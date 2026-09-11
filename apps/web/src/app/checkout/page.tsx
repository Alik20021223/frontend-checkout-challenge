'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import type { CreateOrder, Delivery, Order } from '@checkout/contracts';
import { api } from '@/api';
import { Button } from '@/components/Button';
import { Choice } from '@/components/Choice';
import { EmptyCart } from '@/components/EmptyCart';
import { Field, SelectField } from '@/components/Field';
import { Loading } from '@/components/Loading';
import { Notice } from '@/components/Notice';
import { OrderLines } from '@/components/OrderLines';
import { QueryState } from '@/components/QueryState';
import { describeDeliveryPrice, indexOptions } from '@/lib/delivery';
import { idempotencyKey, releaseIdempotencyKey } from '@/lib/idempotency';
import { readStorage, writeStorage } from '@/lib/storage';
import { useAsync } from '@/lib/useAsync';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useResource } from '@/lib/useResource';
import {
  addressRules,
  customerRules,
  type FieldErrors,
  hasErrors,
  serverFieldErrors,
  validate,
} from '@/lib/validation';
import { useCart } from '@/state/SessionProvider';

type Draft = {
  name: string;
  email: string;
  phone: string;
  method: Delivery['method'];
  pickupPointId: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  paymentMethod: Order['paymentMethod'];
};

type DeliveryFields = Pick<
  Draft,
  'method' | 'pickupPointId' | 'city' | 'street' | 'house' | 'apartment'
>;

const DRAFT_KEY = 'draft';
const ORDER_SCOPE = 'order';
const QUOTE_DEBOUNCE_MS = 400;

const emptyDraft: Draft = {
  name: '',
  email: '',
  phone: '',
  method: 'pickup',
  pickupPointId: '',
  city: '',
  street: '',
  house: '',
  apartment: '',
  paymentMethod: 'card',
};

const formRules = { ...customerRules, ...addressRules };

const retryHints: Record<string, string> = {
  QUOTE_EXPIRED:
    'Расчёт доставки устарел, мы обновили его. Проверьте сумму и подтвердите заказ ещё раз.',
  CART_VERSION_CONFLICT:
    'Корзина изменилась, данные обновлены. Проверьте состав и подтвердите заказ ещё раз.',
  CART_EMPTY: 'В корзине не осталось товаров.',
  VALIDATION_ERROR: 'Проверьте выделенные поля.',
};

function buildDelivery(fields: DeliveryFields): Delivery | null {
  if (fields.method === 'pickup')
    return fields.pickupPointId ? { method: 'pickup', pickupPointId: fields.pickupPointId } : null;
  if (hasErrors(validate(fields, addressRules))) return null;
  const apartment = fields.apartment.trim();
  return {
    method: 'courier',
    address: {
      city: fields.city.trim(),
      street: fields.street.trim(),
      house: fields.house.trim(),
      ...(apartment ? { apartment } : {}),
    },
  };
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, cartError, reloadCart, rememberOrder } = useCart();
  const options = useResource(api.checkoutOptions, []);
  const [draft, setDraft] = useState<Draft>(() => ({
    ...emptyDraft,
    ...readStorage<Partial<Draft>>(DRAFT_KEY),
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const createOrder = useAsync(api.orders.create);

  useEffect(() => writeStorage(DRAFT_KEY, draft), [draft]);

  const { pickupPoints } = useMemo(() => indexOptions(options.data), [options.data]);
  const pointOptions = useMemo(
    () =>
      Array.from(pickupPoints.values(), (point) => ({
        value: point.id,
        label: `${point.title} — ${point.address}`,
      })),
    [pickupPoints],
  );
  const pickupPointId = pickupPoints.has(draft.pickupPointId)
    ? draft.pickupPointId
    : (pointOptions[0]?.value ?? '');

  const { method, city, street, house, apartment } = draft;
  const delivery = useMemo(
    () => buildDelivery({ method, pickupPointId, city, street, house, apartment }),
    [method, pickupPointId, city, street, house, apartment],
  );
  const debouncedDelivery = useDebouncedValue(delivery, QUOTE_DEBOUNCE_MS);

  const cartVersion = cart?.version ?? -1;
  const quoteReady = cart !== null && cart.items.length > 0 && debouncedDelivery !== null;
  const quote = useResource(
    (signal) => api.quotes.create({ cartVersion, delivery: debouncedDelivery as Delivery }, signal),
    [cartVersion, debouncedDelivery],
    { enabled: quoteReady },
  );

  useEffect(() => {
    if (quote.error?.code === 'CART_VERSION_CONFLICT') reloadCart();
  }, [quote.error, reloadCart]);

  const orderError = createOrder.error;
  const reloadQuote = quote.reload;
  useEffect(() => {
    if (!orderError) return;
    if (orderError.code === 'VALIDATION_ERROR') setErrors(serverFieldErrors(orderError, formRules));
    else if (orderError.code === 'QUOTE_EXPIRED') reloadQuote();
    else if (orderError.code === 'CART_VERSION_CONFLICT' || orderError.code === 'CART_EMPTY')
      reloadCart();
  }, [orderError, reloadQuote, reloadCart]);

  function setField<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }
  const update =
    (field: keyof Draft) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setField(field, event.target.value as Draft[typeof field]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(draft, method === 'courier' ? formRules : customerRules);
    setErrors(found);
    if (hasErrors(found) || !quote.data) return;
    const body: CreateOrder = {
      quoteId: quote.data.id,
      paymentMethod: draft.paymentMethod,
      customer: { name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim() },
    };
    const order = await createOrder.run(body, idempotencyKey(ORDER_SCOPE, body));
    if (!order) return;
    releaseIdempotencyKey(ORDER_SCOPE);
    writeStorage(DRAFT_KEY, null);
    rememberOrder(order.id);
    router.push(`/orders/${order.id}`);
    reloadCart();
  };

  if (!cart)
    return cartError ? (
      <Notice kind="error" action={{ label: 'Повторить', onClick: reloadCart }}>
        {cartError.message}
      </Notice>
    ) : (
      <Loading>Загружаем корзину…</Loading>
    );
  if (createOrder.data) return <Loading>Заказ создан, открываем его страницу…</Loading>;
  if (cart.items.length === 0) return <EmptyCart />;

  const pending = createOrder.pending;
  const quoteStale = delivery !== debouncedDelivery || quote.pending;

  return (
    <>
      <h1>Оформление заказа</h1>
      <QueryState query={options} loading="Загружаем способы доставки и оплаты…">
        {({ deliveryMethods, paymentMethods }) => (
          <form className="checkout" onSubmit={submit} noValidate>
            <div className="checkout__form">
              <section className="card">
                <h2>Контакты</h2>
                <Field
                  label="Имя"
                  name="name"
                  autoComplete="name"
                  value={draft.name}
                  onChange={update('name')}
                  error={errors.name}
                  disabled={pending}
                />
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={draft.email}
                  onChange={update('email')}
                  error={errors.email}
                  disabled={pending}
                />
                <Field
                  label="Телефон"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+79990000000"
                  value={draft.phone}
                  onChange={update('phone')}
                  error={errors.phone}
                  disabled={pending}
                />
              </section>

              <section className="card">
                <h2>Доставка</h2>
                <fieldset className="choices">
                  <legend>Способ доставки</legend>
                  {deliveryMethods.map((item) => (
                    <Choice
                      key={item.id}
                      name="method"
                      value={item.id}
                      checked={method === item.id}
                      onChange={(value) => setField('method', value as Delivery['method'])}
                      label={item.title}
                      note={describeDeliveryPrice(item)}
                      disabled={pending}
                    />
                  ))}
                </fieldset>
                {method === 'pickup' ? (
                  <SelectField
                    label="Пункт выдачи"
                    name="pickupPointId"
                    options={pointOptions}
                    value={pickupPointId}
                    onChange={update('pickupPointId')}
                    disabled={pending}
                  />
                ) : (
                  <div className="address">
                    <Field
                      label="Город"
                      name="city"
                      autoComplete="address-level2"
                      value={draft.city}
                      onChange={update('city')}
                      error={errors.city}
                      disabled={pending}
                    />
                    <Field
                      label="Улица"
                      name="street"
                      autoComplete="address-line1"
                      value={draft.street}
                      onChange={update('street')}
                      error={errors.street}
                      disabled={pending}
                    />
                    <Field
                      label="Дом"
                      name="house"
                      value={draft.house}
                      onChange={update('house')}
                      error={errors.house}
                      disabled={pending}
                    />
                    <Field
                      label="Квартира"
                      name="apartment"
                      hint="Необязательно"
                      value={draft.apartment}
                      onChange={update('apartment')}
                      error={errors.apartment}
                      disabled={pending}
                    />
                  </div>
                )}
              </section>

              <section className="card">
                <h2>Оплата</h2>
                <fieldset className="choices">
                  <legend>Способ оплаты</legend>
                  {paymentMethods.map((item) => (
                    <Choice
                      key={item.id}
                      name="paymentMethod"
                      value={item.id}
                      checked={draft.paymentMethod === item.id}
                      onChange={(value) =>
                        setField('paymentMethod', value as Order['paymentMethod'])
                      }
                      label={item.title}
                      disabled={pending}
                    />
                  ))}
                </fieldset>
              </section>
            </div>

            <aside className="card checkout__summary" aria-labelledby="summary-title">
              <h2 id="summary-title">Ваш заказ</h2>
              <OrderLines
                items={cart.items}
                subtotal={cart.subtotal}
                shipping={quote.data?.shipping}
                total={quote.data?.total}
              />
              <div className="checkout__status" aria-live="polite">
                {delivery === null && (
                  <p className="muted">
                    {method === 'courier'
                      ? 'Заполните адрес, чтобы рассчитать доставку.'
                      : 'Выберите пункт выдачи.'}
                  </p>
                )}
                {delivery !== null && quoteStale && <Loading>Рассчитываем доставку…</Loading>}
                {quote.error && (
                  <Notice kind="error" action={{ label: 'Повторить', onClick: quote.reload }}>
                    {quote.error.message}
                  </Notice>
                )}
                {orderError && (
                  <Notice kind="error">{retryHints[orderError.code] ?? orderError.message}</Notice>
                )}
              </div>
              <Button
                type="submit"
                className="checkout__submit"
                pending={pending}
                disabled={quoteStale}
              >
                {draft.paymentMethod === 'card' ? 'Перейти к оплате' : 'Оформить заказ'}
              </Button>
              <p className="muted small">
                <Link href="/cart">Изменить корзину</Link>
              </p>
            </aside>
          </form>
        )}
      </QueryState>
    </>
  );
}

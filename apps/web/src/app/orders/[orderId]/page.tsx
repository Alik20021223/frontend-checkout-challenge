'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Order, Payment, Scenario } from '@checkout/contracts';
import { api, type ApiError } from '@/api';
import { Button } from '@/components/Button';
import { Choice } from '@/components/Choice';
import { Loading } from '@/components/Loading';
import { Notice } from '@/components/Notice';
import { OrderLines } from '@/components/OrderLines';
import { QueryState } from '@/components/QueryState';
import { describeDelivery, indexOptions, type OptionsIndex } from '@/lib/delivery';
import { formatDate, formatMoney } from '@/lib/format';
import { idempotencyKey, releaseIdempotencyKey } from '@/lib/idempotency';
import { useAsync } from '@/lib/useAsync';
import { useResource } from '@/lib/useResource';

// Имитация оплаты отвечает 202 с Retry-After: 1.
const POLL_INTERVAL_MS = 1000;

export default function OrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const order = useResource((signal) => api.orders.get(orderId, signal), [orderId]);
  const options = useResource(api.checkoutOptions, []);
  const index = useMemo(() => indexOptions(options.data), [options.data]);

  return (
    <QueryState query={order} loading="Загружаем заказ…">
      {(data) => <OrderView order={data} index={index} onPaid={order.reload} />}
    </QueryState>
  );
}

type OrderViewProps = { order: Order; index: OptionsIndex; onPaid: () => void };

function OrderView({ order, index, onPaid }: OrderViewProps) {
  const done = order.paymentMethod === 'cash_on_delivery' || order.status === 'paid';

  return (
    <>
      <h1>{done ? 'Заказ оформлен' : 'Оплата заказа'}</h1>
      <p className="muted">
        Номер заказа <strong>{order.number}</strong> от {formatDate(order.createdAt)}
      </p>
      {done ? (
        <Notice kind="success">
          {order.paymentMethod === 'card'
            ? 'Оплата прошла успешно. Спасибо за заказ!'
            : 'Заказ оформлен, оплата при получении.'}
        </Notice>
      ) : (
        <PaymentFlow order={order} onPaid={onPaid} />
      )}
      <div className="order">
        <section className="card">
          <h2>Состав заказа</h2>
          <OrderLines
            items={order.items}
            subtotal={order.subtotal}
            shipping={order.shipping}
            total={order.total}
          />
        </section>
        <section className="card">
          <h2>Доставка и получатель</h2>
          <dl className="details">
            <div>
              <dt>Доставка</dt>
              <dd>{describeDelivery(order.delivery, index.pickupPoints)}</dd>
            </div>
            <div>
              <dt>Оплата</dt>
              <dd>{index.paymentTitles.get(order.paymentMethod) ?? order.paymentMethod}</dd>
            </div>
            <div>
              <dt>Получатель</dt>
              <dd>{order.customer.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{order.customer.email}</dd>
            </div>
            <div>
              <dt>Телефон</dt>
              <dd>{order.customer.phone}</dd>
            </div>
          </dl>
        </section>
      </div>
      <p>
        <Link href="/">Вернуться в каталог</Link>
      </p>
    </>
  );
}

function PaymentFlow({ order, onPaid }: { order: Order; onPaid: () => void }) {
  const attempts = useResource((signal) => api.orders.payments(order.id, signal), [order.id]);

  return (
    <section className="card payment" aria-labelledby="payment-title">
      <h2 id="payment-title">Оплата картой</h2>
      <QueryState query={attempts} loading="Проверяем статус оплаты…">
        {(list) => (
          <PaymentAttempt
            key={list[0]?.id ?? 'new'}
            order={order}
            initial={list[0] ?? null}
            onPaid={onPaid}
            onRefresh={attempts.reload}
          />
        )}
      </QueryState>
    </section>
  );
}

type PaymentAttemptProps = {
  order: Order;
  initial: Payment | null;
  onPaid: () => void;
  onRefresh: () => void;
};

function PaymentAttempt({ order, initial, onPaid, onRefresh }: PaymentAttemptProps) {
  const [attempt, setAttempt] = useState(initial);
  const create = useAsync(api.orders.createPayment);
  const simulate = useAsync(api.payments.simulate);
  const attemptId = attempt?.id ?? '';
  const tracking = useResource((signal) => api.payments.get(attemptId, signal), [attemptId], {
    enabled: attempt?.status === 'processing',
    pollWhile: (payment) => payment.status === 'processing',
    pollIntervalMs: POLL_INTERVAL_MS,
  });
  const current = tracking.data ?? attempt;
  const status = current?.status;

  useEffect(() => {
    if (status === 'succeeded' || create.error?.code === 'ORDER_ALREADY_PAID') onPaid();
  }, [status, create.error, onPaid]);

  // Сценарий уже зафиксирован другим нажатием: остаётся дождаться результата.
  useEffect(() => {
    if (simulate.error?.code === 'PAYMENT_FINALIZED')
      setAttempt((prev) => prev && { ...prev, status: 'processing' });
  }, [simulate.error]);

  const scope = `payment:${order.id}`;
  const start = async () => {
    const payment = await create.run(order.id, idempotencyKey(scope, {}));
    if (!payment) return;
    releaseIdempotencyKey(scope);
    setAttempt(payment);
  };
  const pay = async (scenario: Scenario) => {
    if (!current) return;
    const simulation = await simulate.run(current.id, scenario);
    if (simulation) setAttempt({ ...current, status: simulation.status });
  };

  if (!current || status === 'failed' || status === 'cancelled')
    return (
      <>
        {status === 'failed' && (
          <Notice kind="error">
            Банк отклонил оплату. Попробуйте ещё раз или выберите другую карту.
          </Notice>
        )}
        {status === 'cancelled' && (
          <Notice kind="info">Оплата отменена. Заказ сохранён, его можно оплатить позже.</Notice>
        )}
        {create.error && (
          <Notice kind="error" action={{ label: 'Обновить', onClick: onRefresh }}>
            {create.error.message}
          </Notice>
        )}
        <Button onClick={start} pending={create.pending}>
          {current ? 'Оплатить ещё раз' : `Оплатить ${formatMoney(order.total)}`}
        </Button>
      </>
    );

  if (status === 'pending')
    return (
      <CardForm
        amount={current.amount}
        onPay={pay}
        pending={simulate.pending}
        error={simulate.error}
      />
    );

  return (
    <>
      <Loading>
        {status === 'succeeded'
          ? 'Оплата подтверждена, обновляем заказ…'
          : 'Ждём подтверждение от банка…'}
      </Loading>
      {tracking.error && (
        <Notice kind="error" action={{ label: 'Проверить ещё раз', onClick: tracking.reload }}>
          {tracking.error.message}
        </Notice>
      )}
    </>
  );
}

type CardFormProps = {
  amount: number;
  onPay: (scenario: Scenario) => Promise<void>;
  pending: boolean;
  error: ApiError | null;
};

function CardForm({ amount, onPay, pending, error }: CardFormProps) {
  const sandbox = useResource(api.sandbox, []);
  const [cardId, setCardId] = useState('');
  const [chosen, setChosen] = useState<Scenario | null>(null);

  const choose = (scenario: Scenario) => {
    setChosen(scenario);
    void onPay(scenario);
  };

  return (
    <QueryState query={sandbox} loading="Загружаем тестовые карты…">
      {({ cards }) => {
        const selected = cards.find((card) => card.id === cardId) ?? cards[0];
        return (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (selected) choose(selected.scenario);
            }}
          >
            <p className="muted">
              Это тестовая форма: номер карты и CVC вводить не нужно, выберите карту из списка.
            </p>
            <fieldset className="choices">
              <legend>Карта</legend>
              {cards.map((card) => (
                <Choice
                  key={card.id}
                  name="card"
                  value={card.id}
                  checked={card.id === selected?.id}
                  onChange={setCardId}
                  label={card.title}
                  note={card.maskedNumber}
                  disabled={pending}
                />
              ))}
            </fieldset>
            {error && <Notice kind="error">{error.message}</Notice>}
            <div className="actions">
              <Button type="submit" pending={pending && chosen !== 'cancel'} disabled={!selected}>
                Оплатить {formatMoney(amount)}
              </Button>
              <Button
                variant="secondary"
                onClick={() => choose('cancel')}
                pending={pending && chosen === 'cancel'}
                disabled={pending}
              >
                Отменить оплату
              </Button>
            </div>
          </form>
        );
      }}
    </QueryState>
  );
}

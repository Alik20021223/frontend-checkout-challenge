'use client';

import Link from 'next/link';
import type { CartItem } from '@/api';
import { Button } from '@/components/Button';
import { EmptyCart } from '@/components/EmptyCart';
import { Loading } from '@/components/Loading';
import { Notice } from '@/components/Notice';
import { QuantityControl } from '@/components/QuantityControl';
import { formatMoney, pluralize } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { useCart } from '@/state/SessionProvider';

export default function CartPage() {
  const { cart, cartError, reloadCart } = useCart();

  if (!cart)
    return cartError ? (
      <Notice kind="error" action={{ label: 'Повторить', onClick: reloadCart }}>
        {cartError.message}
      </Notice>
    ) : (
      <Loading>Загружаем корзину…</Loading>
    );
  if (cart.items.length === 0) return <EmptyCart />;

  return (
    <>
      <h1>Корзина</h1>
      {cartError && (
        <Notice kind="error" action={{ label: 'Обновить', onClick: reloadCart }}>
          {cartError.message}
        </Notice>
      )}
      <ul className="cart">
        {cart.items.map((item) => (
          <CartLine key={item.productId} item={item} />
        ))}
      </ul>
      <div className="card cart__footer">
        <p>
          {cart.quantity} {pluralize(cart.quantity, ['товар', 'товара', 'товаров'])} на сумму{' '}
          <strong>{formatMoney(cart.subtotal)}</strong>
        </p>
        <Link href="/checkout" className="button button--primary">
          Оформить заказ
        </Link>
      </div>
    </>
  );
}

function CartLine({ item }: { item: CartItem }) {
  const { changeQuantity } = useCart();
  const remove = useAsync(changeQuantity);

  return (
    <li className="card line">
      <div className="line__info">
        <h2 className="line__title">{item.title}</h2>
        <p className="muted">{formatMoney(item.unitPrice)} за шт.</p>
      </div>
      <QuantityControl productId={item.productId} quantity={item.quantity} label={item.title} />
      <p className="line__total">{formatMoney(item.lineTotal)}</p>
      <div className="line__remove">
        <Button
          variant="ghost"
          size="small"
          onClick={() => void remove.run(item.productId, 0)}
          pending={remove.pending}
          aria-label={`Удалить: ${item.title}`}
        >
          Удалить
        </Button>
        {remove.error && (
          <p className="field__error" role="alert">
            {remove.error.message}
          </p>
        )}
      </div>
    </li>
  );
}

import type { CartItem } from '@/api';
import { formatMoney } from '@/lib/format';

type Props = {
  items: CartItem[];
  subtotal: number;
  shipping?: number | null;
  total?: number | null;
};

const shippingLabel = (shipping: number | null) =>
  shipping === null ? '—' : shipping === 0 ? 'Бесплатно' : formatMoney(shipping);

export function OrderLines({ items, subtotal, shipping = null, total = null }: Props) {
  return (
    <div className="lines">
      <ul className="lines__list">
        {items.map((item) => (
          <li key={item.productId} className="lines__item">
            <span>
              {item.title} <span className="muted">× {item.quantity}</span>
            </span>
            <span>{formatMoney(item.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="lines__totals">
        <div>
          <dt>Товары</dt>
          <dd>{formatMoney(subtotal)}</dd>
        </div>
        <div>
          <dt>Доставка</dt>
          <dd>{shippingLabel(shipping)}</dd>
        </div>
        <div className="lines__total">
          <dt>Итого</dt>
          <dd>{total === null ? '—' : formatMoney(total)}</dd>
        </div>
      </dl>
    </div>
  );
}

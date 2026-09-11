'use client';

import type { Product } from '@checkout/contracts';
import { api, type CartItem } from '@/api';
import { Button } from '@/components/Button';
import { QuantityControl } from '@/components/QuantityControl';
import { QueryState } from '@/components/QueryState';
import { formatMoney } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { useResource } from '@/lib/useResource';
import { useCart } from '@/state/SessionProvider';

export default function CatalogPage() {
  const products = useResource(api.products, []);
  const { cartIndex } = useCart();

  return (
    <>
      <h1>Каталог</h1>
      <QueryState query={products} loading="Загружаем товары…">
        {(list) =>
          list.length === 0 ? (
            <p className="muted">Товаров пока нет.</p>
          ) : (
            <ul className="grid">
              {list.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  inCart={cartIndex.get(product.id)}
                />
              ))}
            </ul>
          )
        }
      </QueryState>
    </>
  );
}

function ProductCard({ product, inCart }: { product: Product; inCart?: CartItem }) {
  const { changeQuantity } = useCart();
  const add = useAsync(changeQuantity);
  const soldOut = product.stock === 0;

  return (
    <li className="card product">
      <div className="product__body">
        <h2 className="product__title">{product.title}</h2>
        <p className="muted">{product.description}</p>
        <p className="product__price">{formatMoney(product.price)}</p>
        <p className="product__stock muted">
          {soldOut ? 'Нет в наличии' : `В наличии: ${product.stock} шт.`}
        </p>
      </div>
      <div className="product__actions">
        {inCart ? (
          <QuantityControl
            productId={product.id}
            quantity={inCart.quantity}
            max={product.stock}
            label={product.title}
          />
        ) : (
          <Button
            onClick={() => void add.run(product.id, 1)}
            pending={add.pending}
            disabled={soldOut}
            aria-label={`В корзину: ${product.title}`}
          >
            {soldOut ? 'Нет в наличии' : 'В корзину'}
          </Button>
        )}
        {add.error && (
          <p className="field__error" role="alert">
            {add.error.message}
          </p>
        )}
      </div>
    </li>
  );
}

import Link from 'next/link';

export function EmptyCart() {
  return (
    <section className="empty">
      <h1>Корзина пуста</h1>
      <p className="muted">Добавьте товары из каталога, чтобы оформить заказ.</p>
      <Link href="/" className="button button--primary">
        Перейти в каталог
      </Link>
    </section>
  );
}

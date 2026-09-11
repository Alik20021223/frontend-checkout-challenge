'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { useCart } from '@/state/SessionProvider';

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const active = usePathname() === href;
  return (
    <li>
      <Link
        href={href}
        className={cx('header__link', active && 'header__link--active')}
        aria-current={active ? 'page' : undefined}
      >
        {children}
      </Link>
    </li>
  );
}

export function Header() {
  const { cart, lastOrderId } = useCart();
  return (
    <header className="header">
      <div className="header__inner">
        <Link href="/" className="header__brand">
          Демо-магазин
        </Link>
        <nav aria-label="Основная навигация">
          <ul className="header__nav">
            <NavLink href="/">Каталог</NavLink>
            <NavLink href="/cart">
              Корзина{cart && cart.quantity > 0 ? ` (${cart.quantity})` : ''}
            </NavLink>
            {lastOrderId && <NavLink href={`/orders/${lastOrderId}`}>Мой заказ</NavLink>}
          </ul>
        </nav>
      </div>
    </header>
  );
}

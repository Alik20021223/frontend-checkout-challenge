import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Header } from '@/components/Header';
import { SessionProvider } from '@/state/SessionProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Демо-магазин',
  description: 'Каталог, корзина, оформление заказа и тестовая оплата',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <SessionProvider>
          <Header />
          <main className="page">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}

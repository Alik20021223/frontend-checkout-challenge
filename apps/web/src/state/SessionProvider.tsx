'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Cart } from '@checkout/contracts';
import { api, type ApiError, type CartItem, ensureSession, onSessionRenewed } from '@/api';
import { Loading } from '@/components/Loading';
import { Notice } from '@/components/Notice';
import { readStorage, writeStorage } from '@/lib/storage';
import { useAsync } from '@/lib/useAsync';
import { useResource } from '@/lib/useResource';

type CartContextValue = {
  cart: Cart | null;
  cartIndex: Map<string, CartItem>;
  cartError: ApiError | null;
  reloadCart: () => void;
  changeQuantity: (productId: string, quantity: number) => Promise<void>;
  lastOrderId: string | null;
  rememberOrder: (orderId: string | null) => void;
};

const ORDER_KEY = 'order';
const CartContext = createContext<CartContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useResource(ensureSession, []);
  const cartQuery = useAsync(api.cart.get);
  const loadCart = cartQuery.run;
  const [lastOrderId, setLastOrderId] = useState(() => readStorage<string>(ORDER_KEY));
  const ready = session.data !== null;

  const rememberOrder = useCallback((orderId: string | null) => {
    writeStorage(ORDER_KEY, orderId);
    setLastOrderId(orderId);
  }, []);

  useEffect(() => {
    if (ready) void loadCart();
  }, [ready, loadCart]);

  // Сессия пересоздаётся после сброса данных на сервере: старый заказ больше не найти.
  useEffect(
    () =>
      onSessionRenewed(() => {
        rememberOrder(null);
        void loadCart();
      }),
    [loadCart, rememberOrder],
  );

  const changeQuantity = useCallback(
    async (productId: string, quantity: number) => {
      if (quantity > 0) await api.cart.setItem(productId, quantity);
      else await api.cart.removeItem(productId);
      await loadCart();
    },
    [loadCart],
  );

  const cart = cartQuery.data;
  const cartIndex = useMemo(() => {
    const index = new Map<string, CartItem>();
    if (cart) for (const item of cart.items) index.set(item.productId, item);
    return index;
  }, [cart]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      cartIndex,
      cartError: cartQuery.error,
      reloadCart: () => void loadCart(),
      changeQuantity,
      lastOrderId,
      rememberOrder,
    }),
    [cart, cartIndex, cartQuery.error, loadCart, changeQuantity, lastOrderId, rememberOrder],
  );

  if (session.error)
    return (
      <main className="page">
        <Notice kind="error" action={{ label: 'Повторить', onClick: session.reload }}>
          {session.error.message}
        </Notice>
      </main>
    );
  if (!ready)
    return (
      <main className="page">
        <Loading>Открываем магазин…</Loading>
      </main>
    );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart можно вызывать только внутри SessionProvider');
  return context;
}

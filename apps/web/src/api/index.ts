import type {
  Cart,
  CreateOrder,
  Order,
  Payment,
  Product,
  Quote,
  Scenario,
  Simulation,
} from '@checkout/contracts';
import { readStorage, writeStorage } from '@/lib/storage';
import { createHttp } from './http';
import type { CartItem, CheckoutOptions, QuoteRequest, Sandbox, Session } from './types';

export { ApiError, toApiError } from './http';
export type * from './types';

const TOKEN_KEY = 'token';
const listeners = new Set<() => void>();
let token: string | null = null;
let renewal: Promise<string> | null = null;

const request = createHttp({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  token: () => (token ??= readStorage<string>(TOKEN_KEY)),
  renewSession,
});

function renewSession() {
  renewal ??= request<Session>('/api/sessions', { method: 'POST', body: {}, auth: false })
    .then((session) => {
      token = session.token;
      writeStorage(TOKEN_KEY, token);
      listeners.forEach((listener) => listener());
      return token;
    })
    .finally(() => {
      renewal = null;
    });
  return renewal;
}

export async function ensureSession() {
  return (token ??= readStorage<string>(TOKEN_KEY)) ?? renewSession();
}

export function onSessionRenewed(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const itemPath = (productId: string) => `/api/cart/items/${encodeURIComponent(productId)}`;

export const api = {
  products: (signal?: AbortSignal) => request<Product[]>('/api/products', { auth: false, signal }),
  sandbox: (signal?: AbortSignal) => request<Sandbox>('/api/sandbox', { auth: false, signal }),
  checkoutOptions: (signal?: AbortSignal) =>
    request<CheckoutOptions>('/api/checkout/options', { signal }),
  cart: {
    get: () => request<Cart>('/api/cart'),
    setItem: (productId: string, quantity: number) =>
      request<CartItem>(itemPath(productId), { method: 'PUT', body: { quantity } }),
    removeItem: (productId: string) => request<void>(itemPath(productId), { method: 'DELETE' }),
  },
  quotes: {
    create: (body: QuoteRequest, signal?: AbortSignal) =>
      request<Quote>('/api/quotes', { method: 'POST', body, signal }),
  },
  orders: {
    get: (orderId: string, signal?: AbortSignal) =>
      request<Order>(`/api/orders/${orderId}`, { signal }),
    create: (body: CreateOrder, idempotencyKey: string) =>
      request<Order>('/api/orders', { method: 'POST', body, idempotencyKey }),
    payments: (orderId: string, signal?: AbortSignal) =>
      request<Payment[]>(`/api/orders/${orderId}/payments`, { signal }),
    createPayment: (orderId: string, idempotencyKey: string) =>
      request<Payment>(`/api/orders/${orderId}/payments`, {
        method: 'POST',
        body: {},
        idempotencyKey,
      }),
  },
  payments: {
    get: (paymentId: string, signal?: AbortSignal) =>
      request<Payment>(`/api/payments/${paymentId}`, { signal }),
    simulate: (paymentId: string, scenario: Scenario) =>
      request<Simulation>(`/api/payments/${paymentId}/simulations`, {
        method: 'POST',
        body: { scenario },
      }),
  },
};

import type { Static } from '@sinclair/typebox';
import type {
  Cart,
  CheckoutOptionsSchema,
  QuoteBody,
  SandboxSchema,
  SessionSchema,
} from '@checkout/contracts';

export type Session = Static<typeof SessionSchema>;
export type CheckoutOptions = Static<typeof CheckoutOptionsSchema>;
export type QuoteRequest = Static<typeof QuoteBody>;
export type Sandbox = Static<typeof SandboxSchema>;
export type TestCard = Sandbox['cards'][number];
export type CartItem = Cart['items'][number];
export type DeliveryMethod = CheckoutOptions['deliveryMethods'][number];
export type PickupPoint = DeliveryMethod['pickupPoints'][number];

import type { Delivery, Order } from '@checkout/contracts';
import type { CheckoutOptions, DeliveryMethod, PickupPoint } from '@/api';
import { formatMoney } from './format';

export type OptionsIndex = {
  pickupPoints: Map<string, PickupPoint>;
  paymentTitles: Map<Order['paymentMethod'], string>;
};

export function indexOptions(options: CheckoutOptions | null): OptionsIndex {
  const pickupPoints = new Map<string, PickupPoint>();
  const paymentTitles = new Map<Order['paymentMethod'], string>();
  if (options) {
    for (const method of options.deliveryMethods)
      for (const point of method.pickupPoints) pickupPoints.set(point.id, point);
    for (const method of options.paymentMethods) paymentTitles.set(method.id, method.title);
  }
  return { pickupPoints, paymentTitles };
}

export function describeDelivery(delivery: Delivery, pickupPoints: Map<string, PickupPoint>) {
  if (delivery.method === 'courier') {
    const { city, street, house, apartment } = delivery.address;
    return `Курьером: ${city}, ${street}, д. ${house}${apartment ? `, кв. ${apartment}` : ''}`;
  }
  const point = pickupPoints.get(delivery.pickupPointId);
  return point
    ? `Самовывоз: ${point.title}, ${point.address}`
    : `Самовывоз, пункт ${delivery.pickupPointId}`;
}

export function describeDeliveryPrice({ price, freeFrom }: DeliveryMethod) {
  if (price === 0) return 'Бесплатно';
  return freeFrom === null
    ? formatMoney(price)
    : `${formatMoney(price)}, бесплатно от ${formatMoney(freeFrom)}`;
}

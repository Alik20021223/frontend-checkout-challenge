'use client';

import { type KeyboardEvent, useState } from 'react';
import { useAsync } from '@/lib/useAsync';
import { useCart } from '@/state/SessionProvider';
import { Button } from './Button';

const MAX_QUANTITY = 99;

type Props = { productId: string; quantity: number; max?: number; label: string };

export function QuantityControl({ productId, quantity, max = MAX_QUANTITY, label }: Props) {
  const { changeQuantity } = useCart();
  const change = useAsync(changeQuantity);
  const [draft, setDraft] = useState<string | null>(null);

  const apply = (next: number) => {
    setDraft(null);
    if (Number.isInteger(next) && next >= 0 && next !== quantity)
      void change.run(productId, Math.min(next, MAX_QUANTITY));
  };
  const commitDraft = () => {
    if (draft !== null) apply(Number(draft));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitDraft();
    }
  };

  return (
    <div className="quantity">
      <div className="quantity__controls" role="group" aria-label={`Количество: ${label}`}>
        <Button
          variant="secondary"
          size="small"
          aria-label="Уменьшить"
          onClick={() => apply(quantity - 1)}
          disabled={change.pending}
        >
          −
        </Button>
        <input
          className="quantity__input"
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          aria-label="Количество"
          value={draft ?? quantity}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={onKeyDown}
          disabled={change.pending}
        />
        <Button
          variant="secondary"
          size="small"
          aria-label="Увеличить"
          onClick={() => apply(quantity + 1)}
          disabled={change.pending || quantity >= max}
        >
          +
        </Button>
      </div>
      {change.error && (
        <p className="field__error" role="alert">
          {change.error.message}
        </p>
      )}
    </div>
  );
}

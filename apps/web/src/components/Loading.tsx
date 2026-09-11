import type { ReactNode } from 'react';

export function Loading({ children = 'Загружаем…' }: { children?: ReactNode }) {
  return (
    <p className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {children}
    </p>
  );
}

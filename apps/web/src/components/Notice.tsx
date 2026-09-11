import type { ReactNode } from 'react';
import { Button } from './Button';

type Props = {
  kind?: 'error' | 'info' | 'success';
  children: ReactNode;
  action?: { label: string; onClick: () => void; pending?: boolean };
};

export function Notice({ kind = 'info', children, action }: Props) {
  return (
    <div className={`notice notice--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <div className="notice__text">{children}</div>
      {action && (
        <Button variant="secondary" size="small" onClick={action.onClick} pending={action.pending}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

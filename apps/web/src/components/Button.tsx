import type { ButtonHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'small' | 'medium';
};

export function Button({
  pending = false,
  variant = 'primary',
  size = 'medium',
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      type={type}
      className={cx('button', `button--${variant}`, size === 'small' && 'button--small', className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

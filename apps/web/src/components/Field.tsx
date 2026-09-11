import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';

type Shell = { label: string; name: string; error?: string; hint?: string; className?: string };

type InputProps = Shell & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name' | 'className'>;

type SelectProps = Shell &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'name' | 'className'> & {
    options: Array<{ value: string; label: string }>;
  };

function controlProps(name: string, error?: string, hint?: string) {
  const id = `field-${name}`;
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return {
    id,
    name,
    messageId,
    className: 'field__control',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': messageId,
  };
}

function FieldShell({
  id,
  messageId,
  label,
  error,
  hint,
  className,
  children,
}: Shell & { id: string; messageId?: string; children: ReactNode }) {
  return (
    <div className={cx('field', error && 'field--invalid', className)}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={messageId} className="field__error">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="field__hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Field({ label, name, error, hint, className, ...input }: InputProps) {
  const { messageId, ...control } = controlProps(name, error, hint);
  return (
    <FieldShell {...{ label, name, error, hint, className, messageId }} id={control.id}>
      <input {...input} {...control} />
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  error,
  hint,
  className,
  options,
  ...select
}: SelectProps) {
  const { messageId, ...control } = controlProps(name, error, hint);
  return (
    <FieldShell {...{ label, name, error, hint, className, messageId }} id={control.id}>
      <select {...select} {...control}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

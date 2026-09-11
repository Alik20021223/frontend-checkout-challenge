import type { ApiError } from '@/api/http';

export type Rule = {
  min?: number;
  max?: number;
  pattern?: RegExp;
  optional?: boolean;
  hint: string;
};

export type FieldErrors = Record<string, string>;

export const customerRules = {
  name: { min: 2, max: 100, hint: 'Укажите имя, от 2 до 100 символов' },
  email: {
    max: 150,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    hint: 'Укажите email в формате name@example.com',
  },
  phone: {
    pattern: /^\+[1-9]\d{9,14}$/,
    hint: 'Телефон в международном формате, например +79990000000',
  },
} satisfies Record<string, Rule>;

export const addressRules = {
  city: { min: 2, max: 100, hint: 'Укажите город' },
  street: { min: 2, max: 150, hint: 'Укажите улицу' },
  house: { min: 1, max: 20, hint: 'Укажите дом' },
  apartment: { max: 20, optional: true, hint: 'Не длиннее 20 символов' },
} satisfies Record<string, Rule>;

export function validate(values: Record<string, string>, rules: Record<string, Rule>) {
  const errors: FieldErrors = {};
  for (const field in rules) {
    const { min = 0, max = Infinity, pattern, optional, hint } = rules[field];
    const value = (values[field] ?? '').trim();
    if (!value) {
      if (!optional) errors[field] = hint;
      continue;
    }
    if (value.length < min || value.length > max || (pattern && !pattern.test(value)))
      errors[field] = hint;
  }
  return errors;
}

export const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0;

// Сервер присылает путь вида body/customer/email; имя поля формы — последний сегмент.
export function serverFieldErrors(error: ApiError, rules: Partial<Record<string, Rule>>) {
  const errors: FieldErrors = {};
  for (const { path, message } of error.fields) {
    const field = path.slice(path.lastIndexOf('/') + 1);
    errors[field] ??= rules[field]?.hint ?? message;
  }
  return errors;
}

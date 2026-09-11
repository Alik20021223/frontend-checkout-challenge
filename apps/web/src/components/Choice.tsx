import { cx } from '@/lib/cx';

type Props = {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: string;
  note?: string;
  disabled?: boolean;
};

export function Choice({ name, value, checked, onChange, label, note, disabled }: Props) {
  return (
    <label className={cx('choice', checked && 'choice--checked')}>
      <input
        className="choice__input"
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        disabled={disabled}
      />
      <span className="choice__label">{label}</span>
      {note && <span className="choice__note">{note}</span>}
    </label>
  );
}

import { useState, type InputHTMLAttributes } from 'react';
import { dateLabel } from '../utils';

export function DateInput({ value, defaultValue, onChange, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [localValue, setLocalValue] = useState(String(defaultValue || ''));
  const current = value === undefined ? localValue : String(value);
  return <span className="date-with-weekday"><input {...props} type="date" value={current} onChange={(event) => { setLocalValue(event.target.value); onChange?.(event); }} />{current && !props.disabled && <small>{dateLabel(current)}</small>}</span>;
}

import { useState } from 'react';
import { dateTimeInputValue, todayDateTimeInputValue } from '../utils';

type Props = {
  name?: string;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  ariaLabel?: string;
  onChange?: (value: string) => void;
};

const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

export function DateTimeInput({ name, value, defaultValue, required, ariaLabel, onChange }: Props) {
  const initial = dateTimeInputValue(value ?? defaultValue) || todayDateTimeInputValue();
  const [localValue, setLocalValue] = useState(initial);
  const current = dateTimeInputValue(value) || localValue;
  const [date = '', time = '00:00'] = current.split('T');
  const [hour = '00', minute = '00'] = time.split(':');

  function update(nextDate: string, nextHour: string, nextMinute: string) {
    const next = nextDate ? `${nextDate}T${nextHour}:${nextMinute}` : '';
    if (value === undefined) setLocalValue(next);
    onChange?.(next);
  }

  return <div className="datetime-24" aria-label={ariaLabel}>
    {name && <input type="hidden" name={name} value={current} />}
    <input aria-label={`${ariaLabel || '일시'} 날짜`} type="date" required={required} min="2000-01-01" max="2100-12-31" value={date} onChange={(event) => update(event.target.value, hour, minute)} />
    <select aria-label={`${ariaLabel || '일시'} 시`} value={hour} onChange={(event) => update(date, event.target.value, minute)}>{hours.map((item) => <option key={item} value={item}>{item}시</option>)}</select>
    <select aria-label={`${ariaLabel || '일시'} 분`} value={minute} onChange={(event) => update(date, hour, event.target.value)}>{minutes.map((item) => <option key={item} value={item}>{item}분</option>)}</select>
  </div>;
}

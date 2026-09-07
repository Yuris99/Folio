import { useEffect, useState } from 'react';

function deadlineTime(value: string): number {
  return new Date(value.includes('T') ? value : `${value}T23:59:59`).getTime();
}

export function DeadlineCountdown({ deadline, compact = false }: { deadline?: string; compact?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!deadline) return null;
  const remaining = deadlineTime(deadline) - now;
  if (remaining <= 0 || remaining > 48 * 60 * 60 * 1000) return null;
  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return <span className={`deadline-timer ${compact ? 'compact' : ''}`}><small>마감까지</small><b>{time}</b></span>;
}

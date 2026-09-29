import { useCallback, useEffect, useRef, useState } from 'react';

export type AutoSaveState = 'saved' | 'waiting' | 'saving' | 'error';

// 값이 바뀌면 잠시 기다렸다가 저장합니다. 창을 닫거나(언마운트) 페이지를 떠날 때 남은 변경을 바로 저장합니다.
export function useAutoSave<T>(value: T, save: (value: T) => Promise<unknown>, { delay = 800, enabled = true }: { delay?: number; enabled?: boolean } = {}) {
  const [state, setState] = useState<AutoSaveState>('saved');
  const serialized = JSON.stringify(value);
  const lastSaved = useRef(serialized);
  const pending = useRef<{ value: T; serialized: string } | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(async (): Promise<void> => {
    if (running.current) await running.current;
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setState('saving');
    running.current = (async () => {
      try {
        await saveRef.current(next.value);
        lastSaved.current = next.serialized;
        setState(pending.current ? 'waiting' : 'saved');
      } catch {
        // 실패한 변경은 다시 대기열에 올려 다음 입력이나 닫을 때 재시도합니다.
        pending.current ??= next;
        setState('error');
      } finally {
        running.current = null;
      }
    })();
    await running.current;
  }, []);

  useEffect(() => {
    if (!enabled || serialized === lastSaved.current) return;
    pending.current = { value, serialized };
    setState('waiting');
    const timer = window.setTimeout(() => void flush(), delay);
    return () => window.clearTimeout(timer);
  }, [serialized, enabled, delay, flush]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (pending.current || running.current) { void flush(); event.preventDefault(); } };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); void flush(); };
  }, [flush]);

  // 다른 항목으로 바꿀 때 새 값을 이미 저장된 기준으로 삼습니다.
  const markSaved = useCallback((next: T) => { lastSaved.current = JSON.stringify(next); pending.current = null; setState('saved'); }, []);

  return { state, flush, markSaved };
}

export function autoSaveLabel(state: AutoSaveState): string {
  return { saved: '자동 저장됨', waiting: '변경됨', saving: '저장 중…', error: '저장 실패 · 다시 시도 중' }[state];
}

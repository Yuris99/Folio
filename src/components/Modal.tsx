import { useEffect, useRef, type ReactNode } from 'react';

const focusable = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, kicker, children, onClose, compact = false, wide = false }: { title: string; kicker: string; children: ReactNode; onClose: () => void; compact?: boolean; wide?: boolean }) {
  const backdrop = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Focus moves in on open and returns to the trigger on close.
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = [...(dialog.current?.querySelectorAll<HTMLElement>(focusable) || [])].find(item => !item.closest('.modal-head'));
    (first || dialog.current)?.focus({ preventScroll: true });
    return () => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Only the topmost dialog reacts, so Escape on a stacked dialog never closes the one beneath it.
      const stack = document.querySelectorAll('.modal-backdrop');
      if (stack[stack.length - 1] !== backdrop.current) return;
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== 'Tab' || !dialog.current) return;
      const items = [...dialog.current.querySelectorAll<HTMLElement>(focusable)].filter(item => item.offsetParent !== null);
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div ref={backdrop} className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialog} tabIndex={-1} className={`modal react-modal ${compact ? 'compact' : ''} ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-body">
          <div className="modal-head"><div><p className="eyebrow">{kicker}</p><h2>{title}</h2></div><button type="button" className="modal-close" aria-label="닫기" onClick={onClose}>×</button></div>
          {children}
        </div>
      </section>
    </div>
  );
}

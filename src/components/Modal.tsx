import { useEffect, type ReactNode } from 'react';

export function Modal({ title, kicker, children, onClose, compact = false, wide = false }: { title: string; kicker: string; children: ReactNode; onClose: () => void; compact?: boolean; wide?: boolean }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal react-modal ${compact ? 'compact' : ''} ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-body">
          <div className="modal-head"><div><p className="eyebrow">{kicker}</p><h2>{title}</h2></div><button type="button" className="modal-close" onClick={onClose}>×</button></div>
          {children}
        </div>
      </section>
    </div>
  );
}

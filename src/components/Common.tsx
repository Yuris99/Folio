import type { ReactNode } from 'react';
import type { View } from '../types';

export function PageHead({ kicker, title, description, actions }: { kicker: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div><p className="eyebrow">{kicker}</p><h1>{title}</h1><p>{description}</p></div>
      {actions || <span className="date-chip">{new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())}</span>}
    </div>
  );
}

export function SupportTabs({ active, navigate }: { active: 'applications' | 'documents'; navigate: (view: View) => void }) {
  return (
    <div className="section-tabs">
      <button className={active === 'applications' ? 'active' : ''} onClick={() => navigate('applications')}>지원 현황</button>
      <button className={active === 'documents' ? 'active' : ''} onClick={() => navigate('documents')}>지원 문서</button>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><strong>{title}</strong><p>{description}</p>{action}</div>;
}

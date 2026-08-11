import { useState } from 'react';
import { api } from '../api';
import { EmptyState, PageHead } from '../components/Common';
import { InterviewModal } from '../components/InterviewModal';
import type { Mutation } from '../hooks/useFolio';
import type { Interview, View, Workspace } from '../types';
import { dateLabel, daysUntil } from '../utils';

export function InterviewsPage({ workspace, navigate, mutate }: { workspace: Workspace; navigate: (view: View) => void; mutate: Mutation }) {
  const [modal, setModal] = useState<{ open: boolean; item?: Interview }>({ open: false });
  async function remove(id: string) {
    if (!window.confirm('이 면접 일정을 삭제할까요?')) return;
    await mutate('면접 일정 삭제', () => api.deleteInterview(id));
  }
  return <>
    <PageHead kicker="INTERVIEWS" title="면접" description="예정된 면접 일정과 준비 메모를 관리합니다." actions={<button className="button primary" onClick={() => setModal({ open: true })}>+ 일정 추가</button>} />
    <article className="card"><div className="section-head"><h2>면접 일정</h2><button className="text-button" onClick={() => navigate('calendar')}>달력 보기 →</button></div>{workspace.interviews.map((item) => <div className="interview-row" key={item.id}><div className="interview-date"><b>{dateLabel(item.date)}</b><br />{daysUntil(item.date) >= 0 ? `D-${daysUntil(item.date)}` : '완료'}</div><div><h3>{item.company} · {item.type}</h3><p>{item.role} · {item.memo || '메모 없음'}</p></div><div className="interview-actions"><button className="button small" onClick={() => setModal({ open: true, item })}>수정</button><button className="row-menu" onClick={() => void remove(item.id)}>×</button></div></div>)}{!workspace.interviews.length && <EmptyState title="등록된 면접 일정이 없습니다." description="면접 일정을 추가하면 달력에도 자동으로 표시됩니다." action={<button className="button primary" onClick={() => setModal({ open: true })}>첫 일정 추가</button>} />}</article>
    {modal.open && <InterviewModal item={modal.item} mutate={mutate} onClose={() => setModal({ open: false })} />}
  </>;
}

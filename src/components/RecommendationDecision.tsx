import { useState } from 'react';
import { Modal } from './Modal';
import { registerReasons, rejectReasons } from '../recommendations';
import type { DiscoveredJob } from '../types';

export type DecisionKind = 'registered' | 'rejected';
export type DecisionPayload = { decision: DecisionKind; reasons: string[]; note: string };

export function RecommendationDecisionModal({ item, kind, busy, error = '', onClose, onSubmit }: { item: DiscoveredJob; kind: DecisionKind; busy: boolean; error?: string; onClose: () => void; onSubmit: (value: DecisionPayload) => void }) {
  const reject = kind === 'rejected';
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const toggle = (reason: string) => setReasons(list => list.includes(reason) ? list.filter(value => value !== reason) : [...list, reason]);
  return <Modal title={reject ? '이 공고 거절하기' : '공고보관함에 등록하기'} kicker={`${item.company || '회사 확인 필요'} · ${item.title}`} compact onClose={onClose}>
    <form className="discovery-settings decision-form" onSubmit={event => { event.preventDefault(); onSubmit({ decision: kind, reasons, note: note.trim() }); }}>
      <p className="discovery-caption">{reject ? '거절한 이유는 다음 추천 분석에 반영됩니다. 거절함에서 언제든 되돌릴 수 있습니다.' : '등록한 이유도 다음 추천 분석에 반영됩니다. 이유는 비워 두어도 됩니다.'}</p>
      <fieldset><legend>{reject ? '거절 이유' : '등록 이유'} (여러 개 선택 가능)</legend>
        <div className="decision-reasons">{(reject ? rejectReasons : registerReasons).map(reason => { const on = reasons.includes(reason); return <button type="button" key={reason} className={on ? 'active' : ''} aria-pressed={on} onClick={() => toggle(reason)}>{on && <span aria-hidden="true">✓ </span>}{reason}</button>; })}</div>
      </fieldset>
      <label>{reject ? '자세한 이유' : '메모'}<textarea value={note} onChange={event => setNote(event.target.value)} rows={3} maxLength={1000} placeholder={reject ? '예: 서울 외 지역, 영업 비중이 높은 직무는 제외하고 싶습니다.' : '예: 데이터 파이프라인 경험을 살릴 수 있는 공고입니다.'} /></label>
      {error && <p className="discovery-notice error" role="alert">{error} 잠시 후 다시 시도해 주세요.</p>}
      <div className="discovery-detail-actions"><button type="button" className="button" onClick={onClose}>취소</button><button className={reject ? 'button danger' : 'button primary'} disabled={busy}>{busy ? '처리 중…' : reject ? '거절하기' : '등록하기'}</button></div>
    </form>
  </Modal>;
}

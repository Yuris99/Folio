import type { FormEvent } from 'react';
import { api } from '../api';
import type { Mutation } from '../hooks/useFolio';
import type { Job } from '../types';
import { todayDateTimeInputValue } from '../utils';
import { Modal } from './Modal';
import { DateTimeInput } from './DateTimeInput';

export function JobCreateModal({ mutate, onClose, onCreated }: { mutate: Mutation; onClose: () => void; onCreated: (job: Job) => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const base = { company: String(data.get('company')), role: String(data.get('role')), deadline: String(data.get('deadline')), url: String(data.get('url')), description: String(data.get('description')) };
    const analysis = await mutate('공고 분석', () => api.analyzeJob(base), false);
    const job = await mutate('공고 저장', () => api.createJob({ ...base, skills: analysis.skills || [] })) as Job;
    onCreated(job);
  }

  return <Modal title="채용 공고 저장" kicker="NEW OPPORTUNITY" onClose={onClose}><form onSubmit={submit}><p className="muted">공고 본문을 붙여 넣으면 핵심 기술을 분석해 저장합니다.</p><div className="form-grid two"><label>회사명<input required name="company" autoFocus /></label><label>직무명<input required name="role" /></label></div><div className="form-grid two"><label>마감 일시 (24시간)<DateTimeInput name="deadline" ariaLabel="마감 일시" defaultValue={todayDateTimeInputValue()} /></label><label>공고 URL<input name="url" type="url" placeholder="https://..." /></label></div><label>채용 공고 본문<textarea required name="description" rows={10} placeholder="주요 업무, 자격 요건, 우대 사항을 붙여 넣으세요." /></label><div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>취소</button><button className="button primary">분석하고 저장</button></div></form></Modal>;
}

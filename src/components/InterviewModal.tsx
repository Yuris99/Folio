import type { FormEvent } from 'react';
import { api } from '../api';
import type { Mutation } from '../hooks/useFolio';
import type { Interview } from '../types';
import { Modal } from './Modal';
import { todayDateTimeInputValue } from '../utils';
import { DateTimeInput } from './DateTimeInput';

export function InterviewModal({ item, mutate, onClose }: { item?: Interview; mutate: Mutation; onClose: () => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = { company: String(data.get('company')), role: String(data.get('role')), date: String(data.get('date')), type: String(data.get('type')), memo: String(data.get('memo')), prepared: item?.prepared || 0 };
    if (item) await mutate('면접 일정 수정', () => api.updateInterview(item.id, payload));
    else await mutate('면접 일정 추가', () => api.createInterview(payload));
    onClose();
  }

  return <Modal title={item ? '면접 일정 수정' : '면접 일정 추가'} kicker="INTERVIEW" compact onClose={onClose}><form onSubmit={submit}>
    <div className="form-grid two"><label>회사명<input required name="company" defaultValue={item?.company || ''} /></label><label>직무명<input required name="role" defaultValue={item?.role || ''} /></label></div>
    <div className="form-grid two"><label>면접 일시 (24시간)<DateTimeInput required name="date" ariaLabel="면접 일시" defaultValue={item?.date || todayDateTimeInputValue()} /></label><label>면접 유형<select name="type" defaultValue={item?.type || '직무 인터뷰'}><option>직무 인터뷰</option><option>기술 면접</option><option>인성 면접</option><option>최종 면접</option><option>과제 전형</option></select></label></div>
    <label>메모<textarea name="memo" rows={4} defaultValue={item?.memo || ''} placeholder="장소, 준비물, 담당자 등을 입력하세요." /></label>
    <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>취소</button><button className="button primary">저장</button></div>
  </form></Modal>;
}

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { api } from '../api';
import type { Mutation } from '../hooks/useFolio';
import type { Attachment, Education, Profile } from '../types';
import { Modal } from './Modal';

export type SectionKey = 'educations' | 'experiences' | 'projects' | 'certifications' | 'languages' | 'awards' | 'activities' | 'militaryServices';
type Item = Record<string, unknown>;
const labels: Record<SectionKey, string> = { educations: '학력', experiences: '경력', projects: '프로젝트', certifications: '자격증', languages: '어학', awards: '수상', activities: '활동·교육', militaryServices: '병역' };
const fields: Record<SectionKey, Array<[string, string]>> = {
  educations: [['school','학교'],['major','전공'],['degree','학위'],['status','상태'],['startDate','입학일'],['endDate','졸업일'],['gpa','전체 학점'],['majorGpa','전공 학점'],['gpaScale','기준 학점'],['description','상세 내용']],
  experiences: [['company','회사'],['department','부서'],['position','직무·직책'],['employmentType','고용 형태'],['startDate','시작일'],['endDate','종료일'],['description','업무 내용'],['achievements','성과']],
  projects: [['name','프로젝트명'],['organization','소속'],['role','역할'],['tech','기술'],['startDate','시작일'],['endDate','종료일'],['url','URL'],['description','상세 내용'],['achievements','성과']],
  certifications: [['name','자격증명'],['issuer','발급기관'],['acquiredDate','취득일'],['credentialId','자격번호']],
  languages: [['name','언어·시험'],['level','등급'],['score','점수'],['acquiredDate','취득일']],
  awards: [['name','수상명'],['issuer','주최기관'],['date','수상일'],['description','상세 내용']],
  activities: [['name','활동·교육명'],['organization','기관'],['role','역할'],['startDate','시작일'],['endDate','종료일'],['description','활동 내용'],['achievements','성과'],['skills','기술·역량']],
  militaryServices: [['branch','군종'],['rank','계급'],['role','보직'],['startDate','입대일'],['endDate','전역일'],['dischargeType','전역 구분'],['description','상세 내용']]
};

export function ResumeDetailModal({ section, index, profile, attachments, mutate, onClose }: { section: SectionKey; index: number; profile: Profile; attachments: Attachment[]; mutate: Mutation; onClose: () => void }) {
  const existing = (profile[section] as unknown as Item[])[index];
  const [draft, setDraft] = useState<Item>({ ...existing });
  const [viewer, setViewer] = useState<Attachment | null>(null);
  const attachmentIds = Array.isArray(draft.attachmentIds) ? draft.attachmentIds as string[] : [];
  const courses = section === 'educations' ? (Array.isArray(draft.courses) ? draft.courses as Education['courses'] : []) || [] : [];
  function change(key: string, value: unknown) { setDraft((current) => ({ ...current, [key]: value })); }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.type !== 'application/pdf' || file.size > 100_000_000) return window.alert('100MB 이하 PDF만 업로드할 수 있습니다.');
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    const item = await mutate('증빙 PDF 업로드', () => api.uploadFile({ name: file.name, type: file.type, data }), false) as Attachment;
    change('attachmentIds', [...attachmentIds, item.id]);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); const next = { ...profile };
    const list = [...(next[section] as unknown as Item[])]; list[index] = { ...draft, verified: Boolean(draft.verified) }; (next[section] as unknown as Item[]) = list;
    await mutate(`${labels[section]} 저장`, () => api.updateProfile(next)); onClose();
  }
  function addCourse() { change('courses', [...courses, { name: '', category: '전공', credits: '', grade: '' }]); }
  function updateCourse(index: number, key: string, value: string) { change('courses', courses.map((course, i) => i === index ? { ...course, [key]: value } : course)); }
  function copyCourses() { const text = courses.map((course) => `[${course.category}] ${course.name} · ${course.credits}학점 · ${course.grade}`).join('\n'); void navigator.clipboard.writeText(text); }
  return <>
    <Modal title={`${labels[section]} 상세`} kicker="RESUME RECORD" onClose={onClose}>
      <form onSubmit={save}><div className="form-grid two">{fields[section].map(([key,label]) => <label className={['description','achievements','skills'].includes(key) ? 'wide' : ''} key={key}>{label}{['description','achievements'].includes(key) ? <textarea rows={4} value={String(draft[key] || '')} onChange={(e) => change(key,e.target.value)} /> : <input value={Array.isArray(draft[key]) ? (draft[key] as string[]).join(', ') : String(draft[key] || '')} onChange={(e) => change(key,key === 'skills' ? e.target.value.split(',').map(x=>x.trim()).filter(Boolean) : e.target.value)} />}</label>)}</div>
        {section === 'educations' && <section className="course-editor"><div className="section-head"><div><h3>수강 과목</h3><p>전공·교양·기타로 분류해 저장하고 복사할 수 있습니다.</p></div><div><button type="button" className="button small" onClick={copyCourses}>과목 복사</button><button type="button" className="button small" onClick={addCourse}>+ 과목</button></div></div>{courses.map((course,index) => <div className="course-row" key={index}><select value={course.category} onChange={(e)=>updateCourse(index,'category',e.target.value)}><option>전공</option><option>교양</option><option>기타</option></select><input placeholder="과목명" value={course.name} onChange={(e)=>updateCourse(index,'name',e.target.value)} /><input placeholder="학점" value={course.credits} onChange={(e)=>updateCourse(index,'credits',e.target.value)} /><input placeholder="성적" value={course.grade} onChange={(e)=>updateCourse(index,'grade',e.target.value)} /><button type="button" onClick={()=>change('courses',courses.filter((_,i)=>i!==index))}>×</button></div>)}</section>}
        <section className="record-files"><div className="section-head"><div><h3>관련 자료</h3><p>성적표, 증명서, 포트폴리오 등 PDF를 항목에 보관합니다.</p></div><label className="button small file-button">PDF 올리기<input hidden type="file" accept="application/pdf" onChange={(e)=>void upload(e)} /></label></div>{attachmentIds.length ? attachmentIds.map((id) => { const file=attachments.find(x=>x.id===id); return file ? <div className="record-file" key={id}><span><b>{file.name}</b><small>{Math.ceil(file.size/1024)}KB</small></span><button type="button" onClick={()=>setViewer(file)}>웹에서 보기</button><button type="button" onClick={()=>change('attachmentIds',attachmentIds.filter(x=>x!==id))}>연결 해제</button></div> : null; }) : <p className="form-help">연결된 자료가 없습니다.</p>}</section>
        <label className="sensitive-check"><input type="checkbox" checked={Boolean(draft.verified)} onChange={(e)=>change('verified',e.target.checked)} /> 원본과 대조해 검수 완료</label>
        <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>취소</button><button className="button primary">저장</button></div>
      </form>
    </Modal>
    {viewer && <div className="pdf-viewer-backdrop"><div className="pdf-viewer"><header><b>{viewer.name}</b><button onClick={()=>setViewer(null)}>닫기</button></header><iframe title={viewer.name} src={api.fileUrl(viewer.id)} /></div></div>}
  </>;
}

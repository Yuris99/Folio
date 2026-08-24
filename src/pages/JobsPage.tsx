import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { EmptyState, PageHead } from '../components/Common';
import { Modal } from '../components/Modal';
import type { Mutation } from '../hooks/useFolio';
import type { Job, View, Workspace } from '../types';
import { dateLabel, daysUntil } from '../utils';

function CompanyAnalysisPanel({ analysis }: { analysis: NonNullable<Job['companyAnalysis']> }) {
  const sections: Array<[string,string[]]> = [['사업·제품',analysis.products],['조직문화',analysis.culture],['최근 이슈',analysis.recentTopics],['주요 업무',analysis.roleResponsibilities],['자격 요건',analysis.requirements],['우대 사항',analysis.preferred],['내 적합 근거',analysis.fitEvidence],['보완·확인 사항',analysis.gaps],['면접 예상 주제',analysis.interviewTopics]];
  return <section className="company-analysis"><div className="section-head"><div><p className="eyebrow">COMPANY & ROLE ANALYSIS</p><h2>기업·직무 분석</h2></div><small>{analysis.analyzedAt?.slice(0,10)} 기준</small></div><article className="analysis-overview"><h3>기업 개요</h3><p>{analysis.overview||'내용 없음'}</p>{analysis.industry&&<b>{analysis.industry}</b>}</article><div className="analysis-grid">{sections.filter(([,items])=>items.length).map(([title,items])=><article key={title}><h3>{title}</h3><ul>{items.map((item,index)=><li key={`${item}-${index}`}>{item}</li>)}</ul></article>)}</div>{analysis.sources.length>0&&<div className="analysis-sources"><h3>출처</h3>{analysis.sources.map((source,index)=><a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer">{source.title||source.url}</a>)}</div>}</section>;
}

export function JobsPage({ workspace, navigate, mutate }: { workspace: Workspace; navigate: (view: View) => void; mutate: Mutation }) {
  const [selectedId, setSelectedId] = useState('');
  const [creating, setCreating] = useState(false);
  const selected = workspace.jobs.find((item) => item.id === selectedId);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const base = { company: String(data.get('company')), role: String(data.get('role')), deadline: String(data.get('deadline')), url: String(data.get('url')), description: String(data.get('description')) };
    const analysis = await mutate('공고 분석', () => api.analyzeJob(base), false);
    const job = await mutate('공고 저장', () => api.createJob({ ...base, skills: analysis.skills || [] })) as Job;
    setSelectedId(job.id);
    setCreating(false);
  }

  async function createApplication(job: Job) {
    if (workspace.applications.some((item) => item.jobId === job.id)) { window.alert('이미 지원 관리에 등록된 공고입니다.'); navigate('applications'); return; }
    await mutate('지원 추가', () => api.createApplication({ jobId: job.id, company: job.company, role: job.role, status: '관심', appliedAt: '', deadline: job.deadline, nextProcess: '서류 제출', nextDate: '', next: '서류 제출', url: job.url, memo: '' }));
    navigate('applications');
  }

  if (selected) {
    const requirements = selected.skills.map((skill) => ({ skill, evidence: workspace.careerFacts.find((fact) => fact.status === 'verified' && fact.skills.some((item) => item.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(item.toLowerCase()))) }));
    return <><button className="text-button" onClick={() => setSelectedId('')}>← 공고 목록</button><div className="detail-hero" style={{ marginTop: 18 }}><p className="eyebrow">JOB POSTING</p><h2>{selected.company} · {selected.role}</h2><p>{dateLabel(selected.deadline)} 마감 · 저장된 공고 원문</p><div className="detail-meta">{selected.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></div><div className="grid dashboard-grid"><article className="card"><div className="section-head"><h2>주요 요구사항</h2></div><div className="requirements">{requirements.map((item) => <div className="requirement" key={item.skill}><span>•</span><div><b>{item.skill}</b><small style={{ display: 'block', marginTop: 4 }}>{item.evidence ? `확인된 경험: ${item.evidence.title}` : '연결할 커리어 데이터가 없습니다.'}</small></div></div>)}</div></article><article className="card"><div className="section-head"><h2>공고 원문</h2></div><p className="muted job-description">{selected.description}</p><div className="detail-actions"><button className="button primary" onClick={() => void createApplication(selected)}>지원 건 만들기</button><button className="button" onClick={() => navigate('career')}>LLM용 커리어 데이터 열기</button></div></article></div>{selected.companyAnalysis && <CompanyAnalysisPanel analysis={selected.companyAnalysis} />}</>;
  }

  return <>
    <PageHead kicker="JOB ARCHIVE" title="공고 보관함" description="관심 있는 공고 원문을 저장하고 지원으로 전환합니다." actions={<button className="button primary" onClick={() => setCreating(true)}>+ 공고 저장</button>} />
    {workspace.jobs.length ? <div className="grid list-grid">{workspace.jobs.map((job) => <button className="card posting-card posting-button" key={job.id} onClick={() => setSelectedId(job.id)}><div className="section-head"><div className="company-logo">{job.company[0]}</div><span className="deadline">{daysUntil(job.deadline) >= 0 ? `D-${daysUntil(job.deadline)}` : '마감'}</span></div><h3>{job.company}</h3><strong>{job.role}</strong><p>{job.description.slice(0, 110)}{job.description.length > 110 ? '…' : ''}</p><div className="tag-row">{job.skills.slice(0, 4).map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></button>)}</div> : <EmptyState title="저장한 공고가 없습니다." description="공고 본문을 붙여 넣으면 핵심 기술을 정리하고 지원 기록으로 연결할 수 있습니다." action={<button className="button primary" onClick={() => setCreating(true)}>첫 공고 저장</button>} />}
    {creating && <Modal title="채용 공고 저장" kicker="NEW OPPORTUNITY" onClose={() => setCreating(false)}><form onSubmit={create}><p className="muted">공고 본문을 붙여 넣으면 핵심 기술을 분석해 저장합니다.</p><div className="form-grid two"><label>회사명<input required name="company" /></label><label>직무명<input required name="role" /></label></div><div className="form-grid two"><label>마감일<input name="deadline" type="date" /></label><label>공고 URL<input name="url" type="url" placeholder="https://..." /></label></div><label>채용 공고 본문<textarea required name="description" rows={10} placeholder="주요 업무, 자격 요건, 우대 사항을 붙여 넣으세요." /></label><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setCreating(false)}>취소</button><button className="button primary">분석하고 저장</button></div></form></Modal>}
  </>;
}

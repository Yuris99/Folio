import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../api';
import { normalizeProfile } from '../defaults';
import { Modal } from '../components/Modal';
import type { Mutation } from '../hooks/useFolio';
import type { Profile, Workspace } from '../types';

type ListKey = 'educations' | 'experiences' | 'projects' | 'certifications' | 'languages' | 'awards';
type Field = { key: string; label: string; type?: string; placeholder?: string; wide?: boolean; textarea?: boolean };
type Section = { key: ListKey; title: string; description: string; fields: Field[] };

const sections: Section[] = [
  { key: 'educations', title: '학력', description: '학교별 재학 기간과 학위 정보를 입력하세요.', fields: [
    { key: 'school', label: '학교명', placeholder: '예: 한국대학교' }, { key: 'major', label: '전공', placeholder: '예: 컴퓨터공학과' }, { key: 'degree', label: '학위 · 과정', placeholder: '학사 / 전문학사 / 고등학교' }, { key: 'status', label: '상태', placeholder: '졸업 / 재학 / 수료' }, { key: 'startDate', label: '입학', type: 'month' }, { key: 'endDate', label: '졸업(예정)', type: 'month' }, { key: 'gpa', label: '학점', placeholder: '3.8 / 4.5' }, { key: 'description', label: '세부 내용', textarea: true, wide: true, placeholder: '복수전공, 주요 수강과목, 학회 활동 등' }
  ] },
  { key: 'experiences', title: '경력', description: '회사별 업무와 성과를 최신 순으로 입력하세요.', fields: [
    { key: 'company', label: '회사명' }, { key: 'department', label: '부서 · 팀' }, { key: 'position', label: '직급 · 직책' }, { key: 'employmentType', label: '고용 형태', placeholder: '정규직 / 인턴 / 프리랜서' }, { key: 'startDate', label: '시작', type: 'month' }, { key: 'endDate', label: '종료', placeholder: '재직 중 또는 2025.02' }, { key: 'description', label: '담당 업무', textarea: true, wide: true, placeholder: '업무와 책임 범위를 구체적으로 적으세요.' }, { key: 'achievements', label: '주요 성과', textarea: true, wide: true, placeholder: '수치, 개선 결과, 기여도를 적으세요.' }
  ] },
  { key: 'projects', title: '프로젝트', description: '문제, 역할, 기술, 결과가 드러나도록 정리하세요.', fields: [
    { key: 'name', label: '프로젝트명' }, { key: 'organization', label: '소속 · 발주처' }, { key: 'role', label: '역할' }, { key: 'tech', label: '기술 스택', placeholder: 'React, TypeScript, AWS' }, { key: 'startDate', label: '시작', type: 'month' }, { key: 'endDate', label: '종료', type: 'month' }, { key: 'url', label: '프로젝트 URL', type: 'url', placeholder: 'https://...' }, { key: 'description', label: '프로젝트 설명', textarea: true, wide: true }, { key: 'achievements', label: '성과 · 결과', textarea: true, wide: true }
  ] },
  { key: 'certifications', title: '자격증', description: '직무와 관련된 자격과 수료 정보를 입력하세요.', fields: [
    { key: 'name', label: '자격증명' }, { key: 'issuer', label: '발급 기관' }, { key: 'acquiredDate', label: '취득일', type: 'date' }, { key: 'credentialId', label: '자격 번호' }
  ] },
  { key: 'languages', title: '어학', description: '언어 활용 수준과 공인 성적을 입력하세요.', fields: [
    { key: 'name', label: '언어 · 시험', placeholder: '영어 · OPIc' }, { key: 'level', label: '활용 수준' }, { key: 'score', label: '점수 · 등급' }, { key: 'acquiredDate', label: '취득일', type: 'date' }
  ] },
  { key: 'awards', title: '수상 · 대외활동', description: '수상, 대외활동, 봉사활동 등을 입력하세요.', fields: [
    { key: 'name', label: '수상 · 활동명' }, { key: 'issuer', label: '주최 기관' }, { key: 'date', label: '일자', type: 'date' }, { key: 'description', label: '세부 내용', textarea: true, wide: true }
  ] }
];

function RepeatSection({ section, profile, onAdd, onRemove, onChange }: { section: Section; profile: Profile; onAdd: () => void; onRemove: (index: number) => void; onChange: (index: number, field: string, value: string) => void }) {
  const items = profile[section.key] as unknown as Array<Record<string, string>>;
  return <section className="resume-section"><div className="section-head resume-section-title"><div><h2>{section.title}</h2><p>{section.description}</p></div><button className="text-button" type="button" onClick={onAdd}>+ {section.title} 추가</button></div><div className="resume-entry-list">{items.map((item, index) => <article className="resume-entry" key={`${section.key}-${index}`}><div className="resume-entry-head"><strong>{item[section.fields[0].key] || `${section.title} ${index + 1}`}</strong><button type="button" onClick={() => onRemove(index)}>삭제</button></div><div className="resume-entry-grid">{section.fields.map((field) => <label className={field.wide ? 'wide' : ''} key={field.key}>{field.label}{field.textarea ? <textarea rows={3} value={item[field.key] || ''} placeholder={field.placeholder} onChange={(event) => onChange(index, field.key, event.target.value)} /> : <input type={field.type || 'text'} value={item[field.key] || ''} placeholder={field.placeholder} onChange={(event) => onChange(index, field.key, event.target.value)} />}</label>)}</div></article>)}{!items.length && <div className="resume-empty">{section.title} 정보가 없습니다. 이력서를 보며 한 항목씩 추가하세요.</div>}</div></section>;
}

export function ProfilePage({ workspace, mutate, onDeleteAccount }: { workspace: Workspace; mutate: Mutation; onDeleteAccount: () => Promise<void> }) {
  const [profile, setProfile] = useState(() => normalizeProfile(workspace.profile));
  const [dirty, setDirty] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  useEffect(() => { if (!dirty) setProfile(normalizeProfile(workspace.profile)); }, [workspace.profile, dirty]);
  const completion = useMemo(() => {
    const present = [profile.name, profile.role, profile.email, profile.phone, profile.target, profile.summary, profile.skills.length, profile.educations.some((item) => item.school), [...profile.experiences, ...profile.projects].some((item) => Object.values(item).some(Boolean)), workspace.attachments.length];
    return Math.round(present.filter(Boolean).length / present.length * 100);
  }, [profile, workspace.attachments.length]);

  function update(key: keyof Profile, value: string) { setDirty(true); setProfile((current) => ({ ...current, [key]: value })); }
  function changeList(section: ListKey, index: number, field: string, value: string) {
    setDirty(true);
    setProfile((current) => {
      const items = [...current[section]] as unknown as Array<Record<string, string>>;
      items[index] = { ...items[index], [field]: value };
      return { ...current, [section]: items } as Profile;
    });
  }
  function addList(section: ListKey) { setDirty(true); setProfile((current) => ({ ...current, [section]: [...current[section], {}] } as Profile)); }
  function removeList(section: ListKey, index: number) { setDirty(true); setProfile((current) => ({ ...current, [section]: current[section].filter((_, itemIndex) => itemIndex !== index) } as Profile)); }

  async function save(event: FormEvent) {
    event.preventDefault();
    const first = profile.educations[0];
    const payload = { ...profile, links: [profile.github, profile.portfolio, profile.blog, profile.linkedin].filter(Boolean), education: first ? [first.school, first.major].filter(Boolean).join(' · ') : '', period: first ? [first.startDate, first.endDate].filter(Boolean).join(' — ') : '' };
    await mutate('이력서 저장', () => api.updateProfile(payload));
    setDirty(false);
  }

  async function addStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await mutate('경험 저장', () => api.createCareerStory({ title: String(data.get('title')), role: String(data.get('role')), skills: String(data.get('skills')).split(',').map((item) => item.trim()).filter(Boolean), summary: String(data.get('summary')) }));
    setStoryOpen(false);
  }

  async function upload(file?: File) {
    if (!file) return;
    if (file.type !== 'application/pdf') { window.alert('PDF 파일만 업로드할 수 있습니다.'); return; }
    if (file.size > 5_000_000) { window.alert('파일은 5MB 이하여야 합니다.'); return; }
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    await mutate('PDF 업로드', () => api.uploadFile({ name: file.name, type: file.type, data }));
  }

  async function deleteFile(id: string) { if (window.confirm('이 PDF를 삭제할까요?')) await mutate('PDF 삭제', () => api.deleteFile(id)); }
  async function deleteAccount() { if (window.prompt('계정과 모든 데이터를 삭제합니다. 계속하려면 "탈퇴"를 입력하세요.') === '탈퇴') await onDeleteAccount(); }

  return <>
    <div className="page-head"><div><p className="eyebrow">MY INFORMATION</p><h1>내 이력서</h1><p>입사 지원서에 반복해서 입력할 정보를 이력서 순서대로 관리합니다.</p></div></div>
    <form className="resume-sheet" onSubmit={save}>
      <section className="resume-header"><div className="resume-avatar">{profile.name[0] || '나'}</div><div><input value={profile.name} onChange={(event) => update('name', event.target.value)} placeholder="이름" aria-label="이름" /><input className="role-input" value={profile.role} onChange={(event) => update('role', event.target.value)} placeholder="희망 직무" aria-label="희망 직무" /></div><div className="resume-save"><span>완성도 <b>{completion}%</b></span><button className="button primary">전체 저장</button></div></section>
      <section className="resume-section"><div className="resume-section-title"><h2>기본 정보</h2><p>이력서 상단에 쓰는 인적 · 연락처 정보입니다.</p></div><div className="resume-fields"><label>영문명<input value={profile.englishName} onChange={(event) => update('englishName', event.target.value)} placeholder="HONG GILDONG" /></label><label>생년월일<input type="date" value={profile.birthDate} onChange={(event) => update('birthDate', event.target.value)} /></label><label>이메일<input type="email" value={profile.email} onChange={(event) => update('email', event.target.value)} /></label><label>연락처<input value={profile.phone} onChange={(event) => update('phone', event.target.value)} /></label><label>거주 지역<input value={profile.location} onChange={(event) => update('location', event.target.value)} /></label><label>주소<input value={profile.address} onChange={(event) => update('address', event.target.value)} placeholder="필요한 경우만 입력" /></label></div></section>
      <section className="resume-section"><div className="resume-section-title"><h2>지원 요약</h2><p>채용 담당자가 가장 먼저 볼 핵심 정보입니다.</p></div><div className="resume-fields"><label className="wide">한 줄 소개<input value={profile.target} onChange={(event) => update('target', event.target.value)} placeholder="나를 가장 잘 설명하는 한 문장" /></label><label className="wide">자기소개 요약<textarea rows={5} value={profile.summary} onChange={(event) => update('summary', event.target.value)} placeholder="주요 경력, 강점, 업무 방식을 3~5문장으로 정리하세요." /></label></div></section>
      <section className="resume-section"><div className="resume-section-title"><h2>희망 조건</h2><p>지원 방향을 정리할 때 사용하는 선택 정보입니다.</p></div><div className="resume-fields"><label>고용 형태<input value={profile.employmentType} onChange={(event) => update('employmentType', event.target.value)} /></label><label>희망 근무지<input value={profile.desiredLocation} onChange={(event) => update('desiredLocation', event.target.value)} /></label><label>희망 연봉<input value={profile.salary} onChange={(event) => update('salary', event.target.value)} /></label><label>입사 가능일<input type="date" value={profile.availableDate} onChange={(event) => update('availableDate', event.target.value)} /></label></div></section>
      {sections.slice(0, 3).map((section) => <RepeatSection key={section.key} section={section} profile={profile} onAdd={() => addList(section.key)} onRemove={(index) => removeList(section.key, index)} onChange={(index, field, value) => changeList(section.key, index, field, value)} />)}
      <section className="resume-section"><div className="resume-section-title"><h2>기술 · 역량</h2><p>쉼표로 구분해 입력하세요.</p></div><input value={profile.skills.join(', ')} onChange={(event) => { setDirty(true); setProfile((current) => ({ ...current, skills: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })); }} placeholder="React, TypeScript, Java, Spring, AWS" /><div className="tag-row profile-tags">{profile.skills.map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></section>
      {sections.slice(3).map((section) => <RepeatSection key={section.key} section={section} profile={profile} onAdd={() => addList(section.key)} onRemove={(index) => removeList(section.key, index)} onChange={(index, field, value) => changeList(section.key, index, field, value)} />)}
      <section className="resume-section"><div className="resume-section-title"><h2>링크</h2><p>채용 담당자가 확인할 온라인 자료입니다.</p></div><div className="resume-fields"><label>GitHub<input type="url" value={profile.github} onChange={(event) => update('github', event.target.value)} placeholder="https://github.com/..." /></label><label>포트폴리오<input type="url" value={profile.portfolio} onChange={(event) => update('portfolio', event.target.value)} /></label><label>기술 블로그<input type="url" value={profile.blog} onChange={(event) => update('blog', event.target.value)} /></label><label>LinkedIn<input type="url" value={profile.linkedin} onChange={(event) => update('linkedin', event.target.value)} /></label></div></section>
      <section className="resume-section"><div className="section-head resume-section-title"><div><h2>경력 소재</h2><p>AI 지원서 초안에 사용할 구체적인 경험을 관리합니다.</p></div><button className="text-button" type="button" onClick={() => setStoryOpen(true)}>+ 경험 추가</button></div>{workspace.stories.map((story) => <article className="resume-experience" key={story.id}><div><strong>{story.title}</strong><small>{story.role}</small></div><p>{story.summary}</p><div className="tag-row">{story.skills.map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></article>)}{!workspace.stories.length && <div className="resume-empty">저장한 경험 소재가 없습니다.</div>}</section>
      <section className="resume-section"><div className="section-head resume-section-title"><div><h2>이력서 · 포트폴리오 파일</h2><p>PDF 파일을 최대 5MB까지 저장할 수 있습니다.</p></div><label className="text-button file-button">+ PDF 추가<input type="file" accept="application/pdf" hidden onChange={(event) => void upload(event.target.files?.[0])} /></label></div><div className="asset-list uploaded-assets">{workspace.attachments.map((file) => <div className="asset-item" key={file.id}><button type="button" onClick={() => window.open(api.fileUrl(file.id), '_blank', 'noopener')}><span>PDF</span><div><strong>{file.name}</strong><small>{Math.ceil(file.size / 1024)} KB · 업로드됨</small></div><i>열기</i></button><button type="button" className="asset-delete" onClick={() => void deleteFile(file.id)}>×</button></div>)}{!workspace.attachments.length && <p className="muted">업로드한 PDF가 없습니다.</p>}</div></section>
      <section className="resume-section data-management"><div><h2>데이터 관리</h2><p>내 데이터를 내려받거나 계정과 저장 파일을 영구 삭제합니다.</p></div><div className="data-actions"><button type="button" className="button" onClick={() => window.location.assign(api.exportUrl())}>데이터 내보내기</button><button type="button" className="button danger" onClick={() => void deleteAccount()}>계정 탈퇴</button></div></section>
    </form>
    {storyOpen && <Modal title="경력 소재 추가" kicker="CAREER STORY" compact onClose={() => setStoryOpen(false)}><form onSubmit={addStory}><label>경험 제목<input required name="title" /></label><label>역할 · 소속<input required name="role" /></label><label>핵심 기술과 역량<input required name="skills" placeholder="React, TypeScript, 협업" /></label><label>성과와 배운 점<textarea required name="summary" rows={5} /></label><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setStoryOpen(false)}>취소</button><button className="button primary">저장</button></div></form></Modal>}
  </>;
}

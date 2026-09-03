import { useMemo, useState, type FormEvent } from 'react';
import { api } from '../api';
import { Modal } from '../components/Modal';
import { ResumeDetailModal, type SectionKey } from '../components/ResumeDetailModal';
import type { Mutation } from '../hooks/useFolio';
import type { Attachment, CareerFact, CareerFactCategory, CareerFactStatus, CareerSource, Profile, Workspace } from '../types';

type VaultTab = 'sources' | 'facts' | 'export';

const categories: Array<{ value: CareerFactCategory; label: string }> = [
  { value: 'profile', label: '기본 정보' }, { value: 'education', label: '학력' }, { value: 'experience', label: '경력' },
  { value: 'project', label: '프로젝트' }, { value: 'skill', label: '기술' }, { value: 'certification', label: '자격증' },
  { value: 'language', label: '어학' }, { value: 'activity', label: '수상·활동' }, { value: 'other', label: '기타' }
];
const categoryLabel = Object.fromEntries(categories.map((item) => [item.value, item.label])) as Record<CareerFactCategory, string>;
const sourceTypeLabel = { resume: '이력서', portfolio: '포트폴리오', 'career-note': '경력 메모' } as const;

function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function copyText(content: string) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(content);
  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function createMarkdown(workspace: Workspace, includeSensitive: boolean, includeReview: boolean) {
  const facts = workspace.careerFacts.filter((fact) => fact.status === 'verified' || (includeReview && fact.status === 'review')).filter((fact) => includeSensitive || !fact.sensitive);
  const profile = workspace.profile;
  const lines = ['# 나의 커리어 데이터', '', '> 이 문서는 Folio에서 검증한 정보를 LLM에 전달하기 위한 자료입니다.', '', '## 기본 정보', `- 이름: ${profile.name || '미입력'}`, `- 희망 직무: ${profile.role || '미입력'}`];
  if (profile.target) lines.push(`- 한 줄 소개: ${profile.target}`);
  if (profile.skills.length) lines.push(`- 핵심 기술: ${profile.skills.join(', ')}`);
  if (includeSensitive) {
    if (profile.email) lines.push(`- 이메일: ${profile.email}`);
    if (profile.phone) lines.push(`- 연락처: ${profile.phone}`);
    if (profile.location) lines.push(`- 거주 지역: ${profile.location}`);
  }
  if (profile.summary) lines.push('', '### 요약', profile.summary);
  const structured = [
    ['학력', profile.educations.map((item) => `- ${item.school}${item.major ? ` · ${item.major}` : ''}${item.degree ? ` · ${item.degree}` : ''} (${[item.startDate, item.endDate].filter(Boolean).join(' ~ ')})${item.description ? `\n  ${item.description}` : ''}`)],
    ['경력', profile.experiences.map((item) => `- ${item.company}${item.position ? ` · ${item.position}` : ''} (${[item.startDate, item.endDate].filter(Boolean).join(' ~ ')})${item.description ? `\n  ${item.description}` : ''}${item.achievements ? `\n  성과: ${item.achievements}` : ''}`)],
    ['프로젝트', profile.projects.map((item) => `- ${item.name}${item.role ? ` · ${item.role}` : ''} (${[item.startDate, item.endDate].filter(Boolean).join(' ~ ')})${item.description ? `\n  ${item.description}` : ''}${item.achievements ? `\n  성과: ${item.achievements}` : ''}`)],
    ['자격증', profile.certifications.map((item) => `- ${item.name}${item.issuer ? ` · ${item.issuer}` : ''}${item.acquiredDate ? ` (${item.acquiredDate})` : ''}`)],
    ['어학', profile.languages.map((item) => `- ${item.name}${item.level ? ` · ${item.level}` : ''}${item.score ? ` · ${item.score}` : ''}`)],
    ['수상', profile.awards.map((item) => `- ${item.name}${item.issuer ? ` · ${item.issuer}` : ''}${item.date ? ` (${item.date})` : ''}${item.description ? `\n  ${item.description}` : ''}`)]
    ,['활동·교육', profile.activities.map((item) => `- ${item.name}${item.organization ? ` · ${item.organization}` : ''} (${[item.startDate, item.endDate].filter(Boolean).join(' ~ ')})${item.description ? `\n  ${item.description}` : ''}`)]
    ,['병역', profile.militaryServices.map((item) => `- ${[item.branch, item.rank, item.role].filter(Boolean).join(' · ')} (${[item.startDate, item.endDate].filter(Boolean).join(' ~ ')})${item.description ? `\n  ${item.description}` : ''}`)]
  ] as const;
  for (const [title, items] of structured) if (items.length) lines.push('', `## ${title}`, ...items);
  for (const category of categories.filter((item) => item.value !== 'profile')) {
    const items = facts.filter((fact) => fact.category === category.value);
    if (!items.length) continue;
    lines.push('', `## ${category.label}`);
    for (const fact of items) {
      lines.push('', `### ${fact.title}`);
      if (fact.organization) lines.push(`- 소속·기관: ${fact.organization}`);
      if (fact.period) lines.push(`- 기간: ${fact.period}`);
      if (fact.description) lines.push(`- 내용: ${fact.description}`);
      if (fact.achievements) lines.push(`- 성과: ${fact.achievements}`);
      if (fact.skills.length) lines.push(`- 기술·역량: ${fact.skills.join(', ')}`);
      const sources = fact.sourceIds.map((id) => workspace.careerSources.find((source) => source.id === id)?.name).filter(Boolean);
      if (sources.length) lines.push(`- 출처: ${sources.join(', ')}`);
      if (fact.status !== 'verified') lines.push('- 확인 상태: 검토 필요');
    }
  }
  lines.push('', '## LLM 사용 규칙', '- 위 데이터에 있는 사실만 사용합니다.', '- 날짜, 수치, 회사명과 기술을 임의로 만들거나 과장하지 않습니다.', '- 필요한 정보가 없거나 서로 충돌하면 먼저 사용자에게 질문합니다.', '- 결과물을 작성하기 전에 어떤 경험을 사용할지 간단히 제안합니다.');
  return lines.join('\n');
}

function createJson(workspace: Workspace, includeSensitive: boolean, includeReview: boolean) {
  const source = workspace.profile;
  const profile = { name: source.name, englishName: source.englishName, role: source.role, target: source.target, summary: source.summary, location: source.location, skills: source.skills, links: { github: source.github, portfolio: source.portfolio, blog: source.blog, linkedin: source.linkedin }, educations: source.educations, experiences: source.experiences, projects: source.projects, certifications: source.certifications, languages: source.languages, awards: source.awards, activities: source.activities, militaryServices: source.militaryServices, ...(includeSensitive ? { email: source.email, phone: source.phone, birthDate: source.birthDate, address: source.address } : {}) };
  const facts = workspace.careerFacts.filter((fact) => fact.status === 'verified' || (includeReview && fact.status === 'review')).filter((fact) => includeSensitive || !fact.sensitive);
  return JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), profile, facts: facts.map((fact) => ({ ...fact, sourceNames: fact.sourceIds.map((id) => workspace.careerSources.find((source) => source.id === id)?.name).filter(Boolean) })), instructions: ['등록된 사실만 사용', '정보가 없거나 충돌하면 질문', '수치와 날짜를 추측하지 않음'] }, null, 2);
}

export function ProfilePage({ workspace, mutate, onDeleteAccount }: { workspace: Workspace; mutate: Mutation; onDeleteAccount: () => Promise<void> }) {
  const [tab, setTab] = useState<VaultTab>('facts');
  const [guideOpen, setGuideOpen] = useState(false);
  const [textSourceOpen, setTextSourceOpen] = useState(false);
  const [factOpen, setFactOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [resumeDetail, setResumeDetail] = useState<{ section: SectionKey; index: number } | null>(null);
  const [resumeCategory, setResumeCategory] = useState('학력');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editingFact, setEditingFact] = useState<CareerFact | null>(null);
  const [filter, setFilter] = useState<'all' | CareerFactStatus>('all');
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [includeReview, setIncludeReview] = useState(false);
  const [format, setFormat] = useState<'markdown' | 'json'>('markdown');
  const [notice, setNotice] = useState('');
  const verified = workspace.careerFacts.filter((fact) => fact.status === 'verified').length;
  const review = workspace.careerFacts.filter((fact) => fact.status === 'review').length;
  const exportContent = useMemo(() => format === 'markdown' ? createMarkdown(workspace, includeSensitive, includeReview) : createJson(workspace, includeSensitive, includeReview), [workspace, includeSensitive, includeReview, format]);
  const conflictIds = useMemo(() => {
    const groups = new Map<string, CareerFact[]>();
    workspace.careerFacts.filter((fact) => fact.status !== 'excluded').forEach((fact) => { const key = `${fact.category}:${fact.title.replace(/\s/g, '').toLowerCase()}`; groups.set(key, [...(groups.get(key) || []), fact]); });
    return new Set([...groups.values()].filter((items) => items.length > 1).flat().map((fact) => fact.id));
  }, [workspace.careerFacts]);
  const filteredFacts = workspace.careerFacts.filter((fact) => filter === 'all' || fact.status === filter);
  const resumeGroups = [
    { label:'학력',items:workspace.profile.educations.map((x,index)=>({section:'educations' as const,index,title:x.school,meta:[x.major,x.degree,[x.startDate,x.endDate].filter(Boolean).join(' ~ ')].filter(Boolean).join(' · '),detail:[x.gpa&&`전체 ${x.gpa}`,x.majorGpa&&`전공 ${x.majorGpa}`,x.description].filter(Boolean).join(' · '),verified:x.verified})) },
    { label:'경력',items:workspace.profile.experiences.map((x,index)=>({section:'experiences' as const,index,title:x.company,meta:[x.position,[x.startDate,x.endDate].filter(Boolean).join(' ~ ')].filter(Boolean).join(' · '),detail:x.description,verified:x.verified})) },
    { label:'프로젝트',items:workspace.profile.projects.map((x,index)=>({section:'projects' as const,index,title:x.name,meta:[x.organization,x.role,[x.startDate,x.endDate].filter(Boolean).join(' ~ ')].filter(Boolean).join(' · '),detail:x.description,verified:x.verified})) },
    { label:'자격증',items:workspace.profile.certifications.map((x,index)=>({section:'certifications' as const,index,title:x.name,meta:[x.issuer,x.acquiredDate].filter(Boolean).join(' · '),detail:x.credentialId,verified:x.verified})) },
    { label:'어학',items:workspace.profile.languages.map((x,index)=>({section:'languages' as const,index,title:x.name,meta:[x.level,x.score,x.acquiredDate].filter(Boolean).join(' · '),detail:'',verified:x.verified})) },
    { label:'수상',items:workspace.profile.awards.map((x,index)=>({section:'awards' as const,index,title:x.name,meta:[x.issuer,x.date].filter(Boolean).join(' · '),detail:x.description,verified:x.verified})) },
    { label:'활동·교육',items:workspace.profile.activities.map((x,index)=>({section:'activities' as const,index,title:x.name,meta:[x.organization,x.role,[x.startDate,x.endDate].filter(Boolean).join(' ~ ')].filter(Boolean).join(' · '),detail:x.description,verified:x.verified})) },
    { label:'병역',items:workspace.profile.militaryServices.map((x,index)=>({section:'militaryServices' as const,index,title:[x.branch,x.rank].filter(Boolean).join(' · '),meta:[x.role,[x.startDate,x.endDate].filter(Boolean).join(' ~ ')].filter(Boolean).join(' · '),detail:x.description,verified:x.verified})) }
  ];
  const selectedResumeGroup = resumeGroups.find((group) => group.label === resumeCategory) || resumeGroups[0];

  function showNotice(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 2200); }

  async function uploadPdf(file?: File) {
    if (!file) return;
    if (file.type !== 'application/pdf') return window.alert('PDF 파일만 업로드할 수 있습니다.');
    if (file.size > 100_000_000) return window.alert('파일은 100MB 이하여야 합니다.');
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    const attachment = await mutate('PDF 업로드', () => api.uploadFile({ name: file.name, type: file.type, data }), false) as Attachment;
    const source = await mutate('원본 등록', () => api.createCareerSource({ name: file.name, type: 'resume', attachmentId: attachment.id }), false) as CareerSource;
    const result = await mutate('커리어 정보 추출', () => api.extractCareerSource(source.id)) as { source: CareerSource; facts: CareerFact[] };
    if (result.facts.length) { setTab('facts'); showNotice(`${result.facts.length}개 항목을 찾았습니다. 내용을 확인해 주세요.`); }
    else window.alert('PDF에서 내용을 추출하지 못했습니다. API 연결을 확인하거나 텍스트 붙여넣기를 이용해 주세요.');
  }

  async function addTextSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const source = await mutate('원본 등록', () => api.createCareerSource({ name: String(data.get('name')), type: String(data.get('type')) as CareerSource['type'], rawText: String(data.get('rawText')) }), false) as CareerSource;
    const result = await mutate('커리어 정보 추출', () => api.extractCareerSource(source.id)) as { source: CareerSource; facts: CareerFact[] };
    setTextSourceOpen(false);
    setTab('facts');
    showNotice(result.facts.length > 1 ? `${result.facts.length}개 항목을 찾았습니다.` : '원문을 검토 항목으로 등록했습니다.');
  }

  async function reanalyze(source: CareerSource) {
    const result = await mutate('원본 다시 분석', () => api.extractCareerSource(source.id)) as { source: CareerSource; facts: CareerFact[] };
    if (result.facts.length) { setTab('facts'); showNotice(`${result.facts.length}개 항목을 다시 찾았습니다.`); }
    else window.alert('분석할 텍스트를 찾지 못했습니다. 텍스트 붙여넣기를 이용해 주세요.');
  }

  async function removeSource(source: CareerSource) {
    if (!window.confirm(`“${source.name}”과 여기서 추출한 정보를 모두 삭제할까요?`)) return;
    await mutate('원본 삭제', () => api.deleteCareerSource(source.id));
  }

  function openFact(fact?: CareerFact) { setEditingFact(fact || null); setFactOpen(true); }
  async function saveFact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      category: String(data.get('category')) as CareerFactCategory, title: String(data.get('title')), organization: String(data.get('organization')),
      period: String(data.get('period')), description: String(data.get('description')), achievements: String(data.get('achievements')),
      skills: String(data.get('skills')).split(',').map((item) => item.trim()).filter(Boolean), sourceIds: data.getAll('sourceIds').map(String),
      status: String(data.get('status')) as CareerFactStatus, sensitive: data.get('sensitive') === 'on'
    };
    if (editingFact) await mutate('정보 수정', () => api.updateCareerFact(editingFact.id, payload));
    else await mutate('정보 추가', () => api.createCareerFact(payload));
    setFactOpen(false); setEditingFact(null);
  }

  async function setStatus(fact: CareerFact, status: CareerFactStatus) { if (status === 'verified' && fact.status === 'review') return promoteFact(fact); await mutate(status === 'verified' ? '정보 확인' : '정보 제외', () => api.updateCareerFact(fact.id, { status })); }
  async function promoteFact(fact: CareerFact) {
    const suggested = fact.category === 'education' ? '학력' : fact.category === 'experience' ? '경력' : fact.category === 'project' ? '프로젝트' : fact.category === 'certification' ? '자격증' : fact.category === 'language' ? '어학' : fact.category === 'activity' ? '활동' : '';
    const target = window.prompt('정식 이력 분류: 학력, 경력, 프로젝트, 자격증, 어학, 수상, 활동, 병역', suggested); if (!target) return;
    const [startDate='',endDate=''] = fact.period.split(/\s*~\s*/); const next: Profile = { ...workspace.profile };
    if(target==='학력')next.educations=[...next.educations,{school:fact.organization||fact.title,major:fact.organization?fact.title:'',degree:'',status:'',startDate,endDate,gpa:'',description:fact.description,verified:true}];
    else if(target==='경력')next.experiences=[...next.experiences,{company:fact.organization,department:'',position:fact.title,employmentType:'',startDate,endDate,description:fact.description,achievements:fact.achievements,verified:true}];
    else if(target==='프로젝트')next.projects=[...next.projects,{name:fact.title,organization:fact.organization,role:'',tech:fact.skills.join(', '),startDate,endDate,url:'',description:fact.description,achievements:fact.achievements,verified:true}];
    else if(target==='자격증')next.certifications=[...next.certifications,{name:fact.title,issuer:fact.organization,acquiredDate:fact.period,credentialId:fact.description,verified:true}];
    else if(target==='어학')next.languages=[...next.languages,{name:fact.title,level:fact.description,score:'',acquiredDate:fact.period,verified:true}];
    else if(target==='수상')next.awards=[...next.awards,{name:fact.title,issuer:fact.organization,date:fact.period,description:[fact.description,fact.achievements].filter(Boolean).join('\n'),verified:true}];
    else if(target==='활동')next.activities=[...next.activities,{name:fact.title,organization:fact.organization,role:'',startDate,endDate,description:fact.description,achievements:fact.achievements,skills:fact.skills,verified:true}];
    else if(target==='병역')next.militaryServices=[...next.militaryServices,{branch:fact.organization,rank:'',role:fact.title,startDate,endDate,dischargeType:'',description:[fact.description,fact.achievements].filter(Boolean).join('\n'),verified:true}];
    else return window.alert('목록에 있는 분류를 입력해 주세요.');
    await mutate('정식 이력 반영',async()=>{await api.updateProfile(next);return api.updateCareerFact(fact.id,{status:'excluded'});});
  }
  async function removeFact(fact: CareerFact) { if (window.confirm('이 항목을 완전히 삭제할까요?')) await mutate('정보 삭제', () => api.deleteCareerFact(fact.id)); }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const profile: Profile = { ...workspace.profile, name: String(data.get('name')), role: String(data.get('role')), target: String(data.get('target')), summary: String(data.get('summary')), email: String(data.get('email')), phone: String(data.get('phone')), location: String(data.get('location')), skills: String(data.get('skills')).split(',').map((item) => item.trim()).filter(Boolean) };
    await mutate('기본 정보 저장', () => api.updateProfile(profile));
    setProfileOpen(false);
  }

  async function copyExport() { await copyText(exportContent); showNotice('클립보드에 복사했습니다.'); }
  async function deleteAccount() { if (window.prompt('계정과 모든 데이터를 삭제합니다. 계속하려면 “탈퇴”를 입력하세요.') === '탈퇴') await onDeleteAccount(); }

  return <>
    <div className="page-head vault-page-head"><div><p className="eyebrow">MY CAREER PORTFOLIO</p><h1>{workspace.profile.name || '나의 커리어'}</h1><p>{workspace.profile.target || workspace.profile.summary || '경험과 역량을 한곳에 정리하는 나의 커리어 포트폴리오'}</p></div><button className="button" onClick={() => setProfileOpen(true)}>프로필 편집</button></div>
    <section className="vault-overview">
      <button className={tab === 'facts' ? 'active' : ''} onClick={() => setTab('facts')}><i>01</i><span><b>내 커리어</b><small>이력·프로젝트·활동</small></span></button>
      <button className={tab === 'sources' ? 'active' : ''} onClick={() => setTab('sources')}><i>02</i><span><b>자료 보관함</b><small>PDF·원본 {workspace.careerSources.length}개</small></span></button>
      <button className={tab === 'export' ? 'active' : ''} onClick={() => setTab('export')}><i>03</i><span><b>AI용 내보내기</b><small>{verified ? `${verified}개 확인 완료` : '확인된 정보 없음'}</small></span></button>
    </section>

    {tab === 'sources' && <section className="vault-panel">
      <div className="vault-panel-head"><div><h2>가지고 있는 자료를 모두 모으세요</h2><p>이력서 버전마다 다른 내용도 그대로 등록하면 다음 단계에서 비교할 수 있습니다.</p></div><div className="source-actions"><label className="button primary file-button">PDF 업로드<input type="file" accept="application/pdf" hidden onChange={(event) => void uploadPdf(event.target.files?.[0])} /></label><button className="button" onClick={() => setTextSourceOpen(true)}>텍스트 붙여넣기</button></div></div>
      {!workspace.careerSources.length ? <div className="vault-empty"><span>01</span><h3>첫 번째 이력서를 등록해 보세요</h3><p>PDF를 올리거나 이력서 내용을 붙여넣으면 검토 가능한 커리어 항목으로 정리합니다.</p><div><label className="button primary file-button">PDF 선택<input type="file" accept="application/pdf" hidden onChange={(event) => void uploadPdf(event.target.files?.[0])} /></label><button className="button" onClick={() => setGuideOpen(true)}>먼저 사용법 보기</button></div></div> : <div className="source-list">{workspace.careerSources.map((source) => {
        const facts = workspace.careerFacts.filter((fact) => fact.sourceIds.includes(source.id));
        const pending = facts.filter((fact) => fact.status === 'review').length;
        return <article className="source-card" key={source.id}><div className="source-icon">{source.attachmentId ? 'PDF' : 'TXT'}</div><div className="source-main"><div className="source-title"><strong>{source.name}</strong><span>{sourceTypeLabel[source.type]}</span></div><p>{facts.length ? `${facts.length}개 항목 추출 · ${pending ? `${pending}개 확인 필요` : '검토 완료'}` : source.status === 'needs-text' ? '분석 실패 · 텍스트로 다시 등록해 주세요' : '분석할 준비가 되었습니다.'}</p></div><div className="source-controls">{source.attachmentId && <button onClick={() => window.open(api.fileUrl(source.attachmentId!), '_blank', 'noopener')}>열기</button>}<button onClick={() => void reanalyze(source)}>다시 분석</button><button className="danger-text" onClick={() => void removeSource(source)}>삭제</button></div></article>;
      })}</div>}
      <aside className="vault-tip"><b>자료가 여러 개인가요?</b><span>최신 이력서뿐 아니라 직무별 이력서와 포트폴리오도 함께 등록하면 빠진 경험과 서로 다른 날짜를 찾기 쉽습니다.</span></aside>
    </section>}

    {tab === 'facts' && <section className="vault-panel">
      <div className="career-profile-hero"><div className="career-monogram">{(workspace.profile.name || '나')[0]}</div><div><span>CAREER PROFILE</span><h2>{workspace.profile.role || '희망 직무를 입력하세요'}</h2><p>{workspace.profile.summary || workspace.profile.target || '나를 설명하는 커리어 소개를 입력하세요.'}</p><div className="tag-row">{workspace.profile.skills.slice(0,8).map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div></div><aside><b>{resumeGroups.reduce((sum, group) => sum + group.items.length, 0)}</b><small>정리된 이력</small></aside></div>
      <section className="canonical-resume">
        <div className="canonical-resume-head"><div><span>EXPERIENCE INDEX</span><h2>커리어 기록</h2><p>분류를 선택해 상세 이력과 연결된 자료를 확인하세요.</p></div></div>
        <div className="resume-category-row">{resumeGroups.map((group) => <button type="button" key={group.label} className={resumeCategory === group.label ? 'active' : ''} onClick={() => setResumeCategory(group.label)}><span>{group.label}</span><b>{group.items.length}</b></button>)}</div>
        {selectedResumeGroup.items.length ? <div className="canonical-items">{selectedResumeGroup.items.map((item) => <article className="canonical-item" key={`${item.section}-${item.index}`} onClick={() => setResumeDetail({ section:item.section,index:item.index })}><div><strong>{item.title || '제목 미입력'}</strong><em className={item.verified ? 'verified' : ''}>{item.verified ? '검수 완료' : '검수 필요'}</em></div>{item.meta && <span>{item.meta}</span>}{item.detail && <p>{item.detail}</p>}<small>상세 보기 · 수정 · 자료 관리 →</small></article>)}</div> : <div className="canonical-empty">등록된 {selectedResumeGroup.label} 정보가 없습니다.</div>}
      </section>
      <div className="review-drawer-head"><button onClick={() => setReviewOpen((value) => !value)}><span><b>가져온 정보 검토함</b><small>정식 이력에 반영하기 전 확인하는 임시 보관함</small></span><em>{review}개 검토 필요</em><i>{reviewOpen ? '−' : '+'}</i></button></div>
      {reviewOpen && <div className="review-drawer"><div className="vault-panel-head fact-head"><div><h2>가져온 내용을 확인하세요</h2><p>확인 후 정식 이력으로 반영하거나 제외할 수 있습니다.</p></div><button className="button" onClick={() => openFact()}>+ 직접 추가</button></div>
      <div className="fact-toolbar"><div className="filters">{([['all', '전체'], ['review', `검토 필요 ${review}`], ['verified', `확인 완료 ${verified}`], ['excluded', '제외됨']] as const).map(([value, label]) => <button key={value} className={`filter ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>{label}</button>)}</div><span>{conflictIds.size ? `중복 가능성 ${conflictIds.size}개` : '충돌 없음'}</span></div>
      {!filteredFacts.length ? <div className="vault-empty compact"><h3>{workspace.careerSources.length ? '이 조건에 해당하는 정보가 없습니다.' : '먼저 원본을 등록하세요.'}</h3><p>{workspace.careerSources.length ? '직접 정보를 추가하거나 다른 필터를 선택할 수 있습니다.' : '원본에서 내용을 추출한 뒤 여기서 사실 여부를 확인합니다.'}</p><button className="button" onClick={() => workspace.careerSources.length ? openFact() : setTab('sources')}>{workspace.careerSources.length ? '정보 직접 추가' : '원본 등록하기'}</button></div> : <div className="fact-list">{filteredFacts.map((fact) => <article className={`fact-card fact-${fact.status}`} key={fact.id}><div className="fact-meta"><span>{categoryLabel[fact.category]}</span>{conflictIds.has(fact.id) && <em>중복 확인</em>}{fact.sensitive && <em>개인정보</em>}</div><div className="fact-content"><div><h3>{fact.title}</h3><p>{[fact.organization, fact.period].filter(Boolean).join(' · ') || '소속과 기간 정보 없음'}</p></div><div className={`fact-status ${fact.status}`}>{fact.status === 'verified' ? '확인 완료' : fact.status === 'excluded' ? '제외됨' : '검토 필요'}</div></div>{fact.description && <p className="fact-description">{fact.description}</p>}{fact.achievements && <div className="fact-achievement"><b>성과</b>{fact.achievements}</div>}{fact.skills.length > 0 && <div className="tag-row">{fact.skills.map((skill) => <span className="tag" key={skill}>{skill}</span>)}</div>}<div className="fact-source">출처: {fact.sourceIds.map((id) => workspace.careerSources.find((source) => source.id === id)?.name).filter(Boolean).join(', ') || '직접 입력'}</div><div className="fact-actions"><button onClick={() => openFact(fact)}>수정</button>{fact.status !== 'verified' && <button className="verify" onClick={() => void setStatus(fact, 'verified')}>내용 확인 완료</button>}{fact.status === 'verified' && <button onClick={() => void setStatus(fact, 'review')}>다시 검토</button>}{fact.status !== 'excluded' && <button onClick={() => void setStatus(fact, 'excluded')}>내보내기 제외</button>}<button className="danger-text" onClick={() => void removeFact(fact)}>삭제</button></div></article>)}</div>}</div>}
    </section>}

    {tab === 'export' && <section className="vault-panel export-panel">
      <div className="vault-panel-head"><div><h2>ChatGPT에 전달할 데이터를 만드세요</h2><p>자소서를 여기서 만들지 않습니다. 검증된 커리어 데이터를 복사해 원하는 채팅에서 사용하세요.</p></div></div>
      <div className="export-layout"><aside className="export-settings"><h3>내보내기 설정</h3><label className="switch-row"><span><b>검토 중인 정보 포함</b><small>아직 확인하지 않은 내용도 포함합니다.</small></span><input type="checkbox" checked={includeReview} onChange={(event) => setIncludeReview(event.target.checked)} /></label><label className="switch-row"><span><b>개인정보 포함</b><small>연락처와 민감 표시 항목을 포함합니다.</small></span><input type="checkbox" checked={includeSensitive} onChange={(event) => setIncludeSensitive(event.target.checked)} /></label><div className="format-choice"><span>파일 형식</span><button className={format === 'markdown' ? 'active' : ''} onClick={() => setFormat('markdown')}>Markdown</button><button className={format === 'json' ? 'active' : ''} onClick={() => setFormat('json')}>JSON</button></div><div className="export-summary"><span>포함되는 정보</span><strong>{workspace.careerFacts.filter((fact) => fact.status === 'verified' || (includeReview && fact.status === 'review')).filter((fact) => includeSensitive || !fact.sensitive).length}개</strong><small>{includeSensitive ? '개인정보 포함' : '개인정보 제외'}</small></div></aside><div className="export-preview"><div className="preview-head"><div><span>미리보기</span><small>{format === 'markdown' ? 'ChatGPT에 바로 붙여넣기 좋음' : 'API와 자동화에 적합'}</small></div><div><button className="button small" onClick={() => downloadText(`folio-career-data.${format === 'markdown' ? 'md' : 'json'}`, exportContent, format === 'markdown' ? 'text/markdown' : 'application/json')}>파일 저장</button><button className="button primary small" onClick={() => void copyExport()}>전체 복사</button></div></div><pre>{exportContent}</pre></div></div>
      {!verified && <aside className="vault-warning"><b>아직 확인 완료된 정보가 없습니다.</b><span>검토 단계에서 사실을 확인하면 안전한 기본 데이터에 포함됩니다.</span><button onClick={() => setTab('facts')}>지금 확인하기 →</button></aside>}
    </section>}

    <section className="vault-data-management"><span>계정 데이터</span><div><button onClick={() => window.location.assign(api.exportUrl())}>전체 백업 JSON</button><button className="danger-text" onClick={() => void deleteAccount()}>계정 탈퇴</button></div></section>
    {notice && <div className="vault-notice">✓ {notice}</div>}
    {resumeDetail && <ResumeDetailModal section={resumeDetail.section} index={resumeDetail.index} profile={workspace.profile} attachments={workspace.attachments} mutate={mutate} onClose={() => setResumeDetail(null)} />}

    {guideOpen && <Modal title="커리어 데이터 보관함 사용법" kicker="QUICK GUIDE" onClose={() => setGuideOpen(false)}><div className="guide-flow"><div><i>1</i><span><b>원본을 모두 등록하세요</b><small>최신 이력서뿐 아니라 직무별 버전과 포트폴리오도 함께 넣습니다.</small></span></div><div><i>2</i><span><b>추출 결과를 확인하세요</b><small>날짜, 회사명, 성과 수치를 원본과 비교한 뒤 ‘내용 확인 완료’를 누릅니다.</small></span></div><div><i>3</i><span><b>중복과 충돌을 정리하세요</b><small>비슷한 항목이 여러 개면 최신 정보만 남기거나 내용을 합칩니다.</small></span></div><div><i>4</i><span><b>LLM용 데이터를 복사하세요</b><small>Markdown을 복사해 ChatGPT 대화 첫 메시지에 붙여넣습니다.</small></span></div></div><div className="guide-example"><b>ChatGPT에서는 이렇게 시작하세요</b><p>“아래는 사실 확인을 마친 내 커리어 데이터야. 이 정보만 사용하고, 부족한 내용은 추측하지 말고 질문해 줘.”</p></div><div className="guide-privacy"><b>개인정보 보호</b><p>기본 내보내기에서는 이메일·전화번호와 민감 표시 항목을 제외합니다. 지원서에 꼭 필요할 때만 개인정보 포함을 켜세요.</p></div><div className="modal-actions"><button className="button primary" onClick={() => setGuideOpen(false)}>시작하기</button></div></Modal>}
    {textSourceOpen && <Modal title="텍스트로 원본 등록" kicker="ADD SOURCE" onClose={() => setTextSourceOpen(false)}><form onSubmit={addTextSource}><div className="form-grid two"><label>자료 이름<input name="name" required placeholder="예: 2026 백엔드 이력서" /></label><label>자료 종류<select name="type" defaultValue="resume"><option value="resume">이력서</option><option value="portfolio">포트폴리오</option><option value="career-note">경력 메모</option></select></label></div><label>전체 내용<textarea name="rawText" required rows={14} placeholder="이력서나 포트폴리오 내용을 그대로 붙여넣으세요. 형식이 깨져도 괜찮습니다." /></label><p className="form-help">등록 후 자동으로 항목을 나눕니다. API가 연결되지 않은 경우 원문 전체가 하나의 검토 항목으로 저장됩니다.</p><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setTextSourceOpen(false)}>취소</button><button className="button primary">등록하고 정리하기</button></div></form></Modal>}
    {factOpen && <Modal title={editingFact ? '커리어 정보 수정' : '커리어 정보 직접 추가'} kicker="CAREER FACT" onClose={() => { setFactOpen(false); setEditingFact(null); }}><form onSubmit={saveFact}><div className="form-grid two"><label>분류<select name="category" defaultValue={editingFact?.category || 'experience'}>{categories.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}</select></label><label>확인 상태<select name="status" defaultValue={editingFact?.status || 'review'}><option value="review">검토 필요</option><option value="verified">확인 완료</option><option value="excluded">내보내기 제외</option></select></label></div><label>제목<input name="title" required defaultValue={editingFact?.title} placeholder="예: 프론트엔드 개발자 / Folio 프로젝트" /></label><div className="form-grid two"><label>소속·기관<input name="organization" defaultValue={editingFact?.organization} /></label><label>기간<input name="period" defaultValue={editingFact?.period} placeholder="2024.01 ~ 2025.06" /></label></div><label>업무·내용<textarea name="description" rows={4} defaultValue={editingFact?.description} /></label><label>성과·결과<textarea name="achievements" rows={3} defaultValue={editingFact?.achievements} placeholder="가능하면 검증 가능한 수치와 결과를 적으세요." /></label><label>기술·역량<input name="skills" defaultValue={editingFact?.skills.join(', ')} placeholder="React, TypeScript, 협업" /></label>{workspace.careerSources.length > 0 && <fieldset className="source-checks"><legend>근거 원본</legend>{workspace.careerSources.map((source) => <label key={source.id}><input type="checkbox" name="sourceIds" value={source.id} defaultChecked={editingFact?.sourceIds.includes(source.id)} />{source.name}</label>)}</fieldset>}<label className="sensitive-check"><input type="checkbox" name="sensitive" defaultChecked={editingFact?.sensitive} /> 개인정보 또는 외부 공유에 주의할 내용</label><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setFactOpen(false)}>취소</button><button className="button primary">저장</button></div></form></Modal>}
    {profileOpen && <Modal title="기본 프로필 편집" kicker="IDENTITY" onClose={() => setProfileOpen(false)}><form onSubmit={saveProfile}><div className="form-grid two"><label>이름<input name="name" defaultValue={workspace.profile.name} /></label><label>희망 직무<input name="role" defaultValue={workspace.profile.role} /></label><label>이메일<input name="email" type="email" defaultValue={workspace.profile.email} /></label><label>연락처<input name="phone" defaultValue={workspace.profile.phone} /></label></div><label>한 줄 소개<input name="target" defaultValue={workspace.profile.target} /></label><label>커리어 요약<textarea name="summary" rows={5} defaultValue={workspace.profile.summary} /></label><label>핵심 기술<input name="skills" defaultValue={workspace.profile.skills.join(', ')} placeholder="React, TypeScript, Java" /></label><label>거주 지역<input name="location" defaultValue={workspace.profile.location} /></label><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setProfileOpen(false)}>취소</button><button className="button primary">저장</button></div></form></Modal>}
  </>;
}

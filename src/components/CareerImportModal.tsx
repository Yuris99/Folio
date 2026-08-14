import { useMemo, useState, type ChangeEvent } from 'react';
import { api } from '../api';
import type { Mutation } from '../hooks/useFolio';
import { Modal } from './Modal';

export type ImportKind = 'career' | 'applications' | 'company-analysis' | 'interviews' | 'documents' | 'tasks';
export type ChatImport = { format: 'folio-chat-import'; version: 1; kind: Exclude<ImportKind, 'career'>; data: Record<string, unknown[]> };
export type CareerImport = Record<string, unknown> & { format: 'folio-career-import'; version: 1 };

const sharedRules = `규칙:
- 내가 직접 제공한 사실만 사용하고 추측하거나 내용을 보완하지 않는다.
- 같은 항목은 하나로 합치되, 충돌하는 정보는 임의로 선택하지 않는다.
- 알 수 없는 문자열은 "", 목록은 []로 둔다.
- 날짜는 가능하면 YYYY-MM-DD 형식으로 쓴다.
- 결과는 설명과 Markdown 코드 블록 없이 유효한 JSON 하나만 출력한다.`;

export const importPrompts: Record<ImportKind, { label: string; description: string; prompt: string }> = {
  career: { label: '내 정보·커리어', description: '프로필, 학력, 경력, 프로젝트, 자격증과 기술', prompt: `지금까지 이 대화에서 내가 직접 제공한 커리어 정보를 Folio로 가져올 수 있게 정리해 줘.\n\n${sharedRules}\n\n{"format":"folio-career-import","version":1,"profile":{"name":"","englishName":"","role":"","target":"","summary":"","email":"","phone":"","birthDate":"","location":"","address":"","github":"","portfolio":"","blog":"","linkedin":"","skills":[]},"educations":[{"school":"","major":"","degree":"","status":"","startDate":"","endDate":"","gpa":"","description":""}],"experiences":[{"company":"","department":"","position":"","employmentType":"","startDate":"","endDate":"","description":"","achievements":""}],"projects":[{"name":"","organization":"","role":"","tech":"","startDate":"","endDate":"","url":"","description":"","achievements":""}],"certifications":[{"name":"","issuer":"","acquiredDate":"","credentialId":""}],"languages":[{"name":"","level":"","score":"","acquiredDate":""}],"awards":[{"name":"","issuer":"","date":"","description":""}],"careerFacts":[{"category":"profile|education|experience|project|skill|certification|language|activity|other","title":"","organization":"","period":"","description":"","achievements":"","skills":[],"sensitive":false}]}` },
  applications: { label: '기업·지원 관리', description: '관심 기업, 채용 공고와 지원 단계', prompt: `지금까지 이 대화에서 언급한 기업, 채용 공고와 나의 지원 현황을 Folio용으로 정리해 줘. 공고와 실제 지원 여부를 구분해.\n\n${sharedRules}\n\n{"format":"folio-chat-import","version":1,"kind":"applications","data":{"jobs":[{"company":"","role":"","deadline":"","url":"","description":"","skills":[]}],"applications":[{"company":"","role":"","status":"관심|작성 중|지원 완료|서류 통과|면접|합격|탈락","next":"","memo":""}]}}` },
  'company-analysis': { label: '기업·직무 분석', description: '사업, 제품, 문화, 직무 요구사항과 내 적합성', prompt: `지금까지 이 대화에서 조사하거나 분석한 기업과 직무 정보를 Folio용으로 정리해 줘. 기업에 대한 객관적 정보와 나의 적합성 판단을 구분하고, 확인 가능한 출처 URL을 보존해.\n\n${sharedRules}\n- fitEvidence에는 이 대화에서 확인된 내 실제 경험만 넣는다.\n- gaps에는 부족하거나 추가 확인이 필요한 역량만 넣는다.\n\n{"format":"folio-chat-import","version":1,"kind":"company-analysis","data":{"analyses":[{"company":"","role":"","overview":"","products":[],"industry":"","culture":[],"recentTopics":[],"roleResponsibilities":[],"requirements":[],"preferred":[],"fitEvidence":[],"gaps":[],"interviewTopics":[],"sources":[{"title":"","url":""}]}]}}` },
  interviews: { label: '면접', description: '면접 일정, 유형, 준비 내용과 메모', prompt: `지금까지 이 대화에서 언급한 면접 일정과 준비 정보를 Folio용으로 정리해 줘. 예정된 면접과 이미 진행한 면접을 모두 포함해.\n\n${sharedRules}\n\n{"format":"folio-chat-import","version":1,"kind":"interviews","data":{"interviews":[{"company":"","role":"","date":"YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm","type":"기술|인성|과제|기타","memo":"","prepared":0}]}}` },
  documents: { label: '지원 문서', description: '자기소개서, 지원 동기와 작성 중인 문서', prompt: `지금까지 이 대화에서 함께 작성한 자기소개서, 지원 동기, 경력기술서 등 지원 문서를 Folio용으로 정리해 줘. 초안도 원문을 보존해.\n\n${sharedRules}\n\n{"format":"folio-chat-import","version":1,"kind":"documents","data":{"documents":[{"title":"","company":"","role":"","content":"","warnings":[]}]}}` },
  tasks: { label: '할 일·일정', description: '지원 준비 작업과 마감 일정', prompt: `지금까지 이 대화에서 정한 취업 준비 할 일과 마감 일정을 Folio용으로 정리해 줘. 이미 끝낸 일도 done으로 구분해.\n\n${sharedRules}\n\n{"format":"folio-chat-import","version":1,"kind":"tasks","data":{"tasks":[{"text":"","date":"YYYY-MM-DD","done":false}]}}` }
};

export function parseImport(text: string, selected: ImportKind): CareerImport | ChatImport {
  const value = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as CareerImport | ChatImport;
  if (!value || value.version !== 1) throw new Error('지원하지 않는 버전입니다.');
  if (selected === 'career') {
    if (value.format !== 'folio-career-import') throw new Error('내 정보·커리어용 JSON이 아닙니다.');
    return value;
  }
  if (value.format !== 'folio-chat-import' || value.kind !== selected || !value.data || typeof value.data !== 'object') throw new Error(`${importPrompts[selected].label}용 JSON 형식이 아닙니다.`);
  for (const list of Object.values(value.data)) if (!Array.isArray(list)) throw new Error('data 안의 항목은 배열이어야 합니다.');
  return value;
}

export function CareerImportModal({ mutate, onClose, onImported }: { mutate: Mutation; onClose: () => void; onImported: (kind: ImportKind) => void }) {
  const [kind, setKind] = useState<ImportKind>('career');
  const [text, setText] = useState('');
  const validation = useMemo(() => { if (!text.trim()) return { value: null, error: '' }; try { return { value: parseImport(text, kind), error: '' }; } catch (error) { return { value: null, error: error instanceof Error ? error.message : 'JSON을 확인해 주세요.' }; } }, [text, kind]);
  const count = validation.value ? (validation.value.format === 'folio-chat-import' ? Object.values(validation.value.data).reduce((sum, items) => sum + items.length, 0) : Object.entries(validation.value).filter(([key, value]) => !['format', 'version'].includes(key) && (Array.isArray(value) ? value.length : value && typeof value === 'object')).length) : 0;
  function selectKind(next: ImportKind) { setKind(next); setText(''); }
  async function copyPrompt() { await navigator.clipboard.writeText(importPrompts[kind].prompt); window.alert(`${importPrompts[kind].label} 정리용 프롬프트를 복사했습니다.`); }
  function loadFile(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setText(String(reader.result || '')); reader.readAsText(file); }
  async function submit() {
    if (!validation.value) return;
    const result = validation.value.format === 'folio-career-import'
      ? await mutate('커리어 가져오기', () => api.importCareerData(validation.value))
      : await mutate(`${importPrompts[kind].label} 가져오기`, () => api.importChatData(validation.value));
    const imported = (result as { imported: { total?: number; skippedDuplicates: number } }).imported;
    window.alert(`가져오기 완료 · ${imported.total ?? '커리어 데이터'}\n중복 제외 ${imported.skippedDuplicates}개`); onImported(kind); onClose();
  }
  return <Modal title="기존 AI 채팅에서 가져오기" kicker="NO API TOKEN" onClose={onClose}>
    <div className="import-kind-grid">{(Object.keys(importPrompts) as ImportKind[]).map((item) => <button type="button" key={item} className={kind === item ? 'active' : ''} onClick={() => selectKind(item)}><b>{importPrompts[item].label}</b><small>{importPrompts[item].description}</small></button>)}</div>
    <div className="career-import-flow">
      <section><span className="import-step">1</span><div><h3>{importPrompts[kind].label} 정리 요청하기</h3><p>프롬프트를 기존 채팅에 붙여넣으세요. Folio의 AI API나 토큰은 사용하지 않습니다.</p><button type="button" className="button" onClick={() => void copyPrompt()}>이 프롬프트 복사</button></div></section>
      <section><span className="import-step">2</span><div className="import-input"><h3>받은 JSON 넣기</h3><textarea rows={10} value={text} onChange={(event) => setText(event.target.value)} placeholder="AI가 만든 JSON을 붙여넣으세요" /><label className="button small file-button">JSON 파일 선택<input hidden type="file" accept="application/json,.json" onChange={loadFile} /></label></div></section>
      {validation.error && <p className="import-error">{validation.error}</p>}
      {validation.value && <section className="import-preview"><span className="import-step">3</span><div><h3>가져오기 미리보기</h3><p>가져올 데이터 묶음/항목 <b>{count}</b>개</p><small>기존 데이터는 유지하고 동일 항목은 제외합니다. 저장 후 각 화면에서 내용을 확인할 수 있습니다.</small></div></section>}
    </div>
    <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>취소</button><button type="button" className="button primary" disabled={!validation.value} onClick={() => void submit()}>가져오기</button></div>
  </Modal>;
}

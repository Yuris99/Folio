import { useState, type Dispatch, type MouseEvent, type ReactNode, type SetStateAction } from 'react';
import { CAREER_GRADES, DEADLINE_BONUS_RULES, PRIORITY_CRITERIA, PRIORITY_THRESHOLDS, buildPriorityPrompt, getPriorityBreakdown, getPriorityLabel, parsePriorityResult, priorityClass, type CriterionKey, type Level, type ParsedPriority } from '../priority';
import type { CareerGrade, Job, Profile } from '../types';

export interface PriorityInput {
  careerGrade: CareerGrade | '';
  careerLevel: number;
  compensationLevel: number;
  passLevel: number;
  workLevel: number;
}

const levelField: Record<Exclude<CriterionKey, 'preference'>, keyof Omit<PriorityInput, 'careerGrade'>> = { career: 'careerLevel', compensation: 'compensationLevel', pass: 'passLevel', work: 'workLevel' };
const gradeOfLevel: Record<Level, CareerGrade> = { 5: 'S', 4: 'A', 3: 'B', 2: 'C', 1: 'D' };
const LEVELS: Level[] = [5, 4, 3, 2, 1];

function Tip({ children }: { children: ReactNode }) {
  return <span className="prio-info" tabIndex={0} aria-label="기준 보기">ⓘ<span className="prio-tip" role="tooltip">{children}</span></span>;
}

export function PriorityEditor({ value, onChange, job, status, profile, description }: { value: PriorityInput; onChange: Dispatch<SetStateAction<PriorityInput>>; job: Pick<Job, 'deadline' | 'alwaysOpen'>; status: string; profile?: Profile; description?: string }) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [message, setMessage] = useState('');
  const [suggestion, setSuggestion] = useState<ParsedPriority | null>(null);
  const breakdown = getPriorityBreakdown({ id: '', jobId: '', next: '', status, careerGrade: value.careerGrade || undefined, careerLevel: value.careerLevel, compensationLevel: value.compensationLevel, passLevel: value.passLevel, workLevel: value.workLevel }, { id: '', company: '', role: '', url: '', description: '', skills: [], deadline: job.deadline, alwaysOpen: job.alwaysOpen });

  function levelOf(key: CriterionKey): Level | undefined {
    if (key === 'preference') return value.careerGrade ? LEVELS[CAREER_GRADES.indexOf(value.careerGrade)] : undefined;
    const level = value[levelField[key]];
    return level >= 1 && level <= 5 ? level as Level : undefined;
  }

  function setLevel(key: CriterionKey, level: Level | undefined) {
    // 빠르게 여러 번 눌러도 앞의 선택이 사라지지 않도록 항상 최신 값에서 바꿉니다.
    if (key === 'preference') onChange((current) => ({ ...current, careerGrade: level ? gradeOfLevel[level] : '' }));
    else onChange((current) => ({ ...current, [levelField[key]]: level || 0 }));
  }

  // 복사 시점의 폼 값(회사·직무·근무지·링크·마감)으로 프롬프트를 만듭니다.
  async function copyPrompt(event: MouseEvent<HTMLButtonElement>) {
    const data = event.currentTarget.form ? new FormData(event.currentTarget.form) : new FormData();
    const text = buildPriorityPrompt({
      company: String(data.get('company') || ''), role: String(data.get('role') || ''), location: String(data.get('location') || ''),
      url: String(data.get('url') || ''), deadline: String(data.get('deadline') || job.deadline || ''), alwaysOpen: job.alwaysOpen, description
    }, profile);
    try { await navigator.clipboard.writeText(text); setMessage('프롬프트를 복사했어요. ChatGPT에 붙여 넣고 답변 전체를 아래에 붙여 넣으세요.'); }
    catch { setPasteText(text); setPasteOpen(true); setMessage('클립보드 권한이 없어 아래에 프롬프트를 띄웠어요. 직접 복사해 주세요.'); }
  }

  function applyResult() {
    const parsed = parsePriorityResult(pasteText);
    if (!parsed) { setMessage('답변에서 점수 JSON을 찾지 못했어요. 마지막 코드블록까지 붙여 넣었는지 확인해 주세요.'); return; }
    onChange((current) => {
      const next = { ...current };
      for (const [key, level] of Object.entries(parsed.levels) as Array<[Exclude<CriterionKey, 'preference'>, Level | undefined]>) if (level) next[levelField[key]] = level;
      return next;
    });
    setSuggestion(parsed);
    setPasteOpen(false);
    setPasteText('');
    const filled = Object.values(parsed.levels).filter(Boolean).length;
    setMessage(`AI 평가 ${filled}개 항목을 채웠어요. 비어 있는 항목은 근거가 부족한 거예요.`);
  }

  return <section className="prio-editor">
    <div className="prio-summary">
      <div><span className="prio-title">지원 우선순위<Tip><b>계산 방법</b><p>지원 가치 100점 = 항목 배점 × 단계 비율(5=100%, 4=85%, 3=65%, 2=40%, 1=15%). 비운 항목은 3단계로 계산해요.</p><p>등급: {PRIORITY_THRESHOLDS.TOP}+ 최우선 · {PRIORITY_THRESHOLDS.ACTIVE}+ 적극 지원 · {PRIORITY_THRESHOLDS.REVIEW}+ 지원 검토 · {PRIORITY_THRESHOLDS.LATER}+ 후순위</p><p>마감 보너스는 등급과 별개로 정렬에만 더해요: {DEADLINE_BONUS_RULES.map((rule) => `${rule.label} +${rule.bonus}`).join(' · ')}</p></Tip></span><small>{breakdown.missing.length ? `미입력 ${breakdown.missing.length}개는 보통으로 계산` : '모든 항목 입력됨'}</small></div>
      <strong className={`prio-total priority-${priorityClass(breakdown.value)}`}>{breakdown.sortScore}<small>점 · {getPriorityLabel(breakdown.value)}</small>{breakdown.deadline > 0 && <em>가치 {breakdown.value} + 마감 {breakdown.deadline}</em>}</strong>
    </div>
    {PRIORITY_CRITERIA.map((criterion) => {
      const current = levelOf(criterion.key);
      return <div className="prio-row" key={criterion.key}>
        <div className="prio-head"><strong>{criterion.label}</strong>{criterion.decidedBy === '나' && <em>내가 결정</em>}<Tip><b>{criterion.label} · {criterion.weight}점</b><p>{criterion.summary}</p><ol>{LEVELS.map((level) => <li key={level}><b>{criterion.key === 'preference' ? gradeOfLevel[level] : level}</b>{criterion.levels[level].replace(/^[SABCD] · /, '')}</li>)}</ol></Tip><span className="prio-points">{breakdown.points[criterion.key]}<small>/{criterion.weight}</small></span></div>
        <div className="prio-levels" role="radiogroup" aria-label={criterion.label}>
          {LEVELS.map((level) => <button type="button" role="radio" aria-checked={current === level} className={current === level ? 'active' : ''} key={level} title={criterion.levels[level]} onClick={() => setLevel(criterion.key, current === level ? undefined : level)}>{criterion.key === 'preference' ? gradeOfLevel[level] : level}</button>)}
        </div>
        <p className={`prio-hint ${current ? '' : 'empty'}`}>{current ? criterion.levels[current].replace(/^[SABCD] · /, '') : '비워 두면 보통(3단계)으로 계산해요'}</p>
      </div>;
    })}
    <div className="prio-ai">
      <div className="prio-ai-actions"><button type="button" className="button small" onClick={(event) => void copyPrompt(event)}>AI 평가 프롬프트 복사</button><button type="button" className="button ghost small" onClick={() => setPasteOpen((open) => !open)}>{pasteOpen ? '닫기' : 'AI 답변 붙여넣기'}</button></div>
      {message && <p className="prio-ai-message">{message}</p>}
      {pasteOpen && <div className="prio-paste"><textarea rows={5} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="ChatGPT 답변 전체를 붙여 넣으세요. 마지막 JSON 코드블록에서 점수를 읽어요." /><button type="button" className="button primary small" disabled={!pasteText.trim()} onClick={applyResult}>점수 채우기</button></div>}
      {suggestion?.preferenceSuggestion && value.careerGrade !== suggestion.preferenceSuggestion && <p className="prio-ai-message">AI가 본 직무선호도는 <b>{suggestion.preferenceSuggestion}</b>예요. 직무선호도는 직접 정해 주세요. <button type="button" className="text-button" onClick={() => onChange((current) => ({ ...current, careerGrade: suggestion.preferenceSuggestion! }))}>{suggestion.preferenceSuggestion}로 정하기</button></p>}
      {suggestion?.check && <p className="prio-ai-message">확인할 것: {suggestion.check}</p>}
    </div>
  </section>;
}

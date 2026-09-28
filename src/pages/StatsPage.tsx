import { useMemo } from 'react';
import { EmptyState, PageHead } from '../components/Common';
import { CAREER_GRADES } from '../priority';
import type { View, Workspace } from '../types';
import { allApplications, applicationStats, applicationStatuses, documentOutcome, getJob, isRejected, isSubmitted, normalizedApplicationStatus, stageResultStats, weeklySubmissions } from '../utils';

const percent = (part: number, whole: number) => whole ? Math.round((part / whole) * 100) : 0;
const monthDay = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;

// 합격·불합격 한 줄 막대. 색만으로 구분하지 않도록 옆에 숫자와 라벨을 함께 둡니다.
function ResultBar({ passed, failed, pending = 0, label }: { passed: number; failed: number; pending?: number; label: string }) {
  const total = passed + failed + pending;
  const segments = [['pass', '합격', passed], ['fail', '불합격', failed], ['pending', '대기', pending]] as const;
  return <div className="stats-result-bar" role="img" aria-label={`${label}: 합격 ${passed}, 불합격 ${failed}${pending ? `, 대기 ${pending}` : ''}`}>
    {segments.filter(([, , count]) => count > 0).map(([kind, name, count]) => <span key={kind} className={`seg-${kind}`} style={{ flexGrow: count }} tabIndex={0}><em className="stats-tip">{name} {count}건 · {percent(count, total)}%</em></span>)}
  </div>;
}

export function StatsPage({ workspace, navigate }: { workspace: Workspace; navigate: (view: View) => void }) {
  const applications = useMemo(() => allApplications(workspace), [workspace]);
  const summary = useMemo(() => applicationStats(applications), [applications]);
  const weekly = useMemo(() => weeklySubmissions(applications), [applications]);
  const stages = useMemo(() => stageResultStats(applications), [applications]);
  const submitted = applications.filter(isSubmitted);
  const inProgress = submitted.filter((item) => !isRejected(item.status)).length;
  const rejected = applications.filter((item) => isRejected(item.status));
  const stagePasses = stages.reduce((sum, stage) => sum + stage.passed, 0);
  const statusCounts = applicationStatuses.map((status) => ({ status, count: applications.filter((item) => normalizedApplicationStatus(item.status) === status).length }));
  const statusMax = Math.max(1, ...statusCounts.map((item) => item.count));
  const weeklyMax = Math.max(1, ...weekly.map((week) => week.count));
  const thisWeek = weekly[weekly.length - 1]?.count || 0;
  const gradeRows = [...CAREER_GRADES, ''].map((grade) => {
    const rows = submitted.filter((item) => (item.careerGrade || '') === grade);
    return { grade: grade || '미입력', submitted: rows.length, passed: rows.filter((item) => documentOutcome(item) === 'passed').length, failed: rows.filter((item) => documentOutcome(item) === 'failed').length };
  }).filter((row) => row.submitted > 0);
  const reasons = rejected.filter((item) => item.rejectionReason?.trim()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 6);

  if (!applications.length) return <>
    <PageHead kicker="STATISTICS" title="통계" description="지원 기록이 쌓이면 합격률과 흐름을 보여 드려요." />
    <EmptyState title="아직 통계를 낼 지원이 없습니다." description="지원을 등록하고 서류·전형 결과를 기록해 보세요." action={<button className="button primary" onClick={() => navigate('applications')}>지원 관리로 이동</button>} />
  </>;

  return <>
    <PageHead kicker="STATISTICS" title="통계" description="직접 기록한 서류·전형 결과로 계산합니다. 결과 대기 중인 지원은 합격률에서 빠집니다." actions={<button className="button" onClick={() => navigate('applications')}>지원 관리 →</button>} />
    <div className="grid stats-grid stats-kpis">
      <div className="card stat"><div className="label">제출한 원서</div><div className="value">{summary.submitted}<span className="unit">개</span></div><small>이번 주 {thisWeek}개</small></div>
      <div className="card stat"><div className="label">서류 합격률</div><div className="value">{summary.passRate === null ? '–' : summary.passRate}<span className="unit">{summary.passRate === null ? '' : '%'}</span></div><small>합격 {summary.passed} · 탈락 {summary.failed}</small></div>
      <div className="card stat"><div className="label">진행 중인 지원</div><div className="value">{inProgress}<span className="unit">건</span></div><small>서류 결과 대기 {summary.pending}건</small></div>
      <div className="card stat"><div className="label">전형 합격 기록</div><div className="value">{stagePasses}<span className="unit">회</span></div><small>불합격 {rejected.length}건</small></div>
    </div>

    <div className="stats-layout">
      <article className="card stats-card stats-wide">
        <div className="section-head"><h2>주간 제출 원서</h2><small>최근 12주 · 접수일 기준</small></div>
        <div className="stats-weekly" role="list">{weekly.map((week) => <div className="stats-week" role="listitem" key={week.start.toISOString()} tabIndex={0} aria-label={`${monthDay(week.start)} 주 ${week.count}개`}>
          <span className="stats-week-bar" style={{ height: `${Math.max(week.count ? 4 : 0, (week.count / weeklyMax) * 100)}%` }}>{week.count > 0 && <b>{week.count}</b>}</span>
          <em className="stats-tip">{monthDay(week.start)} 주 · {week.count}개</em>
          <small>{monthDay(week.start)}</small>
        </div>)}</div>
      </article>

      <article className="card stats-card">
        <div className="section-head"><h2>서류 결과</h2><small>제출 {summary.submitted}개</small></div>
        <ResultBar label="서류 결과" passed={summary.passed} failed={summary.failed} pending={summary.pending} />
        <ul className="stats-legend"><li><i className="seg-pass" />합격 <b>{summary.passed}</b></li><li><i className="seg-fail" />탈락 <b>{summary.failed}</b></li><li><i className="seg-pending" />대기 <b>{summary.pending}</b></li></ul>
        {summary.submitted - summary.passed - summary.failed - summary.pending > 0 && <p className="empty-note">서류 결과 없이 불합격 처리된 {summary.submitted - summary.passed - summary.failed - summary.pending}건은 빠져 있어요.</p>}
      </article>

      <article className="card stats-card">
        <div className="section-head"><h2>지원 상태</h2><small>전체 {applications.length}건</small></div>
        <div className="stats-rows">{statusCounts.map(({ status, count }) => <div className="stats-row" key={status}>
          <span>{status}</span><span className="stats-track"><i style={{ width: `${(count / statusMax) * 100}%` }} /></span><b>{count}</b>
        </div>)}</div>
      </article>

      <article className="card stats-card stats-wide">
        <div className="section-head"><h2>전형 단계별 통과율</h2><small>단계마다 기록한 합격·불합격 기준</small></div>
        {stages.length ? <div className="stats-stage-list">{stages.map((stage) => <div className="stats-stage" key={stage.name}>
          <strong>{stage.name}</strong>
          <ResultBar label={stage.name} passed={stage.passed} failed={stage.failed} />
          <span className="stats-stage-num"><b>{percent(stage.passed, stage.passed + stage.failed)}%</b><small>{stage.passed} / {stage.passed + stage.failed}</small></span>
        </div>)}<ul className="stats-legend"><li><i className="seg-pass" />합격</li><li><i className="seg-fail" />불합격</li></ul></div> : <p className="empty-note">아직 단계별 결과가 없어요. 지원 수정 창의 채용 프로세스에서 단계마다 합격·불합격을 골라 주세요.</p>}
      </article>

      <article className="card stats-card">
        <div className="section-head"><h2>직무선호도별 서류 합격률</h2></div>
        {gradeRows.length ? <table className="stats-table"><thead><tr><th>선호도</th><th>제출</th><th>합격</th><th>탈락</th><th>합격률</th></tr></thead><tbody>{gradeRows.map((row) => <tr key={row.grade}><td><span className={`career-grade grade-${row.grade === '미입력' ? 'none' : row.grade}`}>{row.grade === '미입력' ? '–' : row.grade}</span></td><td>{row.submitted}</td><td>{row.passed}</td><td>{row.failed}</td><td><b>{row.passed + row.failed ? `${percent(row.passed, row.passed + row.failed)}%` : '–'}</b></td></tr>)}</tbody></table> : <p className="empty-note">제출한 원서가 없어요.</p>}
      </article>

      <article className="card stats-card">
        <div className="section-head"><h2>최근 불합격 사유</h2><small>{rejected.length}건 중 메모 {rejected.filter((item) => item.rejectionReason?.trim()).length}건</small></div>
        {reasons.length ? <ul className="stats-reasons">{reasons.map((item) => { const job = getJob(workspace, item); return <li key={item.id}><strong>{job.company}<small>{job.role}{item.documentResult === '불합격' ? ' · 서류' : ''}</small></strong><p>{item.rejectionReason}</p></li>; })}</ul> : <p className="empty-note">남긴 불합격 사유가 없어요.</p>}
      </article>
    </div>
  </>;
}

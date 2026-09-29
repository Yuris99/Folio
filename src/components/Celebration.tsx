import { useEffect, useRef, useState } from 'react';
import type { Workspace } from '../types';
import { statsApplications, applicationStats, documentOutcome, getJob } from '../utils';

const COLORS = ['#c47a81', '#f2c6a0', '#91c39f', '#8fb4ff', '#f3e39b', '#d8a6ff'];

export function fireConfetti(amount = 160) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const context = canvas.getContext('2d');
  if (!context) { canvas.remove(); return; }
  const ratio = window.devicePixelRatio || 1;
  const resize = () => { canvas.width = window.innerWidth * ratio; canvas.height = window.innerHeight * ratio; };
  resize();
  const width = () => canvas.width / ratio, height = () => canvas.height / ratio;
  // 화면 양쪽 아래에서 위로 터지는 폭죽
  const pieces = Array.from({ length: amount }, (_, index) => {
    const fromLeft = index % 2 === 0;
    const angle = (fromLeft ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.9;
    const speed = 9 + Math.random() * 9;
    return {
      x: fromLeft ? width() * 0.1 : width() * 0.9, y: height() * 0.85,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 6, rotation: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.3,
      color: COLORS[index % COLORS.length], round: Math.random() < 0.3
    };
  });
  const started = performance.now();
  const duration = 3800;
  function frame(now: number) {
    const elapsed = now - started;
    context!.setTransform(ratio, 0, 0, ratio, 0, 0);
    context!.clearRect(0, 0, width(), height());
    context!.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - duration + 1000) / 1000);
    for (const piece of pieces) {
      piece.vx *= 0.985; piece.vy = piece.vy * 0.985 + 0.28;
      piece.x += piece.vx; piece.y += piece.vy; piece.rotation += piece.spin;
      context!.save();
      context!.translate(piece.x, piece.y);
      context!.rotate(piece.rotation);
      context!.fillStyle = piece.color;
      if (piece.round) { context!.beginPath(); context!.arc(0, 0, piece.size / 2, 0, Math.PI * 2); context!.fill(); }
      else context!.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
      context!.restore();
    }
    if (elapsed < duration) requestAnimationFrame(frame);
    else { window.removeEventListener('resize', resize); canvas.remove(); }
  }
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
}

function readStoredMilestone(key: string): number | null {
  try { const value = window.localStorage.getItem(key); return value === null ? null : Number(value) || 0; } catch { return null; }
}

function storeMilestone(key: string, value: number) {
  try { window.localStorage.setItem(key, String(value)); } catch { /* 저장이 막힌 브라우저에서는 이번 세션에서만 기억합니다. */ }
}

type Toast = { id: number; title: string; detail: string };

// 원서 10개 단위 돌파와 이번 세션에서 새로 생긴 서류·단계별 합격을 축하합니다.
export function Celebrations({ workspace, userId }: { workspace: Workspace; userId: string }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const passedRef = useRef<Set<string> | null>(null);
  const milestoneRef = useRef<number | null>(null);

  useEffect(() => {
    const applications = statsApplications(workspace);
    const stats = applicationStats(applications);
    // 서류 합격(doc:)과 단계별 합격(step:)을 한 집합으로 추적합니다.
    const passes = new Map<string, { company: string; stage: string }>();
    for (const item of applications) {
      const company = getJob(workspace, item).company;
      if (documentOutcome(item) === 'passed') passes.set(`doc:${item.id}`, { company, stage: '서류' });
      for (const step of item.processSteps || []) if (step.result === '합격' && !step.name.includes('서류')) passes.set(`step:${item.id}:${step.id}`, { company, stage: step.name });
    }
    const storageKey = `folio:milestone:${userId}`;
    const celebrate = (title: string, detail: string, amount?: number) => { setToast({ id: Date.now(), title, detail }); fireConfetti(amount); };

    if (milestoneRef.current === null) {
      const stored = readStoredMilestone(storageKey);
      milestoneRef.current = stored ?? stats.milestone;
      if (stored === null) storeMilestone(storageKey, stats.milestone);
    }
    if (stats.milestone > milestoneRef.current) {
      milestoneRef.current = stats.milestone;
      storeMilestone(storageKey, stats.milestone);
      celebrate(`원서 ${stats.milestone}개 돌파!`, `지금까지 ${stats.submitted}곳에 지원했어요. 꾸준함이 제일 큰 무기예요.`, 220);
    } else if (stats.milestone < milestoneRef.current) {
      // 지원을 지웠다가 다시 넘기면 한 번 더 축하합니다.
      milestoneRef.current = stats.milestone;
      storeMilestone(storageKey, stats.milestone);
    }

    const previous = passedRef.current;
    passedRef.current = new Set(passes.keys());
    if (!previous) return;
    const newlyPassed = [...passes].find(([key]) => !previous.has(key));
    if (newlyPassed) {
      const [key, { company, stage }] = newlyPassed;
      const detail = key.startsWith('doc:') && stats.passRate !== null ? `현재 서류 합격률 ${stats.passRate}% · 다음 전형도 화이팅!` : '다음 전형도 화이팅!';
      celebrate(`${company} ${stage} 합격!`, detail);
    }
  }, [workspace, userId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return <div className="celebration-toast" role="status" key={toast.id}>
    <span aria-hidden="true">🎉</span>
    <div><strong>{toast.title}</strong><small>{toast.detail}</small></div>
    <button type="button" aria-label="닫기" onClick={() => setToast(null)}>×</button>
  </div>;
}

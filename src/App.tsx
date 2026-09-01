import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { Layout } from './components/Layout';
import { useFolio } from './hooks/useFolio';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { CalendarPage } from './pages/CalendarPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { HomePage } from './pages/HomePage';
import { InterviewsPage } from './pages/InterviewsPage';
import { JobsPage } from './pages/JobsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ConsultationsPage } from './pages/ConsultationsPage';
import { ImportsPage } from './pages/ImportsPage';
import type { View } from './types';

const views: View[] = ['home', 'applications', 'documents', 'calendar', 'career', 'imports', 'consultations', 'jobs', 'interviews'];

function viewFromUrl(): View {
  const value = new URLSearchParams(window.location.search).get('view');
  return views.includes(value as View) ? value as View : 'home';
}

export default function App() {
  const folio = useFolio();
  const [view, setView] = useState<View>(viewFromUrl);
  const navigate = useCallback((next: View) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === 'home') url.searchParams.delete('view'); else url.searchParams.set('view', next);
    window.history.pushState(null, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPopState = () => setView(viewFromUrl());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (folio.loading) return <div className="app-loading"><span className="brand-mark">F</span><p>워크스페이스를 불러오는 중...</p></div>;
  if (!folio.user) return <div className="login-screen"><section className="login-card"><span className="brand-mark login-mark">F</span><p className="eyebrow">PERSONAL CAREER WORKSPACE</p><h1>취업 준비를<br />한곳에서 관리하세요.</h1><p>지원 현황, 일정, 회사별 문서와 내 이력서를 안전하게 연결합니다.</p>{folio.error && <div className="login-error">{folio.error}</div>}<button className="google-login" onClick={api.loginWithGoogle}><span>G</span> Google로 계속하기</button><small>로그인하면 서비스 이용약관과 개인정보 처리방침에 동의하게 됩니다.</small></section></div>;

  const page = {
    home: <HomePage workspace={folio.workspace} navigate={navigate} mutate={folio.mutate} />,
    applications: <ApplicationsPage workspace={folio.workspace} navigate={navigate} mutate={folio.mutate} />,
    documents: <DocumentsPage workspace={folio.workspace} navigate={navigate} mutate={folio.mutate} />,
    calendar: <CalendarPage workspace={folio.workspace} navigate={navigate} />,
    career: <ProfilePage workspace={folio.workspace} mutate={folio.mutate} onDeleteAccount={folio.deleteAccount} />,
    consultations: <ConsultationsPage workspace={folio.workspace} mutate={folio.mutate} />,
    imports: <ImportsPage mutate={folio.mutate} />,
    jobs: <JobsPage workspace={folio.workspace} navigate={navigate} mutate={folio.mutate} />,
    interviews: <InterviewsPage workspace={folio.workspace} navigate={navigate} mutate={folio.mutate} />
  }[view];

  return <Layout view={view} navigate={navigate} user={folio.user} workspace={folio.workspace} syncState={folio.syncState} error={folio.error} onLogout={() => void folio.logout()}>{page}</Layout>;
}

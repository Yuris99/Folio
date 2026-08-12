import { useState, type ReactNode } from 'react';
import type { User, View, Workspace } from '../types';

const navItems: Array<{ view: View; icon: string; label: string; mobile?: boolean }> = [
  { view: 'home', icon: '⌂', label: '홈', mobile: true },
  { view: 'applications', icon: '▦', label: '지원 관리', mobile: true },
  { view: 'calendar', icon: '◫', label: '일정', mobile: true },
  { view: 'career', icon: '◇', label: '커리어', mobile: true },
  { view: 'interviews', icon: '◉', label: '면접' },
  { view: 'jobs', icon: '▤', label: '공고 보관함' }
];

export function Layout({ view, navigate, user, workspace, syncState, error, onLogout, children }: {
  view: View;
  navigate: (view: View) => void;
  user: User;
  workspace: Workspace;
  syncState: string;
  error: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const profileName = workspace.profile.name || user.name;
  const move = (next: View) => { navigate(next); setMenuOpen(false); };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand brand-button" onClick={() => move('home')}><span className="brand-mark">F</span><span>folio</span></button>
        <nav className="nav" aria-label="주요 메뉴">
          {navItems.map((item) => <button key={item.view} className={`nav-item ${view === item.view ? 'active' : ''} ${item.view === 'jobs' ? 'sub-item' : ''}`} onClick={() => move(item.view)}><span>{item.icon}</span>{item.label}</button>)}
        </nav>
        <div className="sidebar-bottom"><button className="profile-card profile-button" onClick={() => move('career')}><div className="avatar">{profileName[0] || '나'}</div><div><strong>{profileName}</strong><small>{workspace.profile.role || '희망 직무'}</small></div></button></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="mobile-brand brand-button" onClick={() => move('home')}><span className="brand-mark">F</span>folio</button>
          <div className="top-actions">
            <span className={`sync-state ${error ? 'error' : ''}`}>{error || syncState}</span>
            <button className="header-user" onClick={onLogout} title="로그아웃"><span>{user.name[0] || '나'}</span><small>{user.name}</small></button>
            <button className="mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label="메뉴 열기"><span /><span /></button>
          </div>
        </header>
        {error && <div className="toast show">{error}</div>}
        <section className={`content ${view === 'home' ? 'home-view' : ''}`}>{children}</section>
      </main>
      <nav className="mobile-bottom-nav" aria-label="모바일 주요 메뉴">
        {navItems.filter((item) => item.mobile).map((item) => <button key={item.view} className={`nav-item ${view === item.view ? 'active' : ''}`} onClick={() => move(item.view)}><span>{item.icon}</span><small>{item.label.replace(' 관리', '')}</small></button>)}
      </nav>
      {menuOpen && <div className="mobile-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }}><section className="mobile-menu-sheet react-sheet"><div className="sheet-handle" /><div className="sheet-head"><button className="sheet-home" onClick={() => move('home')}><span className="brand-mark">F</span> 홈</button><button className="modal-close" onClick={() => setMenuOpen(false)}>×</button></div><nav>{navItems.map((item) => <button key={item.view} onClick={() => move(item.view)}><span>{item.icon}</span><div><strong>{item.label}</strong><small>{item.view === 'career' ? '이력서를 모아 LLM용 데이터로 정리' : item.view === 'jobs' ? '저장한 채용 공고' : '화면으로 이동'}</small></div><i>→</i></button>)}</nav></section></div>}
    </div>
  );
}

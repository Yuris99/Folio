import { useState, type ReactNode } from 'react';
import type { User, View, Workspace } from '../types';
import { Icon, type IconName } from './Icon';

type NavItem = { view: View; icon: IconName; label: string; mobile?: string };
const navGroups: Array<{ label: string; items: NavItem[] }> = [
  { label: '', items: [
    { view: 'home', icon: 'home', label: '홈', mobile: '홈' }
  ] },
  { label: '지원', items: [
    { view: 'applications', icon: 'briefcase', label: '지원 관리', mobile: '지원' },
    { view: 'calendar', icon: 'calendar', label: '일정', mobile: '일정' },
    { view: 'jobs', icon: 'bookmark', label: '공고보관함', mobile: '공고' },
    { view: 'interviews', icon: 'mic', label: '면접' },
    { view: 'stats', icon: 'chart', label: '통계', mobile: '통계' }
  ] },
  { label: '자료', items: [
    { view: 'vault', icon: 'archive', label: '통합 보관함' },
    { view: 'consultations', icon: 'message', label: '상담·Q&A' },
    { view: 'career', icon: 'user', label: '커리어' },
    { view: 'imports', icon: 'download', label: 'AI 가져오기' }
  ] }
];
const navItems = navGroups.flatMap((group) => group.items);
// 모바일 하단 탭 순서
const mobileOrder: View[] = ['home', 'applications', 'calendar', 'stats', 'jobs'];

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
    <div className={`app-shell view-${view}`}>
      <aside className="sidebar">
        <button className="brand brand-button" onClick={() => move('home')}><span className="brand-mark">F</span><span>folio</span></button>
        <nav className="nav" aria-label="주요 메뉴">
          {navGroups.map((group) => <div className="nav-group" key={group.label || 'main'}>
            {group.label && <p className="nav-group-label">{group.label}</p>}
            {group.items.map((item) => <button key={item.view} className={`nav-item ${view === item.view ? 'active' : ''}`} aria-current={view === item.view ? 'page' : undefined} onClick={() => move(item.view)}><span><Icon name={item.icon} /></span>{item.label}</button>)}
          </div>)}
        </nav>
        <div className="sidebar-bottom"><button className="profile-card profile-button" onClick={() => move('career')}><div className="avatar">{profileName[0] || '나'}</div><div><strong>{profileName}</strong><small>{workspace.profile.role || '희망 직무'}</small></div></button></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="mobile-brand brand-button" onClick={() => move('home')}><span className="brand-mark">F</span>folio</button>
          <div className="top-actions">
            <span className={`sync-state ${error ? 'error' : ''}`}>{error || syncState}</span>
            <button className="header-user" onClick={onLogout} title="로그아웃"><span>{user.name[0] || '나'}</span><small>{user.name}</small><Icon name="logout" size={15} /></button>
            <button className="mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label="메뉴 열기"><Icon name="menu" size={20} /></button>
          </div>
        </header>
        {error && <div className="toast show">{error}</div>}
        <section className={`content ${view === 'home' ? 'home-view' : ''}`}>{children}</section>
      </main>
      <nav className="mobile-bottom-nav" aria-label="모바일 주요 메뉴">
        {mobileOrder.map((key) => navItems.find((item) => item.view === key)!).map((item) => <button key={item.view} className={`nav-item ${view === item.view ? 'active' : ''}`} aria-current={view === item.view ? 'page' : undefined} onClick={() => move(item.view)}><span><Icon name={item.icon} size={20} /></span><small>{item.mobile}</small></button>)}
      </nav>
      {menuOpen && <div className="mobile-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }}><section className="mobile-menu-sheet react-sheet"><div className="sheet-handle" /><div className="sheet-head"><button className="sheet-home" onClick={() => move('home')}><span className="brand-mark">F</span> 홈</button><button className="modal-close" onClick={() => setMenuOpen(false)}>×</button></div><nav>{navItems.map((item) => <button key={item.view} className={view === item.view ? 'active' : ''} onClick={() => move(item.view)}><span><Icon name={item.icon} /></span><div><strong>{item.label}</strong><small>{item.view === 'career' ? '이력서를 모아 LLM용 데이터로 정리' : '화면으로 이동'}</small></div><i>→</i></button>)}</nav></section></div>}
    </div>
  );
}

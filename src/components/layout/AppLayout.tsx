import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import Sidebar from './Sidebar';
import Header from './Header';
import { Gauge, Target, Paperclip, BookOpen, List, X, ChartBar, MagnifyingGlass, Gear, ListChecks } from '@phosphor-icons/react';

const mobileTabs = [
  { to: '/', icon: Gauge, label: '看板' },
  { to: '/goals', icon: Target, label: '目标' },
  { to: '/clips', icon: Paperclip, label: '剪藏' },
  { to: '/journal', icon: BookOpen, label: '日记' },
];

const moreItems = [
  { to: '/tasks', icon: ListChecks, label: '任务列表' },
  { to: '/analytics', icon: ChartBar, label: '分析统计' },
  { to: '/search', icon: MagnifyingGlass, label: '全局搜索' },
  { to: '/settings', icon: Gear, label: '设置' },
];

function MobileBottomNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="button" aria-label="关闭菜单" tabIndex={0}
          onClick={() => setMoreOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMoreOpen(false); } }}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-[72px] left-4 right-4 bg-surface rounded-2xl shadow-xl border border-border p-3 animate-[slideUp_0.2s_ease-out]">
            {moreItems.map(({ to, icon: Icon, label }) => {
              const active = location.pathname.startsWith(to);
              return (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-body transition-colors ${
                    active ? 'bg-primary/10 text-primary font-medium' : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <Icon size={20} />
                  {label}
                </NavLink>
              );
            })}
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-surface border-t border-border safe-bottom">
        <div className="flex items-center justify-around h-[64px] px-2">
          {mobileTabs.map(({ to, icon: Icon, label }) => {
            const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 min-w-[56px] py-1 px-2 rounded-lg transition-colors ${
                  isActive ? 'text-primary' : 'text-text-secondary'
                }`}
              >
                <Icon size={22} />
                <span className="text-[10px] font-medium">{label}</span>
              </NavLink>
            );
          })}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center gap-0.5 min-w-[56px] py-1 px-2 rounded-lg transition-colors ${
              moreOpen ? 'text-primary' : 'text-text-secondary'
            }`}
          >
            {moreOpen ? <X weight="bold" size={22} /> : <List size={22} />}
            <span className="text-[10px] font-medium">更多</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default function AppLayout() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <div className="min-h-screen bg-bg">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className={`transition duration-200 md:ml-[220px] ${collapsed ? 'md:ml-[60px]' : ''} pb-[72px] md:pb-0`}>
        <Header />
        <main className="px-3 md:px-5 py-4 md:py-6 max-w-[960px] mx-auto page-enter">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}

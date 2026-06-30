import { NavLink, useLocation } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import { useAuth } from '@/lib/auth';
import { Gauge, Target, ChartBar, BookOpen, MagnifyingGlass, Gear, CaretLeft, CaretRight, Paperclip, ListChecks, SignOut, User } from '@phosphor-icons/react';

const navItems = [
  { to: '/', icon: Gauge, label: '今日看板' },
  { to: '/goals', icon: Target, label: '目标规划' },
  { to: '/tasks', icon: ListChecks, label: '任务列表' },
  { to: '/analytics', icon: ChartBar, label: '分析统计' },
  { to: '/journal', icon: BookOpen, label: '反思日记' },
  { to: '/clips', icon: Paperclip, label: '剪藏' },
  { to: '/search', icon: MagnifyingGlass, label: '全局搜索' },
  { to: '/settings', icon: Gear, label: '设置' },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = user?.user_metadata?.full_name as string | undefined ?? user?.user_metadata?.name as string | undefined;
  const email = user?.email;

  return (
    <aside className={`fixed left-0 top-0 h-full bg-surface border-r border-border flex flex-col z-10 transition duration-200 ${
      collapsed ? 'w-[60px]' : 'w-[220px]'
    }`}>
      {/* Logo */}
      <div className={`px-5 py-6 border-b border-border flex items-center ${collapsed ? 'justify-center px-0' : ''}`}>
        {collapsed ? (
          <span className="text-xl text-primary font-bold">✓</span>
        ) : (
          <h1 className="text-h3 text-primary flex items-center gap-2">
            <span className="text-2xl">✓</span>
            TaskTracker
          </h1>
        )}
      </div>

      {/* Nav Items */}
      <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-btn text-body transition-colors duration-150 ${
                collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
              } ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
            >
              <Icon size={20} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User section */}
      <div className={`border-t border-border ${collapsed ? 'px-2' : 'px-3'} py-3`}>
        {collapsed ? (
          <div className="flex justify-center">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full border border-border"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={16} className="text-primary" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full border border-border flex-shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              {displayName && (
                <p className="text-small font-medium text-text-primary truncate">{displayName}</p>
              )}
              {email && (
                <p className="text-[10px] text-text-secondary truncate">{email}</p>
              )}
            </div>
            <button
              onClick={signOut}
              className="flex-shrink-0 p-1 rounded text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors"
              title="退出登录"
            >
              <SignOut size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Toggle button */}
      <div className={`border-t border-border ${collapsed ? 'px-2' : 'px-5'} py-4`}>
        <button
          onClick={toggleSidebar}
          className={`flex items-center gap-2 text-caption text-text-secondary hover:text-text-primary transition-colors w-full ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {collapsed ? <CaretRight size={18} /> : (
            <>
              <CaretLeft weight="bold" size={18} />
              <span>收起菜单</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

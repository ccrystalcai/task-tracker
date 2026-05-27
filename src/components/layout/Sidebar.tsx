import { NavLink, useLocation } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import {
  LayoutDashboard,
  Target,
  BarChart3,
  BookOpen,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '今日看板' },
  { to: '/goals', icon: Target, label: '目标规划' },
  { to: '/analytics', icon: BarChart3, label: '分析统计' },
  { to: '/journal', icon: BookOpen, label: '反思日记' },
  { to: '/search', icon: Search, label: '全局搜索' },
  { to: '/settings', icon: Settings, label: '设置' },
];

export default function Sidebar() {
  const location = useLocation();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <aside className={`fixed left-0 top-0 h-full bg-surface border-r border-border flex flex-col z-10 transition-all duration-200 ${
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

      {/* Toggle button */}
      <div className={`border-t border-border ${collapsed ? 'px-2' : 'px-5'} py-4`}>
        <button
          onClick={toggleSidebar}
          className={`flex items-center gap-2 text-caption text-text-secondary hover:text-text-primary transition-colors w-full ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {collapsed ? <ChevronRight size={18} /> : (
            <>
              <ChevronLeft size={18} />
              <span>收起菜单</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

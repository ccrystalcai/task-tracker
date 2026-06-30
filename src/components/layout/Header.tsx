import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { MagnifyingGlass, Calendar, SignOut, User } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useAuth } from '@/lib/auth';

const pageTitles: Record<string, string> = {
  '/': '今日看板',
  '/goals': '目标规划',
  '/tasks': '任务列表',
  '/analytics': '分析统计',
  '/journal': '反思日记',
  '/search': '全局搜索',
  '/settings': '设置',
  '/clips': '剪藏',
};

export default function Header() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const title = pageTitles[location.pathname] ?? '';
  const today = useMemo(() => format(new Date(), 'yyyy年M月d日 EEEE', { locale: zhCN }), []);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = user?.user_metadata?.full_name as string | undefined ?? user?.user_metadata?.name as string | undefined;
  const email = user?.email;

  return (
    <header className="h-12 md:h-16 border-b border-border bg-surface flex items-center justify-between px-4 md:px-6">
      <div>
        <h2 className="text-body md:text-h2 text-text-primary font-semibold">{title}</h2>
        <p className="hidden md:flex text-caption text-text-secondary items-center gap-1 mt-0.5">
          <Calendar weight="duotone" size={13} />
          {today}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Desktop search button — hidden on mobile */}
        <Link
          to="/search"
          className="hidden md:flex items-center gap-2 px-4 py-2 rounded-btn border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          <MagnifyingGlass weight="duotone" size={18} />
          <span className="text-body">搜索任务…</span>
          <kbd className="text-small px-1.5 py-0.5 rounded bg-surface-hover border border-border ml-2">
            ⌘K
          </kbd>
        </Link>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 rounded-btn hover:bg-surface-hover transition-colors p-1 md:px-2 md:py-1"
            title={displayName ?? email ?? '用户'}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName ?? ''}
                className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-border"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={16} className="text-primary" />
              </div>
            )}
            {displayName && (
              <span className="hidden md:inline text-body text-text-primary max-w-[100px] truncate">
                {displayName}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-surface rounded-card shadow-lg border border-border z-50 animate-[fadeInUp_0.15s_ease-out]">
              {/* User info */}
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="w-10 h-10 rounded-full border border-border"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User size={20} className="text-primary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    {displayName && (
                      <p className="text-body font-medium text-text-primary truncate">{displayName}</p>
                    )}
                    {email && (
                      <p className="text-caption text-text-secondary truncate">{email}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Sign out */}
              <div className="p-2">
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    await signOut();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-btn text-body text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors"
                >
                  <SignOut size={18} />
                  <span>退出登录</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

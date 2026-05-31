import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { MagnifyingGlass, Calendar } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

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
  const title = pageTitles[location.pathname] ?? '';
  const today = useMemo(() => format(new Date(), 'yyyy年M月d日 EEEE', { locale: zhCN }), []);

  return (
    <header className="h-12 md:h-16 border-b border-border bg-surface flex items-center justify-between px-4 md:px-6">
      <div>
        <h2 className="text-body md:text-h2 text-text-primary font-semibold">{title}</h2>
        <p className="hidden md:flex text-caption text-text-secondary items-center gap-1 mt-0.5">
          <Calendar weight="duotone" size={13} />
          {today}
        </p>
      </div>

      {/* Desktop search button — hidden on mobile */}
      <Link         to="/search"
        className="hidden md:flex items-center gap-2 px-4 py-2 rounded-btn border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
      >
        <MagnifyingGlass weight="duotone" size={18} />
        <span className="text-body">搜索任务…</span>
        <kbd className="text-small px-1.5 py-0.5 rounded bg-surface-hover border border-border ml-2">
          ⌘K
        </kbd>
      </Link>
    </header>
  );
}

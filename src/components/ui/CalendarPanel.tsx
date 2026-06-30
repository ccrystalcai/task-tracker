import { useMemo } from 'react';
import {
  format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import DayView from './DayView';
import WeekView from './WeekView';
import MonthView from './MonthView';
import type { Task, Tag } from '@/db/schema';

export type CalendarTab = 'day' | 'week' | 'month';

interface Props {
  tab: CalendarTab;
  tasks: Task[];
  tags: Tag[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onCreateTask: (date: string, dueTime?: string) => void;
  onSelectTask: (task: Task) => void;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
}

export default function CalendarPanel({ tab, ...props }: Props) {
  const { selectedDate, onSelectDate } = props;

  const today = useMemo(() => new Date(), []);
  const viewDate = useMemo(() => new Date(selectedDate + 'T12:00:00'), [selectedDate]);

  const title = useMemo(() => {
    if (tab === 'month') return format(viewDate, 'yyyy年M月', { locale: zhCN });
    if (tab === 'week') {
      const d = new Date(selectedDate + 'T12:00:00');
      const day = d.getDay() || 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - day + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return `${format(monday, 'M月d日', { locale: zhCN })} – ${format(sunday, 'M月d日', { locale: zhCN })}`;
    }
    return format(viewDate, 'yyyy年M月d日 EEEE', { locale: zhCN });
  }, [tab, viewDate, selectedDate]);

  const goToday = () => {
    onSelectDate(format(today, 'yyyy-MM-dd'));
  };

  const nav = (dir: -1 | 1) => {
    const d = new Date(selectedDate + 'T12:00:00');
    let next: Date;
    if (tab === 'month') {
      next = dir < 0 ? subMonths(d, 1) : addMonths(d, 1);
    } else if (tab === 'week') {
      next = dir < 0 ? subWeeks(d, 1) : addWeeks(d, 1);
    } else {
      next = dir < 0 ? subDays(d, 1) : addDays(d, 1);
    }
    onSelectDate(format(next, 'yyyy-MM-dd'));
  };

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header: Navigation only (tabs are now in the parent view switcher) */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        {/* Title + Nav */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => nav(-1)}
            className="p-1 rounded hover:bg-surface-hover text-text-secondary"
          >
            <CaretLeft size={16} weight="bold" />
          </button>
          <h3 className="text-sm font-semibold min-w-[120px] text-center select-none">
            {title}
          </h3>
          <button
            onClick={() => nav(1)}
            className="p-1 rounded hover:bg-surface-hover text-text-secondary"
          >
            <CaretRight size={16} weight="bold" />
          </button>
        </div>

        <button
          onClick={goToday}
          className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition"
        >
          今天
        </button>
      </div>

      {/* Content */}
      {tab === 'day' && <DayView {...props} />}
      {tab === 'week' && <WeekView {...props} />}
      {tab === 'month' && <MonthView {...props} />}
    </div>
  );
}

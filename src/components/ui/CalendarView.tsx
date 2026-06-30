import { useMemo, useState, useCallback } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, addWeeks, subWeeks,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CaretLeft, CaretRight, Plus } from '@phosphor-icons/react';
import type { Task } from '@/db/schema';

interface Props {
  tasks: Task[];
  selectedDate: string;        // yyyy-MM-dd
  onSelectDate: (date: string) => void;
  onCreateTask: (date: string) => void;
  onSelectTask: (task: Task) => void;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
}

type ViewMode = 'month' | 'week';

export default function CalendarView({
  tasks, selectedDate, onSelectDate, onCreateTask, onSelectTask, onUpdateTask,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [viewDate, setViewDate] = useState(new Date());
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Group tasks by dueDate
  const taskMap = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!t.dueDate) continue;
      if (!map[t.dueDate]) map[t.dueDate] = [];
      map[t.dueDate].push(t);
    }
    // Sort each day's tasks: incomplete first, then by priority
    for (const d of Object.keys(map)) {
      map[d].sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (b.status === 'completed' && a.status !== 'completed') return -1;
        return 0;
      });
    }
    return map;
  }, [tasks]);

  const days = useMemo(() => {
    if (viewMode === 'week') {
      const s = startOfWeek(viewDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: s, end: endOfWeek(viewDate, { weekStartsOn: 1 }) });
    }
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMode, viewDate]);

  const today = new Date();
  const sel = new Date(selectedDate + 'T12:00:00');

  const nav = (dir: -1 | 1) => {
    setViewDate(viewMode === 'month'
      ? (dir < 0 ? subMonths : addMonths)(viewDate, 1)
      : (dir < 0 ? subWeeks : addWeeks)(viewDate, 1));
  };

  const goToday = () => {
    setViewDate(today);
    onSelectDate(format(today, 'yyyy-MM-dd'));
  };

  // Drag handlers
  const onDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateStr);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) onUpdateTask(taskId, { dueDate: dateStr });
  }, [onUpdateTask]);

  const weekHeaders = ['一', '二', '三', '四', '五', '六', '日'];

  const isCurrent = viewMode === 'week' || (viewDate.getMonth() === today.getMonth() && viewDate.getFullYear() === today.getFullYear());

  return (
    <div className="card space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-h3">
          {viewMode === 'month'
            ? format(viewDate, 'yyyy年M月', { locale: zhCN })
            : format(days[0], 'M月d日', { locale: zhCN }) + ' – ' + format(days[6], 'M月d日', { locale: zhCN })
          }
        </h3>
        <div className="flex items-center gap-1">
          {/* View toggle */}
          <div className="flex rounded-lg bg-surface-hover p-0.5 mr-1">
            {(['month', 'week'] as ViewMode[]).map((m) => (
              <button key={m}
                onClick={() => setViewMode(m)}
                className={`px-2 py-0.5 rounded-md text-small transition ${
                  viewMode === m ? 'bg-surface text-text-primary shadow-sm font-medium' : 'text-text-secondary'
                }`}
              >
                {m === 'month' ? '月' : '周'}
              </button>
            ))}
          </div>
          <button onClick={() => nav(-1)} className="p-1 rounded hover:bg-surface-hover text-text-secondary">
            <CaretLeft size={16} weight="bold" />
          </button>
          <button onClick={goToday}
            className={`px-2 py-0.5 rounded text-small transition ${
              isCurrent ? 'text-text-secondary hover:text-primary' : 'text-primary font-semibold'
            }`}
          >
            今天
          </button>
          <button onClick={() => nav(1)} className="p-1 rounded hover:bg-surface-hover text-text-secondary">
            <CaretRight size={16} weight="bold" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center border-b border-border pb-1.5">
        {weekHeaders.map((h, i) => (
          <div key={h} className={`text-small py-0.5 font-medium ${
            i >= 5 ? 'text-text-secondary/60' : 'text-text-secondary'
          }`}>
            {h}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const ds = format(day, 'yyyy-MM-dd');
          const dayTasks = taskMap[ds] ?? [];
          const isActive = isSameDay(day, sel);
          const isTodayDay = isToday(day);
          const inMonth = viewMode === 'week' || isSameMonth(day, viewDate);
          const isDragOver = dragOverDate === ds;
          const maxVisible = viewMode === 'month' ? 3 : 6;

          return (
            <div
              key={ds}
              onClick={() => onSelectDate(ds)}
              onDragOver={(e) => onDragOver(e, ds)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, ds)}
              className={`
                relative min-h-[64px] md:min-h-[80px] p-1 border-b border-r border-border
                cursor-pointer transition-colors group
                ${!inMonth ? 'bg-surface-hover/50 opacity-30' : ''}
                ${isActive ? 'bg-primary/5 ring-1 ring-inset ring-primary/30' : ''}
                ${isDragOver ? 'bg-primary/10 ring-2 ring-primary/40' : ''}
                ${viewMode === 'week' ? 'min-h-[100px] md:min-h-[120px]' : ''}
              `}
            >
              {/* Date number + quick-add */}
              <div className="flex items-center justify-between mb-0.5 px-0.5">
                <span className={`
                  text-[12px] leading-none w-5 h-5 flex items-center justify-center rounded-full
                  ${isActive
                    ? 'bg-primary text-white font-bold'
                    : isTodayDay
                      ? 'bg-danger text-white font-bold'
                      : inMonth ? 'text-text-primary' : 'text-text-secondary/40'
                  }
                `}>
                  {format(day, 'd')}
                </span>
                {inMonth && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCreateTask(ds); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-primary/10 text-text-secondary hover:text-primary transition-all"
                    title="添加任务"
                  >
                    <Plus size={12} weight="bold" />
                  </button>
                )}
              </div>

              {/* Task pills */}
              <div className="space-y-0.5 overflow-hidden">
                {dayTasks.slice(0, maxVisible).map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, t.id)}
                    onClick={(e) => { e.stopPropagation(); onSelectTask(t); }}
                    className={`
                      text-[10px] md:text-[11px] leading-tight px-1 py-0.5 rounded-sm truncate
                      cursor-pointer transition-colors
                      ${t.status === 'completed'
                        ? 'bg-success/15 text-success line-through opacity-60'
                        : t.dueDate < format(today, 'yyyy-MM-dd')
                          ? 'bg-danger/10 text-danger'
                          : 'bg-primary/10 text-primary'
                      }
                      hover:brightness-90 active:cursor-grabbing
                    `}
                    title={t.title}
                  >
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > maxVisible && (
                  <div className="text-[10px] text-text-secondary px-1 font-medium">
                    +{dayTasks.length - maxVisible} 更多
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

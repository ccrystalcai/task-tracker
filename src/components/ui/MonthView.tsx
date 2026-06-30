import { useMemo, useState, useCallback } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay,
} from 'date-fns';
import { Plus } from '@phosphor-icons/react';
import type { Task, Tag } from '@/db/schema';

interface Props {
  tasks: Task[];
  tags: Tag[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onCreateTask: (date: string) => void;
  onSelectTask: (task: Task) => void;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
}

function getTagColor(taskTags: string[], allTags: Tag[]): string {
  if (taskTags.length === 0) return '#94A3B8';
  const t = allTags.find((tag) => tag.id === taskTags[0]);
  return t?.color || '#94A3B8';
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export default function MonthView({ tasks, tags, selectedDate, onSelectDate, onCreateTask, onSelectTask, onUpdateTask }: Props) {
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const days = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    const monthStart = startOfMonth(d);
    const monthEnd = endOfMonth(d);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [selectedDate]);

  const taskMap = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!t.dueDate) continue;
      if (!map[t.dueDate]) map[t.dueDate] = [];
      map[t.dueDate].push(t);
    }
    for (const d of Object.keys(map)) {
      map[d].sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (b.status === 'completed' && a.status !== 'completed') return -1;
        return (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99');
      });
    }
    return map;
  }, [tasks]);

  const viewDate = useMemo(() => new Date(selectedDate + 'T12:00:00'), [selectedDate]);
  const sel = new Date(selectedDate + 'T12:00:00');
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const onDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateStr);
  }, []);

  const onDrop = useCallback((e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) onUpdateTask(taskId, { dueDate: dateStr });
  }, [onUpdateTask]);

  const MAX_VISIBLE = 3;

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center border-b border-border/50 bg-surface-hover/30">
        {WEEKDAYS.map((h, i) => (
          <div key={h} className={`text-[11px] py-2 font-medium border-r border-border/50 last:border-r-0 ${
            i >= 5 ? 'text-text-secondary/40' : 'text-text-secondary/60'
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
          const isTodayDay = ds === todayStr;
          const inMonth = isSameMonth(day, viewDate);
          const isDragOver = dragOverDate === ds;

          return (
            <div
              key={ds}
              onClick={() => onSelectDate(ds)}
              onDragOver={(e) => onDragOver(e, ds)}
              onDragLeave={() => setDragOverDate(null)}
              onDrop={(e) => onDrop(e, ds)}
              className={`
                relative min-h-[68px] md:min-h-[82px] p-1 border-b border-r border-border/50 last:border-r-0
                cursor-pointer transition-colors group
                ${!inMonth ? 'bg-surface-hover/30 opacity-25' : ''}
                ${isActive ? 'bg-primary/[0.04] ring-1 ring-inset ring-primary/20' : ''}
                ${isDragOver ? 'bg-primary/10 ring-2 ring-primary/30' : ''}
              `}
            >
              {/* Date number */}
              <div className="flex items-center justify-between px-0.5 mb-0.5">
                <span className={`
                  text-[11px] leading-none w-5 h-5 flex items-center justify-center rounded-full font-medium
                  ${isActive
                    ? 'bg-primary text-white'
                    : isTodayDay
                      ? 'bg-[#FF3B30] text-white'
                      : inMonth ? 'text-text-primary' : 'text-text-secondary/30'
                  }
                `}>
                  {format(day, 'd')}
                </span>
                {inMonth && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCreateTask(ds); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-black/5 text-text-secondary/30 hover:text-primary transition-all"
                    title="添加任务"
                  >
                    <Plus size={11} weight="bold" />
                  </button>
                )}
              </div>

              {/* Task pills */}
              <div className="space-y-[1px]">
                {dayTasks.slice(0, MAX_VISIBLE).map((t) => {
                  const color = getTagColor(t.tags, tags);
                  const done = t.status === 'completed';
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, t.id)}
                      onClick={(e) => { e.stopPropagation(); onSelectTask(t); }}
                      className="flex items-center gap-1 text-[10px] md:text-[11px] px-1.5 py-[2px] rounded-md transition hover:brightness-95 active:cursor-grabbing cursor-pointer truncate"
                      style={{ backgroundColor: color + '13' }}
                      title={t.title}
                    >
                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className={`truncate ${done ? 'line-through opacity-50' : ''}`}>
                        {t.title}
                      </span>
                    </div>
                  );
                })}
                {dayTasks.length > MAX_VISIBLE && (
                  <div className="text-[10px] text-text-secondary/50 px-1 font-medium">
                    +{dayTasks.length - MAX_VISIBLE}
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

import { useMemo, useState, useCallback } from 'react';
import {
  format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay,
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
const today = new Date();
const todayStr = format(today, 'yyyy-MM-dd');

export default function WeekView({ tasks, tags, selectedDate, onSelectDate, onCreateTask, onSelectTask, onUpdateTask }: Props) {
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const weekDays = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    const s = startOfWeek(d, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: s, end: endOfWeek(d, { weekStartsOn: 1 }) });
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
        // Sort by dueTime
        return (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99');
      });
    }
    return map;
  }, [tasks]);

  const sel = new Date(selectedDate + 'T12:00:00');

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

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border/50 bg-surface-hover/30">
        {WEEKDAYS.map((name, i) => {
          const day = weekDays[i];
          const ds = format(day, 'yyyy-MM-dd');
          const isActive = isSameDay(day, sel);
          const isTodayDay = ds === todayStr;
          return (
            <button
              key={ds}
              onClick={() => onSelectDate(ds)}
              className={`text-center py-2.5 border-r border-border/50 last:border-r-0 transition-colors ${
                isActive ? 'bg-primary/5' : 'hover:bg-surface-hover'
              }`}
            >
              <div className="text-[11px] text-text-secondary/70 mb-1">{name}</div>
              <div
                className={`text-sm font-semibold w-7 h-7 mx-auto rounded-full flex items-center justify-center leading-none ${
                  isActive ? 'bg-primary text-white' :
                  isTodayDay ? 'bg-[#FF3B30] text-white' :
                  ''
                }`}
              >
                {format(day, 'd')}
              </div>
            </button>
          );
        })}
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7">
        {weekDays.map((day) => {
          const ds = format(day, 'yyyy-MM-dd');
          const dayTasks = taskMap[ds] ?? [];
          const isActive = isSameDay(day, sel);
          const isDragOver = dragOverDate === ds;

          return (
            <div
              key={ds}
              onClick={() => onSelectDate(ds)}
              onDragOver={(e) => onDragOver(e, ds)}
              onDragLeave={() => setDragOverDate(null)}
              onDrop={(e) => onDrop(e, ds)}
              className={`
                min-h-[130px] p-1.5 border-b border-r border-border/50 last:border-r-0
                cursor-pointer transition-colors group
                ${isActive ? 'bg-primary/[0.03]' : ''}
                ${isDragOver ? 'bg-primary/10 ring-2 ring-primary/20 rounded-lg' : ''}
              `}
            >
              {/* Quick-add button */}
              <div className="flex justify-end mb-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onCreateTask(ds); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-black/5 text-text-secondary/40 hover:text-primary transition-all"
                  title="添加任务"
                >
                  <Plus size={13} weight="bold" />
                </button>
              </div>

              {/* Task pills */}
              <div className="space-y-0.5">
                {dayTasks.map((t) => {
                  const color = getTagColor(t.tags, tags);
                  const done = t.status === 'completed';
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, t.id)}
                      onClick={(e) => { e.stopPropagation(); onSelectTask(t); }}
                      className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md transition hover:brightness-95 active:cursor-grabbing cursor-pointer"
                      style={{ backgroundColor: color + '14' }}
                      title={t.title + (t.dueTime ? ` · ${t.dueTime.substring(0, 5)}` : '')}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className={`truncate flex-1 ${done ? 'line-through opacity-50' : ''}`}>
                        {t.title}
                      </span>
                      {t.dueTime && (
                        <span className="text-[10px] text-text-secondary/50 flex-shrink-0 font-mono">
                          {t.dueTime.substring(0, 5)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Sun, Moon, CaretRight } from '@phosphor-icons/react';
import type { Task, Tag } from '@/db/schema';

interface Props {
  tasks: Task[];
  tags: Tag[];
  selectedDate: string;
  onSelectTask: (task: Task) => void;
  onCreateTask: (date: string, dueTime?: string) => void;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
}

function getTagColor(taskTags: string[], allTags: Tag[]): string {
  if (taskTags.length === 0) return '#94A3B8';
  const t = allTags.find((tag) => tag.id === taskTags[0]);
  return t?.color || '#94A3B8';
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

const START_HOUR = 6;
const END_HOUR = 24;

export default function DayView({ tasks, tags, selectedDate, onSelectTask, onCreateTask, onUpdateTask }: Props) {
  const [showNight, setShowNight] = useState(false);

  const dayTasks = useMemo(() =>
    tasks.filter((t) => t.dueDate === selectedDate),
  [tasks, selectedDate]);

  const allDayTasks = useMemo(() =>
    dayTasks.filter((t) => !t.dueTime),
  [dayTasks]);

  const plannedTasks = useMemo(() =>
    dayTasks.filter((t) => !!t.dueTime).sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || '')),
  [dayTasks]);

  const actualTasks = useMemo(() =>
    dayTasks
      .filter((t) => t.status === 'completed' || t.actualStartTime)
      .sort((a, b) => {
        const aTime = a.actualStartTime || '';
        const bTime = b.actualStartTime || '';
        return aTime.localeCompare(bTime);
      }),
  [dayTasks]);

  const hasNightActivity = useMemo(() => {
    return dayTasks.some((t) => {
      if (!t.actualStartTime) return false;
      const mins = timeToMinutes(t.actualStartTime);
      return mins >= 0 && mins < 360;
    });
  }, [dayTasks]);

  const hours = useMemo(() => {
    const result = [];
    for (let h = START_HOUR; h < END_HOUR; h++) result.push(h);
    return result;
  }, []);

  const plannedByHour = useMemo(() => {
    const map: Record<number, Task[]> = {};
    for (const h of hours) map[h] = [];
    for (const t of plannedTasks) {
      const h = parseInt(t.dueTime!.split(':')[0], 10);
      if (h >= START_HOUR && h < END_HOUR) map[h].push(t);
    }
    return map;
  }, [plannedTasks, hours]);

  const actualByHour = useMemo(() => {
    const map: Record<number, Task[]> = {};
    for (const h of hours) map[h] = [];
    for (const t of actualTasks) {
      if (!t.actualStartTime) continue;
      const h = parseInt(t.actualStartTime.split(':')[0], 10);
      if (h >= START_HOUR && h < END_HOUR) map[h].push(t);
    }
    return map;
  }, [actualTasks, hours]);

  const formatDuration = (mins: number) =>
    mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60 ? `${mins % 60}m` : ''}` : `${mins}m`;

  const onDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div>
      {/* --- All-day tasks --- */}
      {allDayTasks.length > 0 && (
        <div className="border-b border-border/50 bg-surface-hover/20 px-3 py-2">
          <div className="flex items-center gap-2 mb-1.5">
            <Sun size={13} weight="fill" className="text-text-secondary" />
            <span className="text-[11px] font-medium text-text-secondary">全天</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allDayTasks.map((t) => {
              const color = getTagColor(t.tags, tags);
              const done = t.status === 'completed';
              return (
                <button
                  key={t.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, t.id)}
                  onClick={() => onSelectTask(t)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition hover:brightness-95"
                  style={{ backgroundColor: color + '18', color: 'var(--color-text-primary)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className={done ? 'line-through opacity-60' : ''}>{t.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* --- Night toggle --- */}
      {hasNightActivity && (
        <button
          onClick={() => setShowNight(!showNight)}
          className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-text-secondary hover:bg-surface-hover transition border-b border-border/50"
        >
          <Moon size={12} weight={showNight ? 'fill' : 'regular'} />
          <span>夜间 0:00 – 6:00</span>
          <CaretRight size={10} weight="bold" className={`transition ${showNight ? 'rotate-90' : ''}`} />
        </button>
      )}

      {/* --- Column headers --- */}
      <div className="flex items-stretch border-b border-border/50 bg-surface-hover/30 sticky top-0 z-10">
        <div className="w-12 flex-shrink-0" />
        <div className="flex-1 grid grid-cols-2">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-text-secondary border-r border-border/50">计划</div>
          <div className="px-3 py-1.5 text-[11px] font-semibold text-text-secondary">实际</div>
        </div>
      </div>

      {/* --- Timeline --- */}
      <div className="overflow-y-auto max-h-[62vh]">
        {hours.map((h) => {
          const planned = plannedByHour[h] || [];
          const actual = actualByHour[h] || [];
          const hourLabel = `${String(h).padStart(2, '0')}:00`;

          return (
            <div
              key={h}
              className="flex items-stretch border-b border-border/30 hover:bg-surface-hover/10 transition-colors group"
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData('text/plain');
                if (taskId) onUpdateTask(taskId, { dueTime: `${String(h).padStart(2, '0')}:00` });
              }}
            >
              {/* Hour label */}
              <div className="w-12 flex-shrink-0 flex items-start justify-end pr-2 pt-1">
                <span className="text-[11px] text-text-secondary/50 font-mono leading-tight">{hourLabel}</span>
              </div>

              {/* Two columns */}
              <div className="flex-1 grid grid-cols-2 min-h-[50px]">
                {/* Planned */}
                <div
                  className="border-r border-border/30 px-1.5 py-0.5 space-y-0.5 cursor-pointer"
                  onClick={() => onCreateTask(selectedDate, hourLabel)}
                >
                  {planned.map((t) => {
                    const color = getTagColor(t.tags, tags);
                    const done = t.status === 'completed';
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, t.id)}
                        onClick={(e) => { e.stopPropagation(); onSelectTask(t); }}
                        className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg transition hover:brightness-95 active:cursor-grabbing cursor-pointer"
                        style={{ backgroundColor: color + '16' }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className={`truncate flex-1 ${done ? 'line-through opacity-50' : ''}`}>{t.title}</span>
                        <span className="text-[10px] text-text-secondary/60 flex-shrink-0 font-mono">
                          {t.dueTime?.substring(0, 5)} · {formatDuration(t.estimatedMinutes)}
                        </span>
                      </div>
                    );
                  })}
                  {planned.length === 0 && (
                    <div className="opacity-0 group-hover:opacity-100 transition flex items-center justify-center h-full min-h-[20px]">
                      <span className="text-[10px] text-text-secondary/30">+</span>
                    </div>
                  )}
                </div>

                {/* Actual */}
                <div className="px-1.5 py-0.5 space-y-0.5">
                  {actual.map((t) => {
                    const color = getTagColor(t.tags, tags);
                    const actualMins = t.actualMinutes || t.estimatedMinutes;
                    const hasEstimate = planned.some((p) => p.id === t.id);
                    return (
                      <div
                        key={t.id}
                        onClick={(e) => { e.stopPropagation(); onSelectTask(t); }}
                        className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg transition hover:brightness-95 cursor-pointer"
                        style={{ backgroundColor: color + '16' }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="truncate flex-1">{t.title}</span>
                        {!hasEstimate && (
                          <span className="text-[9px] text-warning/70 font-medium flex-shrink-0">未计划</span>
                        )}
                        <span className="text-[10px] text-text-secondary/60 flex-shrink-0 font-mono">
                          {t.actualStartTime?.substring(0, 5) || '—'}
                          {t.actualEndTime ? ` → ${t.actualEndTime.substring(0, 5)}` : ''}
                          {' · '}{formatDuration(actualMins)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

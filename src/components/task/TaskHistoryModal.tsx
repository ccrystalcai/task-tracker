import { useState, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import TaskDetailModal from '@/components/task/TaskDetailModal';
import type { Task, Goal } from '@/db/schema';
import { CheckCircle2, Circle, SkipForward, Star, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, isSameMonth, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface TaskHistoryModalProps {
  open: boolean;
  onClose: () => void;
  task: Task;
  allTasks: Task[];
  goalMap: Map<string, Goal>;
  onUpdate: () => void;
}

export default function TaskHistoryModal({ open, onClose, task, allTasks, goalMap, onUpdate }: TaskHistoryModalProps) {
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const sourceId = task.sourceTaskId || task.id;
  const instances = useMemo(() => {
    const source = allTasks.find((t) => t.id === sourceId);
    const children = allTasks.filter((t) => t.sourceTaskId === sourceId);
    return source ? [source, ...children] : children;
  }, [allTasks, sourceId]);

  const instanceMap = useMemo(() => {
    const map = new Map<string, Task>();
    instances.forEach((t) => map.set(t.dueDate, t));
    return map;
  }, [instances]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarDate);
    const monthEnd = endOfMonth(calendarDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [calendarDate]);

  // Instances in selected month
  const monthInstances = useMemo(() => {
    const monthStr = format(calendarDate, 'yyyy-MM');
    return instances
      .filter((inst) => inst.dueDate.startsWith(monthStr))
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  }, [instances, calendarDate]);

  const formatTime = (mins: number) =>
    mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;

  return (
    <>
      <Modal open={open} onClose={onClose} title={task.title + ' — 历史记录'}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Stats */}
          <div className="flex items-center gap-4 text-small text-text-secondary">
            <span>共 {instances.length} 个实例</span>
            <span>{instances.filter((t) => t.status === 'completed').length} 已完成</span>
            <span>{instances.filter((t) => t.status === 'skipped').length} 已跳过</span>
          </div>

          {/* Calendar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setCalendarDate((d) => subMonths(d, 1))} className="p-1 hover:bg-surface-hover rounded">
                <ChevronLeft size={18} />
              </button>
              <span className="text-body font-medium">
                {format(calendarDate, 'yyyy年M月', { locale: zhCN })}
              </span>
              <button onClick={() => setCalendarDate((d) => addMonths(d, 1))} className="p-1 hover:bg-surface-hover rounded">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-0.5">
              {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
                <div key={d} className="text-center text-small text-text-secondary py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const inst = instanceMap.get(dateStr);
                const isToday = isSameDay(day, new Date());
                const inMonth = isSameMonth(day, calendarDate);

                let bg = 'bg-transparent';
                let cursor = 'cursor-default';
                if (inst) {
                  cursor = 'cursor-pointer';
                  if (inst.status === 'completed') bg = 'bg-success/40';
                  else if (inst.status === 'skipped') bg = 'bg-warning/40';
                  else bg = 'bg-surface-hover';
                }

                return (
                  <div
                    key={dateStr}
                    className={`text-center py-2 rounded text-small ${bg} ${cursor} ${!inMonth ? 'opacity-20' : ''} ${isToday ? 'ring-1 ring-primary' : ''}`}
                    onClick={() => inst && setDetailTask(inst)}
                    title={inst
                      ? [
                          inst.dueDate,
                          inst.status === 'completed' ? '已完成' : inst.status === 'skipped' ? '已跳过' : '待完成',
                          inst.actualMinutes > 0 ? `实际${inst.actualMinutes}分钟` : '',
                          inst.score != null ? `评分${inst.score}/5` : '',
                          inst.reflection ? `反思: ${inst.reflection.substring(0, 30)}` : '',
                          inst.notes && inst.notes !== inst.description ? `备注: ${inst.notes.substring(0, 30)}` : '',
                        ].filter(Boolean).join(' · ')
                      : ''}
                  >
                    <div>{format(day, 'd')}</div>
                    {inst && (
                      <div className="flex justify-center mt-0.5">
                        {inst.status === 'completed' ? (
                          <CheckCircle2 size={12} className="text-success" />
                        ) : inst.status === 'skipped' ? (
                          <SkipForward size={12} className="text-warning" />
                        ) : (
                          <Circle size={12} className="text-text-secondary" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Month History List */}
          <div>
            <h4 className="text-caption text-text-secondary mb-3">
              {format(calendarDate, 'M月', { locale: zhCN })} 打卡记录 ({monthInstances.length})
            </h4>
            {monthInstances.length === 0 ? (
              <p className="text-caption text-text-secondary text-center py-4">该月无记录</p>
            ) : (
              <div className="space-y-0">
                {monthInstances.map((inst, i, arr) => {
                  const isLast = i === arr.length - 1;
                  const isCompleted = inst.status === 'completed';
                  const isSkipped = inst.status === 'skipped';
                  return (
                    <div key={inst.id} className="flex gap-3">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div
                          className={`w-2.5 h-2.5 rounded-full border-2 mt-1.5 ${
                            isCompleted
                              ? 'bg-success border-success'
                              : isSkipped
                              ? 'bg-warning border-warning'
                              : 'bg-surface border-text-secondary'
                          }`}
                        />
                        {!isLast && <div className="w-0.5 flex-1 min-h-[16px] bg-border" />}
                      </div>
                      <div
                        className={`flex-1 pb-2 ${isCompleted ? 'opacity-70' : ''} cursor-pointer hover:bg-surface-hover rounded-btn px-2 -mx-2`}
                        onClick={() => setDetailTask(inst)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-small text-text-secondary font-mono">
                            {inst.dueDate.slice(5)}
                          </span>
                          <span className={`text-body ${isCompleted ? 'line-through text-text-secondary' : ''}`}>
                            {inst.title}
                          </span>
                          {inst.score != null && (
                            <span className="text-warning flex items-center gap-0.5 text-small">
                              <Star size={11} fill="#F59E0B" color="#F59E0B" />{inst.score}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-small text-text-secondary mt-0.5">
                          <span>{formatTime(inst.estimatedMinutes)}</span>
                          {inst.actualMinutes > 0 && <span>实际 {formatTime(inst.actualMinutes)}</span>}
                          {(inst.images?.length ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5"><ImageIcon size={12} />{inst.images!.length}</span>
                          )}
                        </div>
                        {inst.reflection && (
                          <p className="mt-0.5 text-caption text-text-secondary italic line-clamp-1">
                            💬 {inst.reflection}
                          </p>
                        )}
                        {inst.notes && inst.notes !== inst.description && (
                          <p className="mt-0.5 text-caption text-text-secondary line-clamp-1">
                            📝 {inst.notes.substring(0, 60)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {detailTask && (
        <TaskDetailModal
          open={!!detailTask}
          onClose={() => setDetailTask(null)}
          task={detailTask}
          goal={detailTask.goalId ? goalMap.get(detailTask.goalId) ?? null : null}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
}

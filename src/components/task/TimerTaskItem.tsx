import { useEffect } from 'react';
import type { Task, Tag } from '@/db/schema';
import { useTimer } from '@/hooks/useTimer';
import { CheckCircle2, Circle, Play, Pause, Clock, RotateCcw, Edit3, Trash2, Info, Star, Image as ImageIcon } from 'lucide-react';

interface TimerTaskItemProps {
  task: Task;
  tags: Tag[];
  onToggle: () => Promise<void>;
  onEdit?: () => void;
  onDelete?: () => void;
  onDetail?: () => void;
  showGoal?: { name: string; color: string } | null;
}

const today = new Date().toISOString().split('T')[0];

export default function TimerTaskItem({ task, tags, onToggle, onEdit, onDelete, onDetail, showGoal }: TimerTaskItemProps) {
  const { isRunning, elapsedDisplay, totalSeconds, totalDisplay, sessionCount, start, pause, loadSessions } = useTimer(task.id);

  // Reload sessions when task changes
  useEffect(() => {
    loadSessions();
  }, [task.id]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) {
      await pause();
    }
    await onToggle();
  };

  const handleTimerClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) {
      await pause();
    } else {
      await start();
    }
  };

  const isCompleted = task.status === 'completed';
  const taskTags = tags.filter((t) => task.tags.includes(t.id));
  const isToday = task.dueDate === today;
  const actualDisplay = task.actualMinutes > 0 ? `${task.actualMinutes}分钟` : totalSeconds > 0 ? totalDisplay : null;

  const formatEst = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all group ${
      isCompleted ? 'opacity-50' : 'hover:bg-surface-hover'
    } ${isRunning ? 'ring-1 ring-primary/30 bg-primary/5' : ''}`}>

      {/* Complete button */}
      <button onClick={handleToggle} className="flex-shrink-0 transition-transform hover:scale-110" title={isCompleted ? '取消完成' : '标记完成'}>
        {isCompleted
          ? <CheckCircle2 size={20} className="text-success" />
          : <Circle size={20} className="text-text-secondary hover:text-success transition-colors" />}
      </button>

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <p className={`text-body truncate ${isCompleted ? 'line-through text-text-secondary' : ''}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {showGoal && (
            <span className="text-small flex items-center gap-0.5" style={{ color: showGoal.color }}>
              {showGoal.name}
            </span>
          )}
          <span className="text-small text-text-secondary flex items-center gap-0.5">
            <Clock size={11} />预估 {formatEst(task.estimatedMinutes)}
          </span>
          {actualDisplay && (
            <span className={`text-small flex items-center gap-0.5 ${task.actualMinutes > task.estimatedMinutes ? 'text-warning' : 'text-success'}`}>
              · 实际 {actualDisplay}
            </span>
          )}
          {sessionCount > 0 && (
            <span className="text-small text-primary flex items-center gap-0.5">
              <RotateCcw size={11} />{sessionCount}次专注
            </span>
          )}
          {task.reminderEnabled && task.reminderTime && (
            <span className="text-small text-primary">🔔 {task.reminderTime}</span>
          )}
          {taskTags.map((t) => (
            <span key={t.id} className="text-small px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: t.color }}>
              {t.name}
            </span>
          ))}
          {task.recurrenceType !== 'none' && (
            <span className="text-small text-text-secondary">
              🔄 {task.recurrenceType === 'daily' ? '每天' : task.recurrenceType === 'weekly' ? '每周' : '每月'}
              {task.recurrenceInterval > 1 ? ` ×${task.recurrenceInterval}` : ''}
            </span>
          )}
          {task.score != null && (
            <span className="text-small text-warning flex items-center gap-0.5">
              <Star size={11} fill="#F59E0B" color="#F59E0B" />{task.score}
            </span>
          )}
          {task.notes && task.notes !== task.description && (
            <span className="text-small text-text-secondary truncate max-w-[120px]" title={task.notes}>
              📝 {task.notes.substring(0, 20)}
            </span>
          )}
          {(task.images?.length ?? 0) > 0 && (
            <span className="text-small text-text-secondary flex items-center gap-0.5">
              <ImageIcon size={11} />{task.images!.length}
            </span>
          )}
        </div>
      </div>

      {/* Timer */}
      {isToday && !isCompleted && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {isRunning && (
            <span className="text-small font-mono text-primary font-medium animate-pulse">
              {elapsedDisplay}
            </span>
          )}
          <button
            onClick={handleTimerClick}
            className={`p-1.5 rounded-full transition-all ${
              isRunning
                ? 'bg-warning/10 text-warning hover:bg-warning/20'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
            title={isRunning ? '暂停计时' : '开始计时'}
          >
            {isRunning ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
      )}

      {!isToday && sessionCount > 0 && (
        <span className="text-small text-text-secondary flex-shrink-0">累计 {totalDisplay}</span>
      )}

      {/* Edit/Delete (only shown in Goals page) */}
      {onDetail && (
        <button className="p-1 rounded hover:bg-surface-hover text-text-secondary flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onDetail(); }} title="查看详情"><Info size={14} /></button>
      )}
      {onEdit && (
        <button className="p-1 rounded hover:bg-surface-hover text-text-secondary flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}><Edit3 size={14} /></button>
      )}
      {onDelete && (
        <button className="p-1 rounded hover:bg-surface-hover text-danger flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 size={14} /></button>
      )}
    </div>
  );
}

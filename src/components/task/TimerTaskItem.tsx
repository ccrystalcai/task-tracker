import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, Tag } from '@/db/schema';
import { useTimer } from '@/hooks/useTimer';
import { CheckCircle, Circle, Play, Pause, Clock, ArrowCounterClockwise, PencilSimple, Trash, Info, Star, Image as ImageIcon, DotsThree, Paperclip, Bell, ArrowsClockwise, FileText } from '@phosphor-icons/react';

interface TimerTaskItemProps {
  task: Task;
  tags: Tag[];
  onToggle: () => Promise<void>;
  onEdit?: () => void;
  onDelete?: () => void;
  onDetail?: () => void;
  showGoal?: { name: string; color: string } | null;
  linkedClip?: { title: string } | null;
  compact?: boolean;
}

const today = new Date().toISOString().split('T')[0];

export default function TimerTaskItem({ task, tags, onToggle, onEdit, onDelete, onDetail, showGoal, linkedClip, compact }: TimerTaskItemProps) {
  const { isRunning, elapsedDisplay, totalSeconds, totalDisplay, sessionCount, start, pause, loadSessions } = useTimer(task.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => { loadSessions(); }, [task.id]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) await pause();
    await onToggle();
  };

  const handleTimerClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) await pause();
    else await start();
  };

  const isCompleted = task.status === 'completed';
  const taskTags = tags.filter((t) => task.tags.includes(t.id));
  const isToday = task.dueDate === today;
  const actualDisplay = task.actualMinutes > 0 ? `${task.actualMinutes}分钟` : totalSeconds > 0 ? totalDisplay : null;
  const formatEst = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;
  const hasActions = onEdit || onDelete || onDetail;

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition group ${
        isCompleted ? 'opacity-50' : 'hover:bg-surface-hover'
      } ${isRunning ? 'ring-1 ring-primary/30 bg-primary/5' : ''}`}>

        {/* Complete button */}
        <button onClick={handleToggle} className="flex-shrink-0 transition-transform hover:scale-110" title={isCompleted ? '取消完成' : '标记完成'}>
          {isCompleted
            ? <CheckCircle weight="duotone" size={18} className="text-success" />
            : <Circle weight="duotone" size={18} className="text-text-secondary hover:text-success transition-colors" />}
        </button>

        {/* Task info */}
        <div className="flex-1 min-w-0">
          <p className={`text-body truncate ${isCompleted ? 'line-through text-text-secondary' : ''}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {task.reminderEnabled && task.reminderTime && (
              <span className="text-small text-text-secondary flex items-center gap-0.5 flex-shrink-0">
                <Bell weight="duotone" size={11} className="inline" /> {task.reminderTime}
              </span>
            )}
            <span className="text-small text-text-secondary flex items-center gap-0.5 flex-shrink-0">
              <Clock weight="bold" size={11} />{formatEst(task.estimatedMinutes)}
            </span>
            {taskTags.map((t) => (
              <span key={t.id} className="text-small flex items-center gap-1 max-w-[80px] truncate">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                {t.name}
              </span>
            ))}
            {showGoal && (
              <span className="text-small flex items-center gap-0.5 truncate" style={{ color: showGoal.color }}>
                {showGoal.name}
              </span>
            )}
            {linkedClip && (
              <span className="text-small flex items-center gap-0.5 truncate text-primary cursor-pointer hover:underline"
                onClick={(e) => { e.stopPropagation(); navigate('/clips'); }}>
                <Paperclip weight="duotone" size={11} />{linkedClip.title}
              </span>
            )}
          </div>
        </div>

        {/* Timer */}
        {isToday && !isCompleted && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isRunning && (
              <span className="text-small font-mono text-primary font-medium animate-pulse">
                {elapsedDisplay}
              </span>
            )}
            <button
              onClick={handleTimerClick}
              className={`p-1.5 rounded-full transition ${
                isRunning ? 'bg-warning/10 text-warning hover:bg-warning/20' : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
              title={isRunning ? '暂停计时' : '开始计时'}
            >
              {isRunning ? <Pause weight="bold" size={16} /> : <Play weight="bold" size={16} />}
            </button>
          </div>
        )}

        {/* More menu */}
        {hasActions && (
          <div className="relative flex-shrink-0 ml-0.5" ref={menuRef}>
            <button
              className="p-1 rounded hover:bg-surface-hover text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            >
              <DotsThree weight="bold" size={15} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-surface rounded-xl shadow-lg border border-border py-1 z-20 min-w-[120px] animate-[fadeInUp_0.15s_ease-out]">
                {onDetail && (
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-small hover:bg-surface-hover transition-colors"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDetail(); }}>
                    <Info weight="bold" size={13} />查看详情
                  </button>
                )}
                {onEdit && (
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-small hover:bg-surface-hover transition-colors"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}>
                    <PencilSimple weight="bold" size={13} />编辑
                  </button>
                )}
                {onDelete && (
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-small hover:bg-surface-hover text-danger transition-colors"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}>
                    <Trash weight="bold" size={13} />删除
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full mode (Goals page, search results, etc.)
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition group ${
      isCompleted ? 'opacity-50' : 'hover:bg-surface-hover'
    } ${isRunning ? 'ring-1 ring-primary/30 bg-primary/5' : ''}`}>

      {/* Complete button */}
      <button onClick={handleToggle} className="flex-shrink-0 transition-transform hover:scale-110" title={isCompleted ? '取消完成' : '标记完成'}>
        {isCompleted
          ? <CheckCircle weight="duotone" size={20} className="text-success" />
          : <Circle weight="duotone" size={20} className="text-text-secondary hover:text-success transition-colors" />}
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
            <Clock weight="bold" size={11} />预估 {formatEst(task.estimatedMinutes)}
          </span>
          {actualDisplay && (
            <span className={`text-small flex items-center gap-0.5 ${task.actualMinutes > task.estimatedMinutes ? 'text-warning' : 'text-success'}`}>
              · 实际 {actualDisplay}
            </span>
          )}
          {sessionCount > 0 && (
            <span className="text-small text-primary flex items-center gap-0.5">
              <ArrowCounterClockwise weight="bold" size={11} />{sessionCount}次专注
            </span>
          )}
          {task.reminderEnabled && task.reminderTime && (
            <span className="text-small text-primary"><Bell weight="duotone" size={11} className="inline" /> {task.reminderTime}</span>
          )}
          {taskTags.map((t) => (
            <span key={t.id} className="text-small flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
              {t.name}
            </span>
          ))}
          {linkedClip && (
            <span className="text-small flex items-center gap-0.5 text-primary cursor-pointer hover:underline"
              onClick={(e) => { e.stopPropagation(); navigate('/clips'); }}>
              <Paperclip weight="duotone" size={11} />{linkedClip.title}
            </span>
          )}
          {task.recurrenceType !== 'none' && (
            <span className="text-small text-text-secondary">
              <ArrowsClockwise weight="bold" size={11} className="inline" /> {task.recurrenceType === 'daily' ? '每天' : task.recurrenceType === 'weekly' ? '每周' : '每月'}
              {task.recurrenceInterval > 1 ? ` ×${task.recurrenceInterval}` : ''}
            </span>
          )}
          {task.score != null && (
            <span className="text-small text-warning flex items-center gap-0.5">
              <Star weight="duotone" size={11} fill="#F59E0B" color="#F59E0B" />{task.score}
            </span>
          )}
          {task.notes && task.notes !== task.description && (
            <span className="text-small text-text-secondary truncate max-w-[120px]" title={task.notes}>
              <FileText weight="duotone" size={11} className="inline" /> {task.notes.substring(0, 20)}
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
            className={`p-2 rounded-full transition ${
              isRunning
                ? 'bg-warning/10 text-warning hover:bg-warning/20'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
            title={isRunning ? '暂停计时' : '开始计时'}
          >
            {isRunning ? <Pause weight="bold" size={17} /> : <Play weight="bold" size={17} />}
          </button>
        </div>
      )}

      {!isToday && sessionCount > 0 && (
        <span className="text-small text-text-secondary flex-shrink-0">累计 {totalDisplay}</span>
      )}

      {/* Edit/Delete (only shown in Goals page) */}
      {onDetail && (
        <button className="p-1.5 rounded hover:bg-surface-hover text-text-secondary flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onDetail(); }} title="查看详情"><Info weight="bold" size={15} /></button>
      )}
      {onEdit && (
        <button className="p-1.5 rounded hover:bg-surface-hover text-text-secondary flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}><PencilSimple weight="bold" size={15} /></button>
      )}
      {onDelete && (
        <button className="p-1.5 rounded hover:bg-surface-hover text-danger flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash weight="bold" size={15} /></button>
      )}
    </div>
  );
}

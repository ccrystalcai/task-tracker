import { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import { useTagStore } from '@/stores/tagStore';
import { useTaskStore } from '@/stores/taskStore';
import { useGoalStore } from '@/stores/goalStore';
import { useTimer } from '@/hooks/useTimer';
import TaskHistoryModal from '@/components/task/TaskHistoryModal';
import { db } from '@/db';
import { PRIORITY_LABEL, PRIORITY_COLOR } from '@/constants/priorities';
import type { Task, Goal, Priority, RecurrenceType } from '@/db/schema';
import { CheckCircle, Circle, SkipForward, Clock, Star, Calendar, CameraPlus, X, ClockCounterClockwise, Info, Play, Pause, FloppyDisk, Timer, CaretDown, CaretUp } from '@phosphor-icons/react';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const STATUS_OPTIONS = [
  { value: 'pending' as const, label: '待完成', icon: <Circle weight="duotone" size={16} />, className: 'text-text-secondary bg-surface-hover' },
  { value: 'in-progress' as const, label: '进行中', icon: <Clock weight="bold" size={16} />, className: 'text-primary bg-primary/10' },
  { value: 'completed' as const, label: '已完成', icon: <CheckCircle weight="duotone" size={16} />, className: 'text-success bg-success/10' },
  { value: 'skipped' as const, label: '已跳过', icon: <SkipForward weight="bold" size={16} />, className: 'text-warning bg-warning/10' },
];

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'urgent-important', label: PRIORITY_LABEL['urgent-important'], color: PRIORITY_COLOR['urgent-important'] },
  { value: 'urgent-not-important', label: PRIORITY_LABEL['urgent-not-important'], color: PRIORITY_COLOR['urgent-not-important'] },
  { value: 'not-urgent-important', label: PRIORITY_LABEL['not-urgent-important'], color: PRIORITY_COLOR['not-urgent-important'] },
  { value: 'not-urgent-not-important', label: PRIORITY_LABEL['not-urgent-not-important'], color: PRIORITY_COLOR['not-urgent-not-important'] },
];

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '天' },
  { value: 'weekly', label: '周' },
  { value: 'monthly', label: '月' },
];

interface TaskDetailModalProps {
  open: boolean;
  onClose: () => void;
  task: Task;
  goal: Goal | null;
  onUpdate?: () => void;
}

function useSyncedState<T>(external: T, key: unknown): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [internal, setInternal] = useState(external);
  useEffect(() => { setInternal(external); }, [key]);
  return [internal, setInternal];
}

export default function TaskDetailModal({ open, onClose, task, goal: _goal, onUpdate }: TaskDetailModalProps) {
  const { getTagTree } = useTagStore();
  const { updateTask } = useTaskStore();
  const { goals } = useGoalStore();
  const timer = useTimer(task.id);

  const [title, setTitle] = useSyncedState(task.title, task.id);
  const [description, setDescription] = useSyncedState(task.description, task.id);
  const [status, setStatus] = useSyncedState(task.status, task.id);
  const [priority, setPriority] = useSyncedState(task.priority, task.id);
  const [selectedGoalId, setSelectedGoalId] = useSyncedState<string | null>(task.goalId, task.id);
  const [dueDate, setDueDate] = useSyncedState(task.dueDate, task.id);
  const [dueTime, setDueTime] = useSyncedState(task.dueTime || '', task.id);
  const [estimatedMinutes, setEstimatedMinutes] = useSyncedState(task.estimatedMinutes, task.id);
  const [actualMinutes, setActualMinutes] = useSyncedState(task.actualMinutes || 0, task.id);
  const [actualStartTime, setActualStartTime] = useSyncedState(task.actualStartTime || '', task.id);
  const [actualEndTime, setActualEndTime] = useSyncedState(task.actualEndTime || '', task.id);
  const [recurrenceType, setRecurrenceType] = useSyncedState<RecurrenceType>(task.recurrenceType, task.id);
  const [recurrenceInterval, setRecurrenceInterval] = useSyncedState(task.recurrenceInterval, task.id);
  const [recurrenceEndDate, setRecurrenceEndDate] = useSyncedState(task.recurrenceEndDate || '', task.id);
  const [score, setScore] = useSyncedState<number | null>(task.score, task.id);
  const [reflection, setReflection] = useSyncedState(task.reflection, task.id);
  const [notes, setNotes] = useSyncedState(task.notes, task.id);
  const [selectedTags, setSelectedTags] = useSyncedState(task.tags, task.id);
  const [reminderEnabled, setReminderEnabled] = useSyncedState(task.reminderEnabled, task.id);
  const [reminderTime, setReminderTime] = useSyncedState(task.reminderTime || '09:00', task.id);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Collapsible sections: smart defaults based on task state
  const hasTimerActivity = timer.totalSeconds > 0 || task.actualMinutes > 0;
  const isActive = task.status === 'in-progress' || task.status === 'completed';
  const isNew = task.status === 'pending' && !hasTimerActivity;
  const [basicOpen, setBasicOpen] = useState(isNew);
  const [planOpen, setPlanOpen] = useState(isNew);
  const [trackOpen, setTrackOpen] = useState(isActive || hasTimerActivity);

  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active'), [goals]);
  const canShowHistory = task.recurrenceType !== 'none' || task.sourceTaskId != null;

  const flatTags = useMemo(() => {
    const result: { id: string; name: string; color: string; depth: number }[] = [];
    const walk = (nodes: ReturnType<typeof getTagTree>, depth: number) => {
      for (const n of nodes) {
        result.push({ id: n.id, name: n.name, color: n.color, depth });
        if (n.children.length > 0) walk(n.children, depth + 1);
      }
    };
    walk(getTagTree(), 0);
    return result;
  }, [getTagTree]);

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const updates: Partial<Task> = {
      title: title.trim(),
      description: description.trim() || '',
      status,
      priority,
      goalId: selectedGoalId,
      dueDate,
      dueTime: dueTime || null,
      estimatedMinutes,
      actualMinutes,
      actualStartTime: actualStartTime || null,
      actualEndTime: actualEndTime || null,
      recurrenceType,
      recurrenceInterval,
      recurrenceEndDate: recurrenceEndDate || null,
      score,
      reflection: reflection || '',
      notes: notes || '',
      tags: selectedTags,
      reminderEnabled,
      reminderTime: reminderEnabled ? reminderTime : null,
      completedAt: status === 'completed' ? (task.completedAt || new Date()) : null,
    };
    await updateTask(task.id, updates);
    setSaving(false);
    onUpdate?.();
    onClose();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const newImages: string[] = [];
    for (const file of Array.from(files)) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newImages.push(dataUrl);
    }
    await db.tasks.update(task.id, {
      images: [...(task.images || []), ...newImages],
      updatedAt: new Date(),
    });
    setUploading(false);
    onUpdate?.();
  };

  const handleDeleteImage = async (index: number) => {
    const updated = task.images.filter((_, i) => i !== index);
    await db.tasks.update(task.id, { images: updated, updatedAt: new Date() });
    onUpdate?.();
  };

  const formatTime = (mins: number) =>
    mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;

  return (
    <>
      <Modal open={open} onClose={onClose} title={task.title}>
        <div className="space-y-4 max-h-[65vh] overflow-y-auto overscroll-contain pr-1">

          {/* ====== 基础信息 (collapsible) ====== */}
          <div className="border border-border rounded-card overflow-hidden">
            <button
              type="button"
              onClick={() => setBasicOpen(!basicOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-hover hover:bg-border transition-colors"
            >
              <span className="text-small font-medium flex items-center gap-1.5">
                <Info weight="bold" size={14} className="text-primary" />
                基础信息
              </span>
              {basicOpen ? <CaretUp size={16} className="text-text-secondary" /> : <CaretDown weight="bold" size={16} className="text-text-secondary" />}
            </button>
            {basicOpen && (
              <div className="px-4 py-3 space-y-3">
                {/* Title */}
                <div>
                  <label className="text-caption text-text-secondary block mb-1">任务名称</label>
                  <input autoComplete="off" className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>

                {/* Status */}
                <div>
                  <label className="text-caption text-text-secondary block mb-1">状态</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setStatus(opt.value)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-small transition ${
                          status === opt.value ? `${opt.className} font-medium ring-1 ring-offset-1 ring-current` : 'text-text-secondary hover:bg-surface-hover'
                        }`}
                      >
                        {opt.icon}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-caption text-text-secondary block mb-1">优先级</label>
                  <select className="input w-full" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {activeGoals.length > 0 && (
                  <div>
                    <label className="text-caption text-text-secondary block mb-1">所属目标</label>
                    <select className="input w-full" value={selectedGoalId || ''} onChange={(e) => setSelectedGoalId(e.target.value || null)}>
                      <option value="">无</option>
                      {activeGoals.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-caption text-text-secondary block mb-1">描述</label>
                  <textarea autoComplete="off" className="input w-full resize-none" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="补充说明…" />
                </div>
              </div>
            )}
          </div>

          {/* ====== 计划安排 (collapsible) ====== */}
          <div className="border border-border rounded-card overflow-hidden">
            <button
              type="button"
              onClick={() => setPlanOpen(!planOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-hover hover:bg-border transition-colors"
            >
              <span className="text-small font-medium flex items-center gap-1.5">
                <Calendar weight="duotone" size={14} className="text-primary" />
                计划安排
              </span>
              {planOpen ? <CaretUp size={16} className="text-text-secondary" /> : <CaretDown weight="bold" size={16} className="text-text-secondary" />}
            </button>
            {planOpen && (
              <div className="px-4 py-3 space-y-3">
                {/* Date + Time + Estimated */}
                <div>
                  <label className="text-caption text-text-secondary block mb-1">日期 · 时间 · 预估</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <input autoComplete="off" className="input text-small" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    <input autoComplete="off" className="input text-small" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
                    <div className="flex items-center gap-1 col-span-2 sm:col-span-1">
                      <input autoComplete="off" className="input text-small flex-1" type="number" min={5} step={5} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(Number(e.target.value))} />
                      <span className="text-caption text-text-secondary flex-shrink-0">分钟</span>
                    </div>
                  </div>
                </div>

                {/* Recurrence — clearer: 每 [N] [天/周/月] */}
                <div>
                  <label className="text-caption text-text-secondary block mb-1">重复规则</label>
                  {recurrenceType === 'none' ? (
                    <button
                      type="button"
                      onClick={() => setRecurrenceType('daily')}
                      className="text-small text-primary hover:underline"
                    >
                      + 设置重复
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-small text-text-secondary">每</span>
                      <input autoComplete="off" className="input w-14 text-center text-small" type="number" min={1} max={99} value={recurrenceInterval} onChange={(e) => setRecurrenceInterval(Number(e.target.value))} />
                      <select className="input w-16 text-small" value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}>
                        {RECURRENCE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <span className="text-small text-text-secondary">· 至</span>
                      <input autoComplete="off" className="input flex-1 min-w-[120px] text-small" type="date" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} placeholder="可选结束日期" />
                    </div>
                  )}
                </div>

                {/* Tags */}
                {flatTags.length > 0 && (
                  <div>
                    <label className="text-caption text-text-secondary block mb-1">标签</label>
                    <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
                      {flatTags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={`text-small px-2.5 py-1 rounded-full transition ${
                            selectedTags.includes(tag.id)
                              ? 'text-white shadow-sm'
                              : 'bg-surface-hover text-text-secondary hover:bg-border'
                          }`}
                          style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color } : { paddingLeft: `${8 + tag.depth * 12}px` }}
                        >
                          {tag.depth > 0 && <span className="opacity-50 mr-0.5">└</span>}
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reminder */}
                <div className="flex items-center gap-3 bg-surface-hover rounded-btn px-3 py-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-small">
                    <input autoComplete="off" type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} className="rounded" />
                    <span>设置提醒</span>
                  </label>
                  {reminderEnabled && (
                    <input autoComplete="off" className="input text-small w-28" type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ====== 实际执行 (collapsible) ====== */}
          <div className="border border-border rounded-card overflow-hidden">
            <button
              type="button"
              onClick={() => setTrackOpen(!trackOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-hover hover:bg-border transition-colors"
            >
              <span className="text-small font-medium flex items-center gap-1.5">
                <Timer size={14} className="text-warning" />
                实际执行
                {(timer.totalSeconds > 0 || actualMinutes > 0) && (
                  <span className="text-caption text-text-secondary font-normal">
                    · {timer.totalSeconds > 0 ? timer.totalDisplay : formatTime(actualMinutes)}
                  </span>
                )}
              </span>
              {trackOpen ? <CaretUp size={16} className="text-text-secondary" /> : <CaretDown weight="bold" size={16} className="text-text-secondary" />}
            </button>
            {trackOpen && (
              <div className="px-4 py-3 space-y-3">
                {/* Timer */}
                <div className="bg-surface rounded-card p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-h3 font-mono tabular-nums">{timer.elapsedDisplay}</span>
                    <button
                      type="button"
                      onClick={timer.isRunning ? timer.pause : timer.start}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-small font-medium text-white transition ${
                        timer.isRunning ? 'bg-warning hover:bg-warning/90' : 'bg-primary hover:bg-primary/90'
                      }`}
                    >
                      {timer.isRunning ? <Pause weight="bold" size={14} /> : <Play weight="bold" size={14} />}
                      {timer.isRunning ? '暂停' : '开始'}
                    </button>
                  </div>
                  <p className="text-caption text-text-secondary">
                    今日 {timer.sessionCount} 个时段 · 累计 {timer.totalDisplay}
                  </p>
                </div>

                {/* Actual time */}
                <div>
                  <label className="text-caption text-text-secondary block mb-1">实际耗时 · 起止时间</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="flex items-center gap-1">
                      <input autoComplete="off" className="input text-small flex-1" type="number" min={0} step={5} value={actualMinutes} onChange={(e) => setActualMinutes(Number(e.target.value))} />
                      <span className="text-caption text-text-secondary flex-shrink-0">分</span>
                    </div>
                    <input autoComplete="off" className="input text-small" type="datetime-local" value={actualStartTime ? new Date(actualStartTime).toISOString().slice(0, 16) : ''} onChange={(e) => setActualStartTime(e.target.value ? new Date(e.target.value).toISOString() : '')} />
                    <input autoComplete="off" className="input text-small col-span-2 sm:col-span-1" type="datetime-local" value={actualEndTime ? new Date(actualEndTime).toISOString().slice(0, 16) : ''} onChange={(e) => setActualEndTime(e.target.value ? new Date(e.target.value).toISOString() : '')} />
                  </div>
                </div>

                {/* Score */}
                <div>
                  <label className="text-caption text-text-secondary block mb-1">评分</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setScore(score === s ? null : s)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star weight="duotone" size={22}
                          fill={(score && s <= score) ? '#F59E0B' : 'none'}
                          color={(score && s <= score) ? '#F59E0B' : '#CBD5E1'} />
                      </button>
                    ))}
                    {score != null && (
                      <button type="button" onClick={() => setScore(null)} className="text-caption text-text-secondary hover:text-danger ml-1">清除</button>
                    )}
                  </div>
                </div>

                {/* Reflection */}
                <div>
                  <label className="text-caption text-text-secondary block mb-1">
                    {status === 'skipped' ? '跳过原因' : '反思'}
                  </label>
                  <textarea autoComplete="off" className="input w-full resize-none" rows={2} value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder={status === 'skipped' ? '为什么跳过？' : '完成后的反思…'} />
                </div>
              </div>
            )}
          </div>

          {/* Notes — always visible */}
          <div>
            <label className="text-small text-text-secondary block mb-1 font-medium">备注</label>
            <textarea autoComplete="off" className="input w-full resize-none" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="额外备注…" />
          </div>

          {/* Images */}
          <div>
            <label className="text-small text-text-secondary block mb-1 font-medium">图片</label>
            {(task.images?.length ?? 0) > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {task.images.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={img}
                      alt={`附件 ${i + 1}`}
                      className="w-full h-24 object-cover rounded-card cursor-pointer hover:opacity-80"
                      onClick={() => setPreviewImage(img)}
                    />
                    <button
                      onClick={() => handleDeleteImage(i)}
                      className="absolute top-1 right-1 p-0.5 bg-black/50 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <X weight="bold" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-btn bg-surface-hover hover:bg-border cursor-pointer transition-colors text-body">
              <CameraPlus weight="bold" size={18} />
              {uploading ? '上传中…' : '添加图片'}
              <input autoComplete="off" type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
            </label>
          </div>

          {/* FloppyDisk */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
            {canShowHistory ? (
              <button onClick={() => setShowHistory(true)} className="text-small text-primary flex items-center gap-1 hover:underline">
                <ClockCounterClockwise size={14} />查看历史
              </button>
            ) : <span />}
            <button
              type="button"
              className="btn-primary flex items-center gap-1.5"
              disabled={saving || !title.trim()}
              onClick={handleSave}
            >
              <FloppyDisk size={16} />
              {saving ? '保存中…' : '保存修改'}
            </button>
          </div>

          {/* Dates footer */}
          <div className="text-caption text-text-secondary space-y-1 pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <Calendar weight="duotone" size={12} />
              日期: {format(parseISO(task.dueDate), 'yyyy年M月d日 EEEE', { locale: zhCN })}
              {task.dueTime && ` ${task.dueTime}`}
            </div>
            {task.completedAt && (
              <p>完成时间: {format(task.completedAt, 'yyyy年M月d日 HH:mm', { locale: zhCN })}</p>
            )}
            <p>创建时间: {format(task.createdAt, 'yyyy年M月d日 HH:mm', { locale: zhCN })}</p>
          </div>
        </div>
      </Modal>

      {previewImage && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center cursor-pointer"
          onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="预览" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}

      {showHistory && (
        <TaskHistoryModal
          open={showHistory}
          onClose={() => setShowHistory(false)}
          task={task}
          allTasks={useTaskStore.getState().tasks}
          goalMap={goalMap}
          onUpdate={() => onUpdate?.()}
        />
      )}
    </>
  );
}

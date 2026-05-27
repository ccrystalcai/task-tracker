import { useState } from 'react';
import { useTagStore } from '@/stores/tagStore';
import { useGoalStore } from '@/stores/goalStore';
import type { Task, Priority, Tag, RecurrenceType } from '@/db/schema';

interface TaskFormProps {
  initial?: Partial<Task>;
  goalId?: string | null;
  tags: Tag[];
  priority?: Priority;
  onSubmit: (data: {
    goalId?: string | null;
    title: string;
    description?: string;
    estimatedMinutes?: number;
    dueDate: string;
    dueTime?: string | null;
    reminderEnabled?: boolean;
    reminderTime?: string | null;
    priority?: Priority;
    tags?: string[];
    recurrenceType?: RecurrenceType;
    recurrenceInterval?: number;
    recurrenceEndDate?: string | null;
  }) => void;
  onCancel: () => void;
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'urgent-important', label: '紧急重要' },
  { value: 'urgent-not-important', label: '紧急不重要' },
  { value: 'not-urgent-important', label: '不紧急重要' },
  { value: 'not-urgent-not-important', label: '不紧急不重要' },
];

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'none', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
];

export default function TaskForm({ initial, goalId, tags: allTags, priority: priorityProp, onSubmit, onCancel }: TaskFormProps) {
  const { getTagTree } = useTagStore();
  const { goals } = useGoalStore();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(initial?.estimatedMinutes ?? 30);
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState(initial?.dueTime ?? '');
  const [reminderEnabled, setReminderEnabled] = useState(initial?.reminderEnabled ?? false);
  const [reminderTime, setReminderTime] = useState(initial?.reminderTime ?? '09:00');
  const [priority, setPriority] = useState<Priority>(priorityProp ?? initial?.priority ?? 'not-urgent-important');
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tags ?? []);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(initial?.recurrenceType ?? 'none');
  const [recurrenceInterval, setRecurrenceInterval] = useState(initial?.recurrenceInterval ?? 1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(initial?.recurrenceEndDate ?? '');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(goalId ?? initial?.goalId ?? null);

  // Build flat tag list with depth info for display
  const flatTags = (() => {
    const result: { id: string; name: string; color: string; depth: number }[] = [];
    const walk = (nodes: ReturnType<typeof getTagTree>, depth: number) => {
      for (const n of nodes) {
        result.push({ id: n.id, name: n.name, color: n.color, depth });
        if (n.children.length > 0) walk(n.children, depth + 1);
      }
    };
    walk(getTagTree(), 0);
    return result;
  })();

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      goalId: selectedGoalId,
      title: title.trim(),
      description: description.trim(),
      estimatedMinutes,
      dueDate,
      dueTime: dueTime || null,
      reminderEnabled,
      reminderTime: reminderEnabled ? reminderTime : null,
      priority,
      tags: selectedTags,
      recurrenceType,
      recurrenceInterval,
      recurrenceEndDate: recurrenceEndDate || null,
    });
  };

  const activeGoals = goals.filter((g) => g.status === 'active');

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 1. Task name */}
      <div>
        <label className="text-small text-text-secondary block mb-1 font-medium">任务名称</label>
        <input className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="要做什么？" required autoFocus />
      </div>

      {/* 2. Goal */}
      {activeGoals.length > 0 && (
        <div>
          <label className="text-small text-text-secondary block mb-1 font-medium">所属目标</label>
          <select className="input w-full" value={selectedGoalId || ''}
            onChange={(e) => setSelectedGoalId(e.target.value || null)}>
            <option value="">无（独立任务）</option>
            {activeGoals.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 3. Date + Time + Estimated */}
      <div>
        <label className="text-small text-text-secondary block mb-1 font-medium">时间安排</label>
        <div className="grid grid-cols-3 gap-2">
          <input className="input text-small" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required title="日期" />
          <input className="input text-small" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} title="时间（可选）" placeholder="时间" />
          <div className="flex items-center gap-1">
            <input className="input text-small flex-1" type="number" min={5} step={5} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(Number(e.target.value))} title="预估分钟" />
            <span className="text-small text-text-secondary flex-shrink-0">分钟</span>
          </div>
        </div>
      </div>

      {/* 4. Priority + Recurrence */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-small text-text-secondary block mb-1 font-medium">优先级</label>
          <select className="input w-full" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-small text-text-secondary block mb-1 font-medium">重复</label>
          <div className="flex items-center gap-1.5">
            <select className="input flex-1" value={recurrenceType}
              onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}>
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {recurrenceType !== 'none' && (
              <input className="input w-14 text-center" type="number" min={1} max={99}
                value={recurrenceInterval}
                onChange={(e) => setRecurrenceInterval(Number(e.target.value))} />
            )}
          </div>
          {recurrenceType !== 'none' && (
            <input className="input w-full mt-1 text-small" type="date" value={recurrenceEndDate}
              onChange={(e) => setRecurrenceEndDate(e.target.value)} placeholder="结束日期（可选）" />
          )}
        </div>
      </div>

      {/* 5. Tags */}
      {allTags.length > 0 && (
        <div>
          <label className="text-small text-text-secondary block mb-1 font-medium">标签</label>
          <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto p-1">
            {flatTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`text-small px-2.5 py-1 rounded-full transition-all ${
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
          {selectedTags.length > 0 && (
            <p className="text-small text-primary mt-1 cursor-pointer hover:underline" onClick={() => setSelectedTags([])}>
              清除已选 ({selectedTags.length})
            </p>
          )}
        </div>
      )}

      {/* 6. Description */}
      <div>
        <label className="text-small text-text-secondary block mb-1 font-medium">备注</label>
        <textarea className="input w-full resize-none" rows={2} value={description}
          onChange={(e) => setDescription(e.target.value)} placeholder="补充说明..." />
      </div>

      {/* 7. Reminder */}
      <div className="flex items-center gap-3 bg-surface-hover rounded-btn px-3 py-2">
        <label className="flex items-center gap-1.5 cursor-pointer text-small">
          <input type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} className="rounded" />
          <span className="font-medium">设置提醒</span>
        </label>
        {reminderEnabled && (
          <input className="input text-small" type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
        )}
      </div>

      {/* 8. Buttons */}
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" className="btn-secondary" onClick={onCancel}>取消</button>
        <button type="submit" className="btn-primary">{initial?.id ? '保存修改' : '创建任务'}</button>
      </div>
    </form>
  );
}

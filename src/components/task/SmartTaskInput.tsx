import { useState, useMemo } from 'react';
import { PRIORITY_LABEL, PRIORITY_COLOR } from '@/constants/priorities';
import type { Tag, Priority } from '@/db/schema';
import type { Goal } from '@/db/schema';
import { parseTaskInput } from '@/utils/parseTaskInput';
import { loadTaskPrefs } from '@/utils/taskPrefs';
import { Calendar, Clock, Hash, Flag, Target, Sparkle, Warning } from '@phosphor-icons/react';

const QUADRANT_LABELS: Record<Priority, { label: string; color: string }> = {
  'urgent-important': { label: PRIORITY_LABEL['urgent-important'], color: PRIORITY_COLOR['urgent-important'] },
  'urgent-not-important': { label: PRIORITY_LABEL['urgent-not-important'], color: PRIORITY_COLOR['urgent-not-important'] },
  'not-urgent-important': { label: PRIORITY_LABEL['not-urgent-important'], color: PRIORITY_COLOR['not-urgent-important'] },
  'not-urgent-not-important': { label: PRIORITY_LABEL['not-urgent-not-important'], color: PRIORITY_COLOR['not-urgent-not-important'] },
};

interface SmartTaskInputProps {
  tags: Tag[];
  goals: Goal[];
  onSubmit: (data: {
    title: string;
    description?: string;
    dueDate: string;
    dueTime?: string | null;
    estimatedMinutes?: number;
    priority?: Priority;
    tags?: string[];
    goalId?: string | null;
    reminderEnabled?: boolean;
    reminderTime?: string | null;
  }) => void;
  onCancel: () => void;
}

export default function SmartTaskInput({ tags, goals, onSubmit, onCancel }: SmartTaskInputProps) {
  const [input, setInput] = useState('');
  const [description, setDescription] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('09:00');

  const parsed = useMemo(() => parseTaskInput(input), [input]);

  const matchedTags = useMemo(() => {
    return parsed.tagNames
      .map((name) => tags.find((t) => t.name === name))
      .filter(Boolean) as Tag[];
  }, [parsed.tagNames, tags]);

  const matchedGoal = useMemo(() => {
    if (!parsed.goalName) return null;
    return goals.find((g) => g.name.includes(parsed.goalName!)) ?? null;
  }, [parsed.goalName, goals]);

  const hasContent = parsed.title || parsed.dueDate || parsed.dueTime || parsed.estimatedMinutes || parsed.priority || matchedTags.length > 0 || matchedGoal;

  const handleSubmit = () => {
    if (!parsed.title) return;
    const prefs = loadTaskPrefs();
    onSubmit({
      title: parsed.title,
      description: description.trim() || undefined,
      dueDate: parsed.dueDate ?? new Date().toISOString().split('T')[0],
      dueTime: parsed.dueTime,
      estimatedMinutes: parsed.estimatedMinutes ?? prefs.estimatedMinutes,
      priority: parsed.priority ?? prefs.priority,
      tags: matchedTags.length > 0 ? matchedTags.map((t) => t.id) : prefs.tags,
      goalId: matchedGoal?.id ?? null,
      reminderEnabled,
      reminderTime: reminderEnabled ? reminderTime : null,
    });
  };

  return (
    <div className="space-y-4">
      {/* Input */}
      <div>
        <label className="text-small text-text-secondary block mb-1.5 font-medium flex items-center gap-1.5">
          <Sparkle weight="duotone" size={14} className="text-primary" />
          一句话描述任务
        </label>
        <input
          className="input w-full"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='例如: 明天下午3点开会讨论Q2规划 30分钟 #工作 !重要'
          autoFocus
        />
        <p className="text-caption text-text-secondary mt-1.5 leading-relaxed">
          <span className="text-primary font-medium">#标签</span> <span className="text-text-secondary">匹配已有标签</span>
          <span className="mx-1.5">·</span>
          <span className="text-primary font-medium">!优先级</span>
          <span className="mx-1.5">·</span>
          <span className="text-primary font-medium">@目标</span>
          <span className="mx-1.5">·</span>
          支持 明天/下午3点/N分钟
        </p>
      </div>

      {/* Preview */}
      {hasContent && (
        <div className="bg-surface-hover rounded-btn p-3 space-y-2">
          <p className="text-caption text-text-secondary flex items-center gap-1.5">
            <Sparkle weight="duotone" size={12} />
            解析预览
          </p>

          {/* Title */}
          <div className="flex items-center gap-2">
            <Warning weight="duotone" size={14} className="text-text-secondary flex-shrink-0" />
            <span className={`text-sm ${parsed.title ? 'text-text font-medium' : 'text-text-secondary italic'}`}>
              {parsed.title || '(需要输入任务名称)'}
            </span>
          </div>

          {/* Date */}
          {parsed.dueDate && (
            <div className="flex items-center gap-2">
              <Calendar weight="duotone" size={14} className="text-primary flex-shrink-0" />
              <span className="text-sm text-text">{parsed.dueDate}</span>
            </div>
          )}

          {/* Time */}
          {parsed.dueTime && (
            <div className="flex items-center gap-2">
              <Clock weight="bold" size={14} className="text-primary flex-shrink-0" />
              <span className="text-sm text-text">{parsed.dueTime}</span>
            </div>
          )}

          {/* Estimated minutes */}
          {parsed.estimatedMinutes && (
            <div className="flex items-center gap-2">
              <Clock weight="bold" size={14} className="text-warning flex-shrink-0" />
              <span className="text-sm text-text">{parsed.estimatedMinutes} 分钟</span>
            </div>
          )}

          {/* Priority */}
          {parsed.priority && (
            <div className="flex items-center gap-2">
              <Flag weight="duotone" size={14} className="flex-shrink-0" style={{ color: QUADRANT_LABELS[parsed.priority].color }} />
              <span className="text-sm text-text">{QUADRANT_LABELS[parsed.priority].label}</span>
            </div>
          )}

          {/* Tags */}
          {matchedTags.length > 0 && (
            <div className="flex items-center gap-2">
              <Hash weight="duotone" size={14} className="text-text-secondary flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {matchedTags.map((t) => (
                  <span key={t.id} className="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-surface" style={{ color: t.color }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Goal */}
          {matchedGoal && (
            <div className="flex items-center gap-2">
              <Target weight="duotone" size={14} className="text-primary flex-shrink-0" />
              <span className="text-sm text-text">{matchedGoal.name}</span>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      <div>
        <label className="text-small text-text-secondary block mb-1 font-medium">备注</label>
        <textarea autoComplete="off" className="input w-full resize-none" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="补充说明（可选）…" />
      </div>

      {/* Reminder */}
      <div className="flex items-center gap-3 bg-surface-hover rounded-btn px-3 py-2">
        <label className="flex items-center gap-1.5 cursor-pointer text-small">
          <input autoComplete="off" type="checkbox" checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} className="rounded" />
          <span className="font-medium">设置提醒</span>
        </label>
        {reminderEnabled && (
          <input autoComplete="off" className="input text-small w-28" type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
        )}
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" className="btn-secondary" onClick={onCancel}>取消</button>
        <button
          type="button"
          className="btn-primary flex items-center gap-1.5"
          onClick={handleSubmit}
          disabled={!parsed.title}
        >
          <Sparkle weight="duotone" size={16} />
          创建任务
        </button>
      </div>
    </div>
  );
}

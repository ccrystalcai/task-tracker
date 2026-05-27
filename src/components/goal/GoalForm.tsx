import { useState } from 'react';
import type { Goal } from '@/db/schema';

interface GoalFormProps {
  initial?: Partial<Goal>;
  onSubmit: (data: { name: string; description: string; deadline: Date; color: string }) => void;
  onCancel: () => void;
}

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export default function GoalForm({ initial, onSubmit, onCancel }: GoalFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const oneMonthLater = new Date();
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
  const [deadline, setDeadline] = useState(
    initial?.deadline ? new Date(initial.deadline).toISOString().split('T')[0] : oneMonthLater.toISOString().split('T')[0],
  );
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim(), deadline: new Date(deadline), color });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-caption text-text-secondary block mb-1">目标名称</label>
        <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：3个月学会编程" required autoFocus />
      </div>
      <div>
        <label className="text-caption text-text-secondary block mb-1">描述（可选）</label>
        <textarea className="input w-full resize-none" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="简单描述一下这个目标" />
      </div>
      <div>
        <label className="text-caption text-text-secondary block mb-1">截止日期</label>
        <input className="input w-full" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
      </div>
      <div>
        <label className="text-caption text-text-secondary block mb-2">标签颜色</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'scale-110 ring-2 ring-offset-2 ring-primary' : 'hover:scale-105'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>取消</button>
        <button type="submit" className="btn-primary">{initial?.id ? '保存' : '创建目标'}</button>
      </div>
    </form>
  );
}

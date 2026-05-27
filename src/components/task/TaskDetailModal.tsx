import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useTagStore } from '@/stores/tagStore';
import { useTaskStore } from '@/stores/taskStore';
import { useGoalStore } from '@/stores/goalStore';
import TaskHistoryModal from '@/components/task/TaskHistoryModal';
import { db } from '@/db';
import type { Task, Goal } from '@/db/schema';
import {
  CheckCircle2, Circle, SkipForward, Clock, Star,
  Target, Calendar, RotateCcw, ImagePlus, X, History,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  'urgent-important': { label: '紧急重要', color: '#EF4444' },
  'urgent-not-important': { label: '紧急不重要', color: '#F59E0B' },
  'not-urgent-important': { label: '不紧急重要', color: '#6366F1' },
  'not-urgent-not-important': { label: '不紧急不重要', color: '#10B981' },
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  completed: { icon: <CheckCircle2 size={18} />, label: '已完成', className: 'text-success bg-success/10' },
  pending: { icon: <Circle size={18} />, label: '待完成', className: 'text-text-secondary bg-surface-hover' },
  skipped: { icon: <SkipForward size={18} />, label: '已跳过', className: 'text-warning bg-warning/10' },
};

interface TaskDetailModalProps {
  open: boolean;
  onClose: () => void;
  task: Task;
  goal: Goal | null;
  onUpdate?: () => void;
}

export default function TaskDetailModal({ open, onClose, task, goal, onUpdate }: TaskDetailModalProps) {
  const { getTagPath } = useTagStore();
  const { tasks: allTasks } = useTaskStore();
  const { goals } = useGoalStore();
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editActualStart, setEditActualStart] = useState(task.actualStartTime || '');
  const [editActualEnd, setEditActualEnd] = useState(task.actualEndTime || '');
  const [editActualMinutes, setEditActualMinutes] = useState(task.actualMinutes || 0);
  const [savingTime, setSavingTime] = useState(false);

  const goalMap = new Map(goals.map((g) => [g.id, g]));
  const canShowHistory = task.recurrenceType !== 'none' || task.sourceTaskId != null;

  const statusCfg = STATUS_CONFIG[task.status];
  const priorityCfg = PRIORITY_LABELS[task.priority];

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
        <div className="space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Status + Priority */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-caption font-medium ${statusCfg.className}`}>
              {statusCfg.icon}
              {statusCfg.label}
            </span>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-caption font-medium text-white"
              style={{ backgroundColor: priorityCfg.color }}
            >
              {priorityCfg.label}
            </span>
            {task.recurrenceType !== 'none' && (
              <span className="text-caption text-text-secondary flex items-center gap-1">
                <RotateCcw size={12} />
                {task.recurrenceType === 'daily' ? '每天' : task.recurrenceType === 'weekly' ? '每周' : '每月'}
                {task.recurrenceInterval > 1 && ` × ${task.recurrenceInterval}`}
              </span>
            )}
            {canShowHistory && (
              <button
                onClick={() => setShowHistory(true)}
                className="text-caption text-primary flex items-center gap-1 hover:underline"
              >
                <History size={12} />
                查看历史
              </button>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <p className="text-caption text-text-secondary mb-1">描述</p>
              <p className="text-body bg-surface-hover rounded-card p-3 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Goal */}
          {goal && (
            <div className="flex items-center gap-2">
              <Target size={14} />
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: goal.color }} />
              <span className="text-body">{goal.name}</span>
            </div>
          )}

          {/* Time */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-hover rounded-card p-3 text-center">
                <p className="text-caption text-text-secondary mb-0.5">预估时间</p>
                <p className="text-h3 flex items-center justify-center gap-1">
                  <Clock size={18} />
                  {formatTime(task.estimatedMinutes)}
                </p>
              </div>
              <div className="bg-surface-hover rounded-card p-3 text-center">
                <p className="text-caption text-text-secondary mb-0.5">实际耗时(分钟)</p>
                <input
                  className="input text-center text-h3 w-full"
                  type="number"
                  min={0}
                  step={5}
                  value={editActualMinutes}
                  onChange={(e) => setEditActualMinutes(Number(e.target.value))}
                />
              </div>
            </div>

            {task.status === 'completed' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-caption text-text-secondary block mb-0.5">开始时间</label>
                  <input
                    className="input w-full text-small"
                    type="datetime-local"
                    value={editActualStart ? new Date(editActualStart).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setEditActualStart(e.target.value ? new Date(e.target.value).toISOString() : '')}
                  />
                </div>
                <div>
                  <label className="text-caption text-text-secondary block mb-0.5">结束时间</label>
                  <input
                    className="input w-full text-small"
                    type="datetime-local"
                    value={editActualEnd ? new Date(editActualEnd).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setEditActualEnd(e.target.value ? new Date(e.target.value).toISOString() : '')}
                  />
                </div>
              </div>
            )}

            <button
              className="btn-secondary text-small w-full"
              disabled={savingTime}
              onClick={async () => {
                setSavingTime(true);
                await db.tasks.update(task.id, {
                  actualMinutes: editActualMinutes,
                  actualStartTime: editActualStart || null,
                  actualEndTime: editActualEnd || null,
                  updatedAt: new Date(),
                });
                setSavingTime(false);
                onUpdate?.();
              }}
            >
              {savingTime ? '保存中...' : '更新时间'}
            </button>
          </div>

          {/* Score */}
          {task.score != null && (
            <div>
              <p className="text-caption text-text-secondary mb-1">评分</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={20}
                    fill={s <= task.score! ? '#F59E0B' : 'none'}
                    color={s <= task.score! ? '#F59E0B' : '#CBD5E1'} />
                ))}
              </div>
            </div>
          )}

          {/* Reflection */}
          {task.reflection && (
            <div>
              <p className="text-caption text-text-secondary mb-1">
                {task.status === 'skipped' ? '跳过原因' : '反思'}
              </p>
              <p className="text-body bg-surface-hover rounded-card p-3 whitespace-pre-wrap italic">
                {task.reflection}
              </p>
            </div>
          )}

          {/* Notes */}
          {task.notes && task.notes !== task.description && (
            <div>
              <p className="text-caption text-text-secondary mb-1">备注</p>
              <p className="text-body bg-surface-hover rounded-card p-3 whitespace-pre-wrap">{task.notes}</p>
            </div>
          )}

          {/* Tags */}
          {task.tags.length > 0 && (
            <div>
              <p className="text-caption text-text-secondary mb-1">标签</p>
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tagId) => {
                  const path = getTagPath(tagId);
                  if (path.length === 0) return null;
                  const tag = path[path.length - 1];
                  return (
                    <span key={tagId}
                      className="text-small px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: tag.color }}>
                      {path.map((t, i) => (
                        <span key={t.id}>
                          {i > 0 && <span className="opacity-60"> / </span>}
                          {t.name}
                        </span>
                      ))}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Images */}
          {(task.images?.length ?? 0) > 0 && (
            <div>
              <p className="text-caption text-text-secondary mb-2">图片</p>
              <div className="grid grid-cols-3 gap-2">
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
                      className="absolute top-1 right-1 p-0.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Image Upload */}
          <div>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-btn bg-surface-hover hover:bg-border cursor-pointer transition-colors text-body">
              <ImagePlus size={18} />
              {uploading ? '上传中...' : '添加图片'}
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={handleImageUpload} disabled={uploading} />
            </label>
          </div>

          {/* Dates */}
          <div className="text-caption text-text-secondary space-y-1 pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <Calendar size={12} />
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

      {/* Image preview overlay */}
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
          allTasks={allTasks}
          goalMap={goalMap}
          onUpdate={() => onUpdate?.()}
        />
      )}
    </>
  );
}

import { useEffect, useState } from 'react';
import { useGoalStore } from '@/stores/goalStore';
import { useTaskStore } from '@/stores/taskStore';
import { useTagStore } from '@/stores/tagStore';
import { db } from '@/db';
import { generateId } from '@/utils/id';
import { templates } from '@/db/seeds';
import Modal from '@/components/ui/Modal';
import { SkeletonList } from '@/components/ui/Skeleton';
import GoalForm from '@/components/goal/GoalForm';
import TaskForm from '@/components/task/TaskForm';
import TimerTaskItem from '@/components/task/TimerTaskItem';
import TaskDetailModal from '@/components/task/TaskDetailModal';
import type { Goal, Task, GoalTemplate } from '@/db/schema';
import { Target, Plus, CaretDown, CaretUp, CaretRight, Trash, PencilSimple, Sparkle, Clock, BookmarkSimple } from '@phosphor-icons/react';
import { format } from 'date-fns';

export default function Goals() {
  const { goals, loading, fetchGoals, createGoal, updateGoal, deleteGoal } = useGoalStore();
  const { tasks, fetchTasks, createTask, updateTask, toggleTask, deleteTask } = useTaskStore();
  const { tags, fetchTags, createTag } = useTagStore();

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState<{ goalId: string | null } | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [expandedRecurring, setExpandedRecurring] = useState<Set<string>>(new Set());
  const [customTemplates, setCustomTemplates] = useState<GoalTemplate[]>([]);
  const [saveTemplateGoal, setSaveTemplateGoal] = useState<Goal | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<GoalTemplate | null>(null);
  const [editTmplName, setEditTmplName] = useState('');
  const [editTmplDesc, setEditTmplDesc] = useState('');

  useEffect(() => {
    fetchGoals();
    fetchTasks();
    fetchTags();
    db.goalTemplates.toArray().then(setCustomTemplates);
  }, []);

  const goalTasks = (goalId: string) => tasks.filter((t) => t.goalId === goalId);

  // Count actionable tasks: children for recurring sources, source itself for non-recurring
  const goalActionableTasks = (goalId: string) => {
    const all = goalTasks(goalId);
    const sources = all.filter((t) => t.sourceTaskId == null);
    const children = all.filter((t) => t.sourceTaskId != null);
    const regularTasks = sources.filter((t) => t.recurrenceType === 'none');
    const recurringSources = sources.filter((t) => t.recurrenceType !== 'none');
    let total = regularTasks.length;
    recurringSources.forEach((src) => {
      const childCount = children.filter((c) => c.sourceTaskId === src.id).length;
      total += childCount > 0 ? childCount : 1;
    });
    return { total, children, regularTasks, recurringSources };
  };

  const progress = (goalId: string) => {
    const { total, children, regularTasks, recurringSources } = goalActionableTasks(goalId);
    if (total === 0) return 0;
    let completed = regularTasks.filter((t) => t.status === 'completed').length;
    recurringSources.forEach((src) => {
      const srcChildren = children.filter((c) => c.sourceTaskId === src.id);
      if (srcChildren.length > 0) {
        completed += srcChildren.filter((c) => c.status === 'completed').length;
      }
    });
    return Math.round((completed / total) * 100);
  };

  const getChildStats = (sourceId: string) => {
    const children = tasks.filter((t) => t.sourceTaskId === sourceId);
    const completed = children.filter((t) => t.status === 'completed').length;
    return { total: children.length, completed };
  };

  // Goal handlers
  const handleCreateGoal = (data: { name: string; description: string; deadline: Date; color: string }) => {
    createGoal(data);
    setShowGoalForm(false);
  };

  const handleUpdateGoal = (data: { name: string; description: string; deadline: Date; color: string }) => {
    if (editingGoal) {
      updateGoal(editingGoal.id, data);
      setEditingGoal(null);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{ goal: Goal; count: number } | null>(null);

  const handleDeleteGoal = async (id: string) => {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;
    const childTasks = tasks.filter((t) => t.goalId === id);
    if (childTasks.length > 0) {
      setDeleteConfirm({ goal, count: childTasks.length });
    } else {
      if (!confirm(`确定删除目标「${goal.name}」？`)) return;
      await deleteGoal(id);
      fetchGoals();
      fetchTasks();
    }
  };

  const confirmDeleteGoal = async (deleteTasks: boolean) => {
    if (!deleteConfirm) return;
    const { goal } = deleteConfirm;
    const childTasks = tasks.filter((t) => t.goalId === goal.id);
    await deleteGoal(goal.id);
    if (deleteTasks) {
      for (const t of childTasks) {
        await db.tasks.delete(t.id);
      }
    } else {
      for (const t of childTasks) {
        await db.tasks.update(t.id, { goalId: null, updatedAt: new Date() });
      }
    }
    setDeleteConfirm(null);
    fetchGoals();
    fetchTasks();
  };

  const handleSaveAsTemplate = async () => {
    if (!saveTemplateGoal || !templateName.trim()) return;
    const goalTasks = tasks.filter((t) => t.goalId === saveTemplateGoal.id);
    const taskTags = new Set(goalTasks.flatMap((t) => t.tags));
    const goalTags = tags.filter((t) => taskTags.has(t.id));
    const now = new Date();
    const tpl: GoalTemplate = {
      id: generateId(),
      name: templateName.trim(),
      description: templateDesc.trim(),
      data: {
        goal: { name: saveTemplateGoal.name, description: saveTemplateGoal.description, deadline: saveTemplateGoal.deadline, status: 'active', color: saveTemplateGoal.color },
        tags: goalTags.map((t) => ({ name: t.name, color: t.color, parentId: t.parentId })),
        tasks: goalTasks.map((t) => ({
          title: t.title, description: t.description, estimatedMinutes: t.estimatedMinutes, actualMinutes: 0,
          actualStartTime: null, actualEndTime: null, dueDate: new Date().toISOString().split('T')[0],
          dueTime: t.dueTime, reminderEnabled: t.reminderEnabled, reminderTime: t.reminderTime,
          priority: t.priority, tags: [], recurrenceType: t.recurrenceType,
          recurrenceInterval: t.recurrenceInterval, recurrenceEndDate: t.recurrenceEndDate,
          sourceTaskId: null, score: null, reflection: '', notes: t.notes, images: [],
          status: 'pending' as const, completedAt: null,
        })),
      },
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.goalTemplates.put(tpl);
    setCustomTemplates((prev) => [...prev, tpl]);
    setSaveTemplateGoal(null);
    setTemplateName('');
    setTemplateDesc('');
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('确定要删除这个模板吗？')) return;
    await db.goalTemplates.delete(id);
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSaveTemplateEdit = async () => {
    if (!editingTemplate || !editTmplName.trim()) return;
    const updated = { ...editingTemplate, name: editTmplName.trim(), description: editTmplDesc.trim(), updatedAt: new Date() };
    await db.goalTemplates.put(updated);
    setCustomTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    setEditingTemplate(null);
  };

  // Task handlers
  const handleCreateTask = async (data: Parameters<typeof createTask>[0]) => {
    await createTask(data);
    setShowTaskForm(null);
    await fetchTasks();
  };

  const handleUpdateTask = async (data: Parameters<typeof createTask>[0]) => {
    if (editingTask) {
      await updateTask(editingTask.id, data as Partial<Task>);
      setEditingTask(null);
      await fetchTasks();
    }
  };

  // Template import
  const handleImportTemplate = async (template: (typeof templates)[0]) => {
    const now = new Date();
    const goal: Goal = {
      ...template.data.goal,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    // Create tags first
    const tagMap = new Map<string, string>();
    for (const t of template.data.tags) {
      const existing = tags.find((tag) => tag.name === t.name);
      if (existing) {
        tagMap.set(t.name, existing.id);
      } else {
        const created = await createTag(t.name, t.color);
        tagMap.set(t.name, created.id);
      }
    }

    await db.goals.put(goal);
    const allTagIds = Array.from(tagMap.values());

    const newTasks: Task[] = template.data.tasks.map((t) => ({
      ...t,
      id: generateId(),
      goalId: goal.id,
      tags: allTagIds,
      createdAt: now,
      updatedAt: now,
    }));

    await db.tasks.bulkPut(newTasks);
    await fetchGoals();
    await fetchTasks();
    await fetchTags();
  };

  if (loading) return <div className="max-w-2xl mx-auto p-4"><SkeletonList count={6} /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-h3 flex items-center gap-2">
              <Target weight="duotone" size={22} className="text-primary" />
              目标规划
            </h3>
            <p className="text-caption text-text-secondary mt-1">
              目标是任务的集合，先创建目标，再拆解出每天的具体任务
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowGoalForm(true)}>
              <Plus weight="bold" size={16} />创建目标
            </button>
            <TemplateImport
              builtInTemplates={templates}
              customTemplates={customTemplates}
              onImport={handleImportTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onEditTemplate={(tpl) => { setEditingTemplate(tpl); setEditTmplName(tpl.name); setEditTmplDesc(tpl.description); }}
            />
          </div>
        </div>
      </div>

      {/* Goal List */}
      {goals.length === 0 ? (
        <div className="card text-center py-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/5 mb-4">
            <Target weight="duotone" size={40} className="text-primary opacity-40" />
          </div>
          <p className="text-h3 text-text-secondary mb-2">还没有任何目标</p>
          <p className="text-caption text-text-secondary mb-6">创建一个目标，或从模板快速开始</p>
          <div className="flex justify-center gap-3">
            <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowGoalForm(true)}>
              <Plus weight="bold" size={18} />创建目标
            </button>
          </div>
        </div>
      ) : (
        goals.map((goal) => (
          <div key={goal.id} className="card">
            {/* Goal Header */}
            <div className="flex items-start justify-between gap-2">
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: goal.color, boxShadow: `0 0 0 3px ${goal.color}20` }} />
                  <h3 className="text-h3">{goal.name}</h3>
                  <span className={`badge ${
                    goal.status === 'active' ? 'badge-success' :
                    goal.status === 'completed' ? 'badge-primary' : 'badge-muted'
                  }`}>
                    {goal.status === 'active' ? '进行中' : goal.status === 'completed' ? '已完成' : '已归档'}
                  </span>
                </div>
                {goal.description && <p className="text-caption text-text-secondary mt-1 ml-6">{goal.description}</p>}
                <div className="flex items-center gap-4 mt-2 ml-6">
                  <div className="flex items-center gap-1 text-caption text-text-secondary">
                    <Clock weight="bold" size={13} />
                    截止 {format(new Date(goal.deadline), 'yyyy/MM/dd')}
                  </div>
                  <span className="text-caption text-text-secondary">
                    {(() => {
                      const { total, children, regularTasks, recurringSources } = goalActionableTasks(goal.id);
                      let completed = regularTasks.filter((t) => t.status === 'completed').length;
                      recurringSources.forEach((src) => {
                        const srcChildren = children.filter((c) => c.sourceTaskId === src.id);
                        if (srcChildren.length > 0) {
                          completed += srcChildren.filter((c) => c.status === 'completed').length;
                        }
                      });
                      return `${completed}/${total} 任务 · ${progress(goal.id)}% 完成`;
                    })()}
                  </span>
                  {expandedGoal === goal.id ? <CaretUp size={16} className="text-text-secondary" /> : <CaretDown weight="bold" size={16} className="text-text-secondary" />}
                </div>
                {/* Progress bar */}
                <div className="ml-6 mt-2 w-full max-w-xs h-2 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition duration-500 ease-out" style={{
                    width: `${progress(goal.id)}%`,
                    background: `linear-gradient(90deg, ${goal.color}cc, ${goal.color})`,
                  }} />
                </div>
              </div>

              <div className="flex gap-0.5 ml-2 flex-shrink-0">
                <button className="p-1.5 rounded hover:bg-surface-hover text-text-secondary" title="保存为模板" onClick={() => { setSaveTemplateGoal(goal); setTemplateName(goal.name); setTemplateDesc(goal.description); }}>
                  <BookmarkSimple weight="duotone" size={14} />
                </button>
                <button className="p-1.5 rounded hover:bg-surface-hover text-text-secondary" onClick={() => setEditingGoal(goal)}>
                  <PencilSimple weight="bold" size={14} />
                </button>
                <button className="p-1.5 rounded hover:bg-surface-hover text-danger" onClick={() => handleDeleteGoal(goal.id)}>
                  <Trash weight="bold" size={14} />
                </button>
              </div>
            </div>

            {/* Task List (Expanded) */}
            {expandedGoal === goal.id && (
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-caption text-text-secondary">子任务列表</span>
                  <button className="text-small text-primary hover:underline flex items-center gap-1" onClick={() => setShowTaskForm({ goalId: goal.id })}>
                    <Plus weight="bold" size={14} />添加任务
                  </button>
                </div>
                {goalTasks(goal.id).length === 0 ? (
                  <p className="text-caption text-text-secondary text-center py-4">还没有子任务，点击上方按钮添加</p>
                ) : (
                  (() => {
                    const allGoalTasks = goalTasks(goal.id);
                    // Separate source tasks and recurring children
                    const sourceIds = new Set(allGoalTasks
                      .filter((t) => t.sourceTaskId != null)
                      .map((t) => t.sourceTaskId!));
                    const sources = allGoalTasks.filter((t) => t.sourceTaskId == null);
                    const childrenBySource: Record<string, Task[]> = {};
                    allGoalTasks.forEach((t) => {
                      if (t.sourceTaskId && sourceIds.has(t.sourceTaskId)) {
                        if (!childrenBySource[t.sourceTaskId]) childrenBySource[t.sourceTaskId] = [];
                        childrenBySource[t.sourceTaskId].push(t);
                      }
                    });
                    // Orphan instances (source not in this goal)
                    const orphans = allGoalTasks.filter((t) =>
                      t.sourceTaskId != null && !sourceIds.has(t.sourceTaskId)
                    );

                    const toggleRecurring = (id: string) => {
                      setExpandedRecurring((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id); else next.add(id);
                        return next;
                      });
                    };

                    return (
                      <div className="space-y-1">
                        {sources.map((task) => {
                          const children = childrenBySource[task.id] || [];
                          const hasChildren = children.length > 0;
                          const isExpanded = expandedRecurring.has(task.id);
                          const stats = getChildStats(task.id);

                          if (hasChildren) {
                            // Source task with children: whole row clickable for expand
                            return (
                              <div key={task.id}>
                                <div
                                  className="flex items-center gap-2 px-3 py-2.5 rounded-btn hover:bg-surface-hover cursor-pointer group transition-colors"
                                  onClick={() => toggleRecurring(task.id)}
                                >
                                  <div className="flex-1">
                                    <TimerTaskItem task={task} tags={tags}
                                      onToggle={async () => { await toggleTask(task.id); await fetchTasks(); }}
                                      onEdit={() => setEditingTask(task)}
                                      onDelete={async () => { await deleteTask(task.id); await fetchTasks(); }}
                                      onDetail={() => setDetailTask(task)}
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-small font-medium" style={{ color: stats.completed === stats.total ? '#10B981' : '#6366F1' }}>
                                      {stats.completed}/{stats.total}
                                    </span>
                                  </div>
                                  <span className="text-text-secondary flex-shrink-0">
                                    {isExpanded ? <CaretDown weight="bold" size={16} /> : <CaretRight weight="bold" size={16} />}
                                  </span>
                                </div>
                                {isExpanded && (
                                  <div className="ml-4 pl-4 border-l-2 border-primary/20 space-y-0.5 mt-0.5">
                                    {children.sort((a, b) => b.dueDate.localeCompare(a.dueDate)).map((child) => (
                                      <TimerTaskItem key={child.id} task={child} tags={tags}
                                        onToggle={async () => { await toggleTask(child.id); await fetchTasks(); }}
                                        onEdit={() => setEditingTask(child)}
                                        onDelete={async () => { await deleteTask(child.id); await fetchTasks(); }}
                                        onDetail={() => setDetailTask(child)}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          // Regular task or source without children yet
                          return (
                            <TimerTaskItem key={task.id} task={task} tags={tags}
                              onToggle={async () => { await toggleTask(task.id); await fetchTasks(); }}
                              onEdit={() => setEditingTask(task)}
                              onDelete={async () => { await deleteTask(task.id); await fetchTasks(); }}
                              onDetail={() => setDetailTask(task)}
                            />
                          );
                        })}
                        {orphans.map((task) => (
                          <TimerTaskItem key={task.id} task={task} tags={tags}
                            onToggle={async () => { await toggleTask(task.id); await fetchTasks(); }}
                            onEdit={() => setEditingTask(task)}
                            onDelete={async () => { await deleteTask(task.id); await fetchTasks(); }}
                            onDetail={() => setDetailTask(task)}
                          />
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>
            )}
          </div>
        ))
      )}

      {/* Modals */}
      <Modal open={showGoalForm} onClose={() => setShowGoalForm(false)} title="创建目标">
        <GoalForm onSubmit={handleCreateGoal} onCancel={() => setShowGoalForm(false)} />
      </Modal>
      <Modal open={!!editingGoal} onClose={() => setEditingGoal(null)} title="编辑目标">
        {editingGoal && <GoalForm initial={editingGoal} onSubmit={handleUpdateGoal} onCancel={() => setEditingGoal(null)} />}
      </Modal>
      <Modal open={!!showTaskForm} onClose={() => setShowTaskForm(null)} title="添加任务">
        <TaskForm goalId={showTaskForm?.goalId ?? null} tags={tags} onSubmit={handleCreateTask} onCancel={() => setShowTaskForm(null)} />
      </Modal>
      <Modal open={!!editingTask} onClose={() => setEditingTask(null)} title="编辑任务">
        {editingTask && <TaskForm initial={editingTask} tags={tags} onSubmit={handleUpdateTask} onCancel={() => setEditingTask(null)} />}
      </Modal>

      {detailTask && (
        <TaskDetailModal
          open={!!detailTask}
          onClose={() => setDetailTask(null)}
          task={detailTask}
          goal={detailTask.goalId ? goals.find((g) => g.id === detailTask.goalId) ?? null : null}
          onUpdate={fetchTasks}
        />
      )}

      {/* Save as Template Modal */}
      <Modal open={!!saveTemplateGoal} onClose={() => setSaveTemplateGoal(null)} title="保存为模板">
        <div className="space-y-4">
          <div>
            <label className="text-caption text-text-secondary">模板名称</label>
            <input autoComplete="off" className="input mt-1" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="输入模板名称" />
          </div>
          <div>
            <label className="text-caption text-text-secondary">模板描述</label>
            <textarea autoComplete="off" className="input mt-1" rows={2} value={templateDesc} onChange={(e) => setTemplateDesc(e.target.value)} placeholder="描述这个模板" />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button className="btn-secondary" onClick={() => setSaveTemplateGoal(null)}>取消</button>
            <button className="btn-primary" onClick={handleSaveAsTemplate} disabled={!templateName.trim()}>保存</button>
          </div>
        </div>
      </Modal>

      {/* Edit Template Modal */}
      <Modal open={!!editingTemplate} onClose={() => setEditingTemplate(null)} title="编辑模板">
        <div className="space-y-4">
          <div>
            <label className="text-caption text-text-secondary">模板名称</label>
            <input autoComplete="off" className="input mt-1" value={editTmplName} onChange={(e) => setEditTmplName(e.target.value)} placeholder="输入模板名称" />
          </div>
          <div>
            <label className="text-caption text-text-secondary">模板描述</label>
            <textarea autoComplete="off" className="input mt-1" rows={2} value={editTmplDesc} onChange={(e) => setEditTmplDesc(e.target.value)} placeholder="描述这个模板" />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button className="btn-secondary" onClick={() => setEditingTemplate(null)}>取消</button>
            <button className="btn-primary" onClick={handleSaveTemplateEdit} disabled={!editTmplName.trim()}>保存</button>
          </div>
        </div>
      </Modal>

      {deleteConfirm && (
        <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="删除目标">
          <div className="space-y-4">
            <p className="text-body">
              确定删除目标「<span className="font-medium">{deleteConfirm.goal.name}</span>」？
            </p>
            <p className="text-small text-text-secondary bg-warning/5 rounded-card p-3 border border-warning/10">
              该目标下有 <span className="font-medium text-warning">{deleteConfirm.count}</span> 个关联任务，请选择处理方式。
            </p>
            <div className="flex gap-2 justify-end pt-2 border-t border-border">
              <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>
                取消
              </button>
              <button className="btn-secondary" onClick={() => confirmDeleteGoal(false)}>
                保留任务
              </button>
              <button className="btn-primary" style={{ backgroundColor: '#EF4444' }} onClick={() => confirmDeleteGoal(true)}>
                全部删除
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

function TemplateImport({ builtInTemplates, customTemplates, onImport, onDeleteTemplate, onEditTemplate }: {
  builtInTemplates: typeof templates;
  customTemplates: GoalTemplate[];
  onImport: (t: (typeof templates)[0]) => void;
  onDeleteTemplate: (id: string) => void;
  onEditTemplate: (tpl: GoalTemplate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<(typeof templates)[0] | null>(null);
  const [previewIsCustom, setPreviewIsCustom] = useState(false);

  const openPreview = (t: (typeof templates)[0], isCustom: boolean) => {
    setPreview(t);
    setPreviewIsCustom(isCustom);
  };

  return (
    <>
      <button className="btn-secondary flex items-center gap-1.5" onClick={() => setOpen(true)}>
        <Sparkle weight="duotone" size={16} />从模板创建
      </button>
      <Modal open={open} onClose={() => { setOpen(false); setPreview(null); }} title={preview ? '预览模板' : '选择模板'}>
        {preview ? (
          <div className="space-y-4">
            <div className="bg-surface-hover rounded-card p-4">
              <p className="text-body font-medium">{preview.name}</p>
              <p className="text-caption text-text-secondary mt-1">{preview.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: preview.data.goal.color }} />
                <span className="text-small">{preview.data.goal.name}</span>
              </div>
            </div>
            <div>
              <p className="text-caption text-text-secondary mb-2">包含 {preview.data.tasks.length} 个预设任务：</p>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {preview.data.tasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-small px-3 py-1.5 bg-surface-hover rounded-btn">
                    <span className="text-text-secondary w-5 text-right">{i + 1}.</span>
                    <span className="flex-1 truncate">{t.title}</span>
                    <span className="text-text-secondary">{t.estimatedMinutes}分钟</span>
                  </div>
                ))}
              </div>
            </div>
            {preview.data.tags.length > 0 && (
              <div>
                <p className="text-caption text-text-secondary mb-1">标签：</p>
                <div className="flex gap-1 flex-wrap">
                  {preview.data.tags.map((tag) => (
                    <span key={tag.name} className="text-small flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              {previewIsCustom && (
                <button className="btn-secondary text-danger flex items-center gap-1.5" onClick={() => {
                  const ct = customTemplates.find((c) => c.name === preview.name && c.description === preview.description);
                  if (ct) { onDeleteTemplate(ct.id); setOpen(false); setPreview(null); }
                }}><Trash weight="bold" size={14} />删除模板</button>
              )}
              <button className="btn-secondary" onClick={() => setPreview(null)}>返回选择</button>
              <button className="btn-primary" onClick={() => { onImport(preview); setOpen(false); setPreview(null); }}>
                确认导入
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-h-[450px] overflow-y-auto">
            {builtInTemplates.length > 0 && (
              <p className="text-caption text-text-secondary font-medium">内置模板</p>
            )}
            {builtInTemplates.map((t) => (
              <button key={t.name} className="w-full text-left card hover:shadow-card-hover transition-shadow"
                onClick={() => openPreview(t, false)}>
                <p className="text-body font-medium">{t.name}</p>
                <p className="text-caption text-text-secondary">{t.description}</p>
                <p className="text-small text-primary mt-1">{t.data.tasks.length} 个预设任务</p>
              </button>
            ))}
            {customTemplates.length > 0 && (
              <p className="text-caption text-text-secondary font-medium pt-3">自定义模板</p>
            )}
            {customTemplates.map((t) => (
              <div key={t.id} className="w-full text-left card hover:shadow-card-hover transition-shadow flex items-start justify-between"
                onClick={() => openPreview({ name: t.name, description: t.description, data: t.data as (typeof builtInTemplates)[0]['data'] }, true)}>
                <div>
                  <p className="text-body font-medium">{t.name}</p>
                  <p className="text-caption text-text-secondary">{t.description}</p>
                  <p className="text-small text-primary mt-1">{t.data.tasks.length} 个预设任务</p>
                </div>
                <div className="flex gap-1 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                  <button className="p-1 rounded hover:bg-surface-hover text-text-secondary" onClick={() => onEditTemplate(t)}>
                    <PencilSimple weight="bold" size={14} />
                  </button>
                  <button className="p-1 rounded hover:bg-surface-hover text-danger" onClick={() => onDeleteTemplate(t.id)}>
                    <Trash weight="bold" size={14} />
                  </button>
                </div>
              </div>
            ))}
            {builtInTemplates.length === 0 && customTemplates.length === 0 && (
              <p className="text-caption text-text-secondary text-center py-8">暂无可用的模板</p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
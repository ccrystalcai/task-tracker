import { useEffect, useState, useMemo } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { useTagStore } from '@/stores/tagStore';
import { useGoalStore } from '@/stores/goalStore';
import Modal from '@/components/ui/Modal';
import TaskForm from '@/components/task/TaskForm';
import TimerTaskItem from '@/components/task/TimerTaskItem';
import DaySummaryModal from '@/components/task/DaySummaryModal';
import PosterModal from '@/components/export/PosterModal';
import TaskDetailModal from '@/components/task/TaskDetailModal';
import EncouragementToast from '@/components/ui/EncouragementToast';
import { getRandomPraise, getStreakMessage, calculateStreak, checkTaskReminders, requestNotificationPermission } from '@/utils/motivation';
import type { Task, Priority } from '@/db/schema';
import { Plus, AlertCircle, Zap, TrendingUp, Target as TargetIcon, CheckCheck, SkipForward, Star, CheckCircle2, ChevronLeft, ChevronRight, Download, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const today = new Date().toISOString().split('T')[0];

const QUADRANT_CONFIG: Record<Priority, { label: string; color: string; bg: string; border: string; icon: string; glow: string }> = {
  'urgent-important': { label: '紧急重要', color: '#EF4444', bg: 'bg-red-50/50', border: 'border-red-200/60', icon: '🔥', glow: 'rgba(239,68,68,0.08)' },
  'urgent-not-important': { label: '紧急不重要', color: '#F59E0B', bg: 'bg-amber-50/50', border: 'border-amber-200/60', icon: '⚡', glow: 'rgba(245,158,11,0.08)' },
  'not-urgent-important': { label: '不紧急重要', color: '#6366F1', bg: 'bg-blue-50/50', border: 'border-blue-200/60', icon: '🎯', glow: 'rgba(99,102,241,0.08)' },
  'not-urgent-not-important': { label: '不紧急不重要', color: '#10B981', bg: 'bg-green-50/50', border: 'border-green-200/60', icon: '📌', glow: 'rgba(16,185,129,0.08)' },
};

export default function Dashboard() {
  const { tasks, fetchTasks, createTask, updateTask, deleteTask, toggleTask } = useTaskStore();
  const { tags, fetchTags } = useTagStore();
  const { goals, fetchGoals } = useGoalStore();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [quickPriority, setQuickPriority] = useState<Priority | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showPoster, setShowPoster] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'praise' | 'encourage' | 'streak' } | null>(null);
  const [streakChecked, setStreakChecked] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchTags();
    fetchGoals();
    requestNotificationPermission();
  }, []);

  // Streak check on load
  useEffect(() => {
    if (!streakChecked && tasks.length > 0) {
      calculateStreak().then((streak) => {
        const msg = getStreakMessage(streak);
        if (msg) setToast({ message: msg, type: 'streak' });
        setStreakChecked(true);
      });
    }
  }, [tasks, streakChecked]);

  const todayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate === today && !(t.sourceTaskId == null && t.recurrenceType !== 'none')),
    [tasks],
  );
  const completed = todayTasks.filter((t) => t.status === 'completed').length;
  const total = todayTasks.length;
  const allDone = total > 0 && completed === total;
  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  // Reminder check every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      checkTaskReminders(todayTasks);
    }, 60000);
    return () => clearInterval(interval);
  }, [todayTasks]);

  // Praise when all tasks done
  useEffect(() => {
    if (allDone && total > 0 && !showSummary) {
      setToast({ message: getRandomPraise(), type: 'praise' });
    }
  }, [allDone, total, showSummary]);

  const timeStats = useMemo(() => {
    const totalEstimated = todayTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
    const totalActual = todayTasks
      .filter((t) => t.status === 'completed')
      .reduce((s, t) => s + (t.actualMinutes || t.estimatedMinutes), 0);
    const remaining = todayTasks
      .filter((t) => t.status !== 'completed')
      .reduce((s, t) => s + t.estimatedMinutes, 0);

    const byQuadrant: Record<Priority, { count: number; completed: number; estimated: number; actual: number }> = {
      'urgent-important': { count: 0, completed: 0, estimated: 0, actual: 0 },
      'urgent-not-important': { count: 0, completed: 0, estimated: 0, actual: 0 },
      'not-urgent-important': { count: 0, completed: 0, estimated: 0, actual: 0 },
      'not-urgent-not-important': { count: 0, completed: 0, estimated: 0, actual: 0 },
    };

    todayTasks.forEach((t) => {
      const q = byQuadrant[t.priority];
      q.count++;
      q.estimated += t.estimatedMinutes;
      if (t.status === 'completed') {
        q.completed++;
        q.actual += t.actualMinutes || t.estimatedMinutes;
      }
    });

    return { totalEstimated, totalActual, remaining, byQuadrant };
  }, [todayTasks]);

  const quadrants = useMemo(() => {
    const q: Record<Priority, Task[]> = {
      'urgent-important': [],
      'urgent-not-important': [],
      'not-urgent-important': [],
      'not-urgent-not-important': [],
    };
    todayTasks.forEach((t) => q[t.priority].push(t));
    // Sort: pending first, completed at bottom
    for (const key of Object.keys(q) as Priority[]) {
      q[key].sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        return 0;
      });
    }
    return q;
  }, [todayTasks]);

  const insight = useMemo(() => {
    if (total === 0) return null;
    const urgentImportant = timeStats.byQuadrant['urgent-important'];
    const notUrgentImportant = timeStats.byQuadrant['not-urgent-important'];
    const urgentNotImportant = timeStats.byQuadrant['urgent-not-important'];

    if (urgentImportant.estimated > notUrgentImportant.estimated * 1.5) {
      return { type: 'warn' as const, text: '紧急重要任务占比过高，建议提前规划，减少救火式工作', icon: AlertCircle };
    }
    if (notUrgentImportant.estimated > urgentImportant.estimated) {
      return { type: 'good' as const, text: '不紧急重要任务占主导，时间管理状态良好', icon: TrendingUp };
    }
    if (urgentNotImportant.estimated > notUrgentImportant.estimated) {
      return { type: 'warn' as const, text: '紧急不重要任务偏多，考虑是否可委托或减少干扰', icon: Zap };
    }
    return { type: 'info' as const, text: '任务分布较均衡，注意保持不紧急重要任务的投入', icon: TargetIcon };
  }, [timeStats, total]);

  const handleToggle = async (id: string) => {
    await toggleTask(id);
    await fetchTasks();
  };

  const handleCreateTask = async (data: Parameters<typeof createTask>[0]) => {
    await createTask(data);
    setShowTaskForm(false);
    setQuickPriority(null);
    await fetchTasks();
  };

  const handleUpdateTask = async (data: Parameters<typeof createTask>[0]) => {
    if (editingTask) {
      await updateTask(editingTask.id, data as Partial<Task>);
      setEditingTask(null);
      await fetchTasks();
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('确定删除这个任务？')) return;
    await deleteTask(id);
    await fetchTasks();
  };

  const formatTime = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;

  return (
    <div className="space-y-6">
      <div className="card hover:shadow-card-hover">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-h3 flex items-center gap-2">
              {format(new Date(), 'M月d日 EEEE', { locale: zhCN })}
            </h3>
            {total > 0 ? (
              <p className="text-caption text-text-secondary mt-1">
                今日 {total} 个任务 · 已完成 {completed} 个 · 预估 {formatTime(timeStats.totalEstimated)}
                {timeStats.totalActual > 0 && <> · 实际耗时 {formatTime(timeStats.totalActual)}</>}
                {allDone && <span className="text-success ml-2 font-medium">全部完成，太棒了！</span>}
              </p>
            ) : (
              <p className="text-caption text-text-secondary mt-1">今天还没有任务，点击右侧按钮快速添加</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="btn-primary" onClick={() => setShowTaskForm(true)}>
              <Plus size={18} className="inline mr-1" />快速添加
            </button>
            {total > 0 && (
              <>
                <button className="btn-secondary flex items-center gap-1.5" onClick={() => setShowSummary(true)}>
                  <CheckCheck size={18} />
                  完成一天
                </button>
                <button className="btn-secondary flex items-center gap-1.5" onClick={() => setShowPoster(true)}>
                  <Download size={16} />
                  海报
                </button>
              </>
            )}
          </div>
        </div>
        {total > 0 && (
          <div className="progress-bar mt-3">
            <div className="progress-bar-fill" style={{
              width: `${Math.round((completed / total) * 100)}%`,
              background: allDone
                ? 'linear-gradient(90deg, #10B981, #34D399)'
                : `linear-gradient(90deg, var(--color-primary), var(--color-primary-light))`,
            }} />
          </div>
        )}
        {insight && (
          <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-btn text-caption ${
            insight.type === 'good' ? 'bg-success/10 text-success' :
            insight.type === 'warn' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'
          }`}>
            <insight.icon size={16} />
            {insight.text}
          </div>
        )}
      </div>

      {/* Empty state guidance */}
      {total === 0 && (
        <div className="card text-center py-10 space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/5">
            <TargetIcon size={40} className="text-primary opacity-40" />
          </div>
          <div>
            <p className="text-h3 text-text-secondary mb-1">今天还没有任务</p>
            <p className="text-caption text-text-secondary">
              任务是按日期安排的，你有两种方式添加今天的任务：
            </p>
          </div>
          <div className="flex items-center justify-center gap-4">
            <button className="btn-primary" onClick={() => setShowTaskForm(true)}>
              <Plus size={18} className="inline mr-1" />快速添加任务
            </button>
            <span className="text-text-secondary text-caption">或</span>
            <Link to="/goals" className="btn-secondary flex items-center gap-1.5">
              去目标页拆解任务 <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}

      {/* Four Quadrants */}
      {total > 0 && (
        <>
      <div>
        <h3 className="text-h3 mb-3">四象限视图</h3>
        <div className="grid grid-cols-2 gap-4">
          {(Object.keys(QUADRANT_CONFIG) as Priority[]).map((key) => {
            const cfg = QUADRANT_CONFIG[key];
            const stats = timeStats.byQuadrant[key];
            const tasksInQ = quadrants[key];
            return (
              <div key={key} className={`card ${cfg.bg} ${cfg.border} border hover:shadow-card-hover`}
                style={{ boxShadow: stats.count > 0 ? `0 0 0 1px ${cfg.glow}` : undefined }}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-h3 flex items-center gap-1.5">
                    <span className="text-lg">{cfg.icon}</span>
                    <span style={{ color: cfg.color }}>{cfg.label}</span>
                    {stats.count > 0 && (
                      <span className="badge" style={{ backgroundColor: cfg.glow, color: cfg.color }}>
                        {stats.completed}/{stats.count}
                      </span>
                    )}
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-small px-2.5 py-1 rounded-full hover:bg-white/60 transition-all flex items-center gap-1 font-medium"
                      style={{ color: cfg.color, backgroundColor: cfg.glow }}
                      onClick={() => { setQuickPriority(key); setShowTaskForm(true); }}
                    >
                      <Plus size={13} />
                      添加
                    </button>
                    <span className="text-small text-text-secondary font-mono">{formatTime(stats.estimated)}</span>
                  </div>
                </div>
                {stats.count > 0 && (
                  <div className="w-full h-1.5 bg-white/50 rounded-full overflow-hidden mb-3">
                    <div className="h-full rounded-full transition-all duration-500 ease-out" style={{
                      width: `${stats.count > 0 ? Math.round((stats.completed / stats.count) * 100) : 0}%`,
                      background: `linear-gradient(90deg, ${cfg.color}cc, ${cfg.color})`,
                    }} />
                  </div>
                )}
                {tasksInQ.length === 0 ? (
                  <p className="text-caption text-text-secondary py-2 text-center">暂无任务 · 点击添加创建</p>
                ) : (
                  <div className="space-y-0.5 max-h-[250px] overflow-y-auto">
                    {tasksInQ.map((t) => (
                      <TimerTaskItem
                        key={t.id}
                        task={t}
                        tags={tags}
                        onToggle={() => handleToggle(t.id)}
                        onEdit={() => setEditingTask(t)}
                        onDelete={() => handleDeleteTask(t.id)}
                        onDetail={() => setDetailTask(t)}
                        showGoal={t.goalId ? { name: goalMap.get(t.goalId)?.name ?? '', color: goalMap.get(t.goalId)?.color ?? '#6366F1' } : null}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </>)}

      {/* Time Allocation */}
      {total > 0 && (
        <div className="card">
          <h3 className="section-title mb-4">今日时间分配</h3>
          <div className="space-y-3">
            {(Object.keys(QUADRANT_CONFIG) as Priority[]).map((key) => {
              const cfg = QUADRANT_CONFIG[key];
              const stats = timeStats.byQuadrant[key];
              const pct = timeStats.totalEstimated > 0
                ? Math.round((stats.estimated / timeStats.totalEstimated) * 100)
                : 0;
              if (stats.count === 0) return null;
              return (
                <div key={key} className="flex items-center gap-2">
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-sm">{cfg.icon}</span>
                    <span className="text-small font-medium whitespace-nowrap" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <div className="flex-1 h-2.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        background: `linear-gradient(90deg, ${cfg.color}cc, ${cfg.color})`,
                      }} />
                  </div>
                  <span className="text-small text-text-secondary font-mono flex-shrink-0 w-14 text-right">
                    {formatTime(stats.estimated)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-caption text-text-secondary">
            <span>总计预估 {formatTime(timeStats.totalEstimated)} · 已完成 {formatTime(timeStats.totalActual)}</span>
            {timeStats.remaining > 0 && (
              <span className="text-warning font-medium">剩余 {formatTime(timeStats.remaining)}</span>
            )}
          </div>
        </div>
      )}

      {/* Today Timeline + Clock Donut */}
      {total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 card">
            <h3 className="text-h3 mb-4">今日时间轴</h3>
            <div className="space-y-0">
            {todayTasks
              .slice()
              .sort((a, b) => {
                const getTime = (t: Task) => {
                  if (t.status === 'completed' && t.completedAt) {
                    const d = new Date(t.completedAt);
                    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                  }
                  return t.dueTime || '23:59';
                };
                return getTime(a).localeCompare(getTime(b));
              })
              .map((t, i, arr) => {
                const isLast = i === arr.length - 1;
                const isCompleted = t.status === 'completed';
                const isSkipped = t.status === 'skipped';
                return (
                  <div key={t.id} className="flex gap-3">
                    {/* Timeline track */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-3 h-3 rounded-full border-2 mt-1 ${
                        isCompleted ? 'bg-success border-success' :
                        isSkipped ? 'bg-warning border-warning' :
                        'bg-surface border-primary'
                      }`} />
                      {!isLast && <div className="w-0.5 flex-1 min-h-[20px] bg-border" />}
                    </div>
                    {/* Task card */}
                    <div className={`flex-1 pb-3 ${isCompleted ? 'opacity-60' : ''}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-small text-text-secondary font-mono w-12">
                          {isCompleted && t.completedAt
                            ? `${String(new Date(t.completedAt).getHours()).padStart(2, '0')}:${String(new Date(t.completedAt).getMinutes()).padStart(2, '0')}`
                            : t.dueTime || '全天'}
                        </span>
                        <span className={`text-body ${isCompleted ? 'line-through text-text-secondary' : ''}`}>
                          {t.title}
                        </span>
                        {isCompleted && <CheckCircle2 size={14} className="text-success flex-shrink-0" />}
                        {isSkipped && <SkipForward size={14} className="text-warning flex-shrink-0" />}
                      </div>
                      <div className="ml-[60px] flex items-center gap-2 text-small text-text-secondary">
                        <span>{formatTime(t.estimatedMinutes)}</span>
                        {t.score != null && (
                          <span className="text-warning flex items-center gap-0.5">
                            <Star size={11} fill="#F59E0B" color="#F59E0B" />{t.score}
                          </span>
                        )}
                        {t.notes && <span className="truncate max-w-[200px]">📝 {t.notes.substring(0, 30)}</span>}
                        {(t.images?.length ?? 0) > 0 && <span>📷 {t.images!.length}</span>}
                        {t.priority === 'urgent-important' && <span className="text-danger">🔥</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Clock Donut */}
          <div className="card flex items-center justify-center">
            <ClockDonut tasks={todayTasks} />
          </div>
        </div>
      )}

      {/* Estimated vs Actual Timeline */}
      {total > 0 && (
        <div className="card">
          <h3 className="text-h3 mb-4">预估 vs 实际</h3>
          <p className="text-caption text-text-secondary mb-3">24小时视图：浅色=预估时间段，深色=实际完成时间点</p>
          <div className="relative">
            {/* Hour markers */}
            <div className="flex justify-between text-small text-text-secondary mb-1 px-0">
              {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].map((h) => (
                <span key={h} className="text-[10px]">{h}:00</span>
              ))}
            </div>
            <div className="space-y-2">
              {todayTasks
                .filter((t) => t.dueTime)
                .sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || ''))
                .map((t) => {
                  const [eh, em] = (t.dueTime || '0:00').split(':').map(Number);
                  const estStartPct = ((eh * 60 + em) / (24 * 60)) * 100;
                  const estDurationPct = (t.estimatedMinutes / (24 * 60)) * 100;
                  const isCompleted = t.status === 'completed';

                  let actualPct = 0;
                  if (isCompleted && t.completedAt) {
                    const d = new Date(t.completedAt);
                    actualPct = ((d.getHours() * 60 + d.getMinutes()) / (24 * 60)) * 100;
                  }

                  const isOver = isCompleted && actualPct > (estStartPct + estDurationPct);

                  return (
                    <div key={t.id} className="relative h-6 flex items-center">
                      <span className="w-28 text-small truncate flex-shrink-0 pr-2 text-right">
                        {t.title}
                      </span>
                      <div className="flex-1 relative h-full">
                        {/* Estimate bar */}
                        <div
                          className="absolute h-3 rounded-full top-1/2 -translate-y-1/2 opacity-30"
                          style={{
                            left: `${estStartPct}%`,
                            width: `${Math.max(estDurationPct, 1)}%`,
                            backgroundColor: '#6366F1',
                          }}
                        />
                        {/* Actual marker */}
                        {isCompleted && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-2 h-5 rounded-full border border-white"
                            style={{
                              left: `${actualPct}%`,
                              backgroundColor: isOver ? '#EF4444' : '#10B981',
                            }}
                            title={`完成于 ${new Date(t.completedAt!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              {todayTasks.filter((t) => !t.dueTime).length > 0 && (
                <p className="text-caption text-text-secondary mt-2">
                  + {todayTasks.filter((t) => !t.dueTime).length} 个全天任务未显示在时间条上
                </p>
              )}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border text-small text-text-secondary">
              <span className="flex items-center gap-1">
                <span className="w-4 h-2 rounded-full bg-primary opacity-30 inline-block" /> 预估
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success inline-block" /> 按时完成
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> 超时完成
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Today Image Carousel */}
      {(() => {
        const todayImages: { url: string; title: string }[] = [];
        todayTasks.forEach((t) => {
          (t.images || []).forEach((url) => {
            todayImages.push({ url, title: t.title });
          });
        });
        if (todayImages.length === 0) return null;
        return <ImageCarousel images={todayImages} />;
      })()}

      <Modal open={showTaskForm} onClose={() => { setShowTaskForm(false); setQuickPriority(null); }} title="快速添加任务">
        <TaskForm
          tags={tags}
          priority={quickPriority ?? undefined}
          onSubmit={handleCreateTask}
          onCancel={() => { setShowTaskForm(false); setQuickPriority(null); }}
        />
      </Modal>

      <Modal open={!!editingTask} onClose={() => setEditingTask(null)} title="编辑任务">
        {editingTask && (
          <TaskForm
            initial={editingTask}
            tags={tags}
            goalId={editingTask.goalId}
            onSubmit={handleUpdateTask}
            onCancel={() => setEditingTask(null)}
          />
        )}
      </Modal>

      <DaySummaryModal open={showSummary} onClose={() => setShowSummary(false)} />

      <PosterModal open={showPoster} onClose={() => setShowPoster(false)} date={today} />

      {detailTask && (
        <TaskDetailModal
          open={!!detailTask}
          onClose={() => setDetailTask(null)}
          task={detailTask}
          goal={detailTask.goalId ? goalMap.get(detailTask.goalId) ?? null : null}
          onUpdate={fetchTasks}
        />
      )}

      {toast && (
        <EncouragementToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

function ImageCarousel({ images }: { images: { url: string; title: string }[] }) {
  const [current, setCurrent] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const prev = () => setCurrent((c) => (c === 0 ? images.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === images.length - 1 ? 0 : c + 1));

  return (
    <>
      <div className="card">
        <h3 className="text-h3 mb-3">今日截图 ({images.length})</h3>
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {images.map((img, i) => (
              <div
                key={i}
                className={`flex-shrink-0 cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  i === current ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
                onClick={() => setCurrent(i)}
              >
                <img
                  src={img.url}
                  alt={img.title}
                  className="w-24 h-24 object-cover"
                  onClick={(e) => { e.stopPropagation(); setPreviewUrl(img.url); }}
                />
              </div>
            ))}
          </div>
          <button
            onClick={prev}
            className="absolute left-0 top-1/2 -translate-y-1/2 p-1 bg-black/40 text-white rounded-full hover:bg-black/60"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={next}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-1 bg-black/40 text-white rounded-full hover:bg-black/60"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center cursor-pointer"
          onClick={() => setPreviewUrl(null)}
        >
          <img src={previewUrl} alt="预览" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </>
  );
}

function ClockDonut({ tasks }: { tasks: Task[] }) {
  const completedTasks = tasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => {
      const getMinutes = (t: Task) => {
        if (t.completedAt) {
          const d = new Date(t.completedAt);
          return d.getHours() * 60 + d.getMinutes();
        }
        if (t.dueTime) {
          const [h, m] = t.dueTime.split(':').map(Number);
          return h * 60 + m;
        }
        return 0;
      };
      return getMinutes(a) - getMinutes(b);
    });

  const MINUTE_SCALE = (24 * 60) / 360; // minutes per degree
  const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#14B8A6'];

  if (completedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        <svg viewBox="0 0 140 140" className="w-44 h-44">
          <circle cx="70" cy="70" r="62" fill="none" stroke="currentColor" strokeWidth="1" className="text-border" />
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 15 - 90) * (Math.PI / 180);
            const isHour = i % 2 === 0;
            const inner = isHour ? 56 : 59;
            return (
              <line key={i} x1={70 + inner * Math.cos(angle)} y1={70 + inner * Math.sin(angle)}
                x2={70 + 62 * Math.cos(angle)} y2={70 + 62 * Math.sin(angle)}
                stroke="currentColor" strokeWidth={isHour ? 2 : 0.5} className="text-border" />
            );
          })}
          <circle cx="70" cy="70" r="44" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" opacity={0.3} />
          <text x="70" y="64" textAnchor="middle" className="fill-text-secondary" style={{ fontSize: '11px' }}>暂无</text>
          <text x="70" y="78" textAnchor="middle" className="fill-text-secondary" style={{ fontSize: '11px' }}>完成</text>
        </svg>
        <p className="text-small text-text-secondary">完成任务后显示时间分布</p>
      </div>
    );
  }

  // Map each completed task to a slice positioned at its completion time on the 24h clock
  const slices = completedTasks.map((t, i) => {
    let hourAngle = 0;
    if (t.completedAt) {
      const d = new Date(t.completedAt);
      const minutes = d.getHours() * 60 + d.getMinutes();
      hourAngle = (minutes / (24 * 60)) * 360 - 90; // -90 so 0:00 is at top
    } else if (t.dueTime) {
      const [h, m] = t.dueTime.split(':').map(Number);
      hourAngle = ((h * 60 + m) / (24 * 60)) * 360 - 90;
    }

    const duration = t.actualMinutes || t.estimatedMinutes;
    const arcAngle = Math.max(duration / MINUTE_SCALE, 4); // minimum 4 degrees

    return {
      ...t,
      color: COLORS[i % COLORS.length],
      startAngle: hourAngle,
      endAngle: hourAngle + arcAngle,
      arcAngle,
      duration,
    };
  });

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <svg viewBox="0 0 140 140" className="w-44 h-44">
        {/* 24-hour clock ticks */}
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * 15 - 90) * (Math.PI / 180);
          const hour = i;
          const isHour = i % 2 === 0;
          const inner = isHour ? 54 : 57;
          const labelR = 48;
          return (
            <g key={i}>
              <line x1={70 + inner * Math.cos(angle)} y1={70 + inner * Math.sin(angle)}
                x2={70 + 62 * Math.cos(angle)} y2={70 + 62 * Math.sin(angle)}
                stroke="currentColor" strokeWidth={isHour ? 1.5 : 0.5} className="text-border" />
              {isHour && (
                <text x={70 + labelR * Math.cos(angle)} y={70 + labelR * Math.sin(angle)}
                  textAnchor="middle" dominantBaseline="central"
                  className="fill-text-secondary" style={{ fontSize: '7px' }}>
                  {hour}
                </text>
              )}
            </g>
          );
        })}

        {/* Slices positioned at actual completion times */}
        {slices.map((s) => {
          const r = 36;
          const startRad = (s.startAngle * Math.PI) / 180;
          const endRad = (s.endAngle * Math.PI) / 180;
          const x1 = 70 + r * Math.cos(startRad);
          const y1 = 70 + r * Math.sin(startRad);
          const x2 = 70 + r * Math.cos(endRad);
          const y2 = 70 + r * Math.sin(endRad);
          const largeArc = s.arcAngle > 180 ? 1 : 0;

          return (
            <g key={s.id}>
              <path
                d={`M 70 70 L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                fill={s.color}
                opacity={0.75}
                stroke="white"
                strokeWidth="0.5"
              />
              <title>
                {s.title} · {s.duration}分钟
                {s.completedAt ? ` · 完成于 ${new Date(s.completedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </title>
            </g>
          );
        })}

        {/* Center */}
        <circle cx="70" cy="70" r="18" fill="white" stroke="currentColor" strokeWidth="1" className="text-border" />
        <text x="70" y="66" textAnchor="middle" style={{ fontSize: '12px', fontWeight: 700, fill: '#6366F1' }}>
          {completedTasks.length}项
        </text>
        <text x="70" y="79" textAnchor="middle" className="fill-text-secondary" style={{ fontSize: '9px' }}>已完成</text>
      </svg>

      {/* Legend */}
      <div className="space-y-0.5 w-full max-h-[140px] overflow-y-auto">
        {slices.map((s) => {
          const timeLabel = s.completedAt
            ? new Date(s.completedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            : s.dueTime || '—';
          return (
            <div key={s.id} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[11px] text-text-secondary truncate flex-1">{s.title}</span>
              <span className="text-[11px] text-text-secondary font-mono">{timeLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

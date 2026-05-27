import { useEffect, useMemo, useState } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { useTagStore } from '@/stores/tagStore';
import { useGoalStore } from '@/stores/goalStore';
import { useUIStore } from '@/stores/uiStore';
import type { Tag, Priority, Task } from '@/db/schema';
import TaskDetailModal from '@/components/task/TaskDetailModal';
import { BarChart3, Filter, X, Clock, CheckCircle2, Circle, Target, TrendingUp, AlertCircle, Info } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, subDays } from 'date-fns';

const QUADRANT_LABELS: Record<Priority, { label: string; color: string; icon: string }> = {
  'urgent-important': { label: '紧急重要', color: '#EF4444', icon: '🔥' },
  'urgent-not-important': { label: '紧急不重要', color: '#F59E0B', icon: '⚡' },
  'not-urgent-important': { label: '不紧急重要', color: '#6366F1', icon: '🎯' },
  'not-urgent-not-important': { label: '不紧急不重要', color: '#10B981', icon: '📌' },
};

export default function Analytics() {
  const { tasks, fetchTasks } = useTaskStore();
  const { tags, fetchTags } = useTagStore();
  const { goals, fetchGoals } = useGoalStore();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<'today' | 'this-week' | 'this-month' | 'last-7-days' | 'last-30-days' | 'all'>('all');
  const [filterTab, setFilterTab] = useState<'date' | 'tag' | 'goal'>('date');
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
    fetchTags();
    fetchGoals();
  }, []);

  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };
  const clearTagFilter = () => setSelectedTagIds([]);

  const toggleGoalFilter = (goalId: string) => {
    setSelectedGoalIds((prev) =>
      prev.includes(goalId) ? prev.filter((id) => id !== goalId) : [...prev, goalId],
    );
  };
  const clearGoalFilter = () => setSelectedGoalIds([]);

  // Date range helper
  const dateRange = useMemo(() => {
    const today = new Date();
    const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
    switch (datePreset) {
      case 'today': return { start: fmt(today), end: fmt(today) };
      case 'this-week': return { start: fmt(startOfWeek(today, { weekStartsOn: 1 })), end: fmt(endOfWeek(today, { weekStartsOn: 1 })) };
      case 'this-month': return { start: fmt(startOfMonth(today)), end: fmt(endOfMonth(today)) };
      case 'last-7-days': return { start: fmt(subDays(today, 7)), end: fmt(today) };
      case 'last-30-days': return { start: fmt(subDays(today, 30)), end: fmt(today) };
      case 'all': return null;
    }
  }, [datePreset]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (dateRange) {
      result = result.filter((t) => t.dueDate >= dateRange.start && t.dueDate <= dateRange.end);
    }
    if (selectedTagIds.length > 0) {
      result = result.filter((t) => t.tags.some((tid) => selectedTagIds.includes(tid)));
    }
    if (selectedGoalIds.length > 0) {
      result = result.filter((t) => t.goalId && selectedGoalIds.includes(t.goalId));
    }
    return result;
  }, [tasks, selectedTagIds, selectedGoalIds, dateRange]);

  // Overall stats
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter((t) => t.status === 'completed').length;
    const pending = filteredTasks.filter((t) => t.status === 'pending').length;
    const totalEst = filteredTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
    const totalAct = filteredTasks
      .filter((t) => t.status === 'completed')
      .reduce((s, t) => s + (t.actualMinutes || t.estimatedMinutes), 0);

    // By quadrant
    const byQuadrant: Record<Priority, { count: number; completed: number; estimated: number; actual: number }> = {
      'urgent-important': { count: 0, completed: 0, estimated: 0, actual: 0 },
      'urgent-not-important': { count: 0, completed: 0, estimated: 0, actual: 0 },
      'not-urgent-important': { count: 0, completed: 0, estimated: 0, actual: 0 },
      'not-urgent-not-important': { count: 0, completed: 0, estimated: 0, actual: 0 },
    };
    filteredTasks.forEach((t) => {
      const q = byQuadrant[t.priority];
      q.count++;
      q.estimated += t.estimatedMinutes;
      if (t.status === 'completed') {
        q.completed++;
        q.actual += t.actualMinutes || t.estimatedMinutes;
      }
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const efficiency = totalEst > 0 ? Math.round((totalAct / totalEst) * 100) : 0;
    const importantTime = byQuadrant['urgent-important'].estimated + byQuadrant['not-urgent-important'].estimated;
    const effectiveRate = totalEst > 0 ? Math.round((importantTime / totalEst) * 100) : 0;

    return { total, completed, pending, totalEst, totalAct, byQuadrant, completionRate, efficiency, effectiveRate, importantTime };
  }, [filteredTasks]);

  // Monthly heatmap data
  const heatmapData = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    return days.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayTasks = filteredTasks.filter((t) => t.dueDate === dateStr);
      const done = dayTasks.filter((t) => t.status === 'completed').length;
      const total = dayTasks.length;
      return { date: dateStr, day: format(day, 'd'), done, total, rate: total > 0 ? done / total : -1 };
    });
  }, [filteredTasks]);

  // Time distribution by tag
  const tagTimeDistribution = useMemo(() => {
    const dist: Record<string, { tag: Tag; estimated: number; actual: number; count: number }> = {};
    tags.forEach((tag) => {
      dist[tag.id] = { tag, estimated: 0, actual: 0, count: 0 };
    });
    filteredTasks.forEach((t) => {
      t.tags.forEach((tid) => {
        if (dist[tid]) {
          dist[tid].estimated += t.estimatedMinutes;
          dist[tid].count++;
          if (t.status === 'completed') {
            dist[tid].actual += t.actualMinutes || t.estimatedMinutes;
          }
        }
      });
    });
    return Object.values(dist).filter((d) => d.count > 0).sort((a, b) => b.estimated - a.estimated);
  }, [filteredTasks, tags]);

  // Time distribution by goal
  const goalTimeDistribution = useMemo(() => {
    if (goals.length === 0) return [];
    const dist: Record<string, { goalId: string; name: string; color: string; estimated: number; actual: number; count: number; completed: number }> = {};
    goals.forEach((g) => {
      dist[g.id] = { goalId: g.id, name: g.name, color: g.color, estimated: 0, actual: 0, count: 0, completed: 0 };
    });
    filteredTasks.forEach((t) => {
      if (t.goalId && dist[t.goalId]) {
        dist[t.goalId].estimated += t.estimatedMinutes;
        dist[t.goalId].count++;
        if (t.status === 'completed') {
          dist[t.goalId].completed++;
          dist[t.goalId].actual += t.actualMinutes || t.estimatedMinutes;
        }
      }
    });
    return Object.values(dist).filter((d) => d.count > 0).sort((a, b) => b.estimated - a.estimated);
  }, [filteredTasks, goals]);

  const formatTime = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;

  const heatOpacity = (rate: number): number => {
    if (rate < 0) return 0.06;  // no data — barely visible
    if (rate === 0) return 0.12; // 0% — very light
    if (rate < 0.33) return 0.28;
    if (rate < 0.66) return 0.5;
    if (rate < 1) return 0.75;
    return 1; // 100% — full primary
  };

  const primaryColor = useUIStore((s) => s.primaryColor) || '#6366F1';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <h3 className="text-h3 flex items-center gap-2">
          <BarChart3 size={22} className="text-primary" />
          分析统计
        </h3>
        <p className="text-caption text-text-secondary mt-1">了解你的时间投入和执行效率</p>
      </div>

      {/* Filter Tabs */}
      <div className="card">
        <div className="flex items-center gap-1 mb-3 border-b border-border pb-0">
          {([
            { key: 'date', label: '时间范围', icon: Clock },
            { key: 'tag', label: '标签', icon: Filter },
            { key: 'goal', label: '目标', icon: Target },
          ] as const).map(({ key, label, icon: Icon }) => {
            const activeCount =
              key === 'date' ? (datePreset !== 'all' ? 1 : 0) :
              key === 'tag' ? selectedTagIds.length :
              selectedGoalIds.length;
            return (
              <button key={key} onClick={() => setFilterTab(key)}
                className={`px-4 py-2 text-small rounded-t-btn transition-all flex items-center gap-1.5 -mb-px ${
                  filterTab === key
                    ? 'border-b-2 border-primary text-primary font-medium'
                    : 'text-text-secondary hover:text-text-primary'
                }`}>
                <Icon size={14} />
                {label}
                {activeCount > 0 && (
                  <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none">
                    {activeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {filterTab === 'date' && (
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {(['today', 'this-week', 'this-month', 'last-7-days', 'last-30-days', 'all'] as const).map((preset) => (
                <button key={preset} onClick={() => setDatePreset(preset)}
                  className={`px-3 py-1 rounded-full text-small transition-all ${
                    datePreset === preset
                      ? 'bg-primary text-white'
                      : 'bg-surface-hover text-text-secondary hover:bg-border'
                  }`}>
                  {preset === 'today' ? '今日' :
                   preset === 'this-week' ? '本周' :
                   preset === 'this-month' ? '本月' :
                   preset === 'last-7-days' ? '近7天' :
                   preset === 'last-30-days' ? '近30天' : '全部'}
                </button>
              ))}
            </div>
            {dateRange && (
              <p className="text-small text-primary mt-2">{dateRange.start} ~ {dateRange.end}</p>
            )}
          </div>
        )}

        {filterTab === 'tag' && (
          <div>
            {selectedTagIds.length > 0 && (
              <button className="text-small text-primary hover:underline mb-2" onClick={clearTagFilter}>
                <X size={13} className="inline mr-0.5" />清除 ({selectedTagIds.length})
              </button>
            )}
            {tags.length === 0 ? (
              <p className="text-caption text-text-secondary">暂无标签，去「设置」创建标签</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button key={tag.id} onClick={() => toggleTagFilter(tag.id)}
                    className={`px-3 py-1.5 rounded-full text-small transition-all ${
                      selectedTagIds.includes(tag.id)
                        ? 'text-white shadow-sm'
                        : 'bg-surface-hover text-text-secondary hover:bg-border'
                    }`}
                    style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color } : undefined}>
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {filterTab === 'goal' && (
          <div>
            {selectedGoalIds.length > 0 && (
              <button className="text-small text-primary hover:underline mb-2" onClick={clearGoalFilter}>
                <X size={13} className="inline mr-0.5" />清除 ({selectedGoalIds.length})
              </button>
            )}
            {goals.length === 0 ? (
              <p className="text-caption text-text-secondary">暂无目标</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {goals.map((g) => (
                  <button key={g.id} onClick={() => toggleGoalFilter(g.id)}
                    className={`px-3 py-1.5 rounded-full text-small transition-all ${
                      selectedGoalIds.includes(g.id)
                        ? 'text-white shadow-sm'
                        : 'bg-surface-hover text-text-secondary hover:bg-border'
                    }`}
                    style={selectedGoalIds.includes(g.id) ? { backgroundColor: g.color } : undefined}>
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {(selectedTagIds.length > 0 || selectedGoalIds.length > 0 || datePreset !== 'all') && (
          <p className="text-small text-primary mt-2 pt-2 border-t border-border">
            已筛选 {filteredTasks.length} 个任务
          </p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="总任务" value={stats.total} sub={`${stats.completed} 已完成`} color="#6366F1" />
        <StatCard label="完成率" value={`${stats.completionRate}%`} sub={`${stats.pending} 待完成`} color="#10B981" />
        <StatCard label="预估耗时" value={formatTime(stats.totalEst)} sub={`实际 ${formatTime(stats.totalAct)}`} color="#F59E0B" />
        <StatCard label="效率指数" value={`${stats.efficiency}%`}
          sub={stats.efficiency <= 100 ? '按计划或更快' : '超出预估'} color={stats.efficiency <= 100 ? '#10B981' : '#EF4444'} />
        <StatCard label="时间价值率" value={`${stats.effectiveRate}%`}
          sub={stats.effectiveRate >= 60 ? '时间投入健康' : '重要任务占比偏低'} color={stats.effectiveRate >= 60 ? '#10B981' : '#F59E0B'} />
      </div>

      {/* Quadrant time breakdown */}
      <div className="grid grid-cols-2 gap-4">
        {/* Quadrant bar chart */}
        <div className="card">
          <h3 className="text-h3 mb-4">四象限时间分布</h3>
          <div className="space-y-4">
            {(Object.keys(QUADRANT_LABELS) as Priority[]).map((key) => {
              const cfg = QUADRANT_LABELS[key];
              const data = stats.byQuadrant[key];
              const pct = stats.totalEst > 0 ? Math.round((data.estimated / stats.totalEst) * 100) : 0;
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-caption">
                    <span className="flex items-center gap-1">
                      <span>{cfg.icon}</span>
                      <span style={{ color: cfg.color }}>{cfg.label}</span>
                    </span>
                    <span className="text-text-secondary whitespace-nowrap">
                      {data.count}个 · 预{formatTime(data.estimated)}
                      {data.actual > 0 && <> · 实{formatTime(data.actual)}</>}
                    </span>
                  </div>
                  <div className="w-full h-5 bg-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full flex items-center justify-end px-2 transition-all duration-500"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        background: `linear-gradient(90deg, ${cfg.color}cc, ${cfg.color})`,
                      }}>
                      {pct >= 12 && <span className="text-[11px] text-white font-semibold">{pct}%</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Insight panel */}
        <div className="card">
          <h3 className="text-h3 mb-3">效率分析</h3>
          <div className="space-y-3">
            <InsightRow icon={Target} color="#6366F1"
              label="不紧急重要任务占比"
              value={`${stats.totalEst > 0 ? Math.round((stats.byQuadrant['not-urgent-important'].estimated / stats.totalEst) * 100) : 0}%`}
              tip="这个象限投入越多，长期越轻松" />
            <InsightRow icon={AlertCircle} color="#EF4444"
              label="紧急重要任务占比"
              value={`${stats.totalEst > 0 ? Math.round((stats.byQuadrant['urgent-important'].estimated / stats.totalEst) * 100) : 0}%`}
              tip="过高说明处于救火模式，需提前规划" />
            <InsightRow icon={TrendingUp} color="#10B981"
              label="完成率"
              value={`${stats.completionRate}%`}
              tip={stats.completionRate >= 80 ? '执行力不错' : stats.completionRate >= 50 ? '继续加油' : '建议减少每日任务量'} />
            <InsightRow icon={Clock} color="#F59E0B"
              label="效率指数"
              value={`${stats.efficiency}%`}
              tip={stats.efficiency <= 100 ? '实际用时在预估范围内' : '实际用时超出预估，检查是否低估了难度'} />
          </div>
        </div>
      </div>

      {/* Monthly Heatmap */}
      <div className="card">
        <h3 className="text-h3 mb-3">本月打卡热力图</h3>
        <div className="flex flex-wrap gap-1">
          {heatmapData.map((d) => (
            <div key={d.date} className="group relative">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: primaryColor, opacity: heatOpacity(d.rate) }} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-text-primary text-white text-small px-2 py-1 rounded whitespace-nowrap z-10">
                {d.date} · {d.total > 0 ? `${d.done}/${d.total} 完成` : '无任务'}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-small text-text-secondary">
          <span>少</span>
          {[0.06, 0.12, 0.28, 0.5, 0.75, 1].map((op) => (
            <div key={op} className="w-3 h-3 rounded-sm" style={{ backgroundColor: primaryColor, opacity: op }} />
          ))}
          <span>多</span>
        </div>
      </div>

      {/* Time by Tag */}
      {tagTimeDistribution.length > 0 && (
        <div className="card">
          <h3 className="text-h3 mb-3">标签维度时间分布</h3>
          <div className="space-y-2">
            {tagTimeDistribution.map((d) => {
              const maxTime = tagTimeDistribution[0]?.estimated ?? 1;
              const estPct = Math.round((d.estimated / maxTime) * 100);
              const actPct = d.estimated > 0 ? Math.round((d.actual / d.estimated) * 100) : 0;
              return (
                <div key={d.tag.id} className="flex items-center gap-3 py-1.5">
                  <div className="flex items-center gap-2 flex-shrink-0" style={{ width: '120px' }}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.tag.color }} />
                    <span className="text-small font-medium truncate">{d.tag.name}</span>
                    <span className="text-small text-text-secondary flex-shrink-0">{d.count}个</span>
                  </div>
                  <div className="flex-1 h-2.5 bg-border rounded-full overflow-hidden relative">
                    <div className="absolute inset-0 h-full rounded-full opacity-20" style={{ width: `${estPct}%`, backgroundColor: d.tag.color }} />
                    <div className="absolute inset-0 h-full rounded-full" style={{ width: `${Math.max(actPct, 2)}%`, backgroundColor: d.tag.color }} />
                  </div>
                  <span className="text-small text-text-secondary text-right flex-shrink-0 font-mono whitespace-nowrap" style={{ width: '88px' }}>
                    预{formatTime(d.estimated)}{d.actual > 0 ? ` · 实${formatTime(d.actual)}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-small text-text-secondary">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-full opacity-20 inline-block" style={{ backgroundColor: '#6366F1' }} /> 预估占比</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-full inline-block" style={{ backgroundColor: '#6366F1' }} /> 实际比例</span>
          </div>
        </div>
      )}

      {/* Time by Goal */}
      {goalTimeDistribution.length > 0 && (
        <div className="card">
          <h3 className="text-h3 mb-3">目标维度时间分布</h3>
          <div className="space-y-2">
            {goalTimeDistribution.map((d) => {
              const maxTime = goalTimeDistribution[0]?.estimated ?? 1;
              const estPct = Math.round((d.estimated / maxTime) * 100);
              const actPct = d.estimated > 0 ? Math.round((d.actual / d.estimated) * 100) : 0;
              return (
                <div key={d.goalId} className="flex items-center gap-3 py-1.5">
                  <div className="flex items-center gap-2 flex-shrink-0" style={{ width: '140px' }}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-small font-medium truncate">{d.name}</span>
                    <span className="text-small text-text-secondary flex-shrink-0">{d.completed}/{d.count}</span>
                  </div>
                  <div className="flex-1 h-2.5 bg-border rounded-full overflow-hidden relative">
                    <div className="absolute inset-0 h-full rounded-full opacity-20" style={{ width: `${estPct}%`, backgroundColor: d.color }} />
                    <div className="absolute inset-0 h-full rounded-full" style={{ width: `${Math.max(actPct, 2)}%`, backgroundColor: d.color }} />
                  </div>
                  <span className="text-small text-text-secondary text-right flex-shrink-0 font-mono whitespace-nowrap" style={{ width: '88px' }}>
                    预{formatTime(d.estimated)}{d.actual > 0 ? ` · 实${formatTime(d.actual)}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Task List by Tag Filter */}
      {selectedTagIds.length > 0 && (
        <div className="card">
          <h3 className="text-h3 mb-3">筛选结果</h3>
          {filteredTasks.length === 0 ? (
            <p className="text-caption text-text-secondary text-center py-4">没有匹配的任务</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filteredTasks.map((task) => {
                const goal = task.goalId ? goalMap.get(task.goalId) : null;
                const taskTags = tags.filter((t) => task.tags.includes(t.id));
                return (
                  <div key={task.id} className="flex items-center gap-3 px-3 py-2 rounded-btn hover:bg-surface-hover">
                    {task.status === 'completed'
                      ? <CheckCircle2 size={16} className="text-success flex-shrink-0" />
                      : <Circle size={16} className="text-text-secondary flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-body truncate ${task.status === 'completed' ? 'line-through text-text-secondary' : ''}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-small text-text-secondary">{task.dueDate}</span>
                        <span className="text-small text-text-secondary">· {formatTime(task.estimatedMinutes)}</span>
                        {goal && <span className="text-small text-primary">· {goal.name}</span>}
                        {taskTags.map((t) => (
                          <span key={t.id} className="text-small px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: t.color }}>{t.name}</span>
                        ))}
                      </div>
                    </div>
                    <button className="p-1 rounded hover:bg-surface-hover text-text-secondary flex-shrink-0"
                      onClick={() => setDetailTask(task)} title="查看详情"><Info size={14} /></button>
                    <span className="text-small px-2 py-0.5 rounded-full" style={{
                      color: QUADRANT_LABELS[task.priority].color,
                      backgroundColor: `${QUADRANT_LABELS[task.priority].color}15`,
                    }}>
                      {QUADRANT_LABELS[task.priority].label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {detailTask && (
        <TaskDetailModal
          open={!!detailTask}
          onClose={() => setDetailTask(null)}
          task={detailTask}
          goal={detailTask.goalId ? goalMap.get(detailTask.goalId) ?? null : null}
          onUpdate={fetchTasks}
        />
      )}
    </div>
  );
}

// Sub-components
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="card text-center hover:shadow-card-hover transition-all hover:-translate-y-0.5">
      <p className="text-small text-text-secondary font-medium uppercase tracking-wider">{label}</p>
      <p className="text-h1 mt-1.5 font-bold" style={{ color }}>{value}</p>
      <p className="text-small text-text-secondary mt-1">{sub}</p>
    </div>
  );
}

function InsightRow({ icon: Icon, color, label, value, tip }: {
  icon: React.ElementType; color: string; label: string; value: string; tip: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-btn bg-surface-hover">
      <div className="p-1.5 rounded" style={{ backgroundColor: `${color}15` }}>
        <Icon size={16} color={color} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-body">{label}</span>
          <span className="text-h3 font-bold" style={{ color }}>{value}</span>
        </div>
        <p className="text-small text-text-secondary mt-0.5">{tip}</p>
      </div>
    </div>
  );
}

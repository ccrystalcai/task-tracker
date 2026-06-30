import { useEffect, useMemo, useState } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { useTagStore } from '@/stores/tagStore';
import { useGoalStore } from '@/stores/goalStore';
import { useJournalStore } from '@/stores/journalStore';
import { useUIStore } from '@/stores/uiStore';
import { PRIORITY_LABEL, PRIORITY_COLOR, PRIORITY_BAR_COLOR, PRIORITY_ICON } from '@/constants/priorities';
import type { Tag, Priority, Task, Mood } from '@/db/schema';
import { MOOD_ICON, MOOD_LABEL } from '@/constants/moods';
import TaskDetailModal from '@/components/task/TaskDetailModal';
import ClockDonut from '@/components/ui/ClockDonut';
import FilterBar from '@/components/ui/FilterBar';
import type { DateRange } from '@/components/ui/FilterBar';
import { ChartBar, Target, Warning, Heart, CaretLeft, CaretRight, Info, CheckCircle, Circle } from '@phosphor-icons/react';
import type { AppIcon } from '@/constants/moods';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subDays, addMonths, subMonths } from 'date-fns';

const QUADRANT_LABELS: Record<Priority, { label: string; color: string; barColor: string; icon: AppIcon }> = {
  'urgent-important': { label: PRIORITY_LABEL['urgent-important'], color: PRIORITY_COLOR['urgent-important'], barColor: PRIORITY_BAR_COLOR['urgent-important'], icon: PRIORITY_ICON['urgent-important'] },
  'urgent-not-important': { label: PRIORITY_LABEL['urgent-not-important'], color: PRIORITY_COLOR['urgent-not-important'], barColor: PRIORITY_BAR_COLOR['urgent-not-important'], icon: PRIORITY_ICON['urgent-not-important'] },
  'not-urgent-important': { label: PRIORITY_LABEL['not-urgent-important'], color: PRIORITY_COLOR['not-urgent-important'], barColor: PRIORITY_BAR_COLOR['not-urgent-important'], icon: PRIORITY_ICON['not-urgent-important'] },
  'not-urgent-not-important': { label: PRIORITY_LABEL['not-urgent-not-important'], color: PRIORITY_COLOR['not-urgent-not-important'], barColor: PRIORITY_BAR_COLOR['not-urgent-not-important'], icon: PRIORITY_ICON['not-urgent-not-important'] },
};

export default function Analytics() {
  const { tasks, fetchTasks } = useTaskStore();
  const { tags, fetchTags } = useTagStore();
  const { goals, fetchGoals } = useGoalStore();
  const { entries, fetchEntries } = useJournalStore();
  const [dateRangeKey, setDateRangeKey] = useState<DateRange>('all');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<Priority[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  useEffect(() => {
    fetchTasks();
    fetchTags();
    fetchGoals();
    fetchEntries();
  }, []);

  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  const dateRange = useMemo(() => {
    const today = new Date();
    const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
    switch (dateRangeKey) {
      case 'today': return { start: fmt(today), end: fmt(today) };
      case 'this-week': {
        const d = today.getDay() || 7;
        const monday = subDays(today, d - 1);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return { start: fmt(monday), end: fmt(sunday) };
      }
      case 'this-month': return { start: fmt(startOfMonth(today)), end: fmt(endOfMonth(today)) };
      case 'next-3-days': return { start: fmt(today), end: fmt(subDays(today, -2)) };
      case 'next-7-days': return { start: fmt(today), end: fmt(subDays(today, -6)) };
      case 'next-30-days': return { start: fmt(today), end: fmt(subDays(today, -29)) };
      case 'all': return null;
    }
    return null;
  }, [dateRangeKey]);

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
    if (selectedPriorities.length > 0) {
      result = result.filter((t) => selectedPriorities.includes(t.priority));
    }
    if (selectedStatuses.length > 0) {
      result = result.filter((t) => selectedStatuses.includes(t.status));
    }
    return result;
  }, [tasks, selectedTagIds, selectedGoalIds, selectedPriorities, selectedStatuses, dateRange]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter((t) => t.status === 'completed').length;
    const pending = filteredTasks.filter((t) => t.status === 'pending' || t.status === 'in-progress').length;
    const totalEst = filteredTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
    const totalAct = filteredTasks
      .filter((t) => t.status === 'completed')
      .reduce((s, t) => s + (t.actualMinutes || t.estimatedMinutes), 0);

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
      if (t.status === 'completed') { q.completed++; q.actual += t.actualMinutes || t.estimatedMinutes; }
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const efficiency = totalEst > 0 ? Math.round((totalAct / totalEst) * 100) : 0;
    const importantTime = byQuadrant['urgent-important'].estimated + byQuadrant['not-urgent-important'].estimated;
    const effectiveRate = totalEst > 0 ? Math.round((importantTime / totalEst) * 100) : 0;

    return { total, completed, pending, totalEst, totalAct, byQuadrant, completionRate, efficiency, effectiveRate, importantTime };
  }, [filteredTasks]);

  // Tag time distribution
  const tagTimeDistribution = useMemo(() => {
    const dist: Record<string, { tag: Tag; estimated: number; actual: number; count: number }> = {};
    tags.forEach((tag) => { dist[tag.id] = { tag, estimated: 0, actual: 0, count: 0 }; });
    filteredTasks.forEach((t) => {
      t.tags.forEach((tid) => {
        if (dist[tid]) {
          dist[tid].estimated += t.estimatedMinutes;
          dist[tid].count++;
          if (t.status === 'completed') dist[tid].actual += t.actualMinutes || t.estimatedMinutes;
        }
      });
    });
    return Object.values(dist).filter((d) => d.count > 0).sort((a, b) => b.estimated - a.estimated);
  }, [filteredTasks, tags]);

  // Goal time distribution
  const goalTimeDistribution = useMemo(() => {
    if (goals.length === 0) return [];
    const dist: Record<string, { goalId: string; name: string; color: string; estimated: number; actual: number; count: number; completed: number }> = {};
    goals.forEach((g) => { dist[g.id] = { goalId: g.id, name: g.name, color: g.color, estimated: 0, actual: 0, count: 0, completed: 0 }; });
    filteredTasks.forEach((t) => {
      if (t.goalId && dist[t.goalId]) {
        dist[t.goalId].estimated += t.estimatedMinutes;
        dist[t.goalId].count++;
        if (t.status === 'completed') { dist[t.goalId].completed++; dist[t.goalId].actual += t.actualMinutes || t.estimatedMinutes; }
      }
    });
    return Object.values(dist).filter((d) => d.count > 0).sort((a, b) => b.estimated - a.estimated);
  }, [filteredTasks, goals]);

  // Monthly heatmap
  const heatmapData = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    return days.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayTasks = filteredTasks.filter((t) => t.dueDate === dateStr);
      const done = dayTasks.filter((t) => t.status === 'completed').length;
      const total = dayTasks.length;
      const actualMin = dayTasks.filter((t) => t.status === 'completed').reduce((s, t) => s + (t.actualMinutes || t.estimatedMinutes), 0);
      const totalEst = dayTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
      return { date: dateStr, day: format(day, 'd'), done, total, actualMin, totalEst, rate: total > 0 ? done / total : -1 };
    });
  }, [filteredTasks, calendarMonth]);

  const formatTime = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;
  const primaryColor = useUIStore((s) => s.primaryColor) || '#6366F1';
  const hasFilters = selectedTagIds.length > 0 || selectedGoalIds.length > 0 || selectedPriorities.length > 0 || selectedStatuses.length > 0 || dateRangeKey !== 'all';

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-h3 flex items-center gap-2">
            <ChartBar weight="duotone" size={20} className="text-primary" />
            分析统计
          </h3>
          <p className="text-caption text-text-secondary mt-0.5">了解你的时间投入和执行效率</p>
        </div>
        {hasFilters && (
          <span className="text-small text-primary bg-primary/8 px-2.5 py-1 rounded-full">
            {filteredTasks.length} 个任务
          </span>
        )}
      </div>

      {/* Unified FilterBar (same as Dashboard) */}
      <div className="card">
        <FilterBar
          dateRange={dateRangeKey}
          onDateRangeChange={setDateRangeKey}
          allTags={tags}
          selectedTagIds={selectedTagIds}
          onTagsChange={setSelectedTagIds}
          allGoals={goals}
          selectedGoalIds={selectedGoalIds}
          onGoalsChange={setSelectedGoalIds}
          selectedPriorities={selectedPriorities}
          onPrioritiesChange={setSelectedPriorities}
          selectedStatuses={selectedStatuses}
          onStatusesChange={setSelectedStatuses}
        />
      </div>

      {/* Main 2-column layout: Time Allocation (left) + Clock & Stats (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left: Time Allocation */}
        <div className="lg:col-span-2 space-y-3">
          {/* Quadrant distribution */}
          <div className="card">
            <h4 className="text-sm font-semibold mb-3 text-text-secondary">四象限时间分布</h4>
            <div className="space-y-3">
              {(Object.keys(QUADRANT_LABELS) as Priority[]).map((key) => {
                const cfg = QUADRANT_LABELS[key];
                const data = stats.byQuadrant[key];
                const pct = stats.totalEst > 0 ? Math.round((data.estimated / stats.totalEst) * 100) : 0;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-1.5">
                        <cfg.icon size={14} weight="duotone" />
                        <span style={{ color: cfg.color }} className="font-medium">{cfg.label}</span>
                      </span>
                      <span className="text-text-secondary">
                        {data.count}个 · {formatTime(data.estimated)}
                      </span>
                    </div>
                    <div className="w-full h-4 bg-border/50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full flex items-center justify-end px-2 transition duration-500"
                        style={{ width: `${Math.max(pct, 2)}%`, background: `linear-gradient(90deg, ${cfg.barColor}cc, ${cfg.barColor})` }}>
                        {pct >= 10 && <span className="text-[10px] text-white font-semibold">{pct}%</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tag distribution */}
          {tagTimeDistribution.length > 0 && (
            <div className="card">
              <h4 className="text-sm font-semibold mb-3 text-text-secondary">标签维度</h4>
              <div className="space-y-2">
                {tagTimeDistribution.map((d) => {
                  const maxTime = tagTimeDistribution[0]?.estimated ?? 1;
                  const estPct = Math.round((d.estimated / maxTime) * 100);
                  return (
                    <div key={d.tag.id} className="flex items-center gap-2.5 py-1">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.tag.color }} />
                      <span className="text-[12px] font-medium w-[90px] truncate flex-shrink-0">{d.tag.name}</span>
                      <div className="flex-1 h-2 bg-border/50 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition duration-500" style={{ width: `${estPct}%`, backgroundColor: d.tag.color }} />
                      </div>
                      <span className="text-[11px] text-text-secondary font-mono flex-shrink-0">{formatTime(d.estimated)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Goal distribution */}
          {goalTimeDistribution.length > 0 && (
            <div className="card">
              <h4 className="text-sm font-semibold mb-3 text-text-secondary">目标维度</h4>
              <div className="space-y-2">
                {goalTimeDistribution.map((d) => {
                  const maxTime = goalTimeDistribution[0]?.estimated ?? 1;
                  const estPct = Math.round((d.estimated / maxTime) * 100);
                  return (
                    <div key={d.goalId} className="flex items-center gap-2.5 py-1">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-[12px] font-medium w-[90px] truncate flex-shrink-0">{d.name}</span>
                      <div className="flex-1 h-2 bg-border/50 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition duration-500" style={{ width: `${estPct}%`, backgroundColor: d.color }} />
                      </div>
                      <span className="text-[11px] text-text-secondary font-mono flex-shrink-0">{d.completed}/{d.count} · {formatTime(d.estimated)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Calendar heatmap — moved to left column */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-text-secondary">打卡日历</h4>
              <div className="flex items-center gap-1">
                <button onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
                  className="p-1 rounded hover:bg-surface-hover text-text-secondary">
                  <CaretLeft weight="bold" size={14} />
                </button>
                <span className="text-sm font-medium min-w-[80px] text-center">
                  {format(calendarMonth, 'yyyy年M月')}
                </span>
                <button onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                  className="p-1 rounded hover:bg-surface-hover text-text-secondary">
                  <CaretRight weight="bold" size={14} />
                </button>
              </div>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-1.5 text-[10px] text-text-secondary mb-2">
              <span>少</span>
              {[0.06, 0.12, 0.28, 0.5, 0.75, 1].map((op) => (
                <div key={op} className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: primaryColor, opacity: op }} />
              ))}
              <span>多</span>
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {['一','二','三','四','五','六','日'].map((w) => (
                <div key={w} className="text-center text-[10px] text-text-secondary pb-1">{w}</div>
              ))}
              {(() => {
                const firstDay = heatmapData[0];
                if (!firstDay) return null;
                const dow = (new Date(firstDay.date + 'T12:00:00').getDay() + 6) % 7;
                return Array.from({ length: dow }).map((_, i) => <div key={`pad-${i}`} />);
              })()}
              {heatmapData.map((d) => {
                const isToday = d.date === format(new Date(), 'yyyy-MM-dd');
                return (
                  <div key={d.date}
                    className="relative rounded text-center py-1 transition-colors"
                    style={{
                      backgroundColor: d.rate >= 0
                        ? `color-mix(in srgb, ${primaryColor} ${Math.round(d.rate * 30)}%, transparent)`
                        : 'transparent',
                    }}
                    title={d.date}
                  >
                    <div className="text-[11px] font-medium leading-tight">
                      {d.day}
                      {isToday && <span className="text-primary ml-0.5 text-[9px]">今</span>}
                    </div>
                    {d.total > 0 && (
                      <div className="text-[9px] leading-tight">
                        {d.done > 0
                          ? <span className="text-success">✓{formatTime(d.actualMin)}</span>
                          : <span className="text-text-secondary">○{formatTime(d.totalEst)}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Clock + Stats */}
        <div className="space-y-3">
          {/* Clock Donut */}
          <div className="card">
            <h4 className="text-sm font-semibold mb-1 text-text-secondary">时间分布</h4>
            <ClockDonut tasks={filteredTasks} />
          </div>

          {/* Key stats */}
          <div className="card space-y-3">
            <h4 className="text-sm font-semibold text-text-secondary">关键指标</h4>
            <StatRow label="总任务" value={String(stats.total)} sub={`${stats.completed} 已完成 · ${stats.pending} 待完成`} color="#6366F1" />
            <StatRow label="完成率" value={`${stats.completionRate}%`}
              sub={stats.completionRate >= 80 ? '执行力不错' : stats.completionRate >= 50 ? '继续加油' : '建议减少每日任务量'}
              color={stats.completionRate >= 70 ? '#10B981' : '#F59E0B'} />
            <StatRow label="效率指数" value={`${stats.efficiency}%`}
              sub={stats.efficiency <= 100 ? '实际用时在预估范围内' : '实际用时超出预估'}
              color={stats.efficiency <= 100 ? '#10B981' : '#EF4444'} />
            <StatRow label="时间价值率" value={`${stats.effectiveRate}%`}
              sub={stats.effectiveRate >= 60 ? '重要任务占比健康' : '重要任务占比偏低'}
              color={stats.effectiveRate >= 60 ? '#10B981' : '#F59E0B'} />
            <div className="pt-1 border-t border-border/50">
              <div className="text-[11px] text-text-secondary">
                预估 {formatTime(stats.totalEst)} · 实际 {formatTime(stats.totalAct)}
              </div>
            </div>
          </div>

          {/* Efficiency insights */}
          <div className="card space-y-2.5">
            <h4 className="text-sm font-semibold text-text-secondary">效率分析</h4>
            <InsightRow icon={Target} color="#6366F1"
              label="重要不紧急占比"
              value={`${stats.totalEst > 0 ? Math.round((stats.byQuadrant['not-urgent-important'].estimated / stats.totalEst) * 100) : 0}%`}
              tip="这个象限投入越多，长期越轻松" />
            <InsightRow icon={Warning} color="#EF4444"
              label="重要且紧急占比"
              value={`${stats.totalEst > 0 ? Math.round((stats.byQuadrant['urgent-important'].estimated / stats.totalEst) * 100) : 0}%`}
              tip="过高说明处于救火模式" />
          </div>

          {/* Mood × Efficiency — moved to right column */}
          {entries.length > 0 && (() => {
            const moodData = (Object.keys(MOOD_ICON) as Mood[]).map((mood) => {
              const moodEntries = entries.filter((e) => {
                if (e.mood !== mood) return false;
                if (dateRange) return e.date >= dateRange.start && e.date <= dateRange.end;
                return true;
              });
              if (moodEntries.length === 0) return null;
              let totalTasks = 0; let completedTasks = 0;
              moodEntries.forEach((entry) => {
                const dayTasks = filteredTasks.filter((t) => t.dueDate === entry.date);
                totalTasks += dayTasks.length;
                completedTasks += dayTasks.filter((t) => t.status === 'completed').length;
              });
              const rate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
              return { mood, icon: MOOD_ICON[mood], label: MOOD_LABEL[mood], days: moodEntries.length, totalTasks, completedTasks, rate };
            }).filter(Boolean) as { mood: Mood; icon: AppIcon; label: string; days: number; totalTasks: number; completedTasks: number; rate: number }[];
            if (moodData.length === 0) return null;

            return (
              <div className="card">
                <h4 className="text-sm font-semibold mb-3 text-text-secondary flex items-center gap-2">
                  <Heart weight="duotone" size={14} className="text-primary" />
                  心情与效率
                </h4>
                <div className="space-y-2">
                  {moodData.map((d) => (
                    <div key={d.mood} className="flex items-center gap-2.5">
                      <d.icon size={20} weight="duotone" className="flex-shrink-0" />
                      <span className="text-[12px] font-medium flex-shrink-0 w-14">{d.label}</span>
                      <span className="text-[11px] text-text-secondary flex-shrink-0 w-8">{d.days}天</span>
                      <div className="flex-1 h-3 bg-border/50 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition duration-500"
                          style={{
                            width: `${Math.max(d.rate, 2)}%`,
                            background: d.rate >= 70 ? '#10B981' : d.rate >= 40 ? '#F59E0B' : '#EF4444',
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-mono flex-shrink-0 w-10 text-right"
                        style={{ color: d.rate >= 70 ? '#10B981' : d.rate >= 40 ? '#F59E0B' : '#EF4444' }}>
                        {d.rate}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Filtered task list */}
      {selectedTagIds.length > 0 && filteredTasks.length > 0 && (
        <div className="card">
          <h4 className="text-sm font-semibold mb-2 text-text-secondary">筛选结果</h4>
          <div className="space-y-0.5 max-h-80 overflow-y-auto">
            {filteredTasks.map((task) => {
              const goal = task.goalId ? goalMap.get(task.goalId) : null;
              return (
                <div key={task.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-surface-hover">
                  {task.status === 'completed'
                    ? <CheckCircle weight="duotone" size={14} className="text-success flex-shrink-0" />
                    : <Circle weight="duotone" size={14} className="text-text-secondary flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] truncate ${task.status === 'completed' ? 'line-through text-text-secondary' : ''}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-text-secondary">{task.dueDate}</span>
                      <span className="text-[10px] text-text-secondary">· {formatTime(task.estimatedMinutes)}</span>
                      {goal && <span className="text-[10px] text-primary">· {goal.name}</span>}
                    </div>
                  </div>
                  <button className="p-1 rounded hover:bg-surface-hover text-text-secondary flex-shrink-0"
                    onClick={() => setDetailTask(task)} title="查看详情"><Info weight="bold" size={12} /></button>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                    color: QUADRANT_LABELS[task.priority].color,
                    backgroundColor: `${QUADRANT_LABELS[task.priority].color}15`,
                  }}>
                    {QUADRANT_LABELS[task.priority].label}
                  </span>
                </div>
              );
            })}
          </div>
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

function StatRow({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-text-secondary">{label}</span>
        <span className="text-sm font-bold" style={{ color }}>{value}</span>
      </div>
      <p className="text-[10px] text-text-secondary/70 mt-0.5">{sub}</p>
    </div>
  );
}

function InsightRow({ icon: AppIcon, color, label, value, tip }: {
  icon: React.ElementType; color: string; label: string; value: string; tip: string;
}) {
  return (
    <div className="flex items-center gap-2.5 p-2 rounded bg-surface-hover/50">
      <div className="p-1 rounded" style={{ backgroundColor: `${color}15` }}>
        <AppIcon size={14} color={color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[12px] truncate">{label}</span>
          <span className="text-sm font-bold flex-shrink-0 ml-1" style={{ color }}>{value}</span>
        </div>
        <p className="text-[10px] text-text-secondary/70 truncate">{tip}</p>
      </div>
    </div>
  );
}

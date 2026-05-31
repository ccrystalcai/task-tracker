import { useEffect, useState, useMemo } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { useTagStore } from '@/stores/tagStore';
import { useGoalStore } from '@/stores/goalStore';
import { useJournalStore } from '@/stores/journalStore';
import { useClipStore } from '@/stores/clipStore';
import Modal from '@/components/ui/Modal';
import TaskForm from '@/components/task/TaskForm';
import SmartTaskInput from '@/components/task/SmartTaskInput';
import TimerTaskItem from '@/components/task/TimerTaskItem';
import DaySummaryModal from '@/components/task/DaySummaryModal';
import PosterModal from '@/components/export/PosterModal';
import TaskDetailModal from '@/components/task/TaskDetailModal';
import EncouragementToast from '@/components/ui/EncouragementToast';
import StreakBadge from '@/components/ui/StreakBadge';
import AchievementToast from '@/components/ui/AchievementToast';
import WeeklyReview from '@/components/ui/WeeklyReview';
import { getRandomPraise, getStreakMessage, calculateStreak, checkTaskReminders, requestNotificationPermission } from '@/utils/motivation';
import { saveTaskPrefs } from '@/utils/taskPrefs';
import { shouldRemindBackup, markBackupDone, dismissBackupReminder, shouldAutoBackup, markAutoBackupDone } from '@/utils/backupReminder';
import { getStoredToken } from '@/utils/googleDrive';
import { exportAllData, downloadJSON } from '@/utils/export';
import { db } from '@/db';
import { PRIORITY_LABEL, PRIORITY_COLOR, PRIORITY_BAR_COLOR, PRIORITY_ICON } from '@/constants/priorities';
import type { Task, Priority } from '@/db/schema';
import { Plus, Warning, Lightning, TrendUp, Target as TargetIcon, Checks, SkipForward, Star, CheckCircle, CaretLeft, CaretRight, CaretUp, CaretDown, Download, BookOpen, Paperclip, Sparkle, ArrowRight, FileText, Image, Flame, Smiley, SmileyWink, SmileyMeh, SmileySad, SmileyAngry } from '@phosphor-icons/react';
import type { AppIcon } from '@/constants/moods';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, subDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const today = new Date().toISOString().split('T')[0];

const QUADRANT_CONFIG: Record<Priority, { label: string; color: string; barColor: string; bg: string; border: string; icon: AppIcon; glow: string }> = {
  'urgent-important': { label: PRIORITY_LABEL['urgent-important'], color: PRIORITY_COLOR['urgent-important'], barColor: PRIORITY_BAR_COLOR['urgent-important'], bg: 'bg-red-50/50', border: 'border-red-200/60', icon: PRIORITY_ICON['urgent-important'], glow: 'rgba(248,113,113,0.10)' },
  'urgent-not-important': { label: PRIORITY_LABEL['urgent-not-important'], color: PRIORITY_COLOR['urgent-not-important'], barColor: PRIORITY_BAR_COLOR['urgent-not-important'], bg: 'bg-amber-50/50', border: 'border-amber-200/60', icon: PRIORITY_ICON['urgent-not-important'], glow: 'rgba(251,191,36,0.10)' },
  'not-urgent-important': { label: PRIORITY_LABEL['not-urgent-important'], color: PRIORITY_COLOR['not-urgent-important'], barColor: PRIORITY_BAR_COLOR['not-urgent-important'], bg: 'bg-blue-50/50', border: 'border-blue-200/60', icon: PRIORITY_ICON['not-urgent-important'], glow: 'rgba(129,140,248,0.10)' },
  'not-urgent-not-important': { label: PRIORITY_LABEL['not-urgent-not-important'], color: PRIORITY_COLOR['not-urgent-not-important'], barColor: PRIORITY_BAR_COLOR['not-urgent-not-important'], bg: 'bg-green-50/50', border: 'border-green-200/60', icon: PRIORITY_ICON['not-urgent-not-important'], glow: 'rgba(52,211,153,0.10)' },
};

const MOOD_ICONS: Record<string, AppIcon> = {
  great: Smiley, good: SmileyWink, okay: SmileyMeh, bad: SmileySad, terrible: SmileyAngry,
};
const MOOD_LABELS: Record<string, string> = {
  great: '很棒', good: '不错', okay: '一般', bad: '不太好', terrible: '很差',
};

export default function Dashboard() {
  const { tasks, fetchTasks, createTask, deleteTask, toggleTask } = useTaskStore();
  const { tags, fetchTags } = useTagStore();
  const { goals, fetchGoals } = useGoalStore();
  const { entries, fetchEntries } = useJournalStore();
  const { clips, fetchClips } = useClipStore();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showSmartInput, setShowSmartInput] = useState(false);
  const [quickPriority, setQuickPriority] = useState<Priority | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showPoster, setShowPoster] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [expandedQuadrants, setExpandedQuadrants] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'praise' | 'encourage' | 'streak' } | null>(null);
  const [streakChecked, setStreakChecked] = useState(false);
  const [achievementMsg, setAchievementMsg] = useState<string | null>(null);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [quadrantFilter, setQuadrantFilter] = useState<'today' | 'next-3-days' | 'next-7-days' | 'this-week' | 'this-month' | 'next-30-days' | 'all'>('today');
  const [timelineDate, setTimelineDate] = useState(today);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchTags();
    fetchGoals();
    fetchEntries();
    fetchClips();
    requestNotificationPermission();
  }, []);

  // Auto-backup to Google Drive
  useEffect(() => {
    if (!shouldAutoBackup()) return;
    const token = getStoredToken();
    if (!token) return;
    (async () => {
      try {
        const { exportAllData } = await import('@/utils/export');
        const { uploadToDrive } = await import('@/utils/googleDrive');
        const data = await exportAllData();
        const fileName = `tasktracker-auto-${new Date().toISOString().split('T')[0]}.json`;
        await uploadToDrive(fileName, data, token);
        markAutoBackupDone();
      } catch { /* silent — don't bother the user for auto-backup failures */ }
    })();
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

  // Weekly review trigger (Monday check)
  useEffect(() => {
    const now = new Date();
    if (now.getDay() !== 1) return;
    const weekNum = `${now.getFullYear()}-W${Math.ceil((now.getDate() + (now.getDay() + 6) % 7) / 7)}`;
    if (localStorage.getItem(`weekly-review-shown-${weekNum}`)) return;
    db.dailySummaries.where('date').between(
      format(subDays(now, 7), 'yyyy-MM-dd'),
      format(subDays(now, 1), 'yyyy-MM-dd'),
      true, true,
    ).count().then((count) => {
      if (count > 0) {
        setShowWeeklyReview(true);
        localStorage.setItem(`weekly-review-shown-${weekNum}`, '1');
      }
    });
  }, []);

  const todayTasks = useMemo(() => {
    const allToday = tasks.filter((t) => t.dueDate === today);
    const childSourceIds = new Set(
      allToday.filter((t) => t.sourceTaskId != null).map((t) => t.sourceTaskId!),
    );
    return allToday.filter((t) => {
      // Recurring source: only keep if no child instance exists for today
      if (t.sourceTaskId == null && t.recurrenceType !== 'none') {
        return !childSourceIds.has(t.id);
      }
      return true;
    });
  }, [tasks]);

  // Timeline tasks — filterable by date
  const timelineTasks = useMemo(() => {
    const all = tasks.filter((t) => t.dueDate === timelineDate);
    const childSrcIds = new Set(
      all.filter((t) => t.sourceTaskId != null).map((t) => t.sourceTaskId!),
    );
    return all.filter((t) => {
      if (t.sourceTaskId == null && t.recurrenceType !== 'none') return !childSrcIds.has(t.id);
      return true;
    });
  }, [tasks, timelineDate]);

  const completed = todayTasks.filter((t) => t.status === 'completed').length;
  const total = todayTasks.length;

  // Quadrant view — filterable by date range
  const quadrantTasks = useMemo(() => {
    if (quadrantFilter === 'today') return todayTasks;
    if (quadrantFilter === 'all') return tasks.filter((t) => {
      if (t.sourceTaskId == null && t.recurrenceType !== 'none') {
        const childSrcIds = new Set(tasks.filter((c) => c.sourceTaskId != null && c.dueDate).map((c) => c.sourceTaskId!));
        return !childSrcIds.has(t.id);
      }
      return true;
    });
    const now = new Date();
    let start = ''; let end = '';
    if (quadrantFilter === 'next-3-days') {
      start = format(now, 'yyyy-MM-dd');
      end = format(addDays(now, 2), 'yyyy-MM-dd');
    } else if (quadrantFilter === 'next-7-days') {
      start = format(now, 'yyyy-MM-dd');
      end = format(addDays(now, 6), 'yyyy-MM-dd');
    } else if (quadrantFilter === 'next-30-days') {
      start = format(now, 'yyyy-MM-dd');
      end = format(addDays(now, 29), 'yyyy-MM-dd');
    } else if (quadrantFilter === 'this-week') {
      start = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      end = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    } else if (quadrantFilter === 'this-month') {
      start = format(startOfMonth(now), 'yyyy-MM-dd');
      end = format(endOfMonth(now), 'yyyy-MM-dd');
    }
    const inRange = tasks.filter((t) => t.dueDate >= start && t.dueDate <= end);
    const childSrcIds = new Set(inRange.filter((t) => t.sourceTaskId != null).map((t) => t.sourceTaskId!));
    return inRange.filter((t) => {
      if (t.sourceTaskId == null && t.recurrenceType !== 'none') return !childSrcIds.has(t.id);
      return true;
    });
  }, [tasks, todayTasks, quadrantFilter]);
  const allDone = total > 0 && completed === total;
  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const clipMap = useMemo(() => new Map(
    clips.filter((c) => c.convertedTaskId).map((c) => [c.convertedTaskId!, c])
  ), [clips]);

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

  const quadrantStats = useMemo(() => {
    const byQuadrant: Record<Priority, { count: number; completed: number; estimated: number; actual: number }> = {
      'urgent-important': { count: 0, completed: 0, estimated: 0, actual: 0 },
      'urgent-not-important': { count: 0, completed: 0, estimated: 0, actual: 0 },
      'not-urgent-important': { count: 0, completed: 0, estimated: 0, actual: 0 },
      'not-urgent-not-important': { count: 0, completed: 0, estimated: 0, actual: 0 },
    };
    quadrantTasks.forEach((t) => {
      const q = byQuadrant[t.priority];
      q.count++;
      q.estimated += t.estimatedMinutes;
      if (t.status === 'completed') { q.completed++; q.actual += t.actualMinutes || t.estimatedMinutes; }
    });
    return byQuadrant;
  }, [quadrantTasks]);

  const quadrants = useMemo(() => {
    const q: Record<Priority, Task[]> = {
      'urgent-important': [],
      'urgent-not-important': [],
      'not-urgent-important': [],
      'not-urgent-not-important': [],
    };
    quadrantTasks.forEach((t) => q[t.priority].push(t));
    // Sort: pending first, completed at bottom
    for (const key of Object.keys(q) as Priority[]) {
      q[key].sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        return 0;
      });
    }
    return q;
  }, [quadrantTasks]);

  const insight = useMemo(() => {
    if (total === 0) return null;
    const urgentImportant = timeStats.byQuadrant['urgent-important'];
    const notUrgentImportant = timeStats.byQuadrant['not-urgent-important'];
    const urgentNotImportant = timeStats.byQuadrant['urgent-not-important'];

    if (urgentImportant.estimated > notUrgentImportant.estimated * 1.5) {
      return { type: 'warn' as const, text: '重要且紧急任务占比过高，建议提前规划，减少救火式工作', icon: Warning };
    }
    if (notUrgentImportant.estimated > urgentImportant.estimated) {
      return { type: 'good' as const, text: '重要不紧急任务占主导，时间管理状态良好', icon: TrendUp };
    }
    if (urgentNotImportant.estimated > notUrgentImportant.estimated) {
      return { type: 'warn' as const, text: '紧急不重要任务偏多，考虑是否可委托或减少干扰', icon: Lightning };
    }
    return { type: 'info' as const, text: '任务分布较均衡，注意保持重要不紧急任务的投入', icon: TargetIcon };
  }, [timeStats, total]);

  // Yesterday's incomplete tasks for migration
  const yesterdayDate = useMemo(() => format(subDays(new Date(), 1), 'yyyy-MM-dd'), []);
  const yesterdayIncomplete = useMemo(() => {
    const migratedKey = `migrated_${yesterdayDate}`;
    let migratedIds: string[] = [];
    try {
      migratedIds = JSON.parse(localStorage.getItem(migratedKey) ?? '[]');
    } catch { /* ignore */ }
    return tasks.filter((t) =>
      t.dueDate === yesterdayDate &&
      (t.status === 'pending' || t.status === 'in-progress') &&
      t.sourceTaskId == null && // exclude child instances of recurring tasks
      !migratedIds.includes(t.id)
    );
  }, [tasks, yesterdayDate]);

  const handleMigrateYesterday = async () => {
    const migratedKey = `migrated_${yesterdayDate}`;
    let migratedIds: string[] = [];
    try {
      migratedIds = JSON.parse(localStorage.getItem(migratedKey) ?? '[]');
    } catch { /* ignore */ }

    for (const task of yesterdayIncomplete) {
      await createTask({
        title: task.title,
        description: task.description,
        estimatedMinutes: task.estimatedMinutes,
        dueDate: today,
        dueTime: task.dueTime,
        priority: task.priority,
        tags: task.tags,
        goalId: task.goalId,
      });
      migratedIds.push(task.id);
    }
    localStorage.setItem(migratedKey, JSON.stringify(migratedIds));
    await fetchTasks();
  };

  const handleToggle = async (id: string) => {
    await toggleTask(id);
    await fetchTasks();
  };

  const handleCreateTask = async (data: Parameters<typeof createTask>[0]) => {
    await createTask(data);
    saveTaskPrefs({ tags: data.tags ?? [], priority: data.priority ?? 'not-urgent-important', estimatedMinutes: data.estimatedMinutes ?? 30 });
    setShowTaskForm(false);
    setQuickPriority(null);
    await fetchTasks();
  };

  const handleSmartCreate = async (data: Parameters<typeof createTask>[0]) => {
    await createTask(data);
    saveTaskPrefs({ tags: data.tags ?? [], priority: data.priority ?? 'not-urgent-important', estimatedMinutes: data.estimatedMinutes ?? 30 });
    setShowSmartInput(false);
    await fetchTasks();
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('确定删除这个任务？')) return;
    await deleteTask(id);
    await fetchTasks();
  };

  const formatTime = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;

  return (
    <div className="space-y-5">
      <StreakBadge onMilestone={(_, msg) => setAchievementMsg(msg)} />
      <div className="card hover:shadow-card-hover">
        {yesterdayIncomplete.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 mb-3 rounded-btn bg-warning/8 border border-warning/20">
            <span className="text-sm text-text-secondary">
              昨天有 <span className="font-medium text-warning">{yesterdayIncomplete.length}</span> 个任务未完成
            </span>
            <button
              className="flex items-center gap-1 text-sm font-medium text-warning hover:text-warning/80 transition-colors flex-shrink-0"
              onClick={handleMigrateYesterday}
            >
              迁移到今天 <ArrowRight weight="bold" size={14} />
            </button>
          </div>
        )}
        {(() => {
          const daysSince = shouldRemindBackup();
          if (!daysSince) return null;
          const handleBackupNow = async () => {
            const data = await exportAllData();
            downloadJSON(data, `tasktracker-backup-${new Date().toISOString().split('T')[0]}.json`);
            markBackupDone();
          };
          return (
            <div className="flex items-center justify-between gap-3 px-3 py-2 mb-3 rounded-btn bg-primary/5 border border-primary/15">
              <span className="text-sm text-text-secondary">
                {daysSince >= 999 ? '还没有备份过数据' : `已 ${daysSince} 天未备份数据`}，建议导出备份防止丢失
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button className="text-sm font-medium text-primary hover:underline" onClick={handleBackupNow}>立即备份</button>
                <button className="text-sm text-text-secondary hover:text-text-primary" onClick={dismissBackupReminder}>不再提醒</button>
              </div>
            </div>
          );
        })()}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-h3 flex items-center gap-2">
              {format(new Date(), 'M月d日 EEEE', { locale: zhCN })}
              <span className="text-body font-mono text-primary ml-1" style={{ fontSize: '0.95em' }}>
                {format(currentTime, 'HH:mm:ss')}
              </span>
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
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button className="btn-primary flex items-center justify-center gap-1.5" onClick={() => setShowSmartInput(true)}>
              <Sparkle weight="duotone" size={16} />智能录入
            </button>
            <button className="btn-secondary flex items-center justify-center gap-1.5" onClick={() => setShowTaskForm(true)}>
              <Plus weight="bold" size={16} />快速添加
            </button>
            {total > 0 && (
              <>
                <button className="btn-secondary flex items-center justify-center gap-1.5" onClick={() => setShowSummary(true)}>
                  <Checks weight="bold" size={16} />
                  完成一天
                </button>
                <button className="btn-secondary flex items-center justify-center gap-1.5" onClick={() => setShowPoster(true)}>
                  <Download weight="bold" size={14} />
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
            <insight.icon size={16} weight="duotone" />
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
            <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowSmartInput(true)}>
              <Sparkle weight="duotone" size={18} />智能录入
            </button>
            <span className="text-text-secondary text-caption">或</span>
            <button className="btn-secondary flex items-center gap-1.5" onClick={() => setShowTaskForm(true)}>
              <Plus weight="bold" size={18} />快速添加
            </button>
          </div>
        </div>
      )}

      {/* Four Quadrants */}
      {total > 0 && (
        <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-h3 flex-shrink-0 mr-3">四象限视图</h3>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mr-1">
            {([
              { key: 'today', label: '今日' },
              { key: 'next-3-days', label: '近3天' },
              { key: 'next-7-days', label: '近7天' },
              { key: 'this-week', label: '本周' },
              { key: 'this-month', label: '本月' },
              { key: 'next-30-days', label: '近30天' },
              { key: 'all', label: '全部' },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => setQuadrantFilter(key)}
                className={`px-2.5 py-1 rounded-full text-small transition whitespace-nowrap flex-shrink-0 shadow-sm ${
                  quadrantFilter === key ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary hover:bg-border'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {(Object.keys(QUADRANT_CONFIG) as Priority[]).map((key) => {
            const cfg = QUADRANT_CONFIG[key];
            const stats = quadrantStats[key];
            const tasksInQ = quadrants[key];
            return (
              <div key={key} className="card-accent"
                style={{ borderLeftColor: cfg.barColor }}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-h3 flex items-center gap-1.5">
                    <cfg.icon size={20} weight="duotone" />
                    <span style={{ color: cfg.color }}>{cfg.label}</span>
                    {stats.count > 0 && (
                      <span className="badge" style={{ backgroundColor: cfg.glow, color: cfg.color }}>
                        {stats.completed}/{stats.count}
                      </span>
                    )}
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-small px-2.5 py-1 rounded-full hover:bg-border transition flex items-center gap-1 font-medium"
                      style={{ color: cfg.color, backgroundColor: cfg.glow }}
                      onClick={() => { setQuickPriority(key); setShowTaskForm(true); }}
                    >
                      <Plus weight="bold" size={13} />
                      添加
                    </button>
                    <span className="text-small text-text-secondary font-mono">{formatTime(stats.estimated)}</span>
                  </div>
                </div>
                {stats.count > 0 && (
                  <div className="w-full h-1.5 bg-border rounded-full overflow-hidden mb-3">
                    <div className="h-full rounded-full transition duration-500 ease-out" style={{
                      width: `${stats.count > 0 ? Math.round((stats.completed / stats.count) * 100) : 0}%`,
                      backgroundColor: cfg.barColor,
                    }} />
                  </div>
                )}
                {tasksInQ.length === 0 ? (
                  <p className="text-caption text-text-secondary py-4 text-center">暂无任务 · 点击添加创建</p>
                ) : (() => {
                  const isExpanded = expandedQuadrants.has(key);
                  const displayTasks = isExpanded ? tasksInQ : tasksInQ.slice(0, 4);
                  return (
                  <div className="space-y-0.5">
                    <div className={isExpanded ? 'max-h-[320px] overflow-y-auto space-y-0.5 pr-1' : 'space-y-0.5'}>
                      {displayTasks.map((t) => (
                        <TimerTaskItem
                          key={t.id}
                          task={t}
                          tags={tags}
                          compact
                          onToggle={() => handleToggle(t.id)}
                          onDelete={() => handleDeleteTask(t.id)}
                          onDetail={() => setDetailTask(t)}
                          showGoal={t.goalId ? { name: goalMap.get(t.goalId)?.name ?? '', color: goalMap.get(t.goalId)?.color ?? '#6366F1' } : null}
                          linkedClip={clipMap.get(t.id) ? { title: clipMap.get(t.id)!.title || '剪藏链接' } : null}
                        />
                      ))}
                    </div>
                    {tasksInQ.length > 4 && (
                      <button
                        onClick={() => setExpandedQuadrants((prev) => {
                          const next = new Set(prev);
                          isExpanded ? next.delete(key) : next.add(key);
                          return next;
                        })}
                        className="text-caption text-primary hover:underline w-full text-center pt-1.5 flex items-center justify-center gap-1"
                      >
                        {isExpanded ? (
                          <>收起 <CaretUp weight="bold" size={12} /></>
                        ) : (
                          <>查看全部 <CaretDown weight="bold" size={12} /></>
                        )}
                      </button>
                    )}
                  </div>
                )})()}
              </div>
            );
          })}
        </div>
      </div>
      </>)}

      {/* Time Allocation */}
      {total > 0 && (
        <div className="card card-glass">
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
                    <cfg.icon size={16} weight="duotone" />
                    <span className="text-small font-medium whitespace-nowrap" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <div className="flex-1 h-2.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition duration-500"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        background: `linear-gradient(90deg, ${cfg.barColor}cc, ${cfg.barColor})`,
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
          <div className="lg:col-span-2 card card-glass">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3">时间轴</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setTimelineDate((d) => format(subDays(new Date(d + 'T12:00:00'), 1), 'yyyy-MM-dd'))}
                  className="p-1 rounded hover:bg-surface-hover text-text-secondary">
                  <CaretLeft weight="bold" size={18} />
                </button>
                <span className="text-body font-medium min-w-[100px] text-center">
                  {format(new Date(timelineDate + 'T12:00:00'), 'M月d日 EEEE', { locale: zhCN })}
                </span>
                <button onClick={() => setTimelineDate((d) => format(addDays(new Date(d + 'T12:00:00'), 1), 'yyyy-MM-dd'))}
                  className="p-1 rounded hover:bg-surface-hover text-text-secondary">
                  <CaretRight weight="bold" size={18} />
                </button>
              </div>
            </div>
            {timelineTasks.length === 0 ? (
              <p className="text-caption text-text-secondary text-center py-8">当天没有任务</p>
            ) : (
            <div className="space-y-0">
            {timelineTasks
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
                        <span className={`text-body truncate min-w-0 ${isCompleted ? 'line-through text-text-secondary' : ''}`}>
                          {t.title}
                        </span>
                        {isCompleted && <CheckCircle weight="duotone" size={14} className="text-success flex-shrink-0" />}
                        {isSkipped && <SkipForward weight="bold" size={14} className="text-warning flex-shrink-0" />}
                      </div>
                      <div className="ml-[60px] flex items-center gap-2 text-small text-text-secondary">
                        <span>{formatTime(t.estimatedMinutes)}</span>
                        {t.score != null && (
                          <span className="text-warning flex items-center gap-0.5">
                            <Star weight="duotone" size={11} fill="#F59E0B" color="#F59E0B" />{t.score}
                          </span>
                        )}
                        {t.notes && <span className="truncate max-w-[160px] sm:max-w-[200px]"><FileText weight="duotone" size={11} className="inline mr-0.5" />{t.notes.substring(0, 30)}</span>}
                        {(t.images?.length ?? 0) > 0 && <span><Image weight="duotone" size={11} className="inline mr-0.5" />{t.images!.length}</span>}
                        {t.priority === 'urgent-important' && <Flame weight="duotone" size={11} className="text-danger inline" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
          {/* Clock Donut */}
          <div className="card flex items-center justify-center">
            <ClockDonut tasks={timelineTasks} />
          </div>
        </div>
      )}

      {/* Estimated vs Actual Timeline */}
      <div className="card card-glass">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-h3">预估 vs 实际</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setTimelineDate((d) => format(subDays(new Date(d + 'T12:00:00'), 1), 'yyyy-MM-dd'))}
              className="p-1 rounded hover:bg-surface-hover text-text-secondary">
              <CaretLeft weight="bold" size={18} />
            </button>
            <span className="text-body font-medium min-w-[100px] text-center">
              {format(new Date(timelineDate + 'T12:00:00'), 'M月d日 EEEE', { locale: zhCN })}
            </span>
            <button onClick={() => setTimelineDate((d) => format(addDays(new Date(d + 'T12:00:00'), 1), 'yyyy-MM-dd'))}
              className="p-1 rounded hover:bg-surface-hover text-text-secondary">
              <CaretRight weight="bold" size={18} />
            </button>
          </div>
        </div>
        <p className="text-caption text-text-secondary mb-3">上行=预估时段，下行=实际完成（竖线为计划开始时间）</p>
        {timelineTasks.length === 0 ? (
          <p className="text-caption text-text-secondary text-center py-8">当天没有任务</p>
        ) : (
        <div className="relative">
          {/* Hour markers */}
          <div className="flex justify-between text-small text-text-secondary mb-1 px-0">
            {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].map((h) => (
              <span key={h} className="text-[10px]">{h}:00</span>
            ))}
          </div>
          {timelineTasks.filter((t) => t.dueTime).length === 0 ? (
            <p className="text-caption text-text-secondary text-center py-4">没有带时间段的任务</p>
          ) : (
          <div className="space-y-1.5">
            {timelineTasks
              .filter((t) => t.dueTime)
              .sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || ''))
              .map((t) => {
                const [eh, em] = (t.dueTime || '0:00').split(':').map(Number);
                const estStartPct = ((eh * 60 + em) / (24 * 60)) * 100;
                const estDurationPct = Math.max((t.estimatedMinutes / (24 * 60)) * 100, 1.5);
                const isCompleted = t.status === 'completed';

                let actualPct = 0;
                if (isCompleted && t.completedAt) {
                  const d = new Date(t.completedAt);
                  actualPct = ((d.getHours() * 60 + d.getMinutes()) / (24 * 60)) * 100;
                }

                const isOver = isCompleted && actualPct > (estStartPct + estDurationPct);
                const isEarly = isCompleted && actualPct < estStartPct;
                const actualWidth = isCompleted ? Math.max(Math.abs(actualPct - estStartPct), 1.5) : 0;
                const actualLeft = isCompleted ? Math.min(estStartPct, actualPct) : 0;

                return (
                  <div key={t.id}>
                    <div className="flex items-center gap-2">
                      <span className="w-28 text-small truncate flex-shrink-0 pr-2 text-right leading-tight">
                        {t.title}
                      </span>
                      <div className="flex-1 flex flex-col gap-0.5">
                        {/* Estimate row */}
                        <div className="relative h-2.5 rounded-full bg-border/30">
                          <div
                            className="absolute h-full rounded-full bg-primary/40"
                            style={{ left: `${estStartPct}%`, width: `${estDurationPct}%` }}
                          />
                          {!isCompleted && (
                            <div
                              className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border border-dashed border-primary"
                              style={{ left: `${estStartPct}%` }}
                              title={`预定 ${t.dueTime}`}
                            />
                          )}
                        </div>
                        {/* Actual row */}
                        <div className="relative h-2.5 rounded-full bg-border/30">
                          {/* Scheduled marker line */}
                          <div className="absolute top-0 bottom-0 w-px bg-primary/30" style={{ left: `${estStartPct}%` }} />
                          {isCompleted && (
                            <div
                              className="absolute h-full rounded-full"
                              style={{
                                left: `${actualLeft}%`,
                                width: `${actualWidth}%`,
                                backgroundColor: isOver ? '#EF4444' : isEarly ? '#10B981' : '#10B981',
                                opacity: 0.85,
                              }}
                              title={`完成于 ${new Date(t.completedAt!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
                            />
                          )}
                        </div>
                      </div>
                      <span className="w-10 text-right text-[10px] text-text-secondary flex-shrink-0">
                        {isCompleted && t.actualMinutes ? t.actualMinutes + 'm' : t.estimatedMinutes + 'm'}
                      </span>
                    </div>
                  </div>
                );
              })}
            {timelineTasks.filter((t) => !t.dueTime).length > 0 && (
              <p className="text-caption text-text-secondary mt-2">
                + {timelineTasks.filter((t) => !t.dueTime).length} 个全天任务未显示在时间条上
              </p>
            )}
          </div>
          )}
          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border text-small text-text-secondary">
            <span className="flex items-center gap-1">
              <span className="w-4 h-2 rounded-full bg-primary/40 inline-block" /> 预估时段
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-2 rounded-full bg-success inline-block" /> 按时完成
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-2 rounded-full bg-red-500 inline-block" /> 超时完成
            </span>
          </div>
        </div>
        )}
      </div>

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

      {/* Today Overview */}
      {(() => {
        const todayEntry = entries.find((e) => e.date === today);
        const todayClipsCount = clips.filter((c) => format(new Date(c.createdAt), 'yyyy-MM-dd') === today).length;
        if (!todayEntry && todayClipsCount === 0) return null;

        return (
          <div className="card card-glass">
            <h3 className="text-h3 mb-4 flex items-center gap-2">今日全貌</h3>
            <div className="flex items-center gap-4 flex-wrap text-body">
              {todayEntry && (
                <>
                  <Link to="/journal" className="flex items-center gap-1.5 text-text-secondary hover:text-primary transition-colors">
                    {(() => { const MI = MOOD_ICONS[todayEntry.mood] || SmileyMeh; return <MI size={18} />; })()}
                    <span>心情{MOOD_LABELS[todayEntry.mood] || ''}</span>
                  </Link>
                  <Link to="/journal" className="flex items-center gap-1.5 text-text-secondary hover:text-primary transition-colors">
                    <BookOpen weight="duotone" size={18} />
                    <span>写了日记</span>
                  </Link>
                </>
              )}
              {todayEntry ? null : (
                <Link to="/journal" className="flex items-center gap-1.5 text-text-secondary hover:text-primary transition-colors">
                  <BookOpen weight="duotone" size={18} />
                  <span>今天还没写日记 — 去写一篇</span>
                </Link>
              )}
              {todayClipsCount > 0 && (
                <Link to="/clips" className="flex items-center gap-1.5 text-text-secondary hover:text-primary transition-colors">
                  <Paperclip weight="duotone" size={18} />
                  <span>收藏了 {todayClipsCount} 个链接</span>
                </Link>
              )}
              <span className="flex items-center gap-1.5 text-text-secondary">
                <CheckCircle weight="duotone" size={18} className="text-success" />
                <span>完成 {completed}/{total} 个任务</span>
              </span>
            </div>
          </div>
        );
      })()}

      <Modal open={showSmartInput} onClose={() => setShowSmartInput(false)} title="智能录入">
        <SmartTaskInput
          tags={tags}
          goals={goals}
          onSubmit={handleSmartCreate}
          onCancel={() => setShowSmartInput(false)}
        />
      </Modal>

      <Modal open={showTaskForm} onClose={() => { setShowTaskForm(false); setQuickPriority(null); }} title="快速添加任务">
        <TaskForm
          tags={tags}
          priority={quickPriority ?? undefined}
          onSubmit={handleCreateTask}
          onCancel={() => { setShowTaskForm(false); setQuickPriority(null); }}
        />
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

      {achievementMsg && (
        <AchievementToast message={achievementMsg} onDone={() => setAchievementMsg(null)} />
      )}

      {showWeeklyReview && (
        <WeeklyReview onClose={() => setShowWeeklyReview(false)} />
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
      <div className="card card-glass">
        <h3 className="text-h3 mb-3">今日截图 ({images.length})</h3>
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {images.map((img, i) => (
              <div
                key={i}
                className={`flex-shrink-0 cursor-pointer rounded-lg overflow-hidden border-2 transition ${
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
            <CaretLeft weight="bold" size={18} />
          </button>
          <button
            onClick={next}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-1 bg-black/40 text-white rounded-full hover:bg-black/60"
          >
            <CaretRight weight="bold" size={18} />
          </button>
        </div>
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center cursor-pointer"
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
  const COLORS = ['#0D9488', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#14B8A6'];

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

  // Map each completed task to a slice on the 24h clock.
  // The arc shows the work period leading UP TO the completion time.
  const slices = completedTasks.map((t, i) => {
    let completionAngle = 0;
    if (t.completedAt) {
      const d = new Date(t.completedAt);
      const minutes = d.getHours() * 60 + d.getMinutes();
      completionAngle = (minutes / (24 * 60)) * 360 - 90; // -90 so 0:00 is at top
    } else if (t.dueTime) {
      const [h, m] = t.dueTime.split(':').map(Number);
      completionAngle = ((h * 60 + m) / (24 * 60)) * 360 - 90;
    }

    const duration = t.actualMinutes || t.estimatedMinutes;
    const arcAngle = Math.max(duration / MINUTE_SCALE, 4); // minimum 4 degrees

    return {
      ...t,
      color: COLORS[i % COLORS.length],
      startAngle: completionAngle - arcAngle, // work happened before completion
      endAngle: completionAngle,              // arc ends at completion time
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

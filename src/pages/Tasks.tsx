import { useEffect, useMemo, useState } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { useTagStore } from '@/stores/tagStore';
import { useGoalStore } from '@/stores/goalStore';
import { PRIORITY_LABEL, PRIORITY_COLOR, PRIORITY_BADGE_BG } from '@/constants/priorities';
import type { Task, Priority, Tag } from '@/db/schema';
import TaskDetailModal from '@/components/task/TaskDetailModal';
import TimerCell from '@/components/task/TimerCell';
import SmartTaskInput from '@/components/task/SmartTaskInput';
import TaskForm from '@/components/task/TaskForm';
import FilterBar from '@/components/ui/FilterBar';
import type { DateRange } from '@/components/ui/FilterBar';
import CalendarPanel from '@/components/ui/CalendarPanel';
import Modal from '@/components/ui/Modal';
import { ListChecks, CheckCircle, Circle, Clock, CaretDown, Info, SkipForward, Columns, Stack, Trash, ArrowsClockwise, Plus, Sparkle } from '@phosphor-icons/react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { saveTaskPrefs } from '@/utils/taskPrefs';

const QUADRANT_LABELS: Record<Priority, { label: string; color: string }> = {
  'urgent-important': { label: PRIORITY_LABEL['urgent-important'], color: PRIORITY_COLOR['urgent-important'] },
  'urgent-not-important': { label: PRIORITY_LABEL['urgent-not-important'], color: PRIORITY_COLOR['urgent-not-important'] },
  'not-urgent-important': { label: PRIORITY_LABEL['not-urgent-important'], color: PRIORITY_COLOR['not-urgent-important'] },
  'not-urgent-not-important': { label: PRIORITY_LABEL['not-urgent-not-important'], color: PRIORITY_COLOR['not-urgent-not-important'] },
};

type SortKey = 'dueDate' | 'priority' | 'title' | 'estimatedMinutes' | 'status';
type GroupBy = 'none' | 'goal' | 'status' | 'time';
type ColumnKey = 'title' | 'dueDate' | 'priority' | 'tags' | 'goal' | 'status' | 'time' | 'timer';

const COLUMN_DEFS: { key: ColumnKey; label: string; sortKey?: SortKey }[] = [
  { key: 'title', label: '标题', sortKey: 'title' },
  { key: 'dueDate', label: '截止日期', sortKey: 'dueDate' },
  { key: 'priority', label: '优先级', sortKey: 'priority' },
  { key: 'tags', label: '标签' },
  { key: 'goal', label: '目标' },
  { key: 'status', label: '状态', sortKey: 'status' },
  { key: 'time', label: '时长', sortKey: 'estimatedMinutes' },
  { key: 'timer', label: '计时' },
];

const DEFAULT_COLUMNS: ColumnKey[] = ['title', 'dueDate', 'priority', 'tags', 'goal', 'status', 'time'];

const today = new Date().toISOString().split('T')[0];

export default function Tasks() {
  const { tasks, fetchTasks, toggleTask, deleteTask, createTask, updateTask } = useTaskStore();
  const { tags, fetchTags } = useTagStore();
  const { goals, fetchGoals } = useGoalStore();

  // Unified filters
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [selectedPriorities, setSelectedPriorities] = useState<Priority[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // View state
  const [viewTab, setViewTab] = useState<'list' | 'day' | 'week' | 'month'>('list');
  const [timelineDate, setTimelineDate] = useState(today);

  // Table state
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortAsc, setSortAsc] = useState(true);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Modals
  const [showSmartInput, setShowSmartInput] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);

  useEffect(() => { fetchTasks(); fetchTags(); fetchGoals(); }, []);

  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  // Date range → date filter
  const dateFilter = useMemo(() => {
    const now = new Date();
    const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
    switch (dateRange) {
      case 'today': return { start: fmt(now), end: fmt(now) };
      case 'next-3-days': return { start: fmt(now), end: fmt(new Date(now.getTime() + 2 * 86400000)) };
      case 'next-7-days': return { start: fmt(now), end: fmt(new Date(now.getTime() + 6 * 86400000)) };
      case 'this-week': {
        const d = now.getDay() || 7;
        const mon = new Date(now);
        mon.setDate(now.getDate() - d + 1);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        return { start: fmt(mon), end: fmt(sun) };
      }
      case 'this-month': {
        return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
      }
      case 'next-30-days': return { start: fmt(now), end: fmt(new Date(now.getTime() + 29 * 86400000)) };
      case 'all': return null;
    }
  }, [dateRange]);

  const filteredTasks = useMemo(() => {
    let result = tasks.filter((t) => t.sourceTaskId == null);

    if (dateFilter) {
      result = result.filter((t) => t.dueDate >= dateFilter.start && t.dueDate <= dateFilter.end);
    }
    if (selectedPriorities.length > 0) {
      result = result.filter((t) => selectedPriorities.includes(t.priority));
    }
    if (selectedTagIds.length > 0) {
      result = result.filter((t) => t.tags.some((tid) => selectedTagIds.includes(tid)));
    }
    if (selectedGoalIds.length > 0) {
      result = result.filter((t) => t.goalId != null && selectedGoalIds.includes(t.goalId));
    }
    if (selectedStatuses.length > 0) {
      result = result.filter((t) => selectedStatuses.includes(t.status));
    }
    return result;
  }, [tasks, dateFilter, selectedPriorities, selectedTagIds, selectedGoalIds, selectedStatuses]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'dueDate': cmp = a.dueDate.localeCompare(b.dueDate); break;
        case 'priority': {
          const order: Priority[] = ['urgent-important', 'urgent-not-important', 'not-urgent-important', 'not-urgent-not-important'];
          cmp = order.indexOf(a.priority) - order.indexOf(b.priority); break;
        }
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'estimatedMinutes': cmp = a.estimatedMinutes - b.estimatedMinutes; break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filteredTasks, sortKey, sortAsc]);

  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return [{ label: '', tasks: sortedTasks }];
    const groups = new Map<string, Task[]>();
    for (const task of sortedTasks) {
      let key: string;
      if (groupBy === 'status') {
        key = task.status === 'pending' ? '待完成' : task.status === 'in-progress' ? '进行中' : task.status === 'completed' ? '已完成' : '已跳过';
      } else if (groupBy === 'goal') {
        const g = task.goalId ? goalMap.get(task.goalId) : null;
        key = g?.name || '无目标';
      } else {
        const days = differenceInDays(parseISO(task.dueDate), parseISO(today));
        if (days < 0) key = '已逾期';
        else if (days === 0) key = '今天';
        else if (days <= 7) key = '本周';
        else if (days <= 30) key = '本月';
        else key = '更晚';
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(task);
    }
    const order = groupBy === 'status' ? ['进行中', '待完成', '已完成', '已跳过']
      : groupBy === 'time' ? ['已逾期', '今天', '本周', '本月', '更晚']
      : [...groups.keys()].sort();
    return order.filter((k) => groups.has(k)).map((k) => ({ label: k, tasks: groups.get(k)! }));
  }, [sortedTasks, groupBy, goalMap]);

  // Date range change → auto-switch view
  const calendarTab = viewTab === 'list' ? 'day' : viewTab as 'day' | 'week' | 'month';
  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    if (range === 'today') setViewTab('day');
    else if (range === 'this-week') setViewTab('week');
    else if (range === 'this-month') setViewTab('month');
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const handleToggle = async (task: Task) => {
    await toggleTask(task.id);
    await fetchTasks();
  };

  const handleCreateTask = async (data: Parameters<typeof createTask>[0]) => {
    await createTask(data);
    saveTaskPrefs({ tags: data.tags ?? [], priority: data.priority ?? 'not-urgent-important', estimatedMinutes: data.estimatedMinutes ?? 30 });
    setShowTaskForm(false);
    await fetchTasks();
  };

  const handleSmartCreate = async (data: Parameters<typeof createTask>[0]) => {
    await createTask(data);
    saveTaskPrefs({ tags: data.tags ?? [], priority: data.priority ?? 'not-urgent-important', estimatedMinutes: data.estimatedMinutes ?? 30 });
    setShowSmartInput(false);
    await fetchTasks();
  };

  const formatTime = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;

  const dueLabel = (task: Task) => {
    const days = differenceInDays(parseISO(task.dueDate), parseISO(today));
    if (days < 0) return { text: `已逾期 ${Math.abs(days)} 天`, color: '#EF4444' };
    if (days === 0) return { text: '今天截止', color: '#F59E0B' };
    if (days <= 3) return { text: `还有 ${days} 天`, color: '#F97316' };
    return { text: task.dueDate, color: '#10B981' };
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span className="text-[10px] ml-0.5">{sortAsc ? '↑' : '↓'}</span>;
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  const isColumnVisible = (key: ColumnKey) => visibleColumns.includes(key);

  return (
    <div className="space-y-3">
      {/* Header + Quick Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-h3 flex items-center gap-2">
            <ListChecks weight="duotone" size={20} className="text-primary" />
            任务列表
          </h3>
          <p className="text-caption text-text-secondary mt-0.5">
            共 {tasks.length} 个任务 · 当前显示 {filteredTasks.length} 个
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => setShowSmartInput(true)}>
            <Sparkle weight="duotone" size={15} />智能录入
          </button>
          <button className="btn-secondary flex items-center gap-1.5 text-sm" onClick={() => setShowTaskForm(true)}>
            <Plus weight="bold" size={15} />快速添加
          </button>
        </div>
      </div>

      {/* Unified FilterBar (same as Dashboard) */}
      <div className="card">
        <FilterBar
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
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

      {/* View Tabs + Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Tabs — Notion-style, same as Dashboard */}
        <div className="inline-flex items-center rounded-lg bg-surface-hover p-0.5 relative">
          <div
            className="absolute top-0.5 bottom-0.5 rounded-md bg-surface shadow-sm transition-all duration-200 ease-out"
            style={{
              left: `${(['list','day','week','month'] as const).indexOf(viewTab) * 25}%`,
              width: '25%',
            }}
          />
          {([
            { key: 'list' as const, label: '列表', dateRange: undefined as DateRange | undefined },
            { key: 'day' as const, label: '日', dateRange: 'today' as DateRange },
            { key: 'week' as const, label: '周', dateRange: 'this-week' as DateRange },
            { key: 'month' as const, label: '月', dateRange: 'this-month' as DateRange },
          ]).map(({ key, label, dateRange: dr }) => (
            <button
              key={key}
              onClick={() => {
                setViewTab(key);
                if (dr) setDateRange(dr);
              }}
              className={`relative z-10 w-[56px] py-1.5 text-sm font-medium transition-colors duration-200 rounded-md text-center ${
                viewTab === key ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Table toolbar (only in list view) */}
        {viewTab === 'list' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-text-secondary">
              <Stack weight="duotone" size={14} />
              <select
                className="input text-sm py-1"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              >
                <option value="none">不分组</option>
                <option value="status">按状态</option>
                <option value="goal">按目标</option>
                <option value="time">按时间</option>
              </select>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-surface-hover hover:bg-border text-sm text-text-secondary transition-colors"
              >
                <Columns weight="duotone" size={14} />
                列显示
              </button>
              {showColumnMenu && (
                <div className="absolute right-0 top-full mt-1 bg-surface rounded-lg shadow-lg border border-border p-2 z-30 min-w-[160px]">
                  {COLUMN_DEFS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-hover cursor-pointer text-sm">
                      <input type="checkbox" checked={isColumnVisible(key)} onChange={() => toggleColumn(key)} className="rounded" />
                      {label}
                    </label>
                  ))}
                  <button
                    onClick={() => { setVisibleColumns(DEFAULT_COLUMNS); setShowColumnMenu(false); }}
                    className="w-full text-sm text-primary hover:underline mt-1 pt-1 border-t border-border text-center"
                  >
                    恢复默认
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Calendar Views */}
      {viewTab !== 'list' && (
        <div key={viewTab} className="view-enter">
          <CalendarPanel
            tab={calendarTab}
            tasks={filteredTasks}
            tags={tags}
            selectedDate={timelineDate}
            onSelectDate={(date) => setTimelineDate(date)}
            onCreateTask={(date) => { setTimelineDate(date); setShowTaskForm(true); }}
            onSelectTask={setDetailTask}
            onUpdateTask={updateTask}
          />
        </div>
      )}

      {/* List View — Task Table */}
      {viewTab === 'list' && (
        <div key="list" className="view-enter">
          {/* Empty state */}
          {sortedTasks.length === 0 && (
            <div className="card text-center py-12">
              <ListChecks weight="duotone" size={40} className="mx-auto text-text-secondary opacity-30 mb-3" />
              <p className="text-text-secondary">没有匹配的任务</p>
            </div>
          )}

          {/* Ungrouped: pill-style view (like tag filters) */}
          {sortedTasks.length > 0 && groupBy === 'none' && (
            <div className="flex flex-wrap gap-2">
              {sortedTasks.map((task) => {
                const due = dueLabel(task);
                return (
                  <div
                    key={task.id}
                    onClick={() => setDetailTask(task)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border border-border bg-surface hover:bg-surface-hover transition-colors cursor-pointer ${
                      task.status === 'completed' ? 'opacity-50' : ''
                    }`}
                  >
                    <button
                      className="flex-shrink-0 transition-transform hover:scale-110"
                      onClick={(e) => { e.stopPropagation(); handleToggle(task); }}
                      title={task.status === 'completed' ? '取消完成' : '标记完成'}
                    >
                      {task.status === 'completed'
                        ? <CheckCircle weight="duotone" size={16} className="text-success" />
                        : task.status === 'skipped'
                        ? <SkipForward weight="bold" size={16} className="text-warning" />
                        : task.status === 'in-progress'
                        ? <Clock weight="bold" size={16} className="text-primary" />
                        : <Circle weight="duotone" size={16} className="text-text-secondary hover:text-success transition-colors" />}
                    </button>
                    <span className={`text-sm truncate max-w-[200px] ${task.status === 'completed' || task.status === 'skipped' ? 'line-through text-text-secondary' : ''}`}>
                      {task.title}
                    </span>
                    <span className="text-[11px] flex-shrink-0" style={{ color: due.color }}>{due.text}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{
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

          {/* Grouped table view */}
          {sortedTasks.length > 0 && groupBy !== 'none' && (
            <div className="space-y-3">
              {groupedTasks.map((group) => (
                <div key={group.label}>
                  {group.label && (
                    <h4 className="text-sm font-semibold mb-2 px-1 text-text-secondary">
                      {group.label}
                      <span className="text-text-secondary font-normal ml-2">{group.tasks.length}</span>
                    </h4>
                  )}
                  <div className="card overflow-x-auto p-0">
                    <table className="w-full table-auto hidden md:table">
                      <thead>
                        <tr className="border-b border-border bg-surface-hover/50 text-sm text-text-secondary font-medium">
                          <th className="w-10 pl-4 py-2.5" />
                          {isColumnVisible('title') && (
                            <th className="text-left min-w-[140px] py-2.5 cursor-pointer hover:text-text-primary" onClick={() => handleSort('title')}>
                              标题 {sortIndicator('title')}
                            </th>
                          )}
                          {isColumnVisible('dueDate') && (
                            <th className="text-left whitespace-nowrap px-3 py-2.5 cursor-pointer hover:text-text-primary" onClick={() => handleSort('dueDate')}>
                              截止日期 {sortIndicator('dueDate')}
                            </th>
                          )}
                          {isColumnVisible('priority') && (
                            <th className="text-left whitespace-nowrap px-3 py-2.5 cursor-pointer hover:text-text-primary" onClick={() => handleSort('priority')}>
                              优先级 {sortIndicator('priority')}
                            </th>
                          )}
                          {isColumnVisible('tags') && (
                            <th className="text-left whitespace-nowrap px-3 py-2.5">标签</th>
                          )}
                          {isColumnVisible('goal') && (
                            <th className="text-left whitespace-nowrap px-3 py-2.5">目标</th>
                          )}
                          {isColumnVisible('status') && (
                            <th className="text-left whitespace-nowrap px-3 py-2.5 cursor-pointer hover:text-text-primary" onClick={() => handleSort('status')}>
                              状态 {sortIndicator('status')}
                            </th>
                          )}
                          {isColumnVisible('time') && (
                            <th className="text-right whitespace-nowrap px-3 py-2.5 cursor-pointer hover:text-text-primary" onClick={() => handleSort('estimatedMinutes')}>
                              时长 {sortIndicator('estimatedMinutes')}
                            </th>
                          )}
                          {isColumnVisible('timer') && (
                            <th className="text-left whitespace-nowrap px-3 py-2.5">计时</th>
                          )}
                          <th className="w-8 pr-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {group.tasks.map((task) => {
                          const due = dueLabel(task);
                          const goal = task.goalId ? goalMap.get(task.goalId) : null;
                          const taskTags = task.tags.map((tid) => tagMap.get(tid)).filter(Boolean) as Tag[];

                          return (
                            <tr key={task.id}
                              className={`hover:bg-surface-hover transition-colors cursor-pointer group ${
                                task.status === 'completed' ? 'opacity-50' : ''
                              }`}
                              onClick={() => setDetailTask(task)}
                            >
                              <td className="pl-4 py-2.5">
                                <button className="transition-transform hover:scale-110"
                                  title={task.status === 'completed' ? '取消完成' : '标记完成'}
                                  onClick={(e) => { e.stopPropagation(); handleToggle(task); }}>
                                  {task.status === 'completed'
                                    ? <CheckCircle weight="duotone" size={18} className="text-success" />
                                    : task.status === 'skipped'
                                    ? <SkipForward weight="bold" size={18} className="text-warning" />
                                    : task.status === 'in-progress'
                                    ? <Clock weight="bold" size={18} className="text-primary" />
                                    : <Circle weight="duotone" size={18} className="text-text-secondary hover:text-success transition-colors" />}
                                </button>
                              </td>
                              {isColumnVisible('title') && (
                                <td className="min-w-[140px] py-2.5">
                                  <p className={`text-sm truncate ${task.status === 'completed' || task.status === 'skipped' ? 'line-through text-text-secondary' : ''}`}>
                                    {task.title}
                                    {task.recurrenceType !== 'none' && <ArrowsClockwise weight="bold" size={12} className="text-text-secondary ml-1 inline" />}
                                  </p>
                                </td>
                              )}
                              {isColumnVisible('dueDate') && (
                                <td className="whitespace-nowrap px-3 py-2.5">
                                  <span className="text-sm" style={{ color: due.color }}>{due.text}</span>
                                </td>
                              )}
                              {isColumnVisible('priority') && (
                                <td className="whitespace-nowrap px-3 py-2.5">
                                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: QUADRANT_LABELS[task.priority].color, backgroundColor: PRIORITY_BADGE_BG(QUADRANT_LABELS[task.priority].color) }}>
                                    {QUADRANT_LABELS[task.priority].label}
                                  </span>
                                </td>
                              )}
                              {isColumnVisible('tags') && (
                                <td className="whitespace-nowrap px-3 py-2.5">
                                  <div className="flex gap-1">
                                    {taskTags.map((t) => (
                                      <span key={t.id} className="text-xs flex items-center gap-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />{t.name}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              )}
                              {isColumnVisible('goal') && (
                                <td className="whitespace-nowrap px-3 py-2.5 max-w-[120px]">
                                  <span className="text-sm text-text-secondary truncate block">
                                    {goal ? <span style={{ color: goal.color }}>{goal.name}</span> : '—'}
                                  </span>
                                </td>
                              )}
                              {isColumnVisible('status') && (
                                <td className="whitespace-nowrap px-3 py-2.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    task.status === 'completed' ? 'bg-success/10 text-success' :
                                    task.status === 'skipped' ? 'bg-warning/10 text-warning' :
                                    task.status === 'in-progress' ? 'bg-primary/10 text-primary' : 'bg-surface-hover text-text-secondary'
                                  }`}>
                                    {task.status === 'pending' ? '待完成' : task.status === 'in-progress' ? '进行中' : task.status === 'completed' ? '已完成' : '已跳过'}
                                  </span>
                                </td>
                              )}
                              {isColumnVisible('time') && (
                                <td className="whitespace-nowrap text-right px-3 py-2.5">
                                  <span className="text-sm text-text-secondary">
                                    {task.actualMinutes > 0 ? (
                                      <span className={task.actualMinutes > task.estimatedMinutes ? 'text-warning' : 'text-success'}>
                                        实{formatTime(task.actualMinutes)}/预{formatTime(task.estimatedMinutes)}
                                      </span>
                                    ) : formatTime(task.estimatedMinutes)}
                                  </span>
                                </td>
                              )}
                              {isColumnVisible('timer') && (
                                <td className="whitespace-nowrap px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                  <TimerCell taskId={task.id} />
                                </td>
                              )}
                              <td className="pr-4 py-2.5">
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    className="p-1 rounded hover:bg-surface-hover text-text-secondary hover:text-primary"
                                    onClick={(e) => { e.stopPropagation(); setDetailTask(task); }}
                                    title="查看详情"
                                  >
                                    <Info weight="bold" size={14} />
                                  </button>
                                  <button
                                    className="p-1 rounded hover:bg-surface-hover text-text-secondary hover:text-danger"
                                    onClick={(e) => { e.stopPropagation(); if (confirm('确定删除该任务？')) { deleteTask(task.id); fetchTasks(); } }}
                                    title="删除"
                                  >
                                    <Trash weight="bold" size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Mobile card view */}
                    <div className="md:hidden divide-y divide-border">
                      {group.tasks.map((task) => {
                        const due = dueLabel(task);
                        const goal = task.goalId ? goalMap.get(task.goalId) : null;
                        const taskTags = task.tags.map((tid) => tagMap.get(tid)).filter(Boolean) as Tag[];
                        const isExpanded = expanded.has(task.id);

                        return (
                          <div key={task.id}>
                            <div className={`px-4 py-2.5 hover:bg-surface-hover transition-colors cursor-pointer ${
                              task.status === 'completed' ? 'opacity-50' : ''
                            }`} onClick={() => setDetailTask(task)}>
                              <div className="flex items-center gap-3">
                                <button className="flex-shrink-0 transition-transform hover:scale-110"
                                  onClick={(e) => { e.stopPropagation(); handleToggle(task); }}>
                                  {task.status === 'completed'
                                    ? <CheckCircle weight="duotone" size={18} className="text-success" />
                                    : task.status === 'skipped'
                                    ? <SkipForward weight="bold" size={18} className="text-warning" />
                                    : task.status === 'in-progress'
                                    ? <Clock weight="bold" size={18} className="text-primary" />
                                    : <Circle weight="duotone" size={18} className="text-text-secondary hover:text-success transition-colors" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm truncate ${task.status === 'completed' || task.status === 'skipped' ? 'line-through text-text-secondary' : ''}`}>
                                    {task.title}
                                    {task.recurrenceType !== 'none' && <ArrowsClockwise weight="bold" size={12} className="text-text-secondary ml-1 inline" />}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-text-secondary">
                                    <span style={{ color: due.color }}>{due.text}</span>
                                    <span>· {formatTime(task.estimatedMinutes)}</span>
                                  </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); setExpanded((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
                                  return next;
                                }); }}
                                  className="p-1 rounded hover:bg-surface-hover text-text-secondary">
                                  <CaretDown weight="bold" size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                              </div>
                              {isExpanded && (
                                <div className="mt-2 pt-2 border-t border-border space-y-1.5">
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-text-secondary">优先级:</span>
                                    <span style={{ color: QUADRANT_LABELS[task.priority].color }}>{QUADRANT_LABELS[task.priority].label}</span>
                                  </div>
                                  {taskTags.length > 0 && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-text-secondary">标签:</span>
                                      <div className="flex gap-1 flex-wrap">
                                        {taskTags.map((t) => <span key={t.id} className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />{t.name}</span>)}
                                      </div>
                                    </div>
                                  )}
                                  {goal && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-text-secondary">目标:</span>
                                      <span style={{ color: goal.color }}>{goal.name}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-text-secondary">状态:</span>
                                    <span>{task.status === 'pending' ? '待完成' : task.status === 'in-progress' ? '进行中' : task.status === 'completed' ? '已完成' : '已跳过'}</span>
                                  </div>
                                  <TimerCell taskId={task.id} />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showColumnMenu && (
        <div className="fixed inset-0 z-20" role="presentation" onClick={() => setShowColumnMenu(false)} />
      )}

      {/* Smart Input Modal */}
      <Modal open={showSmartInput} onClose={() => setShowSmartInput(false)} title="智能录入">
        <SmartTaskInput
          tags={tags}
          goals={goals}
          onSubmit={handleSmartCreate}
          onCancel={() => setShowSmartInput(false)}
        />
      </Modal>

      {/* Task Form Modal */}
      <Modal open={showTaskForm} onClose={() => setShowTaskForm(false)} title="快速添加任务">
        <TaskForm
          tags={tags}
          onSubmit={handleCreateTask}
          onCancel={() => setShowTaskForm(false)}
        />
      </Modal>

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

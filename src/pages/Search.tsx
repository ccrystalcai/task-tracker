import { useEffect, useState, useMemo } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { useGoalStore } from '@/stores/goalStore';
import { useTagStore } from '@/stores/tagStore';
import Fuse from 'fuse.js';
import type { Task, Goal } from '@/db/schema';
import type { FuseResultMatch } from 'fuse.js';
import TaskDetailModal from '@/components/task/TaskDetailModal';
import { Search as SearchIcon, CheckCircle2, Circle, Clock, Target, SkipForward, Star, Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const PRIORITY_LABELS: Record<string, string> = {
  'urgent-important': '紧急重要',
  'urgent-not-important': '紧急不重要',
  'not-urgent-important': '不紧急重要',
  'not-urgent-not-important': '不紧急不重要',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 size={16} className="text-success flex-shrink-0" />,
  pending: <Circle size={16} className="text-text-secondary flex-shrink-0" />,
  skipped: <SkipForward size={16} className="text-warning flex-shrink-0" />,
};

type SearchResultItem = {
  type: 'task' | 'goal';
  id: string;
  title: string;
  subtitle: string;
  task?: Task;
  goal?: Goal;
};

export default function Search() {
  const { tasks, fetchTasks } = useTaskStore();
  const { goals, fetchGoals } = useGoalStore();
  const { tags, fetchTags } = useTagStore();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
    fetchGoals();
    fetchTags();
  }, []);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const fuse = useMemo(() => {
    const items: SearchResultItem[] = [
      ...tasks.map((t) => {
        const taskTagsText = t.tags.map((tid) => tagMap.get(tid)?.name).filter(Boolean).join(' ');
        return {
          type: 'task' as const,
          id: t.id,
          title: t.title,
          subtitle: [t.description, t.reflection, t.notes, taskTagsText].filter(Boolean).join(' '),
          task: t,
        };
      }),
      ...goals.map((g) => {
        const goalTasks = tasks.filter((t) => t.goalId === g.id);
        const goalTagsText = goalTasks.flatMap((t) => t.tags.map((tid) => tagMap.get(tid)?.name)).filter(Boolean).join(' ');
        return {
          type: 'goal' as const,
          id: g.id,
          title: g.name,
          subtitle: [g.description, goalTagsText].filter(Boolean).join(' '),
          goal: g,
        };
      }),
    ];

    return new Fuse(items, {
      keys: ['title', 'subtitle'],
      threshold: 0.4,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 1,
    });
  }, [tasks, goals, tagMap]);

  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return fuse.search(debouncedQuery).slice(0, 30);
  }, [debouncedQuery, fuse]);

  const taskResults = results.filter((r) => r.item.type === 'task');
  const goalResults = results.filter((r) => r.item.type === 'goal');

  // Highlight matching text
  const highlight = (text: string, matches?: readonly FuseResultMatch[]) => {
    if (!matches || matches.length === 0) return <span>{text}</span>;
    const indices = matches
      .flatMap((m) => m.indices)
      .sort((a, b) => a[0] - b[0]);

    const parts: React.ReactNode[] = [];
    let lastEnd = 0;
    for (const [start, end] of indices) {
      if (start > lastEnd) parts.push(text.slice(lastEnd, start));
      parts.push(<mark key={start} className="bg-warning/30 text-text-primary rounded-sm px-0.5">{text.slice(start, end + 1)}</mark>);
      lastEnd = end + 1;
    }
    if (lastEnd < text.length) parts.push(text.slice(lastEnd));
    return <span>{parts}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-h3 flex items-center gap-2">
          <SearchIcon size={22} className="text-primary" />
          全局搜索
        </h3>
        <p className="text-caption text-text-secondary mt-1">
          搜索任务、目标和反思内容
        </p>
      </div>

      <div className="card">
        <div className="relative">
          <SearchIcon size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            className="input w-full pl-10"
            placeholder="输入关键词搜索任务、目标、反思..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {!debouncedQuery.trim() ? (
        <div className="card text-center py-16 space-y-3">
          <SearchIcon size={48} className="mx-auto text-text-secondary opacity-30" />
          <p className="text-text-secondary">输入关键词开始搜索</p>
          <p className="text-caption text-text-secondary">
            支持模糊搜索 · 可搜索任务名、描述、反思、目标名
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-text-secondary">未找到匹配结果</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Task Results */}
          {taskResults.length > 0 && (
            <div>
              <h4 className="text-h3 mb-3 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-primary" />
                任务 ({taskResults.length})
              </h4>
              <div className="space-y-2">
                {taskResults.map(({ item, matches }) => {
                  const task = item.task!;
                  return (
                    <div key={task.id} className="card hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {STATUS_ICON[task.status]}
                            <p className="text-body font-medium">
                              {highlight(task.title, matches)}
                            </p>
                            <span className={`text-small px-1.5 py-0.5 rounded-full ${
                              task.priority === 'urgent-important' ? 'bg-red-100 text-red-600' :
                              task.priority === 'urgent-not-important' ? 'bg-amber-100 text-amber-600' :
                              task.priority === 'not-urgent-important' ? 'bg-blue-100 text-blue-600' :
                              'bg-green-100 text-green-600'
                            }`}>
                              {PRIORITY_LABELS[task.priority]}
                            </span>
                          </div>
                          {(task.description || task.reflection) && (
                            <p className="text-caption text-text-secondary mt-1 ml-6 line-clamp-2">
                              {highlight(
                                [task.description, task.reflection, task.notes].filter(Boolean).join(' · '),
                                matches
                              )}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 ml-6 text-small text-text-secondary">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {task.estimatedMinutes}min
                            </span>
                            <span>{format(parseISO(task.dueDate), 'M月d日', { locale: zhCN })}</span>
                            {task.score && (
                              <span className="flex items-center gap-0.5 text-warning">
                                <Star size={12} fill="#F59E0B" color="#F59E0B" />
                                {task.score}
                              </span>
                            )}
                          </div>
                          {task.tags.length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5 ml-6">
                              {task.tags.map((tagId) => {
                                const tag = tagMap.get(tagId);
                                if (!tag) return null;
                                return (
                                  <span key={tagId}
                                    className="text-small px-1.5 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: tag.color, fontSize: '11px' }}>
                                    {tag.name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <button className="p-1 rounded hover:bg-surface-hover text-text-secondary flex-shrink-0 ml-2"
                          onClick={() => setDetailTask(task)} title="查看详情"><Info size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Goal Results */}
          {goalResults.length > 0 && (
            <div>
              <h4 className="text-h3 mb-3 flex items-center gap-2">
                <Target size={18} className="text-primary" />
                目标 ({goalResults.length})
              </h4>
              <div className="space-y-2">
                {goalResults.map(({ item, matches }) => {
                  const goal = item.goal!;
                  const goalTasks = tasks.filter((t) => t.goalId === goal.id);
                  const completed = goalTasks.filter((t) => t.status === 'completed').length;
                  return (
                    <div key={goal.id} className="card hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-2">
                        <span className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: goal.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-body font-medium">
                            {highlight(goal.name, matches)}
                          </p>
                          {goal.description && (
                            <p className="text-caption text-text-secondary mt-1 line-clamp-2">
                              {highlight(goal.description, matches)}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-small text-text-secondary">
                            <span>{goalTasks.length} 个任务</span>
                            <span>{completed} 已完成</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-small ${
                              goal.status === 'active' ? 'bg-success/10 text-success' :
                              goal.status === 'completed' ? 'bg-primary/10 text-primary' :
                              'bg-text-secondary/10 text-text-secondary'
                            }`}>
                              {goal.status === 'active' ? '进行中' : goal.status === 'completed' ? '已完成' : '已归档'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {detailTask && (
        <TaskDetailModal
          open={!!detailTask}
          onClose={() => setDetailTask(null)}
          task={detailTask}
          goal={detailTask.goalId ? goals.find((g) => g.id === detailTask.goalId) ?? null : null}
          onUpdate={fetchTasks}
        />
      )}
    </div>
  );
}

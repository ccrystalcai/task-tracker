import { useEffect, useState, useMemo } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { useGoalStore } from '@/stores/goalStore';
import { useTagStore } from '@/stores/tagStore';
import { useClipStore } from '@/stores/clipStore';
import Fuse from 'fuse.js';
import { PRIORITY_LABEL, PRIORITY_COLOR, PRIORITY_BADGE_BG } from '@/constants/priorities';
import type { Task, Goal, Clip } from '@/db/schema';
import type { FuseResultMatch } from 'fuse.js';
import TaskDetailModal from '@/components/task/TaskDetailModal';
import { MagnifyingGlass as SearchIcon, CheckCircle, Circle, Clock, Target, SkipForward, Star, Info, Paperclip, ArrowSquareOut, X, Calendar } from '@phosphor-icons/react';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle weight="duotone" size={16} className="text-success flex-shrink-0" />,
  pending: <Circle weight="duotone" size={16} className="text-text-secondary flex-shrink-0" />,
  'in-progress': <Clock weight="bold" size={16} className="text-primary flex-shrink-0" />,
  skipped: <SkipForward weight="bold" size={16} className="text-warning flex-shrink-0" />,
};

type SearchResultItem = {
  type: 'task' | 'goal' | 'clip';
  id: string;
  title: string;
  subtitle: string;
  task?: Task;
  goal?: Goal;
  clip?: Clip;
};

export default function MagnifyingGlass() {
  const { tasks, fetchTasks } = useTaskStore();
  const { goals, fetchGoals } = useGoalStore();
  const { tags, fetchTags } = useTagStore();
  const { clips, fetchClips } = useClipStore();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [clipTagFilter, setClipTagFilter] = useState<string[]>([]);

  useEffect(() => {
    fetchTasks();
    fetchGoals();
    fetchTags();
    fetchClips();
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
      ...clips.map((c) => {
        const clipTagsText = c.tags.map((tid) => tagMap.get(tid)?.name).filter(Boolean).join(' ');
        return {
          type: 'clip' as const,
          id: c.id,
          title: c.title || c.url,
          subtitle: [c.summary, c.notes, c.url, clipTagsText].filter(Boolean).join(' '),
          clip: c,
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
  }, [tasks, goals, clips, tagMap]);

  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return fuse.search(debouncedQuery).slice(0, 30);
  }, [debouncedQuery, fuse]);

  const taskResults = results.filter((r) => r.item.type === 'task');
  const goalResults = results.filter((r) => r.item.type === 'goal');
  const clipResults = results.filter((r) => r.item.type === 'clip');

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
    <div className="space-y-5">
      <div className="card">
        <h3 className="text-h3 flex items-center gap-2">
          <SearchIcon size={22} className="text-primary" />
          全局搜索
        </h3>
        <p className="text-caption text-text-secondary mt-1">
          搜索任务、目标、反思内容和剪藏
        </p>
      </div>

      <div className="card">
        <div className="relative">
          <SearchIcon size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            className="input w-full pl-10"
            placeholder="输入关键词搜索任务、目标、反思、剪藏…"
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
            支持模糊搜索 · 可搜索任务、目标、剪藏链接、标签
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-text-secondary">未找到匹配结果</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Task Results */}
          {taskResults.length > 0 && (
            <div>
              <h4 className="text-h3 mb-3 flex items-center gap-2">
                <CheckCircle weight="duotone" size={18} className="text-primary" />
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
                            <p className="text-body font-medium truncate">
                              {highlight(task.title, matches)}
                            </p>
                            <span className="text-small px-1.5 py-0.5 rounded-full"
                              style={{ color: PRIORITY_COLOR[task.priority], backgroundColor: PRIORITY_BADGE_BG(PRIORITY_COLOR[task.priority]) }}>
                              {PRIORITY_LABEL[task.priority]}
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
                              <Clock weight="bold" size={12} />
                              {task.estimatedMinutes}min
                            </span>
                            <span>{format(parseISO(task.dueDate), 'M月d日', { locale: zhCN })}</span>
                            {task.score && (
                              <span className="flex items-center gap-0.5 text-warning">
                                <Star weight="duotone" size={12} fill="#F59E0B" color="#F59E0B" />
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
                                    className="text-small flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                                    {tag.name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <button className="p-1 rounded hover:bg-surface-hover text-text-secondary flex-shrink-0 ml-2"
                          onClick={() => setDetailTask(task)} title="查看详情"><Info weight="bold" size={14} /></button>
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
                <Target weight="duotone" size={18} className="text-primary" />
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
                          <p className="text-body font-medium truncate">
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

          {/* Clip Results */}
          {clipResults.length > 0 && (() => {
            const clipTagIds = [...new Set(clipResults.flatMap((r) => r.item.clip?.tags || []))];
            const clipTags = clipTagIds.map((tid) => tagMap.get(tid)).filter(Boolean);
            let filteredClipResults = clipResults;
            if (clipTagFilter.length > 0) {
              filteredClipResults = clipResults.filter((r) =>
                r.item.clip?.tags.some((tid) => clipTagFilter.includes(tid))
              );
            }
            return (
            <div>
              <h4 className="text-h3 mb-3 flex items-center gap-2">
                <Paperclip weight="duotone" size={18} className="text-primary" />
                剪藏 ({filteredClipResults.length})
              </h4>
              {clipTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {clipTags.map((tag) => (
                    <button
                      key={tag!.id}
                      onClick={() => setClipTagFilter((prev) =>
                        prev.includes(tag!.id) ? prev.filter((id) => id !== tag!.id) : [...prev, tag!.id]
                      )}
                      className={`text-small px-2 py-0.5 rounded-full transition ${
                        clipTagFilter.includes(tag!.id) ? 'text-white' : 'bg-surface-hover text-text-secondary hover:bg-border'
                      }`}
                      style={clipTagFilter.includes(tag!.id) ? { backgroundColor: tag!.color } : {}}
                    >
                      {tag!.name}
                    </button>
                  ))}
                  {clipTagFilter.length > 0 && (
                    <button className="text-small px-2 py-0.5 text-text-secondary hover:text-danger" onClick={() => setClipTagFilter([])}>
                      <X weight="bold" size={12} className="inline" /> 清除
                    </button>
                  )}
                </div>
              )}
              <div className="space-y-2">
                {filteredClipResults.map(({ item, matches }) => {
                  const clip = item.clip!;
                  return (
                    <div key={clip.id} className="card hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {clip.favicon ? (
                            <img src={clip.favicon} alt="" className="w-4 h-4 rounded flex-shrink-0 mt-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <Paperclip weight="duotone" size={16} className="text-text-secondary flex-shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <p className="text-body font-medium truncate">
                              {highlight(clip.title || '无标题', matches)}
                            </p>
                            <p className="text-caption text-text-secondary truncate">{clip.url}</p>
                            {clip.summary && (
                              <p className="text-caption text-text-secondary mt-1 line-clamp-2">
                                {highlight(clip.summary, matches)}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 text-small text-text-secondary">
                              <span>{format(new Date(clip.createdAt), 'MM/dd HH:mm')}</span>
                              {clip.relatedJournalDate && <span><Calendar weight="duotone" size={13} className="inline mr-0.5" />{clip.relatedJournalDate}</span>}
                            </div>
                            {clip.tags.length > 0 && (
                              <div className="flex items-center gap-1 mt-1.5">
                                {clip.tags.map((tagId) => {
                                  const tag = tagMap.get(tagId);
                                  if (!tag) return null;
                                  return (
                                    <span key={tagId}
                                      className="text-small flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                                      {tag.name}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <a href={clip.url} target="_blank" rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-surface-hover text-text-secondary flex-shrink-0 ml-2"
                          title="打开链接">
                          <ArrowSquareOut weight="duotone" size={14} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )})()}
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

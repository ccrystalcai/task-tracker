import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { db } from '@/db';
import { generateId } from '@/utils/id';
import type { Task, Mood } from '@/db/schema';
import Modal from '@/components/ui/Modal';
import { Star, CheckCircle, Clock, SkipForward, CameraPlus, X, CaretDown, CaretUp, Confetti } from '@phosphor-icons/react';
import type { AppIcon } from '@/constants/moods';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { DailySummary } from '@/db/schema';
import { MOOD_ICON, MOOD_LABEL, WEATHER_ICON, WEATHER_LABEL } from '@/constants/moods';
import type { Weather } from '@/constants/moods';

const DRAFT_KEY = 'tasktracker-day-summary-draft';

const today = new Date().toISOString().split('T')[0];
const MOODS: { value: Mood; icon: AppIcon; label: string }[] = [
  { value: 'great', icon: MOOD_ICON.great, label: MOOD_LABEL.great },
  { value: 'good', icon: MOOD_ICON.good, label: MOOD_LABEL.good },
  { value: 'okay', icon: MOOD_ICON.okay, label: MOOD_LABEL.okay },
  { value: 'bad', icon: MOOD_ICON.bad, label: MOOD_LABEL.bad },
  { value: 'terrible', icon: MOOD_ICON.terrible, label: MOOD_LABEL.terrible },
];

const WEATHERS: { value: Weather; icon: AppIcon; label: string }[] = [
  { value: 'sunny', icon: WEATHER_ICON.sunny, label: WEATHER_LABEL.sunny },
  { value: 'cloudy', icon: WEATHER_ICON.cloudy, label: WEATHER_LABEL.cloudy },
  { value: 'rainy', icon: WEATHER_ICON.rainy, label: WEATHER_LABEL.rainy },
  { value: 'stormy', icon: WEATHER_ICON.stormy, label: WEATHER_LABEL.stormy },
  { value: 'snowy', icon: WEATHER_ICON.snowy, label: WEATHER_LABEL.snowy },
  { value: 'windy', icon: WEATHER_ICON.windy, label: WEATHER_LABEL.windy },
];

interface DaySummaryModalProps {
  open: boolean;
  onClose: () => void;
}

export default function DaySummaryModal({ open, onClose }: DaySummaryModalProps) {
  const { tasks, fetchTasks } = useTaskStore();
  const todayTasks = useMemo(() => tasks.filter((t) => t.dueDate === today), [tasks]);
  const completedTasks = todayTasks.filter((t) => t.status === 'completed');
  const pendingTasks = todayTasks.filter((t) => t.status !== 'completed');

  const [mood, setMood] = useState<Mood>('good');
  const [weather, setWeather] = useState<'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'windy' | null>(null);
  const [summary, setSummary] = useState('');
  const [taskScores, setTaskScores] = useState<Record<string, number>>({});
  const [taskReflections, setTaskReflections] = useState<Record<string, string>>({});
  const [taskSkipReasons, setTaskSkipReasons] = useState<Record<string, string>>({});
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [expandedCompleted, setExpandedCompleted] = useState(true);
  const [expandedPending, setExpandedPending] = useState(true);

  // Restore draft from localStorage on mount
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.date === today) {
        if (draft.mood) setMood(draft.mood);
        if (draft.weather) setWeather(draft.weather);
        if (draft.summary) setSummary(draft.summary);
        if (draft.taskScores) setTaskScores(draft.taskScores);
        if (draft.taskReflections) setTaskReflections(draft.taskReflections);
        if (draft.taskSkipReasons) setTaskSkipReasons(draft.taskSkipReasons);
        if (draft.images) setImages(draft.images);
      }
    } catch { /* ignore */ }
  }, [open]);

  // Auto-save draft
  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        date: today,
        mood, weather, summary, taskScores, taskReflections, taskSkipReasons, images,
      }));
    } catch { /* ignore */ }
  }, [mood, weather, summary, taskScores, taskReflections, taskSkipReasons, images]);

  const draftTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!open) return;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(saveDraft, 1000);
    return () => clearTimeout(draftTimer.current);
  }, [saveDraft, open]);

  // Collect task images from today's tasks
  const taskImages = useMemo(() => {
    const imgs: { taskId: string; title: string; url: string }[] = [];
    todayTasks.forEach((t) => {
      (t.images || []).forEach((url) => {
        imgs.push({ taskId: t.id, title: t.title, url });
      });
    });
    return imgs;
  }, [todayTasks]);

  const totalEstimated = todayTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
  const totalActual = completedTasks.reduce((s, t) => s + (t.actualMinutes || t.estimatedMinutes), 0);

  const formatTime = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;

  // Auto-detect task mentions in summary and link reflections
  const autoLinkReflections = useCallback((summaryText: string) => {
    const newReflections = { ...taskReflections };
    for (const task of todayTasks) {
      if (summaryText.includes(task.title)) {
        if (!newReflections[task.id]) {
          newReflections[task.id] = `（从小结中自动关联）`;
        }
      }
    }
    setTaskReflections(newReflections);
  }, [todayTasks, taskReflections]);

  const handleSubmit = async () => {
    setSubmitting(true);

    // Auto-link before saving
    autoLinkReflections(summary);

    // Save scores and reflections for completed tasks
    for (const task of completedTasks) {
      const score = taskScores[task.id];
      const reflection = taskReflections[task.id];
      if (score || reflection) {
        await db.tasks.update(task.id, {
          score: score ?? task.score,
          reflection: reflection ?? task.reflection,
          updatedAt: new Date(),
        });
      }
    }

    // Save skip reasons for pending tasks
    for (const task of pendingTasks) {
      const reason = taskSkipReasons[task.id];
      if (reason) {
        await db.tasks.update(task.id, {
          reflection: reason,
          status: 'skipped' as const,
          updatedAt: new Date(),
        });
      }
    }

    // Build combined summary with task info
    const taskSummaryParts: string[] = [];
    if (completedTasks.length > 0) {
      taskSummaryParts.push(`✅ 完成：${completedTasks.map((t) => t.title).join('、')}`);
    }
    if (pendingTasks.length > 0) {
      const pendingWithReasons = pendingTasks.map((t) => {
        const reason = taskSkipReasons[t.id];
        return reason ? `${t.title}（${reason}）` : t.title;
      }).join('、');
      taskSummaryParts.push(`⏭ 未完成：${pendingWithReasons}`);
    }
    const fullSummary = [summary, ...taskSummaryParts].filter(Boolean).join('\n\n');

    // Save daily summary
    const dailySummary: DailySummary = {
      id: generateId(),
      date: today,
      totalTasks: todayTasks.length,
      completedTasks: completedTasks.length,
      totalEstimatedMinutes: totalEstimated,
      totalActualMinutes: totalActual,
      summary: fullSummary,
      images,
      createdAt: new Date(),
    };
    await db.dailySummaries.put(dailySummary);

    // Save journal entry — merge with existing
    const existingEntry = await db.journalEntries.where('date').equals(today).first();
    const suggestions = generateSuggestions(mood, todayTasks, fullSummary);
    if (existingEntry) {
      const mergedContent = existingEntry.content
        ? `${existingEntry.content}\n\n---\n\n${fullSummary}`
        : fullSummary;
      await db.journalEntries.update(existingEntry.id, {
        mood,
        weather,
        content: mergedContent,
        summary: existingEntry.summary || summary || '',
        suggestions,
        images: [...new Set([...(existingEntry.images ?? []), ...images])],
        updatedAt: new Date(),
      });
    } else {
      await db.journalEntries.put({
        id: generateId(),
        date: today,
        mood,
        weather,
        content: fullSummary,
        summary: summary || '',
        suggestions,
        images,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Clear draft
    localStorage.removeItem(DRAFT_KEY);

    await fetchTasks();
    setSubmitting(false);
    setDone(true);
  };

  if (done) {
    return (
      <Modal open={open} onClose={onClose} title="今日小结已保存">
        <div className="text-center py-6 space-y-3">
          <Confetti weight="duotone" size={40} className="mx-auto text-primary" />
          <p className="text-h3 text-success">今天辛苦啦！</p>
          <p className="text-body text-text-secondary">
            完成了 {completedTasks.length}/{todayTasks.length} 个任务，累计投入 {formatTime(totalActual)}
          </p>
          {pendingTasks.length > 0 && (
            <p className="text-caption text-text-secondary">
              未完成的任务已记录原因，明天继续加油
            </p>
          )}
          <p className="text-caption text-text-secondary">已自动生成反思日记</p>
          <button className="btn-primary mt-4" onClick={onClose}>关闭</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`完成一天 — ${format(new Date(), 'M月d日 EEEE', { locale: zhCN })}`}>
      <div className="space-y-5 max-h-[70vh] overflow-y-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-surface-hover rounded-card p-3">
            <p className="text-h2 text-primary">{completedTasks.length}/{todayTasks.length}</p>
            <p className="text-small text-text-secondary">完成任务</p>
          </div>
          <div className="bg-surface-hover rounded-card p-3">
            <p className="text-h2 text-success">{formatTime(totalActual)}</p>
            <p className="text-small text-text-secondary">实际耗时</p>
          </div>
          <div className="bg-surface-hover rounded-card p-3">
            <p className="text-h2 text-warning">{pendingTasks.length}</p>
            <p className="text-small text-text-secondary">未完成</p>
          </div>
        </div>

        {/* Completed tasks */}
        {completedTasks.length > 0 && (
          <div>
            <button
              className="flex items-center gap-2 w-full text-left mb-3"
              onClick={() => setExpandedCompleted(!expandedCompleted)}
            >
              {expandedCompleted ? <CaretDown weight="bold" size={16} className="text-text-secondary" /> : <CaretUp weight="bold" size={16} className="text-text-secondary" />}
              <h4 className="text-h3">已完成任务 — 打分与反思 ({completedTasks.length})</h4>
            </button>
            {expandedCompleted && <div className="space-y-3">
              {completedTasks.map((task) => (
                <div key={task.id} className="border border-border rounded-card p-3">
                  <p className="text-body font-medium flex items-center gap-2">
                    <CheckCircle weight="duotone" size={16} className="text-success" />
                    <span className="truncate min-w-0">{task.title}</span>
                    <span className="text-small text-text-secondary font-normal flex-shrink-0">
                      {task.actualMinutes > 0 ? `实际 ${task.actualMinutes}min` : `预估 ${task.estimatedMinutes}min`}
                    </span>
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-caption text-text-secondary mr-1">评分</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} onClick={() => setTaskScores({ ...taskScores, [task.id]: star })}
                        className="transition-transform hover:scale-110">
                        <Star weight="duotone" size={18}
                          fill={star <= (taskScores[task.id] ?? 0) ? '#F59E0B' : 'none'}
                          color={star <= (taskScores[task.id] ?? 0) ? '#F59E0B' : '#CBD5E1'} />
                      </button>
                    ))}
                  </div>
                  <textarea autoComplete="off" className="input w-full mt-2 resize-none text-caption" rows={2}
                    placeholder="写一句反思：哪里做得好？哪里可以改进？"
                    value={taskReflections[task.id] ?? ''}
                    onChange={(e) => setTaskReflections({ ...taskReflections, [task.id]: e.target.value })} />
                </div>
              ))}
            </div>
            }
          </div>
        )}

        {/* Pending tasks - with skip reasons */}
        {pendingTasks.length > 0 && (
          <div>
            <button
              className="flex items-center gap-2 w-full text-left mb-3"
              onClick={() => setExpandedPending(!expandedPending)}
            >
              {expandedPending ? <CaretDown weight="bold" size={16} className="text-text-secondary" /> : <CaretUp weight="bold" size={16} className="text-text-secondary" />}
              <h4 className="text-h3">未完成任务 — 记录原因 ({pendingTasks.length})</h4>
            </button>
            {expandedPending && <div className="space-y-3">
              {pendingTasks.map((task) => (
                <div key={task.id} className="border border-border rounded-card p-3">
                  <p className="text-body font-medium flex items-center gap-2">
                    <SkipForward weight="bold" size={16} className="text-warning" />
                    <span className="truncate min-w-0">{task.title}</span>
                    <span className="text-small text-text-secondary font-normal flex-shrink-0">
                      <Clock weight="bold" size={12} className="inline mr-0.5" />{task.estimatedMinutes}min
                    </span>
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-caption text-text-secondary flex-shrink-0">未完成原因</span>
                    <select
                      className="input flex-1 text-caption"
                      value={taskSkipReasons[task.id]?.startsWith('其他') ? '其他' : taskSkipReasons[task.id] || ''}
                      onChange={(e) => {
                        if (e.target.value === '其他') {
                          setTaskSkipReasons({ ...taskSkipReasons, [task.id]: '其他：' });
                        } else {
                          setTaskSkipReasons({ ...taskSkipReasons, [task.id]: e.target.value });
                        }
                      }}
                    >
                      <option value="">选择原因（可选）</option>
                      <option value="时间不够">时间不够</option>
                      <option value="优先级调整">优先级调整</option>
                      <option value="状态不好">状态不好/精力不足</option>
                      <option value="遇到阻碍">遇到阻碍/需要帮助</option>
                      <option value="忘记做了">忘记做了</option>
                      <option value="计划有变">计划有变</option>
                      <option value="其他">其他（手动输入）</option>
                    </select>
                  </div>
                  {(taskSkipReasons[task.id]?.startsWith('其他') || taskSkipReasons[task.id]?.length) && (
                    <textarea
                      className="input w-full mt-2 resize-none text-caption"
                      rows={1}
                      placeholder="补充说明…"
                      value={taskSkipReasons[task.id]?.startsWith('其他：') ? taskSkipReasons[task.id].replace('其他：', '') : taskSkipReasons[task.id] || ''}
                      onChange={(e) => setTaskSkipReasons({ ...taskSkipReasons, [task.id]: `其他：${e.target.value}` })}
                    />
                  )}
                </div>
              ))}
            </div>
            }
          </div>
        )}

        {/* Mood */}
        <div>
          <h4 className="text-h3 mb-2">今天的心情</h4>
          <div className="flex gap-2">
            {MOODS.map((m) => (
              <button key={m.value} onClick={() => setMood(m.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-card border-2 transition ${
                  mood === m.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary-light'
                }`}>
                <m.icon size={28} weight="duotone" />
                <span className="text-small text-text-secondary">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Weather */}
        <div>
          <h4 className="text-h3 mb-2">今日天气</h4>
          <div className="flex gap-2 flex-wrap">
            {WEATHERS.map((w) => (
              <button key={w.value} onClick={() => setWeather(weather === w.value ? null : w.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-card border-2 transition ${
                  weather === w.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary-light'
                }`}>
                <w.icon size={28} weight="duotone" />
                <span className="text-small text-text-secondary">{w.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Photos */}
        <div>
          <h4 className="text-h3 mb-2">今日照片</h4>
          {/* Task images */}
          {taskImages.length > 0 && (
            <div className="mb-3">
              <p className="text-caption text-text-secondary mb-2">
                来自今日任务的截图 ({taskImages.length} 张)，点击添加到总结
              </p>
              <div className="flex gap-2 flex-wrap">
                {taskImages.map((img, i) => (
                  <div key={`${img.taskId}-${i}`} className="relative">
                    <img
                      src={img.url}
                      alt={img.title}
                      className={`w-16 h-16 object-cover rounded-lg cursor-pointer border-2 transition ${
                        images.includes(img.url) ? 'border-primary opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
                      }`}
                      onClick={() => {
                        if (images.includes(img.url)) {
                          setImages(images.filter((u) => u !== img.url));
                        } else {
                          setImages([...images, img.url]);
                        }
                      }}
                    />
                    <span className="absolute bottom-0 left-0 right-0 text-[9px] text-white bg-black/50 truncate rounded-b-lg px-0.5">
                      {img.title.substring(0, 6)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Upload */}
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-btn bg-surface-hover hover:bg-border cursor-pointer transition-colors text-body">
            <CameraPlus weight="bold" size={18} />
            添加照片
            <input autoComplete="off" type="file" accept="image/*" multiple className="hidden"
              onChange={async (e) => {
                const files = e.target.files;
                if (!files) return;
                for (const file of Array.from(files)) {
                  const dataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                  });
                  setImages((prev) => [...prev, dataUrl]);
                }
              }} />
          </label>
          {images.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {images.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt={`附件图片 ${i + 1}`} className="w-16 h-16 object-cover rounded-lg" />
                  <button
                    onClick={() => setImages(images.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 p-0.5 bg-black/50 text-white rounded-full"
                  >
                    <X weight="bold" size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overall summary */}
        <div>
          <h4 className="text-h3 mb-2">今日小结</h4>
          <textarea autoComplete="off" className="input w-full resize-none" rows={5}
            placeholder="写写今天的感受、收获或者想记住的事情...&#10;&#10;提到具体任务名称会自动关联到对应任务的反思"
            value={summary}
            onChange={(e) => setSummary(e.target.value)} />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <button className="btn-secondary" onClick={() => { saveDraft(); onClose(); }}>稍后再写</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '保存中…' : '完成一天'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function generateSuggestions(mood: Mood, tasks: Task[], summaryText: string): string[] {
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.length;
  const suggestions: string[] = [];

  if (mood === 'bad' || mood === 'terrible') {
    suggestions.push('今天状态不太好，没关系，允许自己有低谷期，明天会更好');
    suggestions.push('试试减少明天的任务量，只安排 1-2 件最重要的事');
  }
  if (completed === total && total > 0) {
    suggestions.push('全部完成任务，执行力满分！保持这个节奏');
  } else if (completed < total && total > 0) {
    const skipped = tasks.filter((t) => t.status !== 'completed');
    const timeReasons = skipped.filter((t) => t.reflection.includes('时间不够'));
    if (timeReasons.length > 0) {
      suggestions.push('部分任务因时间不够未完成，明天可以调整预估时长或减少任务量');
    }
    suggestions.push(`完成了 ${completed}/${total}，未完成的任务已记录原因，明天优先处理`);
  }
  if (tasks.some((t) => t.priority === 'urgent-important' && t.status !== 'completed')) {
    suggestions.push('有紧急重要任务未完成，建议明天第一件事处理它');
  }
  if (summaryText.length < 10) {
    suggestions.push('试着多写一些感受和反思，越具体越容易发现改进点');
  }

  if (suggestions.length === 0) {
    suggestions.push('今天虽然没有任务，但休息也是重要的一部分');
  }

  return suggestions;
}

import { useEffect, useState } from 'react';
import { useJournalStore } from '@/stores/journalStore';
import { useTaskStore } from '@/stores/taskStore';
import { db } from '@/db';
import Modal from '@/components/ui/Modal';
import GalleryPosterModal from '@/components/export/GalleryPosterModal';
import type { JournalEntry, Mood, DailySummary } from '@/db/schema';
import { BookOpen, Smile, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Edit3, Trash2, Plus, Lightbulb, Heart, Sun, LayoutGrid, CheckCircle2, Circle, SkipForward, Clock, ImagePlus, X, Download } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const MOOD_MAP: Record<Mood, { emoji: string; label: string }> = {
  great: { emoji: '😄', label: '很棒' },
  good: { emoji: '😊', label: '不错' },
  okay: { emoji: '😐', label: '一般' },
  bad: { emoji: '😔', label: '不太好' },
  terrible: { emoji: '😫', label: '很差' },
};

const WEATHER_MAP: Record<string, { emoji: string; label: string }> = {
  sunny: { emoji: '☀️', label: '晴' },
  cloudy: { emoji: '⛅', label: '多云' },
  rainy: { emoji: '🌧', label: '雨' },
  stormy: { emoji: '⛈', label: '暴风雨' },
  snowy: { emoji: '❄️', label: '雪' },
  windy: { emoji: '💨', label: '风' },
};

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 'great', emoji: '😄', label: '很棒' },
  { value: 'good', emoji: '😊', label: '不错' },
  { value: 'okay', emoji: '😐', label: '一般' },
  { value: 'bad', emoji: '😔', label: '不太好' },
  { value: 'terrible', emoji: '😫', label: '很差' },
];

const WEATHERS: { value: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'windy'; emoji: string; label: string }[] = [
  { value: 'sunny', emoji: '☀️', label: '晴' },
  { value: 'cloudy', emoji: '⛅', label: '多云' },
  { value: 'rainy', emoji: '🌧', label: '雨' },
  { value: 'stormy', emoji: '⛈', label: '暴风雨' },
  { value: 'snowy', emoji: '❄️', label: '雪' },
  { value: 'windy', emoji: '💨', label: '风' },
];

type ViewMode = 'mood' | 'daily' | 'gallery';

const today = new Date().toISOString().split('T')[0];

export default function Journal() {
  const { entries, loading, fetchEntries, upsertEntry, deleteEntry } = useJournalStore();
  const { tasks, fetchTasks } = useTaskStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [editMood, setEditMood] = useState<Mood>('good');
  const [editContent, setEditContent] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMood, setNewMood] = useState<Mood>('good');
  const [newContent, setNewContent] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [galleryMonth, setGalleryMonth] = useState<string>('all');
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [editWeather, setEditWeather] = useState<'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'windy' | null>(null);
  const [newWeather, setNewWeather] = useState<'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'windy' | null>(null);
  const [editImages, setEditImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editShowMoodWeather, setEditShowMoodWeather] = useState(false);
  const [newShowMoodWeather, setNewShowMoodWeather] = useState(false);
  const [galleryShowMood, setGalleryShowMood] = useState(true);
  const [galleryShowWeather, setGalleryShowWeather] = useState(true);
  const [galleryShowSummary, setGalleryShowSummary] = useState(true);
  const [galleryShowImages, setGalleryShowImages] = useState(true);
  const [galleryTimeRange, setGalleryTimeRange] = useState<'all' | 'this-week' | 'this-month'>('all');
  const [galleryOnlyImages, setGalleryOnlyImages] = useState(false);
  const [posterData, setPosterData] = useState<{ photos: string[]; date: string; summary: string } | null>(null);
  const [combineMode, setCombineMode] = useState(false);
  const [selectedCombineIds, setSelectedCombineIds] = useState<Set<string>>(new Set());
  const [combineEntriesData, setCombineEntriesData] = useState<Array<{
    date: string; mood: Mood; weather: string | null; summary: string; photos: string[];
  }> | null>(null);

  useEffect(() => {
    fetchEntries();
    fetchTasks();
    db.dailySummaries.toArray().then(setDailySummaries);
  }, [fetchEntries, fetchTasks]);

  const summaryByDate = dailySummaries.reduce<Record<string, DailySummary>>((acc, s) => {
    acc[s.date] = s;
    return acc;
  }, {});

  const tasksByDate = tasks.reduce<Record<string, typeof tasks>>((acc, t) => {
    if (!acc[t.dueDate]) acc[t.dueDate] = [];
    acc[t.dueDate].push(t);
    return acc;
  }, {});

  const formatTime = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;

  // Group entries by month
  const grouped = entries.reduce<Record<string, JournalEntry[]>>((acc, entry) => {
    const month = entry.date.substring(0, 7);
    if (!acc[month]) acc[month] = [];
    acc[month].push(entry);
    return acc;
  }, {});

  const handleEdit = (entry: JournalEntry) => {
    setError(null);
    setEditingEntry(entry);
    setEditMood(entry.mood);
    setEditWeather(entry.weather);
    setEditContent(entry.content);
    setEditSummary(entry.summary || '');
    setEditImages(entry.images || []);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    setSaving(true);
    setError(null);
    try {
      await upsertEntry({
        id: editingEntry.id,
        date: editingEntry.date,
        mood: editMood,
        weather: editWeather,
        content: editContent,
        summary: editSummary,
        suggestions: editingEntry.suggestions,
        images: editImages,
      });
      setEditingEntry(null);
    } catch (e) {
      setError((e as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      await upsertEntry({
        date: newDate,
        mood: newMood,
        weather: newWeather,
        content: newContent,
        summary: newSummary,
        suggestions: [],
        images: newImages,
      });
      setShowCreate(false);
      setNewContent('');
      setNewImages([]);
      setNewMood('good');
      setNewDate(new Date().toISOString().split('T')[0]);
    } catch (e) {
      setError((e as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这篇日记？')) return;
    try {
      await deleteEntry(id);
    } catch (e) {
      setError((e as Error).message || '删除失败');
    }
  };

  const openEntryPoster = (entry: JournalEntry) => {
    const s = summaryByDate[entry.date];
    const dateTasks = tasksByDate[entry.date] || [];
    const imgs = new Set<string>();
    (entry.images || []).forEach((url) => imgs.add(url));
    (s?.images || []).forEach((url) => imgs.add(url));
    dateTasks.forEach((t) => (t.images || []).forEach((url) => imgs.add(url)));
    setPosterData({
      photos: [...imgs],
      date: entry.date,
      summary: entry.summary || entry.content || '',
    });
  };

  const toggleCombineSelect = (entryId: string) => {
    setSelectedCombineIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const doCombineExport = () => {
    const selected = entries.filter((e) => selectedCombineIds.has(e.id));
    if (selected.length === 0) return;
    const data = selected.map((entry) => {
      const s = summaryByDate[entry.date];
      const dateTasks = tasksByDate[entry.date] || [];
      const imgs = new Set<string>();
      (entry.images || []).forEach((url) => imgs.add(url));
      (s?.images || []).forEach((url) => imgs.add(url));
      dateTasks.forEach((t) => (t.images || []).forEach((url) => imgs.add(url)));
      return {
        date: entry.date,
        mood: entry.mood,
        weather: entry.weather,
        summary: entry.summary || s?.summary || entry.content || '',
        photos: [...imgs],
      };
    });
    setCombineEntriesData(data);
    setCombineMode(false);
  };

  const formatMonth = (month: string) => {
    const [y, m] = month.split('-');
    return `${y}年${parseInt(m)}月`;
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-h3 flex items-center gap-2">
              <BookOpen size={22} className="text-primary" />
              反思日记
            </h3>
            <p className="text-caption text-text-secondary mt-1">
              {entries.length > 0
                ? `共 ${entries.length} 篇日记`
                : '完成一天后，可以在这里写反思日记'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-surface-hover rounded-btn p-0.5">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-3 py-1 rounded-btn text-small transition-all flex items-center gap-1 ${viewMode === 'daily' ? 'bg-primary text-white' : 'text-text-secondary'}`}
              >
                <Sun size={14} />今日
              </button>
              <button
                onClick={() => setViewMode('mood')}
                className={`px-3 py-1 rounded-btn text-small transition-all flex items-center gap-1 ${viewMode === 'mood' ? 'bg-primary text-white' : 'text-text-secondary'}`}
              >
                <Heart size={14} />心情
              </button>
              <button
                onClick={() => setViewMode('gallery')}
                className={`px-3 py-1 rounded-btn text-small transition-all flex items-center gap-1 ${viewMode === 'gallery' ? 'bg-primary text-white' : 'text-text-secondary'}`}
              >
                <LayoutGrid size={14} />画廊
              </button>
            </div>
            <button className="btn-primary flex items-center gap-1.5" onClick={() => { setError(null); setShowCreate(true); }}>
              <Plus size={18} />
              写日记
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12">
          <p className="text-text-secondary">加载中...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="card text-center py-16 space-y-4">
          <Smile size={48} className="mx-auto text-text-secondary opacity-40" />
          <div>
            <p className="text-h3 text-text-secondary mb-2">还没有日记</p>
            <p className="text-body text-text-secondary">
              每天完成所有任务后，点击「完成一天」按钮来写反思日记
            </p>
            <p className="text-caption text-text-secondary mt-1">
              或者点击右上角的「写日记」手动创建
            </p>
          </div>
        </div>
      ) : viewMode === 'gallery' ? (
        /* Gallery view */
        <>
        <div>
          {/* Toolbar: month filter + field toggles */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-small text-text-secondary flex-shrink-0">时间：</span>
              <div className="flex gap-1.5">
                {(['all', 'this-week', 'this-month'] as const).map((preset) => (
                  <button key={preset} onClick={() => setGalleryTimeRange(preset)}
                    className={`px-3 py-1 rounded-full text-small transition-all ${galleryTimeRange === preset ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary'}`}>
                    {preset === 'all' ? '全部' : preset === 'this-week' ? '本周' : '本月'}
                  </button>
                ))}
              </div>
              {(() => {
                const months = [...new Set(entries.map((e) => e.date.substring(0, 7)))].sort().reverse();
                if (months.length <= 1) return null;
                return (
                  <>
                    <span className="text-small text-text-secondary flex-shrink-0 ml-3">月份：</span>
                    <div className="flex gap-1.5 flex-wrap">
                      <button onClick={() => setGalleryMonth('all')}
                        className={`px-3 py-1 rounded-full text-small transition-all ${galleryMonth === 'all' ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary'}`}>
                        全部
                      </button>
                      {months.map((m) => (
                        <button key={m} onClick={() => setGalleryMonth(m)}
                          className={`px-3 py-1 rounded-full text-small transition-all ${galleryMonth === m ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary'}`}>
                          {m.replace('-', '年')}月
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              {combineMode ? (
                <>
                  <span className="text-small text-primary font-medium">
                    已选 {selectedCombineIds.size} 篇
                  </span>
                  <button
                    onClick={() => { setCombineMode(false); setSelectedCombineIds(new Set()); }}
                    className="px-2.5 py-1 rounded-full text-small transition-all bg-surface-hover text-text-secondary"
                  >
                    取消
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setCombineMode(true); setSelectedCombineIds(new Set()); }}
                  className="px-2.5 py-1 rounded-full text-small transition-all bg-primary text-white flex items-center gap-1"
                >
                  <Download size={14} />
                  组合导出
                </button>
              )}
              <span className="text-small text-text-secondary flex-shrink-0">显示：</span>
              <button
                onClick={() => setGalleryOnlyImages(!galleryOnlyImages)}
                className={`px-2.5 py-1 rounded-full text-small transition-all ${galleryOnlyImages ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary'}`}
              >
                🖼 仅图片
              </button>
              <button
                onClick={() => setGalleryShowMood(!galleryShowMood)}
                className={`px-2.5 py-1 rounded-full text-small transition-all ${galleryShowMood ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary'}`}
              >
                😊 心情
              </button>
              <button
                onClick={() => setGalleryShowWeather(!galleryShowWeather)}
                className={`px-2.5 py-1 rounded-full text-small transition-all ${galleryShowWeather ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary'}`}
              >
                🌤 天气
              </button>
              <button
                onClick={() => setGalleryShowSummary(!galleryShowSummary)}
                className={`px-2.5 py-1 rounded-full text-small transition-all ${galleryShowSummary ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary'}`}
              >
                摘要
              </button>
              <button
                onClick={() => setGalleryShowImages(!galleryShowImages)}
                className={`px-2.5 py-1 rounded-full text-small transition-all ${galleryShowImages ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary'}`}
              >
                🖼 图片
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {entries
            .filter((e) => {
              // Month filter
              if (galleryMonth !== 'all' && !e.date.startsWith(galleryMonth)) return false;
              // Time range filter
              if (galleryTimeRange !== 'all') {
                const today = new Date();
                let start = ''; let end = '';
                if (galleryTimeRange === 'this-week') {
                  start = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                  end = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                } else if (galleryTimeRange === 'this-month') {
                  start = format(startOfMonth(today), 'yyyy-MM-dd');
                  end = format(endOfMonth(today), 'yyyy-MM-dd');
                }
                if (e.date < start || e.date > end) return false;
              }
              // Images-only filter
              if (galleryOnlyImages) {
                const ds = summaryByDate[e.date];
                const dateTasks = tasksByDate[e.date] || [];
                const hasImgs = (e.images || []).length > 0 ||
                  (ds?.images || []).length > 0 ||
                  dateTasks.some((t) => (t.images || []).length > 0);
                if (!hasImgs) return false;
              }
              return true;
            })
            .map((entry) => {
            const mood = MOOD_MAP[entry.mood];
            const s = summaryByDate[entry.date];
            const dateTasks = tasksByDate[entry.date] || [];
            const taskImgs = dateTasks.flatMap((t) => (t.images || []).map((url) => url));
            const dsImages = s?.images || [];
            const entryImages = entry.images || [];
            const allImages = [...new Set([...entryImages, ...dsImages, ...taskImgs])];

            return <GalleryCard
              key={entry.id}
              entry={entry}
              mood={mood}
              allImages={allImages}
              showMood={galleryShowMood}
              showWeather={galleryShowWeather}
              showSummary={galleryShowSummary}
              showImages={galleryShowImages}
              combineMode={combineMode}
              isSelected={selectedCombineIds.has(entry.id)}
              onToggleSelect={() => toggleCombineSelect(entry.id)}
              onEdit={() => handleEdit(entry)}
              onPreview={(url: string) => setPreviewUrl(url)}
              onExport={() => openEntryPoster(entry)}
            />;
          })}
          </div>
        </div>

        {/* Combine mode bottom bar */}
        {combineMode && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-800 shadow-xl rounded-2xl px-6 py-3 flex items-center gap-4 border border-border">
            <span className="text-body font-medium">
              已选择 {selectedCombineIds.size} 篇日记
            </span>
            <button
              onClick={() => { setCombineMode(false); setSelectedCombineIds(new Set()); }}
              className="px-4 py-1.5 rounded-full text-small bg-surface-hover text-text-secondary"
            >
              取消
            </button>
            <button
              onClick={doCombineExport}
              disabled={selectedCombineIds.size === 0}
              className="px-5 py-1.5 rounded-full text-small bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Download size={14} />
              导出选中
            </button>
          </div>
        )}
        </>
      ) : viewMode === 'daily' ? (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([month, monthEntries]) => (
              <div key={month}>
                <h4 className="text-h3 text-text-secondary mb-3 flex items-center gap-2">
                  <Calendar size={18} />
                  {formatMonth(month)}
                </h4>
                <div className="space-y-3">
                  {monthEntries.map((entry) => {
                    const mood = MOOD_MAP[entry.mood];
                    const isExpanded = expandedId === entry.id;
                    return (
                      <div key={entry.id} className={`card hover:shadow-card-hover transition-all ${entry.date === today ? 'ring-2 ring-primary/30 bg-primary/5' : ''}`}>
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">
                              {entry.weather ? WEATHER_MAP[entry.weather]?.emoji : '📝'}
                            </span>
                            <div>
                              <p className="text-body font-medium flex items-center gap-2">
                                {format(parseISO(entry.date), 'M月d日 EEEE', { locale: zhCN })}
                                {entry.date === today && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">今天</span>
                                )}
                              </p>
                              <p className="text-caption text-text-secondary">
                                {entry.content.length > 60
                                  ? entry.content.substring(0, 60) + '...'
                                  : entry.content || '（无内容）'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.suggestions.length > 0 && (
                              <span className="text-small text-primary flex items-center gap-1">
                                <Lightbulb size={14} />
                                {entry.suggestions.length}
                              </span>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEdit(entry); }}
                              className="p-1.5 rounded hover:bg-surface-hover text-text-secondary hover:text-primary"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                              className="p-1.5 rounded hover:bg-surface-hover text-text-secondary hover:text-danger"
                            >
                              <Trash2 size={16} />
                            </button>
                            {isExpanded ? <ChevronUp size={18} className="text-text-secondary" /> : <ChevronDown size={18} className="text-text-secondary" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-border space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{mood.emoji}</span>
                              <span className="text-body font-medium">{mood.label}</span>
                              {entry.weather && (
                                <span className="text-lg">{WEATHER_MAP[entry.weather]?.emoji}</span>
                              )}
                            </div>
                            {/* Daily summary */}
                            {(entry.summary || summaryByDate[entry.date]?.summary) ? (
                              <div className="bg-primary/5 rounded-card p-3 border border-primary/10">
                                <p className="text-caption text-primary font-medium mb-1">今日小结</p>
                                <p className="text-body whitespace-pre-wrap">{entry.summary || summaryByDate[entry.date]?.summary}</p>
                              </div>
                            ) : null}
                            {/* Today's tasks */}
                            {(() => {
                              const dateTasks = tasksByDate[entry.date] || [];
                              if (dateTasks.length === 0) return null;
                              const done = dateTasks.filter((t) => t.status === 'completed').length;
                              return (
                                <div className="bg-surface-hover rounded-card p-3">
                                  <p className="text-caption text-text-secondary font-medium mb-2 flex items-center gap-1">
                                    <Clock size={13} />
                                    今日任务 ({done}/{dateTasks.length})
                                  </p>
                                  <div className="space-y-0.5">
                                    {dateTasks.map((t) => (
                                      <div key={t.id} className="flex items-center gap-2 text-small">
                                        {t.status === 'completed' ? (
                                          <CheckCircle2 size={13} className="text-success flex-shrink-0" />
                                        ) : t.status === 'skipped' ? (
                                          <SkipForward size={13} className="text-warning flex-shrink-0" />
                                        ) : (
                                          <Circle size={13} className="text-text-secondary flex-shrink-0" />
                                        )}
                                        <span className={`flex-1 truncate ${t.status === 'completed' ? 'line-through text-text-secondary' : ''}`}>
                                          {t.title}
                                        </span>
                                        <span className="text-text-secondary flex-shrink-0">{formatTime(t.estimatedMinutes)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                            <div className="bg-surface-hover rounded-card p-4">
                              <p className="text-body whitespace-pre-wrap">{entry.content || '（无内容）'}</p>
                            </div>
                            {/* Journal + Task images */}
                            {(() => {
                              const jImages = entry.images || [];
                              const dateTasks = tasksByDate[entry.date] || [];
                              const tImages = dateTasks.flatMap((t) => (t.images || []).map((url) => ({ url, title: t.title })));
                              if (jImages.length === 0 && tImages.length === 0) return null;
                              return (
                                <div>
                                  <p className="text-caption text-text-secondary font-medium mb-2">图片</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {jImages.map((img, i) => (
                                      <img key={`j-${i}`} src={img} alt="" className="w-20 h-20 object-cover rounded-lg" />
                                    ))}
                                    {tImages.map((img, i) => (
                                      <img key={`t-${i}`} src={img.url} alt={img.title} className="w-20 h-20 object-cover rounded-lg" />
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                            {entry.suggestions.length > 0 && (
                              <div>
                                <p className="text-caption font-medium text-primary mb-2 flex items-center gap-1">
                                  <Lightbulb size={14} />
                                  优化建议
                                </p>
                                <ul className="space-y-1.5">
                                  {entry.suggestions.map((s, i) => (
                                    <li key={i} className="text-caption text-text-secondary flex items-start gap-2">
                                      <span className="text-primary mt-0.5">•</span>
                                      {s}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      ) : (
        /* Mood view */
        <div className="space-y-2">
          {entries.map((entry) => {
            const mood = MOOD_MAP[entry.mood];
            const summary = summaryByDate[entry.date];
            const displayText = entry.summary || summary?.summary || entry.content || '';
            return (
              <div
                key={entry.id}
                className="card hover:shadow-card-hover cursor-pointer transition-all hover:-translate-y-0.5"
                onClick={() => handleEdit(entry)}
              >
                <div className="flex items-center gap-3">
                  {/* Mood emoji */}
                  <span className="text-2xl flex-shrink-0">{mood.emoji}</span>
                  {/* Date */}
                  <span className="text-small text-text-secondary flex-shrink-0 font-mono w-14">
                    {format(parseISO(entry.date), 'MM.dd')}
                  </span>
                  {/* Summary / content preview */}
                  <span className="text-body text-text-secondary truncate flex-1 min-w-0">
                    {displayText || '（无内容）'}
                  </span>
                  {/* Weather */}
                  {entry.weather && (
                    <span className="text-base flex-shrink-0">{WEATHER_MAP[entry.weather]?.emoji}</span>
                  )}
                  {/* Actions */}
                  <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleEdit(entry)}
                      className="p-1 rounded hover:bg-surface-hover text-text-secondary hover:text-primary"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1 rounded hover:bg-surface-hover text-text-secondary hover:text-danger"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        open={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        title={editingEntry ? format(parseISO(editingEntry.date), 'M月d日 EEEE', { locale: zhCN }) : '编辑日记'}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} className="space-y-4">
          {/* Content first — primary action */}
          <div>
            <label className="text-small font-medium text-text-secondary block mb-1">今天发生了什么？</label>
            <textarea
              className="input w-full resize-none"
              rows={7}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="记录今天的经历、感受、想法..."
            />
          </div>

          {/* Summary */}
          <div>
            <label className="text-small font-medium text-text-secondary block mb-1">一句话总结</label>
            <textarea
              className="input w-full resize-none"
              rows={2}
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              placeholder="给今天一个简单的总结..."
            />
          </div>

          {/* Images */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-small font-medium text-text-secondary">照片</label>
              {editImages.length > 0 && (
                <button type="button" className="text-small text-primary hover:underline" onClick={() => setEditImages([])}>
                  清除全部
                </button>
              )}
            </div>
            {editImages.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {editImages.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} className="w-16 h-16 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => setEditImages(editImages.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 p-0.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-surface-hover hover:bg-border cursor-pointer transition-colors text-small">
              <ImagePlus size={15} />
              添加照片
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files) return;
                  for (const file of Array.from(files)) {
                    const dataUrl = await new Promise<string>((resolve) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(reader.result as string);
                      reader.readAsDataURL(file);
                    });
                    setEditImages((prev) => [...prev, dataUrl]);
                  }
                }} />
            </label>
            {/* Task images from that date */}
            {editingEntry && (() => {
              const dateTasks = tasksByDate[editingEntry.date] || [];
              const taskImgs = dateTasks.flatMap((t) => (t.images || []).map((url) => ({ url, title: t.title })));
              if (taskImgs.length === 0) return null;
              return (
                <div className="mt-2">
                  <p className="text-caption text-text-secondary mb-1">来自当天任务的截图</p>
                  <div className="flex gap-2 flex-wrap">
                    {taskImgs.map((img, i) => (
                      <div key={i} className="relative">
                        <img
                          src={img.url} alt={img.title}
                          className={`w-14 h-14 object-cover rounded-lg cursor-pointer border-2 transition-all ${
                            editImages.includes(img.url) ? 'border-primary opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
                          }`}
                          onClick={() => {
                            if (editImages.includes(img.url)) {
                              setEditImages(editImages.filter((u) => u !== img.url));
                            } else {
                              setEditImages([...editImages, img.url]);
                            }
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Mood + Weather — collapsible */}
          <div>
            <button
              type="button"
              onClick={() => setEditShowMoodWeather(!editShowMoodWeather)}
              className="flex items-center gap-2 text-small font-medium text-text-secondary hover:text-text transition-colors"
            >
              <ChevronDown size={14} className={`transition-transform ${editShowMoodWeather ? 'rotate-180' : ''}`} />
              心情与天气（可选）
              {(editMood || editWeather) && (
                <span className="text-text-secondary font-normal">
                  — {MOOD_MAP[editMood]?.emoji} {editWeather ? WEATHER_MAP[editWeather]?.emoji : ''}
                </span>
              )}
            </button>
            {editShowMoodWeather && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-small font-medium text-text-secondary block mb-1.5">心情</label>
                  <div className="flex gap-1">
                    {MOODS.map((m) => (
                      <button type="button" key={m.value} onClick={() => setEditMood(m.value)}
                        className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border-1.5 transition-all flex-1 ${
                          editMood === m.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary-light'
                        }`}>
                        <span className="text-lg">{m.emoji}</span>
                        <span className="text-[10px] text-text-secondary">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-small font-medium text-text-secondary block mb-1.5">天气</label>
                  <div className="grid grid-cols-3 gap-1">
                    {WEATHERS.map((w) => (
                      <button type="button" key={w.value} onClick={() => setEditWeather(editWeather === w.value ? null : w.value)}
                        className={`flex items-center gap-1 p-1.5 rounded-lg border-1.5 transition-all ${
                          editWeather === w.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary-light'
                        }`}>
                        <span className="text-base">{w.emoji}</span>
                        <span className="text-[10px] text-text-secondary">{w.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-small text-danger">{error}</p>}
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button type="button" className="btn-secondary" onClick={() => setEditingEntry(null)}>取消</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Image Preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center cursor-pointer"
          onClick={() => setPreviewUrl(null)}
        >
          <img src={previewUrl} alt="预览" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}

      <GalleryPosterModal
        open={!!posterData}
        onClose={() => setPosterData(null)}
        date={posterData?.date || today}
        summary={posterData?.summary || ''}
        photos={posterData?.photos || []}
      />

      <GalleryPosterModal
        open={!!combineEntriesData}
        onClose={() => setCombineEntriesData(null)}
        date={today}
        summary=""
        photos={[]}
        combineEntries={combineEntriesData || undefined}
      />

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="写日记"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
          {/* Date */}
          <div>
            <label className="text-small font-medium text-text-secondary block mb-1">日期</label>
            <input
              type="date"
              className="input w-full"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>

          {/* Content first — primary action */}
          <div>
            <label className="text-small font-medium text-text-secondary block mb-1">今天发生了什么？</label>
            <textarea
              className="input w-full resize-none"
              rows={7}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="记录今天的经历、感受、想法..."
            />
          </div>

          {/* Summary */}
          <div>
            <label className="text-small font-medium text-text-secondary block mb-1">一句话总结</label>
            <textarea
              className="input w-full resize-none"
              rows={2}
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              placeholder="给今天一个简单的总结..."
            />
          </div>

          {/* Images */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-small font-medium text-text-secondary">照片</label>
              {newImages.length > 0 && (
                <button type="button" className="text-small text-primary hover:underline" onClick={() => setNewImages([])}>
                  清除全部
                </button>
              )}
            </div>
            {newImages.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {newImages.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} className="w-16 h-16 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => setNewImages(newImages.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 p-0.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-surface-hover hover:bg-border cursor-pointer transition-colors text-small">
              <ImagePlus size={15} />
              添加照片
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files) return;
                  for (const file of Array.from(files)) {
                    const dataUrl = await new Promise<string>((resolve) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(reader.result as string);
                      reader.readAsDataURL(file);
                    });
                    setNewImages((prev) => [...prev, dataUrl]);
                  }
                }} />
            </label>
            {/* Task images from selected date */}
            {(() => {
              const dateTasks = tasksByDate[newDate] || [];
              const taskImgs = dateTasks.flatMap((t) => (t.images || []).map((url) => ({ url, title: t.title })));
              if (taskImgs.length === 0) return null;
              return (
                <div className="mt-2">
                  <p className="text-caption text-text-secondary mb-1">来自当天任务的截图</p>
                  <div className="flex gap-2 flex-wrap">
                    {taskImgs.map((img, i) => (
                      <div key={i} className="relative">
                        <img
                          src={img.url} alt={img.title}
                          className={`w-14 h-14 object-cover rounded-lg cursor-pointer border-2 transition-all ${
                            newImages.includes(img.url) ? 'border-primary opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
                          }`}
                          onClick={() => {
                            if (newImages.includes(img.url)) {
                              setNewImages(newImages.filter((u) => u !== img.url));
                            } else {
                              setNewImages([...newImages, img.url]);
                            }
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Mood + Weather — collapsible */}
          <div>
            <button
              type="button"
              onClick={() => setNewShowMoodWeather(!newShowMoodWeather)}
              className="flex items-center gap-2 text-small font-medium text-text-secondary hover:text-text transition-colors"
            >
              <ChevronDown size={14} className={`transition-transform ${newShowMoodWeather ? 'rotate-180' : ''}`} />
              心情与天气（可选）
              {(newMood || newWeather) && (
                <span className="text-text-secondary font-normal">
                  — {MOOD_MAP[newMood]?.emoji} {newWeather ? WEATHER_MAP[newWeather]?.emoji : ''}
                </span>
              )}
            </button>
            {newShowMoodWeather && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-small font-medium text-text-secondary block mb-1.5">心情</label>
                  <div className="flex gap-1">
                    {MOODS.map((m) => (
                      <button type="button" key={m.value} onClick={() => setNewMood(m.value)}
                        className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border-1.5 transition-all flex-1 ${
                          newMood === m.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary-light'
                        }`}>
                        <span className="text-lg">{m.emoji}</span>
                        <span className="text-[10px] text-text-secondary">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-small font-medium text-text-secondary block mb-1.5">天气</label>
                  <div className="grid grid-cols-3 gap-1">
                    {WEATHERS.map((w) => (
                      <button type="button" key={w.value} onClick={() => setNewWeather(newWeather === w.value ? null : w.value)}
                        className={`flex items-center gap-1 p-1.5 rounded-lg border-1.5 transition-all ${
                          newWeather === w.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary-light'
                        }`}>
                        <span className="text-base">{w.emoji}</span>
                        <span className="text-[10px] text-text-secondary">{w.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-small text-danger">{error}</p>}
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>取消</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function GalleryCard({ entry, mood, allImages, showMood, showWeather, showSummary, showImages, combineMode, isSelected, onToggleSelect, onEdit, onPreview, onExport }: {
  entry: JournalEntry;
  mood: { emoji: string; label: string };
  allImages: string[];
  showMood: boolean;
  showWeather: boolean;
  showSummary: boolean;
  showImages: boolean;
  combineMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onPreview: (url: string) => void;
  onExport: () => void;
}) {
  const [imgIdx, setImgIdx] = useState(0);

  const hasImages = showImages && allImages.length > 0;
  const currentImg = allImages[imgIdx];

  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIdx((i) => (i === 0 ? allImages.length - 1 : i - 1));
  };
  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIdx((i) => (i === allImages.length - 1 ? 0 : i + 1));
  };

  return (
    <div
      className={`card overflow-hidden hover:shadow-card-hover cursor-pointer transition-all hover:-translate-y-0.5 flex flex-col group relative ${isSelected ? 'ring-2 ring-primary' : ''}`}
      onClick={combineMode ? onToggleSelect : onEdit}
    >
      {/* Selection checkbox in combine mode */}
      {combineMode && (
        <div className="absolute bottom-3 right-3 z-10">
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            isSelected ? 'bg-primary border-primary text-white' : 'border-white/60 bg-black/20'
          }`}>
            {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
          </div>
        </div>
      )}
      {/* Hero image with carousel */}
      {hasImages ? (
        <div className="relative -mx-6 -mt-6 mb-3 h-40 bg-surface-hover overflow-hidden group">
          <img
            src={currentImg}
            alt=""
            className="w-full h-full object-cover cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onPreview(currentImg); }}
          />
          {/* Export button — top right, visible on hover */}
          <button
            onClick={(e) => { e.stopPropagation(); onExport(); }}
            className="absolute top-1.5 right-1.5 p-1.5 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
            title="导出此日记海报"
          >
            <Download size={13} />
          </button>
          {allImages.length > 1 && (
            <>
              <button
                onClick={prevImg}
                className="absolute left-1 top-1/2 -translate-y-1/2 p-1 bg-black/30 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/50"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={nextImg}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-black/30 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/50"
              >
                <ChevronRight size={14} />
              </button>
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                {allImages.map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i === imgIdx ? 'bg-white scale-110' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Card body */}
      <div className="flex-1 space-y-1.5">
        <p className="text-small text-text-secondary font-medium">
          {format(parseISO(entry.date), 'M月d日 EEEE', { locale: zhCN })}
        </p>

        {/* Mood + Weather row */}
        {(showMood || showWeather) && (
          <div className="flex items-center gap-2">
            {showMood && <span className="text-xl">{mood.emoji}</span>}
            {showWeather && entry.weather && (
              <span className="text-base">{WEATHER_MAP[entry.weather]?.emoji}</span>
            )}
          </div>
        )}

        {/* Summary */}
        {showSummary && (entry.summary || entry.content) && (
          <p className="text-caption text-text-secondary line-clamp-3 leading-relaxed">
            {entry.summary || entry.content}
          </p>
        )}

        {/* Export button for cards without hero image — visible on hover */}
        {!hasImages && (
          <button
            onClick={(e) => { e.stopPropagation(); onExport(); }}
            className="text-small text-primary hover:underline flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Download size={12} />导出海报
          </button>
        )}
      </div>
    </div>
  );
}

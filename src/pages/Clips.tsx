import { useEffect, useState, useMemo } from 'react';
import { useClipStore } from '@/stores/clipStore';
import { useTagStore } from '@/stores/tagStore';
import { useTaskStore } from '@/stores/taskStore';
import Modal from '@/components/ui/Modal';
import ClipPosterModal from '@/components/export/ClipPosterModal';
import type { Clip } from '@/db/schema';
import { Paperclip, Plus, Trash, PencilSimple, Link, ArrowSquareOut, Clipboard, List, SquaresFour, CaretDown, CaretUp, X, BookmarkSimple, Download, Calendar, ClipboardText } from '@phosphor-icons/react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { SkeletonList } from '@/components/ui/Skeleton';
import TimeFilterBar from '@/components/ui/TimeFilterBar';

export default function Clips() {
  const { clips, loading, fetchClips, createClip, updateClip, deleteClip } = useClipStore();
  const { tags, fetchTags } = useTagStore();
  const { tasks, fetchTasks, createTask } = useTaskStore();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [urlSummary, setUrlSummary] = useState('');
  const [urlFavicon, setUrlFavicon] = useState('');
  const [urlImage, setUrlImage] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [clipNotes, setClipNotes] = useState('');
  const [relatedJournalDate, setRelatedJournalDate] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [editingClip, setEditingClip] = useState<Clip | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editRelatedJournalDate, setEditRelatedJournalDate] = useState('');
  const [editImage, setEditImage] = useState('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [galleryExpandedId, setGalleryExpandedId] = useState<string | null>(null);
  const [posterClip, setPosterClip] = useState<Clip | null>(null);

  const handleConvertToTask = async (clip: Clip) => {
    if (!confirm(`创建任务"阅读：${clip.title || clip.url}"？`)) return;
    const newTask = await createTask({
      title: `阅读：${clip.title || '剪藏链接'}`,
      description: clip.url,
      estimatedMinutes: 30,
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'not-urgent-important' as const,
      tags: clip.tags,
    });
    await updateClip(clip.id, { convertedTaskId: newTask.id });
  };
  const [clipTimeFilter, setClipTimeFilter] = useState<'today' | 'last-3-days' | 'last-7-days' | 'this-week' | 'this-month' | 'last-30-days' | 'all'>('all');

  useEffect(() => { fetchClips(); fetchTags(); fetchTasks(); }, []);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (/^https?:\/\/\S+$/.test(trimmed)) {
        setUrl(trimmed);
      } else {
        setUrl(trimmed);
      }
    } catch {
      setFetchError('无法访问剪贴板，请手动粘贴链接');
    }
  };

  const handleFetch = async () => {
    if (!url.trim()) return;
    setFetching(true);
    setFetchError('');

    const u = url.startsWith('http') ? url : 'https://' + url;

    const tryFetch = async (fetchUrl: string): Promise<string> => {
      const resp = await fetch(fetchUrl);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.text();
    };

    let html = '';

    // Try direct first, then fall back to CORS proxies
    try {
      html = await tryFetch(u);
    } catch {
      const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
        `https://corsproxy.io/?${encodeURIComponent(u)}`,
      ];
      for (const proxy of proxies) {
        try {
          html = await tryFetch(proxy);
          break;
        } catch { /* try next proxy */ }
      }
    }

    if (!html) {
      setFetchError('无法获取页面信息（网络限制），请手动填写标题和摘要');
      setFetching(false);
      return;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const title = doc.querySelector('title')?.textContent?.trim() ?? '';
      const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
      let summary = metaDesc;
      if (!summary) {
        const firstP = doc.querySelector('p')?.textContent?.trim() ?? '';
        summary = firstP.substring(0, 200);
      }
      const favicon = doc.querySelector('link[rel="icon"]')?.getAttribute('href')
        ?? doc.querySelector('link[rel="shortcut icon"]')?.getAttribute('href')
        ?? '';
      const resolvedFavicon = favicon && !favicon.startsWith('http')
        ? new URL(favicon, u).href
        : favicon;
      const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '';
      const resolvedImage = ogImage && !ogImage.startsWith('http')
        ? new URL(ogImage, u).href
        : ogImage;
      setUrlTitle(title);
      setUrlSummary(summary);
      setUrlFavicon(resolvedFavicon);
      setUrlImage(resolvedImage);
    } catch {
      setFetchError('解析页面信息失败，请手动填写');
    }
    setFetching(false);
  };

  const handleSave = async () => {
    if (!url.trim()) return;
    const trimmedUrl = url.trim();
    // Duplicate detection
    const existing = clips.find((c) => c.url === trimmedUrl);
    if (existing && !confirm(`该链接已剪藏过（${existing.title || '无标题'}），确定再次保存？`)) return;
    try {
      await createClip({
        url: trimmedUrl,
        title: urlTitle,
        summary: urlSummary,
        favicon: urlFavicon,
        image: urlImage,
        tags: selectedTags,
        notes: clipNotes,
        relatedJournalDate: relatedJournalDate || null,
      });
      setUrl(''); setUrlTitle(''); setUrlSummary(''); setUrlFavicon(''); setUrlImage('');
      setSelectedTags([]); setClipNotes(''); setRelatedJournalDate('');
    } catch (e) {
      setFetchError('保存失败：' + (e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这个剪藏？')) return;
    await deleteClip(id);
  };

  const handleUpdate = async () => {
    if (!editingClip) return;
    await updateClip(editingClip.id, {
      title: editTitle,
      notes: editNotes,
      tags: editTags,
      relatedJournalDate: editRelatedJournalDate || null,
      image: editImage,
    });
    setEditingClip(null); setGalleryExpandedId(null);
  };

  const toggleTag = (tagId: string, current: string[], setter: (v: string[]) => void) => {
    setter(current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]);
  };

  const filteredClips = (() => {
    let result = clips;

    // Time filter
    if (clipTimeFilter !== 'all') {
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      let start = ''; let end = '';
      if (clipTimeFilter === 'today') { start = todayStr; end = todayStr; }
      else if (clipTimeFilter === 'last-3-days') { start = format(subDays(now, 2), 'yyyy-MM-dd'); end = todayStr; }
      else if (clipTimeFilter === 'last-7-days') { start = format(subDays(now, 6), 'yyyy-MM-dd'); end = todayStr; }
      else if (clipTimeFilter === 'last-30-days') { start = format(subDays(now, 29), 'yyyy-MM-dd'); end = todayStr; }
      else if (clipTimeFilter === 'this-week') { start = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'); end = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'); }
      else if (clipTimeFilter === 'this-month') { start = format(startOfMonth(now), 'yyyy-MM-dd'); end = format(endOfMonth(now), 'yyyy-MM-dd'); }
      result = result.filter((c) => {
        const d = format(new Date(c.createdAt), 'yyyy-MM-dd');
        return d >= start && d <= end;
      });
    }

    // Tag filter
    if (tagFilter.length > 0) {
      result = result.filter((c) => tagFilter.some((ft) => c.tags.includes(ft)));
    }

    return result;
  })();

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  if (loading) return <div className="max-w-2xl mx-auto p-4"><SkeletonList count={5} /></div>;

  return (
    <div className="space-y-3">
      {/* Header + Add Form */}
      <div className="card card-glass">
        <h3 className="text-h3 flex items-center gap-2 mb-4">
          <Paperclip weight="duotone" size={22} className="text-primary" /> 剪藏
        </h3>

        {/* URL Input */}
        <div className="flex gap-2 mb-3">
          <input
            className="input flex-1"
            placeholder="输入或粘贴链接..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
          />
          <button className="btn-secondary flex items-center gap-1" onClick={handlePaste} title="从剪贴板粘贴">
            <Clipboard weight="bold" size={15} />
          </button>
          <button className="btn-primary flex items-center gap-1" onClick={handleFetch} disabled={fetching || !url.trim()}>
            {fetching ? '抓取中...' : '抓取'}
          </button>
        </div>
        {fetchError && <p className="text-caption text-warning mb-3">{fetchError}</p>}

        {/* Manual fields — show whenever URL is entered */}
        {url.trim() && (
          <div className="space-y-2 mb-3 p-3 bg-surface-hover rounded-card">
            <input
              className="input w-full"
              placeholder="标题"
              value={urlTitle}
              onChange={(e) => setUrlTitle(e.target.value)}
            />
            <textarea
              className="input w-full"
              rows={2}
              placeholder="摘要"
              value={urlSummary}
              onChange={(e) => setUrlSummary(e.target.value)}
            />
            <textarea
              className="input w-full"
              rows={2}
              placeholder="笔记/备注（可选）"
              value={clipNotes}
              onChange={(e) => setClipNotes(e.target.value)}
            />
            {/* Image preview */}
            {urlImage && (
              <div className="relative">
                <img src={urlImage} alt="预览" className="w-full max-h-48 object-cover rounded-lg" onError={() => setUrlImage('')} />
              </div>
            )}
            {/* Related journal date */}
            <div className="flex items-center gap-2">
              <label className="text-small text-text-secondary whitespace-nowrap">关联日记：</label>
              <input
                type="date"
                className="input"
                value={relatedJournalDate}
                onChange={(e) => setRelatedJournalDate(e.target.value)}
              />
            </div>
            {/* Tag selector */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id, selectedTags, setSelectedTags)}
                    className={`text-small px-2.5 py-0.5 rounded-full transition ${
                      selectedTags.includes(tag.id) ? 'text-white' : 'bg-surface-hover text-text-secondary hover:bg-border'
                    }`}
                    style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
            <button className="btn-primary flex items-center gap-1" onClick={handleSave}>
              <Plus weight="bold" size={14} />保存剪藏
            </button>
          </div>
        )}
      </div>

      {/* Time filter */}
      <TimeFilterBar value={clipTimeFilter} onChange={setClipTimeFilter}
        options={[
          { key: 'today' as const, label: '今日' },
          { key: 'last-3-days' as const, label: '近3天' },
          { key: 'last-7-days' as const, label: '近7天' },
          { key: 'this-week' as const, label: '本周' },
          { key: 'this-month' as const, label: '本月' },
          { key: 'last-30-days' as const, label: '近30天' },
          { key: 'all' as const, label: '全部' },
        ]}
      />

      {/* View toggle + tag filter */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-surface-hover'}`}
          ><List weight="bold" size={18} /></button>
          <button
            onClick={() => setViewMode('gallery')}
            className={`p-1.5 rounded ${viewMode === 'gallery' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-surface-hover'}`}
          ><SquaresFour weight="bold" size={18} /></button>
          {tagFilter.length > 0 && (
            <span className="text-small text-primary">已筛选 {tagFilter.length} 个标签</span>
          )}
        </div>
        {/* Tag filter chips */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.filter((t) => clips.some((c) => c.tags.includes(t.id))).map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id, tagFilter, setTagFilter)}
                className={`text-small px-2 py-0.5 rounded-full transition ${
                  tagFilter.includes(tag.id) ? 'text-white' : 'bg-surface-hover text-text-secondary hover:bg-border'
                }`}
                style={tagFilter.includes(tag.id) ? { backgroundColor: tag.color } : {}}
              >
                {tag.name}
              </button>
            ))}
            {tagFilter.length > 0 && (
              <button className="text-small px-2 py-0.5 text-text-secondary hover:text-danger" onClick={() => setTagFilter([])}>
                <X weight="bold" size={12} className="inline" /> 清除
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {filteredClips.length === 0 ? (
        <div className="card card-glass text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/5 mb-3">
            <Paperclip weight="duotone" size={32} className="text-primary opacity-40" />
          </div>
          <p className="text-h3 text-text-secondary mb-2">还没有剪藏</p>
          <p className="text-caption text-text-secondary">在上方粘贴链接，自动抓取标题和摘要</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {filteredClips.map((clip) => {
            const isExpanded = expandedId === clip.id;
            return (
              <div key={clip.id} className="card card-glass">
                <div className="flex items-start justify-between cursor-pointer" role="button" tabIndex={0}
                  onClick={() => setExpandedId(isExpanded ? null : clip.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isExpanded ? null : clip.id); } }}>
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {clip.favicon ? (
                      <img src={clip.favicon} alt="" className="w-5 h-5 rounded flex-shrink-0 mt-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <Link size={18} className="text-text-secondary flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-body font-medium truncate">{clip.title || '无标题'}</p>
                      <p className="text-caption text-text-secondary truncate flex items-center gap-1 flex-wrap">
                        <span className="truncate">{clip.url}</span>
                        {clip.tags.map((tagId) => {
                          const tag = tags.find((t) => t.id === tagId);
                          return tag ? (
                            <span key={tagId} className="text-small flex items-center gap-1 flex-shrink-0">
                              <span className="text-text-secondary">·</span>
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                              {tag.name}
                            </span>
                          ) : null;
                        })}
                        {clip.relatedJournalDate && (
                          <span className="text-small flex items-center gap-1 flex-shrink-0 text-primary cursor-pointer hover:underline"
                            onClick={(e) => { e.stopPropagation(); navigate('/journal'); }}>
                            <span className="text-text-secondary">·</span>
                            <Calendar weight="duotone" size={13} className="inline mr-0.5" />{clip.relatedJournalDate}
                          </span>
                        )}
                        {clip.convertedTaskId && (() => {
                          const linkedTask = taskMap.get(clip.convertedTaskId);
                          return linkedTask ? (
                            <span className="text-small flex items-center gap-1 flex-shrink-0 text-primary cursor-pointer hover:underline"
                              onClick={(e) => { e.stopPropagation(); navigate('/'); }}>
                              <span className="text-text-secondary">·</span>
                              <ClipboardText weight="duotone" size={13} className="inline mr-0.5" />{linkedTask.title}
                            </span>
                          ) : null;
                        })()}
                      </p>
                      {clip.summary && !isExpanded && (
                        <p className="text-caption text-text-secondary mt-0.5 truncate">{clip.summary}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
                    <button className="p-1.5 rounded hover:bg-surface-hover text-text-secondary" onClick={(e) => { e.stopPropagation(); handleConvertToTask(clip); }} title="转为任务">
                      <BookmarkSimple weight="bold" size={14} />
                    </button>
                    <a href={clip.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-surface-hover text-text-secondary" onClick={(e) => e.stopPropagation()}>
                      <ArrowSquareOut weight="bold" size={14} />
                    </a>
                    <button className="p-1.5 rounded hover:bg-surface-hover text-text-secondary" onClick={(e) => { e.stopPropagation(); setPosterClip(clip); }} title="海报">
                      <Download weight="bold" size={14} />
                    </button>
                    <button className="p-1.5 rounded hover:bg-surface-hover text-text-secondary" onClick={(e) => { e.stopPropagation(); setEditingClip(clip); setEditTitle(clip.title); setEditNotes(clip.notes); setEditTags(clip.tags); setEditRelatedJournalDate(clip.relatedJournalDate || ''); setEditImage(clip.image || ''); }}>
                      <PencilSimple weight="bold" size={14} />
                    </button>
                    <button className="p-1.5 rounded hover:bg-surface-hover text-danger" onClick={(e) => { e.stopPropagation(); handleDelete(clip.id); }}>
                      <Trash weight="bold" size={14} />
                    </button>
                    {isExpanded ? <CaretUp size={16} weight="bold" className="text-text-secondary" /> : <CaretDown size={16} weight="bold" className="text-text-secondary" />}
                  </div>
                </div>
                {/* Expanded content */}
                {isExpanded && (
                  <div className="mt-3 ml-8 space-y-2">
                    {clip.image && (
                      <img src={clip.image} alt="" className="w-full max-h-48 object-cover rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    {clip.summary && <p className="text-body text-text-secondary">{clip.summary}</p>}
                    {clip.notes && (
                      <div className="bg-surface-hover rounded-btn p-3">
                        <p className="text-caption text-text-secondary mb-1 font-medium">笔记</p>
                        <p className="text-body whitespace-pre-wrap">{clip.notes}</p>
                      </div>
                    )}
                    <p className="text-small text-text-secondary">
                      {format(new Date(clip.createdAt), 'yyyy/MM/dd HH:mm')}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredClips.map((clip) => {
            const isGalleryExpanded = galleryExpandedId === clip.id;
            return (
            <div key={clip.id} className="card card-glass hover:shadow-card-hover">
              <div className="cursor-pointer" role="button" tabIndex={0}
                onClick={() => setGalleryExpandedId(isGalleryExpanded ? null : clip.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setGalleryExpandedId(isGalleryExpanded ? null : clip.id); } }}>
                {clip.image ? (
                  <div className="-mx-5 -mt-5 mb-2 h-32 bg-surface-hover overflow-hidden rounded-t-[14px]">
                    <img src={clip.image} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                ) : null}
                <div className="flex items-start gap-2 mb-2">
                  {clip.favicon ? (
                    <img src={clip.favicon} alt="" className="w-4 h-4 rounded flex-shrink-0 mt-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <Link size={16} className="text-text-secondary flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-body font-medium truncate">{clip.title || '无标题'}</p>
                    <p className="text-small text-text-secondary truncate flex items-center gap-1 flex-wrap">
                      <span className="truncate">{clip.url.substring(0, 60)}</span>
                      {clip.tags.map((tagId) => {
                        const tag = tags.find((t) => t.id === tagId);
                        return tag ? (
                          <span key={tagId} className="text-small flex items-center gap-1 flex-shrink-0">
                            <span className="text-text-secondary">·</span>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </span>
                        ) : null;
                      })}
                      {clip.relatedJournalDate && (
                        <span className="text-small flex items-center gap-1 flex-shrink-0 text-primary cursor-pointer hover:underline"
                          onClick={(e) => { e.stopPropagation(); navigate('/journal'); }}>
                          <span className="text-text-secondary">·</span>
                          <Calendar weight="duotone" size={13} className="inline mr-0.5" />{clip.relatedJournalDate}
                        </span>
                      )}
                      {clip.convertedTaskId && (() => {
                        const linkedTask = taskMap.get(clip.convertedTaskId);
                        return linkedTask ? (
                          <span className="text-small flex items-center gap-1 flex-shrink-0 text-primary cursor-pointer hover:underline"
                            onClick={(e) => { e.stopPropagation(); navigate('/'); }}>
                            <span className="text-text-secondary">·</span>
                            <ClipboardText weight="duotone" size={13} className="inline mr-0.5" />{linkedTask.title}
                          </span>
                        ) : null;
                      })()}
                    </p>
                  </div>
                </div>
                {clip.summary && !isGalleryExpanded && <p className="text-caption text-text-secondary line-clamp-2 mb-2">{clip.summary}</p>}
                <p className="text-small text-text-secondary">
                  {format(new Date(clip.createdAt), 'MM/dd HH:mm')}
                  {isGalleryExpanded ? <CaretUp size={14} className="inline ml-1 text-text-secondary" /> : <CaretDown weight="bold" size={14} className="inline ml-1 text-text-secondary" />}
                </p>
              </div>
              {/* Gallery expanded content */}
              {isGalleryExpanded && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  {clip.summary && <p className="text-caption text-text-secondary">{clip.summary}</p>}
                  {clip.notes && (
                    <div className="bg-surface-hover rounded-btn p-2">
                      <p className="text-caption text-text-secondary mb-0.5 font-medium">笔记</p>
                      <p className="text-caption whitespace-pre-wrap">{clip.notes}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <a href={clip.url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-small flex items-center gap-1">
                      <ArrowSquareOut weight="duotone" size={12} /> 打开
                    </a>
                    <button className="btn-secondary text-small flex items-center gap-1" onClick={() => handleConvertToTask(clip)}>
                      <BookmarkSimple weight="duotone" size={12} /> 转任务
                    </button>
                    <button className="btn-secondary text-small flex items-center gap-1" onClick={() => setPosterClip(clip)}>
                      <Download weight="bold" size={12} /> 海报
                    </button>
                    <button className="btn-secondary text-small flex items-center gap-1" onClick={() => { setEditingClip(clip); setEditTitle(clip.title); setEditNotes(clip.notes); setEditTags(clip.tags); setEditRelatedJournalDate(clip.relatedJournalDate || ''); setEditImage(clip.image || ''); }}>
                      <PencilSimple weight="bold" size={12} /> 编辑
                    </button>
                    <button className="btn-secondary text-small flex items-center gap-1 text-danger" onClick={() => handleDelete(clip.id)}>
                      <Trash weight="bold" size={12} /> 删除
                    </button>
                  </div>
                </div>
              )}
            </div>
          )})}
        </div>
      )}

      {/* Clip Poster Modal */}
      <ClipPosterModal open={!!posterClip} onClose={() => setPosterClip(null)} clip={posterClip} tags={tags} />

      {/* Edit Modal */}
      <Modal open={!!editingClip} onClose={() => setEditingClip(null)} title="编辑剪藏">
        {editingClip && (
          <div className="space-y-3">
            <a href={editingClip.url} target="_blank" rel="noopener noreferrer" className="text-small text-primary flex items-center gap-1 hover:underline">
              <ArrowSquareOut weight="duotone" size={14} /> {editingClip.url}
            </a>
            <div>
              <label className="text-caption text-text-secondary">标题</label>
              <input autoComplete="off" className="input w-full mt-1" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="标题" />
            </div>
            <div>
              <label className="text-caption text-text-secondary">笔记</label>
              <textarea autoComplete="off" className="input w-full mt-1" rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="添加备注..." />
            </div>
            <div>
              <label className="text-caption text-text-secondary">图片链接</label>
              <input autoComplete="off" className="input w-full mt-1" value={editImage} onChange={(e) => setEditImage(e.target.value)} placeholder="预览图URL（可选）" />
              {editImage && <img src={editImage} alt="" className="w-full max-h-40 object-cover rounded-lg mt-2" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-caption text-text-secondary whitespace-nowrap">关联日记：</label>
              <input autoComplete="off" type="date" className="input" value={editRelatedJournalDate} onChange={(e) => setEditRelatedJournalDate(e.target.value)} />
            </div>
            {tags.length > 0 && (
              <div>
                <label className="text-caption text-text-secondary">标签</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id, editTags, setEditTags)}
                      className={`text-small px-2.5 py-0.5 rounded-full transition ${
                        editTags.includes(tag.id) ? 'text-white' : 'bg-surface-hover text-text-secondary hover:bg-border'
                      }`}
                      style={editTags.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <button className="btn-secondary flex items-center gap-1" onClick={() => handleDelete(editingClip.id)}>
                <Trash weight="bold" size={14} /> 删除
              </button>
              <button className="btn-primary" onClick={handleUpdate}>保存</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

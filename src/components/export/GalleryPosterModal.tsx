import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import Modal from '@/components/ui/Modal';
import { Download, Film, Camera, BookOpen } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Mood } from '@/db/schema';

type LayoutMode = 'single' | 'filmstrip' | 'magazine';

interface CombineEntry {
  date: string;
  mood: Mood;
  weather: string | null;
  summary: string;
  photos: string[];
}

interface GalleryPosterModalProps {
  open: boolean;
  onClose: () => void;
  photos: string[];
  date: string;
  summary?: string;
  combineEntries?: CombineEntry[];
}

const BG = {
  filmstrip: '#1a1a1a',
  single: '#0f172a',
  magazine: '#fafafa',
} as const;

type CombineTemplate = 'butter' | 'minimal' | 'vintage' | 'fresh';

export default function GalleryPosterModal({ open, onClose, photos, date, summary, combineEntries }: GalleryPosterModalProps) {
  const [layout, setLayout] = useState<LayoutMode>(photos.length === 1 ? 'single' : 'filmstrip');
  const [selected, setSelected] = useState<string[]>([...photos]);
  const [combineTemplate, setCombineTemplate] = useState<CombineTemplate>('butter');
  const posterRef = useRef<HTMLDivElement>(null);

  const togglePhoto = (url: string) => {
    if (selected.includes(url)) {
      if (selected.length > 1) setSelected(selected.filter((u) => u !== url));
    } else {
      setSelected([...selected, url]);
    }
  };

  const handleExport = async () => {
    if (!posterRef.current) return;
    const combineBgs: Record<CombineTemplate, string> = {
      butter: '#fafafa', minimal: '#ffffff', vintage: '#2a2520', fresh: '#f8f6f2',
    };
    const bg = combineEntries ? combineBgs[combineTemplate] : BG[layout];
    const canvas = await html2canvas(posterRef.current, {
      backgroundColor: bg,
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement('a');
    link.download = combineEntries ? `Memories-${combineTemplate}-${date}.png` : `Memory-${date}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Combine mode: multi-entry long-scroll poster
  if (combineEntries && combineEntries.length > 0) {
    const TEMPLATES: { key: CombineTemplate; label: string; desc: string; bg: string }[] = [
      { key: 'butter', label: '黄油相机', desc: '活泼排版', bg: '#fafafa' },
      { key: 'minimal', label: '简约杂志', desc: '留白美学', bg: '#ffffff' },
      { key: 'vintage', label: '复古胶片', desc: '温暖怀旧', bg: '#2a2520' },
      { key: 'fresh', label: '清新手账', desc: '彩色贴纸风', bg: '#f8f6f2' },
    ];
    const currentBg = TEMPLATES.find((t) => t.key === combineTemplate)?.bg || '#fafafa';

    return (
      <Modal open={open} onClose={onClose} title="导出组合海报">
        <div className="space-y-4">
          <div>
            <p className="text-caption text-text-secondary mb-2">
              共 {combineEntries.length} 篇日记 · 选择排版风格
            </p>
            <div className="flex gap-2 flex-wrap">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setCombineTemplate(t.key)}
                  className={`flex flex-col items-start gap-0.5 px-4 py-2.5 rounded-card border transition-all ${
                    combineTemplate === t.key
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-text-secondary hover:border-primary-light'
                  }`}
                >
                  <span className="text-small font-medium">{t.label}</span>
                  <span className="text-[10px] opacity-60">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-center">
            <div
              ref={posterRef}
              className="w-[375px] overflow-hidden flex flex-col"
              style={{ backgroundColor: currentBg }}
            >
              {combineTemplate === 'butter' && <CombineLayout entries={combineEntries} />}
              {combineTemplate === 'minimal' && <MinimalLayout entries={combineEntries} />}
              {combineTemplate === 'vintage' && <VintageLayout entries={combineEntries} />}
              {combineTemplate === 'fresh' && <FreshLayout entries={combineEntries} />}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button className="btn-secondary" onClick={onClose}>关闭</button>
            <button className="btn-primary flex items-center gap-2" onClick={handleExport}>
              <Download size={16} />
              下载长图
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (photos.length === 0) {
    return (
      <Modal open={open} onClose={onClose} title="导出海报">
        <p className="text-text-secondary text-center py-8">当天没有上传图片，请先在日记中添加照片</p>
      </Modal>
    );
  }

  const displayPhotos = selected.length > 0 ? selected : photos;
  const displayDate = format(parseISO(date), 'yyyy.MM.dd EEEE', { locale: zhCN });

  return (
    <Modal open={open} onClose={onClose} title="导出画廊海报">
      <div className="space-y-4">
        {/* Layout picker */}
        <div>
          <p className="text-caption text-text-secondary mb-2">排版风格</p>
          <div className="flex gap-2">
            {([
              { value: 'single' as LayoutMode, label: '单张', icon: Camera, hint: '适合1张照片' },
              { value: 'filmstrip' as LayoutMode, label: '胶片', icon: Film, hint: '电影感拼接' },
              { value: 'magazine' as LayoutMode, label: '杂志', icon: BookOpen, hint: '图文混排' },
            ]).map((m) => (
              <button
                key={m.value}
                onClick={() => setLayout(m.value)}
                className={`flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-card border transition-all ${
                  layout === m.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-text-secondary hover:border-primary-light'
                }`}
              >
                <m.icon size={18} />
                <span className="text-small">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Photo selection */}
        {photos.length > 1 && (
          <div>
            <p className="text-caption text-text-secondary mb-2">
              选择照片 ({selected.length}/{photos.length})
              <button
                onClick={() => setSelected([...photos])}
                className="text-primary hover:underline ml-3"
              >
                全选
              </button>
            </p>
            <div className="flex gap-2 flex-wrap">
              {photos.map((url, i) => {
                const isSelected = selected.includes(url);
                return (
                  <div key={i} className="relative">
                    <img
                      src={url}
                      onClick={() => togglePhoto(url)}
                      className={`w-16 h-16 object-cover rounded-lg cursor-pointer border-2 transition-all ${
                        isSelected ? 'border-primary opacity-100' : 'border-transparent opacity-40 hover:opacity-60'
                      }`}
                    />
                    {isSelected && layout === 'filmstrip' && (
                      <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center font-bold">
                        {selected.indexOf(url) + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Poster preview */}
        <div className="flex justify-center">
          <div
            ref={posterRef}
            className="w-[360px] min-h-[480px] overflow-hidden flex flex-col"
            style={{ backgroundColor: BG[layout] }}
          >
            {layout === 'single' && <SingleLayout photo={displayPhotos[0]} date={displayDate} summary={summary} />}
            {layout === 'filmstrip' && <FilmstripLayout photos={displayPhotos.slice(0, 6)} date={displayDate} summary={summary} />}
            {layout === 'magazine' && <MagazineLayout photos={displayPhotos.slice(0, 5)} date={displayDate} summary={summary} />}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <button className="btn-secondary" onClick={onClose}>关闭</button>
          <button className="btn-primary flex items-center gap-2" onClick={handleExport}>
            <Download size={16} />
            下载海报
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ========== Single Layout ========== */
function SingleLayout({ photo, date, summary }: { photo: string; date: string; summary?: string }) {
  return (
    <div className="flex flex-col h-full">
      {/* Photo — dominant */}
      <div className="h-72 overflow-hidden">
        <img src={photo} alt="" className="w-full h-full object-cover" />
      </div>
      {/* Text area */}
      <div className="flex-1 px-6 py-5 flex flex-col justify-center">
        <p className="text-white/50 text-xs tracking-widest uppercase mb-2">{date}</p>
        {summary ? (
          <p className="text-white/90 text-base leading-relaxed line-clamp-4">{summary}</p>
        ) : (
          <p className="text-white/30 text-sm italic">记录这一刻</p>
        )}
      </div>
      <div className="px-6 pb-5">
        <p className="text-white/15 text-[10px] tracking-widest">TASKTRACKER</p>
      </div>
    </div>
  );
}

/* ========== Filmstrip Layout ========== */
function FilmstripLayout({ photos, date, summary }: { photos: string[]; date: string; summary?: string }) {
  return (
    <div className="flex flex-col h-full">
      {/* Film strip */}
      <div className="px-3 pt-6 pb-2">
        {/* Top sprocket holes */}
        <div className="h-4 relative overflow-hidden mb-0">
          <div className="flex gap-[10px]">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="w-3 h-3 rounded-full bg-white/15 flex-shrink-0" />
            ))}
          </div>
        </div>
        {/* Frames */}
        <div className="flex gap-2 bg-black/40 p-2 rounded-sm" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}>
          {photos.map((url, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full aspect-[3/4] overflow-hidden rounded-sm" style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.1)' }}>
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
              <span className="text-white/30 text-[9px] font-mono">{String(i + 1).padStart(2, '0')}</span>
            </div>
          ))}
        </div>
        {/* Bottom sprocket holes */}
        <div className="h-4 relative overflow-hidden mt-0">
          <div className="flex gap-[10px]">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="w-3 h-3 rounded-full bg-white/15 flex-shrink-0" />
            ))}
          </div>
        </div>
      </div>
      {/* Caption */}
      <div className="flex-1 px-5 py-4 flex flex-col justify-end">
        <p className="text-white/60 text-xs tracking-wider mb-1">{date}</p>
        {summary && <p className="text-white/80 text-sm leading-relaxed line-clamp-3">{summary}</p>}
      </div>
      <div className="px-5 pb-4">
        <p className="text-white/15 text-[10px] tracking-widest">TASKTRACKER · MEMORIES</p>
      </div>
    </div>
  );
}

/* ========== Magazine Layout ========== */
function MagazineLayout({ photos, date, summary }: { photos: string[]; date: string; summary?: string }) {
  if (photos.length === 1) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-64 overflow-hidden">
          <img src={photos[0]} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 px-7 py-5 flex flex-col justify-center">
          <p className="text-black/40 text-xs tracking-widest mb-3">{date}</p>
          {summary && <p className="text-black/80 text-lg leading-relaxed font-serif">{summary}</p>}
        </div>
        <div className="px-7 pb-5">
          <div className="w-6 h-0.5 bg-black/20 mb-3" />
          <p className="text-black/25 text-[10px] tracking-widest">TASKTRACKER</p>
        </div>
      </div>
    );
  }

  // Multi-photo: hero + smaller grid
  const [hero, ...rest] = photos;
  return (
    <div className="flex flex-col h-full">
      {/* Hero */}
      <div className="h-52 overflow-hidden">
        <img src={hero} alt="" className="w-full h-full object-cover" />
      </div>
      {/* Smaller images row */}
      <div className="flex gap-0.5 h-24 px-0.5">
        {rest.slice(0, 4).map((url, i) => (
          <div key={i} className="flex-1 overflow-hidden">
            <img src={url} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
      {/* Text */}
      <div className="flex-1 px-7 py-4 flex flex-col justify-center">
        <p className="text-black/40 text-xs tracking-widest mb-2">{date}</p>
        {summary && <p className="text-black/80 text-sm leading-relaxed line-clamp-3">{summary}</p>}
      </div>
      <div className="px-7 pb-5">
        <p className="text-black/25 text-[10px] tracking-widest">TASKTRACKER</p>
      </div>
    </div>
  );
}

/* ========== Combine Layout (Butter Camera style) ========== */

const MOOD_C: Record<string, string> = { great: '😄', good: '😊', okay: '😐', bad: '😔', terrible: '😫' };
const WEATHER_C: Record<string, string> = { sunny: '☀️', cloudy: '⛅', rainy: '🌧', stormy: '⛈', snowy: '❄️', windy: '💨' };

function CombineLayout({ entries }: { entries: CombineEntry[] }) {
  const dates = entries.map((e) => e.date).sort();
  const dateRange = dates.length > 1
    ? `${format(parseISO(dates[0]), 'M.dd')} — ${format(parseISO(dates[dates.length - 1]), 'M.dd')}`
    : format(parseISO(dates[0]), 'yyyy.MM.dd');

  return (
    <div style={{ padding: '36px 24px 48px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '5px', color: '#bbb', marginBottom: '10px', fontWeight: 500 }}>
          记 忆 合 集
        </div>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '1px', marginBottom: '6px' }}>
          MEMORIES
        </div>
        <div style={{ fontSize: '12px', color: '#aaa', fontWeight: 400 }}>{dateRange}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '18px' }}>
          <div style={{ width: '32px', height: '1px', backgroundColor: '#ddd' }} />
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#d0d0d0' }} />
          <div style={{ width: '32px', height: '1px', backgroundColor: '#ddd' }} />
        </div>
      </div>

      {/* Entry blocks */}
      {entries.map((entry, i) => {
        const moodEmoji = MOOD_C[entry.mood] || '😊';
        const weatherEmoji = entry.weather ? WEATHER_C[entry.weather] : null;
        const hasPhotos = entry.photos.length > 0;

        return (
          <div key={i}>
            <EntryBlock
              entry={entry}
              moodEmoji={moodEmoji}
              weatherEmoji={weatherEmoji}
              index={i}
              hasPhotos={hasPhotos}
            />
            {i < entries.length - 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '32px 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e8e8e8' }} />
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#d5d5d5' }} />
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#d5d5d5' }} />
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#d5d5d5' }} />
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e8e8e8' }} />
              </div>
            )}
          </div>
        );
      })}

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '40px', paddingTop: '28px', borderTop: '1px solid #e8e8e8' }}>
        <div style={{ fontSize: '9px', letterSpacing: '4px', color: '#ccc', fontWeight: 500 }}>
          TASKTRACKER
        </div>
      </div>
    </div>
  );
}

function EntryBlock({ entry, moodEmoji, weatherEmoji, index, hasPhotos }: {
  entry: CombineEntry;
  moodEmoji: string;
  weatherEmoji: string | null;
  index: number;
  hasPhotos: boolean;
}) {
  const dateStr = format(parseISO(entry.date), 'M月d日 EEEE', { locale: zhCN });

  if (!hasPhotos) {
    return <TextBlock entry={entry} moodEmoji={moodEmoji} weatherEmoji={weatherEmoji} dateStr={dateStr} index={index} />;
  }

  // Alternate layouts for visual rhythm
  const layoutType = (['hero', 'side', 'polaroid', 'banner'] as const)[index % 4];
  switch (layoutType) {
    case 'hero': return <HeroBlock entry={entry} moodEmoji={moodEmoji} weatherEmoji={weatherEmoji} dateStr={dateStr} />;
    case 'side': return <SideBlock entry={entry} moodEmoji={moodEmoji} weatherEmoji={weatherEmoji} dateStr={dateStr} />;
    case 'polaroid': return <PolaroidBlock entry={entry} moodEmoji={moodEmoji} dateStr={dateStr} />;
    case 'banner': return <BannerBlock entry={entry} moodEmoji={moodEmoji} weatherEmoji={weatherEmoji} dateStr={dateStr} />;
    default: return <TextBlock entry={entry} moodEmoji={moodEmoji} weatherEmoji={weatherEmoji} dateStr={dateStr} index={index} />;
  }
}

/* --- Hero: full-width photo with text overlay --- */
function HeroBlock({ entry, moodEmoji, weatherEmoji, dateStr }: {
  entry: CombineEntry; moodEmoji: string; weatherEmoji: string | null; dateStr: string;
}) {
  return (
    <div>
      <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', marginBottom: '14px' }}>
        <img src={entry.photos[0]} alt="" style={{ width: '100%', height: '220px', objectFit: 'cover', display: 'block' }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)',
        }} />
        <div style={{ position: 'absolute', bottom: '14px', left: '16px', right: '16px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginBottom: '4px', letterSpacing: '0.5px' }}>
            {dateStr}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '22px' }}>{moodEmoji}</span>
            {weatherEmoji && <span style={{ fontSize: '16px' }}>{weatherEmoji}</span>}
          </div>
        </div>
      </div>
      {entry.summary && (
        <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#555', padding: '0 2px' }}>
          {entry.summary}
        </p>
      )}
    </div>
  );
}

/* --- Side: photo left, text right --- */
function SideBlock({ entry, moodEmoji, weatherEmoji, dateStr }: {
  entry: CombineEntry; moodEmoji: string; weatherEmoji: string | null; dateStr: string;
}) {
  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
      <div style={{ width: '140px', height: '170px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
        <img src={entry.photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '170px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <span style={{ fontSize: '20px' }}>{moodEmoji}</span>
          {weatherEmoji && <span style={{ fontSize: '14px' }}>{weatherEmoji}</span>}
        </div>
        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '8px', letterSpacing: '0.5px' }}>
          {dateStr}
        </div>
        {entry.summary && (
          <p style={{ fontSize: '12px', lineHeight: '1.65', color: '#666' }}>
            {entry.summary}
          </p>
        )}
      </div>
    </div>
  );
}

/* --- Polaroid: photo with white border, slightly tilted --- */
function PolaroidBlock({ entry, moodEmoji, dateStr }: {
  entry: CombineEntry; moodEmoji: string; dateStr: string;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        display: 'inline-block',
        backgroundColor: '#fff',
        padding: '8px 8px 28px 8px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        transform: 'rotate(-2deg)',
        borderRadius: '2px',
        marginBottom: '14px',
      }}>
        <img
          src={entry.photos[0]}
          alt=""
          style={{ width: '220px', height: '180px', objectFit: 'cover', display: 'block' }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px' }}>{moodEmoji}</span>
        <span style={{ fontSize: '11px', color: '#999' }}>{dateStr}</span>
      </div>
      {entry.summary && (
        <p style={{ fontSize: '12px', lineHeight: '1.65', color: '#777', marginTop: '8px', maxWidth: '260px', margin: '8px auto 0' }}>
          {entry.summary}
        </p>
      )}
    </div>
  );
}

/* --- Banner: horizontal photo strip with text below --- */
function BannerBlock({ entry, moodEmoji, weatherEmoji, dateStr }: {
  entry: CombineEntry; moodEmoji: string; weatherEmoji: string | null; dateStr: string;
}) {
  const extraPhotos = entry.photos.slice(1, 4);
  return (
    <div>
      <div style={{ borderRadius: '8px', overflow: 'hidden', marginBottom: '14px' }}>
        <img src={entry.photos[0]} alt="" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} />
      </div>
      {extraPhotos.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
          {extraPhotos.map((url, i) => (
            <div key={i} style={{ flex: 1, height: '60px', borderRadius: '4px', overflow: 'hidden' }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <span style={{ fontSize: '18px' }}>{moodEmoji}</span>
        {weatherEmoji && <span style={{ fontSize: '14px' }}>{weatherEmoji}</span>}
        <span style={{ fontSize: '11px', color: '#aaa' }}>{dateStr}</span>
      </div>
      {entry.summary && (
        <p style={{ fontSize: '12px', lineHeight: '1.65', color: '#666' }}>
          {entry.summary}
        </p>
      )}
    </div>
  );
}

/* --- Text-only: date + mood + summary on accent bar --- */
function TextBlock({ entry, moodEmoji, weatherEmoji, dateStr, index }: {
  entry: CombineEntry; moodEmoji: string; weatherEmoji: string | null; dateStr: string; index: number;
}) {
  const colors = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];
  const accent = colors[index % colors.length];
  return (
    <div style={{ display: 'flex', gap: '14px' }}>
      <div style={{ width: '3px', borderRadius: '2px', backgroundColor: accent, flexShrink: 0, alignSelf: 'stretch' }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontSize: '22px' }}>{moodEmoji}</span>
          {weatherEmoji && <span style={{ fontSize: '15px' }}>{weatherEmoji}</span>}
          <span style={{ fontSize: '11px', color: '#999', fontWeight: 500 }}>{dateStr}</span>
        </div>
        {entry.summary ? (
          <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#555' }}>
            {entry.summary}
          </p>
        ) : (
          <p style={{ fontSize: '12px', color: '#ccc', fontStyle: 'italic' }}>这一天没有留下文字</p>
        )}
      </div>
    </div>
  );
}

/* ========== Minimal Magazine Layout ========== */

function MinimalLayout({ entries }: { entries: CombineEntry[] }) {
  const dates = entries.map((e) => e.date).sort();
  const dateRange = dates.length > 1
    ? `${format(parseISO(dates[0]), 'M.dd')} — ${format(parseISO(dates[dates.length - 1]), 'M.dd')}`
    : format(parseISO(dates[0]), 'yyyy.MM.dd');

  return (
    <div style={{ padding: '40px 28px 48px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ marginBottom: '44px' }}>
        <div style={{ fontSize: '28px', fontWeight: 300, color: '#111', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
          记忆<br />碎片集
        </div>
        <div style={{ width: '20px', height: '1px', backgroundColor: '#111', margin: '16px 0 10px' }} />
        <div style={{ fontSize: '11px', color: '#999', letterSpacing: '1px' }}>{dateRange}</div>
      </div>
      {entries.map((entry, i) => {
        const dateStr = format(parseISO(entry.date), 'yyyy.MM.dd EEEE', { locale: zhCN });
        const moodEmoji = MOOD_C[entry.mood] || '😊';
        const weatherEmoji = entry.weather ? WEATHER_C[entry.weather] : null;
        return (
          <div key={i} style={{ marginBottom: i < entries.length - 1 ? '44px' : '0' }}>
            {entry.photos.length > 0 && (
              <div style={{ marginBottom: '16px', borderRadius: '2px', overflow: 'hidden' }}>
                <img src={entry.photos[0]} alt="" style={{ width: '100%', height: i % 2 === 0 ? '240px' : '180px', objectFit: 'cover', display: 'block' }} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '16px' }}>{moodEmoji}</span>
              {weatherEmoji && <span style={{ fontSize: '13px' }}>{weatherEmoji}</span>}
              <span style={{ fontSize: '10px', color: '#bbb', letterSpacing: '0.5px' }}>{dateStr}</span>
            </div>
            {entry.summary && (
              <p style={{ fontSize: '13px', lineHeight: '1.75', color: '#444' }}>{entry.summary}</p>
            )}
            {i < entries.length - 1 && (
              <div style={{ width: '100%', height: '1px', backgroundColor: '#eee', marginTop: '44px' }} />
            )}
          </div>
        );
      })}
      <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #eee' }}>
        <div style={{ fontSize: '9px', letterSpacing: '4px', color: '#ccc' }}>TASKTRACKER</div>
      </div>
    </div>
  );
}

/* ========== Vintage Film Layout ========== */

function VintageLayout({ entries }: { entries: CombineEntry[] }) {
  const dates = entries.map((e) => e.date).sort();
  const dateRange = dates.length > 1
    ? `${format(parseISO(dates[0]), 'M.dd')} — ${format(parseISO(dates[dates.length - 1]), 'M.dd')}`
    : format(parseISO(dates[0]), 'yyyy.MM.dd');

  return (
    <div style={{ padding: '32px 20px 44px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '36px', paddingBottom: '24px', borderBottom: '1px solid rgba(212,167,116,0.3)' }}>
        <div style={{ fontSize: '9px', letterSpacing: '6px', color: '#d4a574', marginBottom: '10px' }}>
          DEVELOPED MEMORIES
        </div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: '#e8d5c4', letterSpacing: '2px', marginBottom: '6px' }}>
          胶片记忆
        </div>
        <div style={{ fontSize: '11px', color: '#8a7a6a' }}>{dateRange}</div>
      </div>

      {entries.map((entry, i) => {
        const dateStr = format(parseISO(entry.date), 'MM.dd EEEE', { locale: zhCN });
        const moodEmoji = MOOD_C[entry.mood] || '😊';
        const weatherEmoji = entry.weather ? WEATHER_C[entry.weather] : null;
        return (
          <div key={i} style={{ marginBottom: i < entries.length - 1 ? '36px' : '0' }}>
            {entry.photos.length > 0 && (
              <div style={{
                padding: '6px',
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: '2px',
                border: '1px solid rgba(255,255,255,0.06)',
                marginBottom: '14px',
              }}>
                <img src={entry.photos[0]} alt="" style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>{moodEmoji}</span>
              {weatherEmoji && <span style={{ fontSize: '14px' }}>{weatherEmoji}</span>}
              <span style={{ fontSize: '10px', color: '#8a7a6a', letterSpacing: '0.5px' }}>{dateStr}</span>
            </div>
            {entry.summary && (
              <p style={{ fontSize: '12px', lineHeight: '1.7', color: '#b8a898' }}>{entry.summary}</p>
            )}
            {i < entries.length - 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '36px' }}>
                <div style={{ width: '20px', height: '1px', backgroundColor: 'rgba(212,167,116,0.2)' }} />
                <div style={{ width: '3px', height: '3px', backgroundColor: '#d4a574', transform: 'rotate(45deg)' }} />
                <div style={{ width: '20px', height: '1px', backgroundColor: 'rgba(212,167,116,0.2)' }} />
              </div>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid rgba(212,167,116,0.2)', textAlign: 'center' }}>
        <div style={{ fontSize: '9px', letterSpacing: '5px', color: '#6a5a4a' }}>TASKTRACKER · FILM</div>
      </div>
    </div>
  );
}

/* ========== Fresh Journal Layout ========== */

function FreshLayout({ entries }: { entries: CombineEntry[] }) {
  const dates = entries.map((e) => e.date).sort();
  const dateRange = dates.length > 1
    ? `${format(parseISO(dates[0]), 'M.dd')} — ${format(parseISO(dates[dates.length - 1]), 'M.dd')}`
    : format(parseISO(dates[0]), 'yyyy.MM.dd');
  const accents = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7', '#A8E6CF', '#FF8A80'];

  return (
    <div style={{ padding: '28px 22px 44px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Sticker header */}
      <div style={{ textAlign: 'center', marginBottom: '34px' }}>
        <div style={{
          display: 'inline-block',
          backgroundColor: accents[0],
          color: '#fff',
          padding: '6px 16px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '1px',
          marginBottom: '12px',
          transform: 'rotate(-1deg)',
          boxShadow: '0 2px 8px rgba(255,107,107,0.2)',
        }}>
          记 忆 手 账
        </div>
        <div style={{ fontSize: '11px', color: '#bbb' }}>{dateRange}</div>
      </div>

      {entries.map((entry, i) => {
        const dateStr = format(parseISO(entry.date), 'M.dd', { locale: zhCN });
        const dayOfWeek = format(parseISO(entry.date), 'EEE', { locale: zhCN });
        const moodEmoji = MOOD_C[entry.mood] || '😊';
        const weatherEmoji = entry.weather ? WEATHER_C[entry.weather] : null;
        const accent = accents[i % accents.length];
        const hasPhotos = entry.photos.length > 0;

        return (
          <div key={i} style={{
            backgroundColor: '#fff',
            borderRadius: '14px',
            padding: '18px',
            marginBottom: i < entries.length - 1 ? '18px' : '0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            position: 'relative',
          }}>
            {/* Tape decoration */}
            <div style={{
              position: 'absolute',
              top: '-8px',
              left: '50%',
              transform: `translateX(-50%) rotate(${i % 2 === 0 ? '-2deg' : '3deg'})`,
              width: '48px',
              height: '16px',
              backgroundColor: 'rgba(255,255,255,0.7)',
              borderRadius: '2px',
              border: '1px dashed #e0e0e0',
            }} />

            {/* Date badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: '40px', height: '40px',
                borderRadius: '50%',
                backgroundColor: accent,
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 700,
                lineHeight: 1,
                flexShrink: 0,
              }}>
                <span>{dateStr}</span>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#555', fontWeight: 500 }}>{dayOfWeek}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '16px' }}>{moodEmoji}</span>
                  {weatherEmoji && <span style={{ fontSize: '12px' }}>{weatherEmoji}</span>}
                </div>
              </div>
            </div>

            {hasPhotos && (
              <div style={{
                display: 'flex',
                gap: '6px',
                marginBottom: '12px',
              }}>
                <div style={{ flex: 1, height: '120px', borderRadius: '10px', overflow: 'hidden' }}>
                  <img src={entry.photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                {entry.photos.length > 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '80px' }}>
                    {entry.photos.slice(1, 3).map((url, j) => (
                      <div key={j} style={{ flex: 1, borderRadius: '8px', overflow: 'hidden' }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {entry.summary && (
              <p style={{ fontSize: '12px', lineHeight: '1.65', color: '#777' }}>{entry.summary}</p>
            )}

            {/* Washi tape accent at bottom */}
            <div style={{
              width: '60px',
              height: '3px',
              borderRadius: '2px',
              backgroundColor: accent,
              opacity: 0.3,
              marginTop: '12px',
            }} />
          </div>
        );
      })}

      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '9px', letterSpacing: '4px', color: '#ddd' }}>TASKTRACKER</div>
      </div>
    </div>
  );
}

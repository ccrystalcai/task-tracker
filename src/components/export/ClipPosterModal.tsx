import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import Modal from '@/components/ui/Modal';
import { Download, SquaresFour } from '@phosphor-icons/react';
import { format } from 'date-fns';
import type { Clip } from '@/db/schema';

const BG_COLORS = ['#1e293b', '#0f172a', '#1e3a5f', '#374151', '#3b0764', '#450a0a', '#064e3b', '#faf5ff', '#fefce8', '#f0fdf4'];
const ACCENT_COLORS = ['#0D9488', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

interface Props {
  open: boolean;
  onClose: () => void;
  clip: Clip | null;
  tags?: { id: string; name: string; color: string }[];
}

export default function ClipPosterModal({ open, onClose, clip, tags = [] }: Props) {
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [accentColor, setAccentColor] = useState(ACCENT_COLORS[0]);
  const posterRef = useRef<HTMLDivElement>(null);

  if (!clip) return null;

  const isDark = !bgColor.startsWith('#f');

  const handleExport = async () => {
    if (!posterRef.current) return;
    const canvas = await html2canvas(posterRef.current, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement('a');
    link.download = `clip-${clip.id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const clipTags = tags.filter((t) => clip.tags.includes(t.id));

  return (
    <Modal open={open} onClose={onClose} title="知识卡片海报">
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-small text-text-secondary">背景：</span>
            {BG_COLORS.map((c) => (
              <button key={c} onClick={() => setBgColor(c)}
                className="w-6 h-6 rounded-full border-2 transition"
                style={{ backgroundColor: c, borderColor: bgColor === c ? accentColor : 'transparent' }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-small text-text-secondary">强调色：</span>
            {ACCENT_COLORS.map((c) => (
              <button key={c} onClick={() => setAccentColor(c)}
                className="w-5 h-5 rounded-full border-2 transition"
                style={{ backgroundColor: c, borderColor: accentColor === c ? '#fff' : 'transparent' }}
              />
            ))}
          </div>
        </div>

        {/* Poster preview */}
        <div ref={posterRef} className="rounded-xl overflow-hidden" style={{ backgroundColor: bgColor, width: 375, minHeight: 500 }}>
          <div className="p-8 flex flex-col h-full" style={{ color: isDark ? '#f1f5f9' : '#1e293b' }}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
              {clip.favicon && <img src={clip.favicon} alt="" className="w-5 h-5 rounded" />}
              <span className="text-small opacity-60" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                {format(new Date(clip.createdAt), 'yyyy/MM/dd')}
              </span>
            </div>

            {/* Image */}
            {clip.image && (
              <div className="-mx-8 -mt-8 mb-6">
                <img src={clip.image} alt="" className="w-full h-48 object-cover" />
              </div>
            )}

            {/* Title */}
            <h2 className="text-xl font-bold mb-3 leading-snug" style={{ color: accentColor }}>
              {clip.title || '无标题'}
            </h2>

            {/* URL */}
            <p className="text-small mb-4 opacity-50 truncate" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
              {clip.url}
            </p>

            {/* Summary */}
            {clip.summary && (
              <div className="mb-5 p-4 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }}>
                <p className="text-body leading-relaxed opacity-90">{clip.summary}</p>
              </div>
            )}

            {/* Notes */}
            {clip.notes && (
              <div className="mb-5">
                <p className="text-small font-medium mb-1" style={{ color: accentColor }}>笔记</p>
                <p className="text-body leading-relaxed opacity-80 whitespace-pre-wrap">{clip.notes}</p>
              </div>
            )}

            {/* Tags */}
            {clipTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-auto pt-4">
                {clipTags.map((tag) => (
                  <span key={tag.id} className="px-3 py-1 rounded-full text-small font-medium"
                    style={{ backgroundColor: tag.color + '30', color: tag.color, border: `1px solid ${tag.color}40` }}>
                    #{tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* Footer decoration */}
            <div className="mt-6 pt-4 border-t flex items-center justify-between" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
              <div className="flex items-center gap-2">
                <SquaresFour weight="duotone" size={14} style={{ color: accentColor }} />
                <span className="text-small opacity-50">via 小懒同学 知识卡片</span>
              </div>
              <span className="text-small opacity-30">{clip.id.slice(0, 6)}</span>
            </div>
          </div>
        </div>

        <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={handleExport}>
          <Download weight="bold" size={16} /> 导出海报
        </button>
      </div>
    </Modal>
  );
}

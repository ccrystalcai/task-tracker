import { useState, useRef, useMemo } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import html2canvas from 'html2canvas';
import Modal from '@/components/ui/Modal';
import { Download, LayoutGrid, Images, Album } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const BG_COLORS = ['#1e293b', '#0f172a', '#1e3a5f', '#374151', '#3b0764', '#450a0a', '#064e3b', '#faf5ff', '#fefce8', '#f0fdf4'];

type LayoutMode = 'polaroid' | 'grid9' | 'collage';

interface PosterModalProps {
  open: boolean;
  onClose: () => void;
  date?: string;
}

export default function PosterModal({ open, onClose, date: propDate }: PosterModalProps) {
  const { tasks } = useTaskStore();
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [layout, setLayout] = useState<LayoutMode>('polaroid');

  const posterRef = useRef<HTMLDivElement>(null);

  const date = propDate || new Date().toISOString().split('T')[0];

  const dateTasks = useMemo(() => tasks.filter((t) => t.dueDate === date), [tasks, date]);
  const completed = dateTasks.filter((t) => t.status === 'completed').length;
  const total = dateTasks.length;

  const allPhotos = useMemo(() => {
    const photos: string[] = [];
    dateTasks.forEach((t) => {
      (t.images || []).forEach((url) => photos.push(url));
    });
    return photos;
  }, [dateTasks]);

  const initialized = useRef(false);
  if (!initialized.current && selectedPhotos.length === 0 && allPhotos.length > 0) {
    initialized.current = true;
    setSelectedPhotos([...allPhotos]);
  }
  // Reset when date changes
  const [lastDate, setLastDate] = useState(date);
  if (date !== lastDate) {
    setLastDate(date);
    setSelectedPhotos([...allPhotos]);
    initialized.current = false;
  }

  const handleExport = async () => {
    if (!posterRef.current) return;
    const canvas = await html2canvas(posterRef.current, {
      backgroundColor: bgColor,
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement('a');
    link.download = `TaskTracker-${date}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const isDark = !bgColor.startsWith('#f');

  return (
    <Modal open={open} onClose={onClose} title="导出海报">
      <div className="space-y-4">
        {/* Layout mode */}
        <div>
          <p className="text-caption text-text-secondary mb-2">布局模式</p>
          <div className="flex gap-2">
            {([
              { value: 'polaroid' as LayoutMode, label: '拍立得', icon: Album },
              { value: 'grid9' as LayoutMode, label: '九宫格', icon: LayoutGrid },
              { value: 'collage' as LayoutMode, label: '拼贴', icon: Images },
            ]).map((m) => (
              <button
                key={m.value}
                onClick={() => setLayout(m.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-small transition-all ${
                  layout === m.value ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary'
                }`}
              >
                <m.icon size={14} />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Background color */}
        <div>
          <p className="text-caption text-text-secondary mb-2">背景色</p>
          <div className="flex gap-2 flex-wrap">
            {BG_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setBgColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  bgColor === c ? 'border-primary scale-110 ring-1 ring-primary' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Photo selection */}
        {allPhotos.length > 0 && (
          <div>
            <p className="text-caption text-text-secondary mb-2">选择照片 ({selectedPhotos.length} 张)</p>
            <div className="flex gap-2 flex-wrap max-h-24 overflow-y-auto">
              {allPhotos.map((url, i) => {
                const isSelected = selectedPhotos.includes(url);
                return (
                  <div key={i} className="relative">
                    <img
                      src={url}
                      className={`w-14 h-14 object-cover rounded-lg cursor-pointer border-2 transition-all ${
                        isSelected ? 'border-primary opacity-100' : 'border-transparent opacity-40 hover:opacity-70'
                      }`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedPhotos(selectedPhotos.filter((u) => u !== url));
                        } else {
                          setSelectedPhotos([...selectedPhotos, url]);
                        }
                      }}
                    />
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
            className="w-[340px] min-h-[480px] rounded-xl overflow-hidden flex flex-col"
            style={{ backgroundColor: bgColor }}
          >
            {/* Header with hero photo */}
            {selectedPhotos.length > 0 ? (
              <div className="h-44 overflow-hidden relative">
                <img src={selectedPhotos[0]} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-5">
                  <p className="text-white/80" style={{ fontSize: '11px' }}>
                    {format(parseISO(date), 'EEEE', { locale: zhCN })}
                  </p>
                  <p className="text-white text-2xl font-bold">
                    {format(parseISO(date), 'M月d日', { locale: zhCN })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-5 pt-5 pb-2">
                <p className={isDark ? 'text-white/60' : 'text-text-secondary'} style={{ fontSize: '12px' }}>
                  {format(parseISO(date), 'EEEE', { locale: zhCN })}
                </p>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-text'}`}>
                  {format(parseISO(date), 'M月d日', { locale: zhCN })}
                </p>
              </div>
            )}

            {/* Stats */}
            {total > 0 && (
              <div className="px-5 py-2 flex gap-4">
                <div className="text-center">
                  <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-text'}`}>{completed}/{total}</p>
                  <p className={isDark ? 'text-white/40' : 'text-text-secondary'} style={{ fontSize: '10px' }}>任务完成</p>
                </div>
              </div>
            )}

            {/* Layout: Polaroid */}
            {layout === 'polaroid' && selectedPhotos.length > 0 && (
              <div className="px-4 py-3 flex flex-wrap justify-center gap-2">
                {selectedPhotos.slice(0, 6).map((url, i) => {
                  const rotations = [-6, 3, -3, 5, -2, 2];
                  return (
                    <div
                      key={i}
                      className="bg-white shadow-md"
                      style={{
                        width: '100px',
                        padding: '5px 5px 16px 5px',
                        transform: `rotate(${rotations[i % rotations.length]}deg)`,
                        borderRadius: '2px',
                      }}
                    >
                      <img src={url} alt="" className="w-full h-24 object-cover" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Layout: 9-grid */}
            {layout === 'grid9' && selectedPhotos.length > 0 && (
              <div className="px-4 py-3">
                <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
                  {Array.from({ length: 9 }).map((_, i) => {
                    const url = selectedPhotos[i % selectedPhotos.length];
                    return url ? (
                      <img key={i} src={url} alt="" className="w-full aspect-square object-cover" />
                    ) : (
                      <div key={i} className="w-full aspect-square bg-white/10" />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Layout: Collage */}
            {layout === 'collage' && selectedPhotos.length > 0 && (
              <div className="px-4 py-3 relative" style={{ height: '220px' }}>
                {selectedPhotos.slice(0, 5).map((url, i) => {
                  const positions = [
                    { top: 0, left: 0, w: 160, h: 120, rot: -2 },
                    { top: 10, left: 130, w: 130, h: 90, rot: 3 },
                    { top: 90, left: 10, w: 100, h: 100, rot: -4 },
                    { top: 80, left: 100, w: 140, h: 85, rot: 1 },
                    { top: 150, left: 60, w: 120, h: 70, rot: -1 },
                  ];
                  const p = positions[i] || positions[0];
                  return (
                    <div
                      key={i}
                      className="absolute border-2 border-white/80 shadow-lg rounded overflow-hidden"
                      style={{
                        top: p.top, left: p.left, width: p.w, height: p.h,
                        transform: `rotate(${p.rot}deg)`,
                      }}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Task list */}
            {total > 0 && (
              <div className="px-5 py-3 flex-1">
                {dateTasks.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">
                      {t.status === 'completed' ? '✅' : t.status === 'skipped' ? '⏭️' : '⬜'}
                    </span>
                    <span className={`text-sm truncate ${t.status === 'completed' ? 'line-through opacity-50' : ''} ${isDark ? 'text-white/70' : 'text-text-secondary'}`}>
                      {t.title}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="px-5 pb-4 pt-2">
              <p className={isDark ? 'text-white/20' : 'text-text-secondary'} style={{ fontSize: '10px', textAlign: 'center' }}>
                TaskTracker
              </p>
            </div>
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

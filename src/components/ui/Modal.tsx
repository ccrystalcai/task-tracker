import { useEffect } from 'react';
import { X } from '@phosphor-icons/react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);

    const scrollY = window.scrollY;
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    if (scrollbarW > 0) document.body.style.paddingRight = `${scrollbarW}px`;

    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.paddingRight = '';
      window.scrollTo(0, scrollY);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" role="presentation" onClick={onClose} onTouchMove={(e) => e.preventDefault()} />

      {/* Sheet / Modal panel */}
      <div className="relative bg-surface w-full md:max-w-lg md:mx-4 md:rounded-2xl rounded-t-2xl max-h-[85vh] md:max-h-[90vh] overflow-y-auto p-5 md:p-6 animate-[slideUp_0.25s_ease-out] md:animate-[fadeInUp_0.2s_ease-out] shadow-card-lg overscroll-contain">

        {/* Drag handle — mobile only */}
        <div className="flex justify-center mb-3 md:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-h3">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover" aria-label="关闭">
            <X weight="bold" size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

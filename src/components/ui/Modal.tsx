import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-card-lg w-full max-w-lg mx-4 p-6 animate-[fadeInUp_0.2s_ease-out]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-h3">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

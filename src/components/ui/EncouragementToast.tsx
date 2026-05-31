import { useEffect, useState } from 'react';
import { X, Confetti, Trophy, TrendUp } from '@phosphor-icons/react';

interface EncouragementToastProps {
  message: string;
  type?: 'praise' | 'encourage' | 'streak';
  autoClose?: number;
  onClose: () => void;
}

const TOAST_ICONS = {
  praise: Confetti,
  streak: Trophy,
  encourage: TrendUp,
} as const;

export default function EncouragementToast({ message, type = 'encourage', autoClose = 5000, onClose }: EncouragementToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    if (autoClose > 0) {
      const timer = setTimeout(() => handleClose(), autoClose);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const bgColor = type === 'praise' ? 'bg-success' : type === 'streak' ? 'bg-primary' : 'bg-warning';
  const Icon = TOAST_ICONS[type];

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition duration-300 ${
      visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
    }`}>
      <div className={`${bgColor} text-white px-6 py-4 rounded-card shadow-lg flex items-center gap-4 max-w-md`}
        style={{ animation: 'slideUp 0.4s ease-out' }}>
        <Icon size={28} />
        <p className="text-body flex-1">{message}</p>
        <button onClick={handleClose} className="text-white/70 hover:text-white" aria-label="关闭">
          <X weight="bold" size={18} />
        </button>
      </div>
    </div>
  );
}

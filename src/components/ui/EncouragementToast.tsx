import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface EncouragementToastProps {
  message: string;
  type?: 'praise' | 'encourage' | 'streak';
  autoClose?: number;
  onClose: () => void;
}

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
  const emoji = type === 'praise' ? '🎉' : type === 'streak' ? '🏆' : '💪';

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
      visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
    }`}>
      <div className={`${bgColor} text-white px-6 py-4 rounded-card shadow-lg flex items-center gap-4 max-w-md`}
        style={{ animation: 'slideUp 0.4s ease-out' }}>
        <span className="text-2xl">{emoji}</span>
        <p className="text-body flex-1">{message}</p>
        <button onClick={handleClose} className="text-white/70 hover:text-white">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Trophy } from '@phosphor-icons/react';

interface Props {
  message: string;
  onDone: () => void;
}

export default function AchievementToast({ message, onDone }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 400);
    }, 3500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className={`fixed top-4 inset-x-4 z-[70] flex justify-center transition duration-400 ${visible ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0'}`}>
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl px-5 py-3 shadow-xl shadow-amber-500/25 flex items-center gap-3 max-w-sm">
        <Trophy weight="duotone" size={22} className="flex-shrink-0" />
        <p className="text-body font-medium">{message}</p>
      </div>
    </div>
  );
}

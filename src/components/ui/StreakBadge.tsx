import { useEffect, useState } from 'react';
import { calculateStreak, getStreakMessage, STREAK_MILESTONES } from '@/utils/motivation';
import { Flame } from '@phosphor-icons/react';

const STREAK_COLORS: Record<string, { bg: string; text: string }> = {
  '0': { bg: '#9CA3AF15', text: '#9CA3AF' },
  '1': { bg: '#6366F115', text: '#6366F1' },
  '2': { bg: '#10B98115', text: '#10B981' },
  '3': { bg: '#8B5CF615', text: '#8B5CF6' },
  '4': { bg: '#F59E0B15', text: '#F59E0B' },
};

function getStreakLevel(streak: number): string {
  if (streak >= 30) return '4';
  if (streak >= 14) return '3';
  if (streak >= 7) return '2';
  if (streak >= 3) return '1';
  return '0';
}

const MILESTONES = Object.keys(STREAK_MILESTONES).map(Number).sort((a, b) => a - b);

interface Props {
  onMilestone?: (streak: number, message: string) => void;
}

export default function StreakBadge({ onMilestone }: Props) {
  const [streak, setStreak] = useState(0);
  const [lastMilestone, setLastMilestone] = useState(0);

  useEffect(() => {
    calculateStreak().then((s) => {
      setStreak(s);
      // Check if we hit a new milestone
      const msg = getStreakMessage(s);
      if (msg && s > lastMilestone && onMilestone) {
        onMilestone(s, msg);
      }
      setLastMilestone(s);
    });
  }, []);

  if (streak < 2) return null;

  const level = getStreakLevel(streak);
  const colors = STREAK_COLORS[level];
  const nextMilestone = MILESTONES.find((m) => m > streak) ?? MILESTONES[MILESTONES.length - 1];
  const prevMilestone = [...MILESTONES].reverse().find((m) => m <= streak) ?? 0;
  const progress = Math.round(((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100);

  return (
    <div className="card" style={{ backgroundColor: colors.bg, borderColor: `${colors.text}20`, borderWidth: '1px' }}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Flame weight="duotone" size={22} style={{ color: colors.text }} />
          <span className="text-lg font-bold" style={{ color: colors.text }}>{streak}</span>
          <span className="text-small" style={{ color: colors.text, opacity: 0.7 }}>天</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body font-medium truncate" style={{ color: colors.text }}>
            连续打卡 {streak} 天
          </p>
          <div className="w-full h-1.5 bg-border rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition duration-700"
              style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: colors.text }}
            />
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: colors.text, opacity: 0.6 }}>
            {streak >= 100 ? '已解锁全部成就！' : `还差 ${nextMilestone - streak} 天解锁 ${nextMilestone} 天成就`}
          </p>
        </div>
      </div>
    </div>
  );
}

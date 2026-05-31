import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { db } from '@/db';
import { calculateStreak } from '@/utils/motivation';
import { CheckCircle, Clock, Flame, BookOpen, Smiley } from '@phosphor-icons/react';
import { MOOD_ICON } from '@/constants/moods';
import type { AppIcon } from '@/constants/moods';
import { format, startOfWeek, endOfWeek } from 'date-fns';

const MOOD_EMOJI: Record<string, AppIcon> = MOOD_ICON;

interface WeeklyData {
  completedTasks: number;
  totalTasks: number;
  actualMinutes: number;
  journalCount: number;
  bestMood: string | null;
  dailyDone: number;
}

export default function WeeklyReview({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [streak, setStreak] = useState(0);
  const [weekStr, setWeekStr] = useState('');

  useEffect(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(weekEnd, 'yyyy-MM-dd');
    setWeekStr(`${format(weekStart, 'M.dd')} — ${format(weekEnd, 'M.dd')}`);

    Promise.all([
      db.tasks.where('dueDate').between(startStr, endStr, true, true).toArray(),
      db.journalEntries.where('date').between(startStr, endStr, true, true).toArray(),
      db.dailySummaries.where('date').between(startStr, endStr, true, true).toArray(),
      calculateStreak(),
    ]).then(([tasks, entries, summaries, s]) => {
      const completed = tasks.filter((t) => t.status === 'completed').length;
      const actual = tasks
        .filter((t) => t.status === 'completed')
        .reduce((sum, t) => sum + (t.actualMinutes || t.estimatedMinutes), 0);

      const moods = entries.map((e) => e.mood).filter(Boolean);
      const moodCounts: Record<string, number> = {};
      moods.forEach((m) => { moodCounts[m] = (moodCounts[m] || 0) + 1; });
      let bestMood: string | null = null;
      let bestCount = 0;
      Object.entries(moodCounts).forEach(([m, c]) => {
        if (c > bestCount) { bestMood = m; bestCount = c; }
      });

      setData({
        completedTasks: completed,
        totalTasks: tasks.length,
        actualMinutes: actual,
        journalCount: entries.length,
        bestMood,
        dailyDone: summaries.filter((s) => s.completedTasks > 0).length,
      });
      setStreak(Math.floor(s / 7));
    });
  }, []);

  if (!data) return null;

  const rate = data.totalTasks > 0 ? Math.round((data.completedTasks / data.totalTasks) * 100) : 0;
  const formatTime = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;

  return (
    <Modal open onClose={onClose} title="上周回顾">
      <div className="space-y-4">
        <p className="text-caption text-text-secondary">{weekStr}</p>

        <div className="grid grid-cols-2 gap-3">
          <StatBox icon={CheckCircle} color="#10B981" label="完成率" value={`${rate}%`} sub={`${data.completedTasks}/${data.totalTasks} 个任务`} />
          <StatBox icon={Clock} color="#6366F1" label="专注时长" value={formatTime(data.actualMinutes)} sub="实际记录时间" />
          <StatBox icon={Flame} color="#F59E0B" label="打卡周" value={`第 ${streak || 1} 周`} sub={data.dailyDone > 0 ? `${data.dailyDone} 天有打卡` : '本周还没开始'} />
          <StatBox icon={BookOpen} color="#8B5CF6" label="日记" value={`${data.journalCount} 篇`} sub={data.journalCount > 0 ? '坚持记录' : '这周还没写'} />
        </div>

        {data.bestMood && (
          <div className="flex items-center gap-2 px-4 py-3 bg-surface-hover rounded-btn">
            <Smiley weight="duotone" size={18} className="text-primary" />
            <span className="text-body">心情最好的一天：</span>
            {(() => { const I = MOOD_EMOJI[data.bestMood] || MOOD_ICON.good; return <I size={28} />; })()}
          </div>
        )}

        {/* Encouragement */}
        <div className="bg-primary/5 rounded-card p-4 text-center">
          <p className="text-body text-primary font-medium">
            {rate >= 80
              ? `完成了上周的 ${rate}%，状态非常棒！继续保持 🔥`
              : rate >= 50
              ? `完成了上周的 ${rate}%，节奏不错，这周继续加油 💪`
              : data.totalTasks > 0
              ? `上周节奏有些慢，调整一下这周重新出发 🌱`
              : '新的一周，新的开始！给自己定个小目标吧 🎯'}
          </p>
        </div>
      </div>
    </Modal>
  );
}

function StatBox({ icon: AppIcon, color, label, value, sub }: {
  icon: React.ElementType; color: string; label: string; value: string; sub: string;
}) {
  return (
    <div className="bg-surface-hover rounded-card p-3 text-center">
      <AppIcon size={18} style={{ color }} className="mx-auto mb-1" />
      <p className="stat-number" style={{ color }}>{value}</p>
      <p className="text-small text-text-secondary">{label}</p>
      <p className="text-[10px] text-text-secondary mt-0.5">{sub}</p>
    </div>
  );
}

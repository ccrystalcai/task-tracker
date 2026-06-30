const PRAISE = [
  '今天全部完成了，执行力爆表！🔥',
  '完美的一天，每个任务都搞定了！💯',
  '全勤打卡！你就说强不强吧！💪',
  '任务清空！这种满足感无可替代 ✨',
  '一个不落，今天的状态绝了！🚀',
];

const ENCOURAGE = [
  '每一个完成的任务，都是未来的你在感谢现在的自己 🌟',
  '不需要完美，只需要比昨天进步一点点就好 🌱',
  '累了就歇会儿，但别忘了为什么出发 ⛅',
  '慢慢来，比较快。你已经很棒了 💛',
  '种一棵树最好的时间是十年前，其次是现在 🌳',
];

const FIRST_COMPLETE = [
  '好的开始是成功的一半！继续加油 🎯',
  '第一个任务完成！感觉不错吧？😊',
  '迈出第一步了，接下来的路会越来越顺 🛤️',
];

export const STREAK_MILESTONES: Record<number, string> = {
  3: '连续打卡 3 天！习惯开始发芽了 🌱',
  7: '连续 7 天打卡！一周的坚持不容易 👏',
  14: '连续 14 天！这已经不是三分钟热度了 🔥',
  21: '21 天！一个新习惯已经养成 🏆',
  30: '30 天连续打卡！你已经超越了 99% 的人 🚀',
  60: '60 天！自律已经刻进了 DNA 🧬',
  100: '100 天！请收下我的膝盖 🙇',
};

export function getRandomPraise(): string {
  return PRAISE[Math.floor(Math.random() * PRAISE.length)];
}

export function getRandomEncourage(): string {
  return ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)];
}

export function getFirstComplete(): string {
  return FIRST_COMPLETE[Math.floor(Math.random() * FIRST_COMPLETE.length)];
}

export function getStreakMessage(streak: number): string | null {
  const milestones = Object.keys(STREAK_MILESTONES).map(Number).sort((a, b) => a - b);
  for (const m of milestones) {
    if (streak === m) return STREAK_MILESTONES[m];
  }
  return null;
}

import { supabase } from '@/lib/supabase';

// Calculate current streak from daily summaries
export async function calculateStreak(): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return 0;

  const { data, error } = await supabase
    .from('daily_summaries')
    .select('date, completed_tasks')
    .eq('user_id', session.user.id)
    .order('date', { ascending: false });

  if (error || !data || data.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < data.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split('T')[0];

    if (data.some((s) => s.date === expectedStr && s.completed_tasks > 0)) {
      streak++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }

  return streak;
}

// Browser notification
export function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return Promise.resolve(false);
  if (Notification.permission === 'granted') return Promise.resolve(true);
  if (Notification.permission === 'denied') return Promise.resolve(false);
  return Notification.requestPermission().then((p) => p === 'granted');
}

export function sendNotification(title: string, body: string): void {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/favicon.svg' });
}

// Check and trigger task reminders
export function checkTaskReminders(tasks: { id: string; title: string; reminderEnabled: boolean; reminderTime: string | null; dueDate: string }[]): void {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  for (const task of tasks) {
    if (task.dueDate !== today) continue;
    if (!task.reminderEnabled || !task.reminderTime) continue;
    if (task.reminderTime === currentTime) {
      sendNotification('⏰ 任务提醒', task.title);
    }
  }
}

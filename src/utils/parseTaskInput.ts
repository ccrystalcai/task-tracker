import type { Priority } from '@/db/schema';
import { addDays, startOfWeek } from 'date-fns';

export interface ParsedResult {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  estimatedMinutes: number | null;
  priority: Priority | null;
  tagNames: string[];
  goalName: string | null;
}

const WEEKDAY_CN: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0,
};

const PRIORITY_MAP: Record<string, Priority> = {
  '重要且紧急': 'urgent-important',
  '重急': 'urgent-important',
  '重要不紧急': 'not-urgent-important',
  '重要': 'not-urgent-important',
  '紧急不重要': 'urgent-not-important',
  '不重要紧急': 'urgent-not-important',
  '紧急': 'urgent-not-important',
  '非重要紧急': 'not-urgent-not-important',
  '不急': 'not-urgent-not-important',
};

const DURATION_RE = /(\d+(?:\.\d+)?)\s*(分钟|小时|h|m|H|M|min|hour|hrs?|分|时)/;
const TIME_12H_RE = /(下午|上午|晚上|中午|早上|傍晚)\s*(\d{1,2})[点:：](\d{0,2})/;
const TIME_24H_RE = /(\d{1,2}):(\d{2})/;
const DATE_REL_RE = /(今天|明天|后天|大后天|下周[一二三四五六日天]|下週[一二三四五六日天]|周[一二三四五六日天]|週[一二三四五六日天])/;
const DATE_NUM_RE = /(\d{1,2})月(\d{1,2})[日号]/;
const DATE_ISO_RE = /(\d{4})-(\d{2})-(\d{2})/;

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function resolveDate(input: string): { date: string; matched: string } | null {
  // ISO date: 2026-05-29
  let m = input.match(DATE_ISO_RE);
  if (m) return { date: `${m[1]}-${m[2]}-${m[3]}`, matched: m[0] };

  // Numeric date: 5月29日
  m = input.match(DATE_NUM_RE);
  if (m) {
    const y = new Date().getFullYear();
    return { date: `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`, matched: m[0] };
  }

  // Relative date
  m = input.match(DATE_REL_RE);
  if (!m) return null;

  const ref = new Date(today() + 'T12:00:00');
  const w = m[0];
  if (w === '今天') return { date: today(), matched: w };
  if (w === '明天') return { date: formatDate(addDays(ref, 1)), matched: w };
  if (w === '后天') return { date: formatDate(addDays(ref, 2)), matched: w };
  if (w === '大后天') return { date: formatDate(addDays(ref, 3)), matched: w };

  // 下周X
  const nxm = w.match(/下[週周]([一二三四五六日天])/);
  if (nxm) {
    const targetDow = WEEKDAY_CN[nxm[1]];
    const nextMonday = addDays(startOfWeek(ref, { weekStartsOn: 1 }), 7);
    const target = targetDow === 0 ? addDays(nextMonday, 6) : addDays(nextMonday, targetDow - 1);
    return { date: formatDate(target), matched: w };
  }

  // 周X (this week)
  const twm = w.match(/[週周]([一二三四五六日天])/);
  if (twm) {
    const targetDow = WEEKDAY_CN[twm[1]];
    const mon = startOfWeek(ref, { weekStartsOn: 1 });
    const target = targetDow === 0 ? addDays(mon, 6) : addDays(mon, targetDow - 1);
    return { date: formatDate(target), matched: w };
  }

  return null;
}

function resolveTime(input: string): { time: string; matched: string } | null {
  // 12h: 下午3点 / 上午9:30
  let m = input.match(TIME_12H_RE);
  if (m) {
    const period = m[1];
    let hour = parseInt(m[2], 10);
    const min = m[3] ? parseInt(m[3].padEnd(2, '0'), 10) : 0;
    if (period === '下午' || period === '晚上' || period === '傍晚') {
      if (hour < 12) hour += 12;
    } else if (period === '中午' && hour < 12) {
      hour += 12;
    } else if ((period === '上午' || period === '早上') && hour === 12) {
      hour = 0;
    }
    return { time: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`, matched: m[0] };
  }

  // 24h: 15:00
  m = input.match(TIME_24H_RE);
  if (m) return { time: `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}`, matched: m[0] };

  return null;
}

function resolveDuration(input: string): { minutes: number; matched: string } | null {
  const m = input.match(DURATION_RE);
  if (!m) return null;
  const val = parseFloat(m[1]);
  const unit = m[2];
  if (unit === '小时' || unit === 'h' || unit === 'H' || unit === 'hour' || unit === 'hrs' || unit === '时') {
    return { minutes: Math.round(val * 60), matched: m[0] };
  }
  return { minutes: Math.round(val), matched: m[0] };
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function parseTaskInput(
  raw: string,
): ParsedResult {
  let remaining = raw.trim();

  // Extract #tags
  const tagNames: string[] = [];
  remaining = remaining.replace(/#([\w一-鿿㐀-䶿]+)/g, (_, name) => {
    tagNames.push(name);
    return '';
  });

  // Extract @goal
  let goalName: string | null = null;
  remaining = remaining.replace(/@([\w一-鿿㐀-䶿]+)/, (_, name) => {
    goalName = name;
    return '';
  });

  // Extract !priority
  let priority: Priority | null = null;
  remaining = remaining.replace(/!(\S+)/, (_, key) => {
    priority = PRIORITY_MAP[key] ?? null;
    return '';
  });

  // Extract date
  let dueDate: string | null = null;
  const dateResult = resolveDate(remaining);
  if (dateResult) {
    dueDate = dateResult.date;
    remaining = remaining.replace(dateResult.matched, '');
  }

  // Extract time
  let dueTime: string | null = null;
  const timeResult = resolveTime(remaining);
  if (timeResult) {
    dueTime = timeResult.time;
    remaining = remaining.replace(timeResult.matched, '');
  }

  // Extract duration
  let estimatedMinutes: number | null = null;
  const durResult = resolveDuration(remaining);
  if (durResult) {
    estimatedMinutes = durResult.minutes;
    remaining = remaining.replace(durResult.matched, '');
  }

  // Clean up remaining to get title
  const title = remaining.replace(/\s+/g, ' ').trim();

  return { title, dueDate, dueTime, estimatedMinutes, priority, tagNames, goalName };
}

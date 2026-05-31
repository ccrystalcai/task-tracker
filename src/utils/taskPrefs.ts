import type { Priority } from '@/db/schema';

const KEY = 'task_last_prefs';

interface TaskPrefs {
  tags: string[];
  priority: Priority;
  estimatedMinutes: number;
}

export function loadTaskPrefs(): TaskPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { tags: [], priority: 'not-urgent-important', estimatedMinutes: 30 };
}

export function saveTaskPrefs(prefs: Partial<TaskPrefs>) {
  const current = loadTaskPrefs();
  const merged = { ...current, ...prefs };
  try {
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch { /* ignore */ }
}

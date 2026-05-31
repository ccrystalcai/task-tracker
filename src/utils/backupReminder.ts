const LAST_BACKUP_KEY = 'tasktracker-last-backup-date';
const DISMISSED_KEY = 'tasktracker-backup-reminder-dismissed';
const SCHEDULE_KEY = 'tasktracker-backup-schedule';
const LAST_AUTO_KEY = 'tasktracker-last-auto-backup-date';

export type BackupSchedule = 'manual' | 'daily' | 'weekly';

export function getBackupSchedule(): BackupSchedule {
  return (localStorage.getItem(SCHEDULE_KEY) as BackupSchedule) || 'manual';
}

export function setBackupSchedule(schedule: BackupSchedule): void {
  localStorage.setItem(SCHEDULE_KEY, schedule);
}

export function shouldAutoBackup(): boolean {
  const schedule = getBackupSchedule();
  if (schedule === 'manual') return false;

  const lastStr = localStorage.getItem(LAST_AUTO_KEY);
  const today = new Date().toISOString().split('T')[0];
  if (!lastStr) return true;

  if (schedule === 'daily') return lastStr !== today;

  const last = new Date(lastStr + 'T12:00:00');
  const now = new Date(today + 'T12:00:00');
  const days = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  return days >= 7;
}

export function markAutoBackupDone(): void {
  localStorage.setItem(LAST_AUTO_KEY, new Date().toISOString().split('T')[0]);
}

export function shouldRemindBackup(): number | null {
  const dismissed = localStorage.getItem(DISMISSED_KEY);
  if (dismissed === 'true') return null;

  const lastStr = localStorage.getItem(LAST_BACKUP_KEY);
  const today = new Date().toISOString().split('T')[0];

  if (!lastStr) {
    return 999; // Never backed up
  }

  const last = new Date(lastStr + 'T12:00:00');
  const now = new Date(today + 'T12:00:00');
  const days = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  return days > 7 ? days : null;
}

export function markBackupDone(): void {
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString().split('T')[0]);
  localStorage.removeItem(DISMISSED_KEY);
}

export function dismissBackupReminder(): void {
  localStorage.setItem(DISMISSED_KEY, 'true');
}

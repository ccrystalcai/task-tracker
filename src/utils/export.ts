import { db } from '@/db';

export async function exportAllData(): Promise<string> {
  const [goals, tasks, taskRecords, journalEntries, dailySummaries, tags, focusSessions, goalTemplates, clips] = await Promise.all([
    db.goals.toArray(),
    db.tasks.toArray(),
    db.taskRecords.toArray(),
    db.journalEntries.toArray(),
    db.dailySummaries.toArray(),
    db.tags.toArray(),
    db.focusSessions.toArray(),
    db.goalTemplates.toArray(),
    db.clips.toArray(),
  ]);

  return JSON.stringify(
    { goals, tasks, taskRecords, journalEntries, dailySummaries, tags, focusSessions, goalTemplates, clips, exportedAt: new Date().toISOString() },
    null,
    2,
  );
}

export function downloadJSON(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importAllData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);

  await db.transaction('rw', [
    db.goals, db.tasks, db.taskRecords, db.journalEntries, db.dailySummaries, db.tags,
    db.focusSessions, db.goalTemplates, db.clips,
  ], async () => {
    if (data.goals?.length) await db.goals.bulkPut(data.goals);
    if (data.tasks?.length) await db.tasks.bulkPut(data.tasks);
    if (data.taskRecords?.length) await db.taskRecords.bulkPut(data.taskRecords);
    if (data.journalEntries?.length) await db.journalEntries.bulkPut(data.journalEntries);
    if (data.dailySummaries?.length) await db.dailySummaries.bulkPut(data.dailySummaries);
    if (data.tags?.length) await db.tags.bulkPut(data.tags);
    if (data.focusSessions?.length) await db.focusSessions.bulkPut(data.focusSessions);
    if (data.goalTemplates?.length) await db.goalTemplates.bulkPut(data.goalTemplates);
    if (data.clips?.length) await db.clips.bulkPut(data.clips);
  });
}

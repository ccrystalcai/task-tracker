import { supabase } from '@/lib/supabase';

const TABLES = [
  'goals', 'tasks', 'task_records', 'journal_entries',
  'daily_summaries', 'tags', 'focus_sessions', 'goal_templates', 'clips',
] as const;

export async function exportAllData(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const uid = session.user.id;
  const results = await Promise.all(
    TABLES.map((table) =>
      supabase.from(table).select('*').eq('user_id', uid),
    ),
  );

  const data: Record<string, unknown[]> = {};
  TABLES.forEach((table, i) => {
    data[table] = results[i].data ?? [];
  });

  return JSON.stringify(
    { ...data, exportedAt: new Date().toISOString() },
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
  const imported = JSON.parse(jsonString);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const uid = session.user.id;

  for (const table of TABLES) {
    const rows = imported[table];
    if (!rows || rows.length === 0) continue;

    // Inject user_id into every row
    const rowsWithUser = rows.map((r: Record<string, unknown>) => ({
      ...r,
      user_id: uid,
    }));

    // Upload in batches of 100
    for (let i = 0; i < rowsWithUser.length; i += 100) {
      const batch = rowsWithUser.slice(i, i + 100);
      const { error } = await supabase.from(table).upsert(batch, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });

      if (error) {
        console.error(`importAllData ${table} batch:`, error.message);
      }
    }
  }
}

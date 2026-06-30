import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { JournalEntry, Mood } from '@/db/schema';
import { generateId } from '@/utils/id';
import { toCamelCase, mapRowsToCamelCase } from '@/lib/mapping';

type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'windy' | null;

async function getUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

interface JournalStore {
  entries: JournalEntry[];
  loading: boolean;
  fetchEntries: () => Promise<void>;
  getEntryByDate: (date: string) => Promise<JournalEntry | undefined>;
  upsertEntry: (data: {
    id?: string;
    date: string;
    mood: Mood;
    weather?: WeatherType;
    content: string;
    summary?: string;
    suggestions: string[];
    images?: string[];
    tags?: string[];
  }) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
}

export const useJournalStore = create<JournalStore>((set, get) => ({
  entries: [],
  loading: false,

  fetchEntries: async () => {
    set({ loading: true });
    const uid = await getUserId();
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: false });

    if (error) {
      console.error('fetchEntries:', error.message);
      set({ loading: false });
      return;
    }

    const entries = mapRowsToCamelCase<JournalEntry>(data ?? []);
    set({ entries, loading: false });
  },

  getEntryByDate: async (date: string) => {
    const uid = await getUserId();
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', uid)
      .eq('date', date)
      .maybeSingle();

    if (error) {
      console.error('getEntryByDate:', error.message);
      return undefined;
    }

    return data ? (toCamelCase(data) as unknown as JournalEntry) : undefined;
  },

  upsertEntry: async (data) => {
    const uid = await getUserId();

    // Check if entry exists
    let existingId = data.id;
    if (!existingId) {
      const { data: existing } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('user_id', uid)
        .eq('date', data.date)
        .maybeSingle();
      existingId = existing?.id;
    }

    if (existingId) {
      // Update existing entry
      const updateData = {
        mood: data.mood,
        weather: data.weather ?? undefined,
        content: data.content,
        summary: data.summary ?? undefined,
        suggestions: data.suggestions,
        images: data.images ?? undefined,
        tags: data.tags ?? undefined,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('journal_entries')
        .update(updateData)
        .eq('id', existingId)
        .eq('user_id', uid);

      if (error) {
        console.error('upsertEntry update:', error.message);
        return;
      }
    } else {
      // Insert new entry
      const entry = {
        id: data.id || generateId(),
        user_id: uid,
        date: data.date,
        mood: data.mood,
        weather: data.weather ?? null,
        content: data.content,
        summary: data.summary ?? '',
        suggestions: data.suggestions,
        images: data.images ?? [],
        tags: data.tags ?? [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('journal_entries')
        .insert(entry);

      if (error) {
        console.error('upsertEntry insert:', error.message);
        return;
      }
    }

    await get().fetchEntries();
  },

  deleteEntry: async (id: string) => {
    const uid = await getUserId();
    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', uid);

    if (error) {
      console.error('deleteEntry:', error.message);
      return;
    }

    await get().fetchEntries();
  },
}));

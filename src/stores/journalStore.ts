import { create } from 'zustand';
import { db } from '@/db';
import type { JournalEntry, Mood } from '@/db/schema';
import { generateId } from '@/utils/id';

type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'windy' | null;

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
    const entries = await db.journalEntries.orderBy('date').reverse().toArray();
    set({ entries, loading: false });
  },

  getEntryByDate: async (date: string) => {
    return db.journalEntries.where('date').equals(date).first();
  },

  upsertEntry: async (data) => {
    const existing = data.id
      ? await db.journalEntries.get(data.id)
      : await db.journalEntries.where('date').equals(data.date).first();

    if (existing) {
      await db.journalEntries.update(existing.id, {
        mood: data.mood,
        weather: data.weather ?? existing.weather,
        content: data.content,
        summary: data.summary ?? existing.summary ?? '',
        suggestions: data.suggestions,
        images: data.images ?? existing.images ?? [],
        tags: data.tags ?? existing.tags ?? [],
        updatedAt: new Date(),
      });
    } else {
      await db.journalEntries.put({
        id: data.id || generateId(),
        date: data.date,
        mood: data.mood,
        weather: data.weather ?? null,
        content: data.content,
        summary: data.summary ?? '',
        suggestions: data.suggestions,
        images: data.images ?? [],
        tags: data.tags ?? [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await get().fetchEntries();
  },

  deleteEntry: async (id: string) => {
    await db.journalEntries.delete(id);
    await get().fetchEntries();
  },
}));

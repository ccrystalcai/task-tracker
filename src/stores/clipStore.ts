import { create } from 'zustand';
import { db } from '@/db';
import { generateId } from '@/utils/id';
import type { Clip } from '@/db/schema';

interface ClipState {
  clips: Clip[];
  loading: boolean;
  fetchClips: () => Promise<void>;
  createClip: (data: {
    url: string;
    title?: string;
    summary?: string;
    content?: string;
    favicon?: string;
    image?: string;
    tags?: string[];
    notes?: string;
    relatedJournalDate?: string | null;
  }) => Promise<Clip>;
  updateClip: (id: string, data: Partial<Clip>) => Promise<void>;
  deleteClip: (id: string) => Promise<void>;
}

export const useClipStore = create<ClipState>((set) => ({
  clips: [],
  loading: false,

  fetchClips: async () => {
    set({ loading: true });
    const clips = await db.clips.orderBy('createdAt').reverse().toArray();
    set({ clips, loading: false });
  },

  createClip: async (data) => {
    const now = new Date();
    const clip: Clip = {
      id: generateId(),
      url: data.url,
      title: data.title ?? '',
      summary: data.summary ?? '',
      content: data.content ?? '',
      favicon: data.favicon ?? '',
      image: data.image ?? '',
      tags: data.tags ?? [],
      notes: data.notes ?? '',
      relatedJournalDate: data.relatedJournalDate ?? null,
      convertedTaskId: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.clips.put(clip);
    set((s) => ({ clips: [clip, ...s.clips] }));
    return clip;
  },

  updateClip: async (id, data) => {
    await db.clips.update(id, { ...data, updatedAt: new Date() });
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === id ? { ...c, ...data, updatedAt: new Date() } : c,
      ),
    }));
  },

  deleteClip: async (id) => {
    await db.clips.delete(id);
    set((s) => ({ clips: s.clips.filter((c) => c.id !== id) }));
  },
}));

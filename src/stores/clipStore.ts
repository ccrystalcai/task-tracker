import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/utils/id';
import { toSnakeCase, mapRowsToCamelCase } from '@/lib/mapping';
import type { Clip } from '@/db/schema';

async function getUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

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
    const uid = await getUserId();
    const { data, error } = await supabase
      .from('clips')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchClips:', error.message);
      set({ loading: false });
      return;
    }

    const clips = mapRowsToCamelCase<Clip>(data ?? []);
    set({ clips, loading: false });
  },

  createClip: async (data) => {
    const uid = await getUserId();
    const now = new Date();
    const clip: Clip = {
      id: generateId(),
      userId: uid,
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

    const { error } = await supabase
      .from('clips')
      .insert(toSnakeCase(clip as unknown as Record<string, unknown>));

    if (error) {
      console.error('createClip:', error.message);
      throw error;
    }

    set((s) => ({ clips: [clip, ...s.clips] }));
    return clip;
  },

  updateClip: async (id, data) => {
    const uid = await getUserId();
    const updateData = { ...data, updatedAt: new Date() };

    const { error } = await supabase
      .from('clips')
      .update(toSnakeCase(updateData as unknown as Record<string, unknown>))
      .eq('id', id)
      .eq('user_id', uid);

    if (error) {
      console.error('updateClip:', error.message);
      return;
    }

    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === id ? { ...c, ...updateData } : c,
      ),
    }));
  },

  deleteClip: async (id) => {
    const uid = await getUserId();
    const { error } = await supabase
      .from('clips')
      .delete()
      .eq('id', id)
      .eq('user_id', uid);

    if (error) {
      console.error('deleteClip:', error.message);
      return;
    }

    set((s) => ({ clips: s.clips.filter((c) => c.id !== id) }));
  },
}));

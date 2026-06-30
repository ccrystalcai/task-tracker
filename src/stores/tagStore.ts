import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/utils/id';
import { toSnakeCase, mapRowsToCamelCase } from '@/lib/mapping';
import type { Tag } from '@/db/schema';

export interface TagNode extends Tag {
  children: TagNode[];
}

async function getUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

interface TagState {
  tags: Tag[];
  loading: boolean;
  fetchTags: () => Promise<void>;
  createTag: (name: string, color: string, parentId?: string | null) => Promise<Tag>;
  updateTag: (id: string, data: Partial<Pick<Tag, 'name' | 'color' | 'parentId'>>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  getRootTags: () => Tag[];
  getChildTags: (parentId: string) => Tag[];
  getTagPath: (tagId: string) => Tag[];
  getTagTree: () => TagNode[];
  getTagDepth: (tagId: string) => number;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  loading: false,

  fetchTags: async () => {
    set({ loading: true });
    const uid = await getUserId();
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('fetchTags:', error.message);
      set({ loading: false });
      return;
    }

    const tags = mapRowsToCamelCase<Tag>(data ?? []);
    set({ tags, loading: false });
  },

  createTag: async (name, color, parentId = null) => {
    const uid = await getUserId();
    const tag: Tag = {
      id: generateId(),
      userId: uid,
      name,
      color,
      parentId,
      createdAt: new Date(),
    };

    const { error } = await supabase
      .from('tags')
      .insert(toSnakeCase(tag as unknown as Record<string, unknown>));

    if (error) {
      console.error('createTag:', error.message);
      throw error;
    }

    set((s) => ({ tags: [...s.tags, tag] }));
    return tag;
  },

  updateTag: async (id, data) => {
    const uid = await getUserId();
    const { error } = await supabase
      .from('tags')
      .update(toSnakeCase(data as unknown as Record<string, unknown>))
      .eq('id', id)
      .eq('user_id', uid);

    if (error) {
      console.error('updateTag:', error.message);
      return;
    }

    set((s) => ({
      tags: s.tags.map((t) => (t.id === id ? { ...t, ...data } : t)),
    }));
  },

  deleteTag: async (id) => {
    const uid = await getUserId();

    // Un-parent children first
    const children = get().tags.filter((t) => t.parentId === id);
    for (const child of children) {
      await supabase
        .from('tags')
        .update({ parent_id: null })
        .eq('id', child.id)
        .eq('user_id', uid);
    }

    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', id)
      .eq('user_id', uid);

    if (error) {
      console.error('deleteTag:', error.message);
      return;
    }

    set((s) => ({
      tags: s.tags
        .filter((t) => t.id !== id)
        .map((t) => (t.parentId === id ? { ...t, parentId: null } : t)),
    }));
  },

  getRootTags: () => get().tags.filter((t) => !t.parentId),

  getChildTags: (parentId) => get().tags.filter((t) => t.parentId === parentId),

  getTagPath: (tagId) => {
    const path: Tag[] = [];
    let current = get().tags.find((t) => t.id === tagId);
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.unshift(current);
      current = current.parentId ? get().tags.find((t) => t.id === current!.parentId) : undefined;
    }
    return path;
  },

  getTagDepth: (tagId) => {
    let depth = 1;
    let current = get().tags.find((t) => t.id === tagId);
    const visited = new Set<string>();
    while (current?.parentId && !visited.has(current.id)) {
      visited.add(current.id);
      depth++;
      const parentId = current.parentId;
      current = get().tags.find((t) => t.id === parentId);
      if (depth > 3) break;
    }
    return Math.min(depth, 3);
  },

  getTagTree: () => {
    const tags = get().tags;
    const map = new Map<string, TagNode>();
    const roots: TagNode[] = [];

    for (const tag of tags) {
      map.set(tag.id, { ...tag, children: [] });
    }
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    // Sort children by name
    const sortChildren = (nodes: TagNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach((n) => sortChildren(n.children));
    };
    sortChildren(roots);
    return roots;
  },
}));

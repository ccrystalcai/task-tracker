import { create } from 'zustand';
import { db } from '@/db';
import { generateId } from '@/utils/id';
import type { Tag } from '@/db/schema';

export interface TagNode extends Tag {
  children: TagNode[];
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
    const tags = await db.tags.toArray();
    set({ tags, loading: false });
  },

  createTag: async (name, color, parentId = null) => {
    const tag: Tag = { id: generateId(), name, color, parentId, createdAt: new Date() };
    await db.tags.put(tag);
    set((s) => ({ tags: [...s.tags, tag] }));
    return tag;
  },

  updateTag: async (id, data) => {
    await db.tags.update(id, data);
    set((s) => ({
      tags: s.tags.map((t) => (t.id === id ? { ...t, ...data } : t)),
    }));
  },

  deleteTag: async (id) => {
    const children = get().tags.filter((t) => t.parentId === id);
    for (const child of children) {
      await db.tags.update(child.id, { parentId: null });
    }
    await db.tags.delete(id);
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

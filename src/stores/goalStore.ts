import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/utils/id';
import { toSnakeCase, mapRowsToCamelCase } from '@/lib/mapping';
import type { Goal } from '@/db/schema';

async function getUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

interface GoalState {
  goals: Goal[];
  loading: boolean;
  fetchGoals: () => Promise<void>;
  createGoal: (data: { name: string; description: string; deadline: Date; color: string }) => Promise<Goal>;
  updateGoal: (id: string, data: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
}

export const useGoalStore = create<GoalState>((set) => ({
  goals: [],
  loading: false,

  fetchGoals: async () => {
    set({ loading: true });
    const uid = await getUserId();
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchGoals:', error.message);
      set({ loading: false });
      return;
    }

    const goals = mapRowsToCamelCase<Goal>(data ?? []);
    set({ goals, loading: false });
  },

  createGoal: async (data) => {
    const uid = await getUserId();
    const now = new Date();
    const goal: Goal = {
      id: generateId(),
      userId: uid,
      ...data,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    const { error } = await supabase
      .from('goals')
      .insert(toSnakeCase(goal as unknown as Record<string, unknown>));

    if (error) {
      console.error('createGoal:', error.message);
      throw error;
    }

    set((s) => ({ goals: [...s.goals, goal] }));
    return goal;
  },

  updateGoal: async (id, data) => {
    const uid = await getUserId();
    const updateData = { ...data, updatedAt: new Date() };

    const { error } = await supabase
      .from('goals')
      .update(toSnakeCase(updateData as unknown as Record<string, unknown>))
      .eq('id', id)
      .eq('user_id', uid);

    if (error) {
      console.error('updateGoal:', error.message);
      return;
    }

    set((s) => ({
      goals: s.goals.map((g) => (g.id === id ? { ...g, ...updateData } : g)),
    }));
  },

  deleteGoal: async (id) => {
    const uid = await getUserId();
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', uid);

    if (error) {
      console.error('deleteGoal:', error.message);
      return;
    }

    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
  },
}));

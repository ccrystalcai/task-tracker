import { create } from 'zustand';
import { db } from '@/db';
import { generateId } from '@/utils/id';
import type { Goal } from '@/db/schema';

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
    const goals = await db.goals.toArray();
    set({ goals, loading: false });
  },

  createGoal: async (data) => {
    const now = new Date();
    const goal: Goal = {
      id: generateId(),
      ...data,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await db.goals.put(goal);
    set((s) => ({ goals: [...s.goals, goal] }));
    return goal;
  },

  updateGoal: async (id, data) => {
    await db.goals.update(id, { ...data, updatedAt: new Date() });
    set((s) => ({
      goals: s.goals.map((g) => (g.id === id ? { ...g, ...data, updatedAt: new Date() } : g)),
    }));
  },

  deleteGoal: async (id) => {
    await db.goals.delete(id);
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
  },
}));

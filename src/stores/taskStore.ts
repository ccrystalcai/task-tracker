import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/utils/id';
import { toSnakeCase, mapRowsToCamelCase } from '@/lib/mapping';
import { addDays, addWeeks, addMonths } from 'date-fns';
import type { Task, Priority, RecurrenceType } from '@/db/schema';

async function getUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

interface TaskState {
  tasks: Task[];
  loading: boolean;
  fetchTasks: () => Promise<void>;
  fetchTasksByDate: (date: string) => Promise<Task[]>;
  createTask: (data: {
    goalId?: string | null;
    title: string;
    description?: string;
    estimatedMinutes?: number;
    dueDate: string;
    dueTime?: string | null;
    reminderEnabled?: boolean;
    reminderTime?: string | null;
    priority?: Priority;
    tags?: string[];
    recurrenceType?: RecurrenceType;
    recurrenceInterval?: number;
    recurrenceEndDate?: string | null;
  }) => Promise<Task>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

function addToDate(dateStr: string, type: RecurrenceType, interval: number): string {
  const date = new Date(dateStr + 'T12:00:00');
  if (type === 'daily') return addDays(date, interval).toISOString().split('T')[0];
  if (type === 'weekly') return addWeeks(date, interval).toISOString().split('T')[0];
  if (type === 'monthly') return addMonths(date, interval).toISOString().split('T')[0];
  return dateStr;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,

  fetchTasks: async () => {
    set({ loading: true });
    const uid = await getUserId();

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchTasks:', error.message);
      set({ loading: false });
      return;
    }

    let tasks = mapRowsToCamelCase<Task>(data ?? []);

    // Auto-generate recurring instances (client-side logic, unchanged)
    const today = new Date().toISOString().split('T')[0];
    const newInstances: Task[] = [];
    const sourceTasks = tasks.filter((t) => t.recurrenceType !== 'none' && !t.sourceTaskId);

    for (const source of sourceTasks) {
      const instances = tasks.filter((t) => t.sourceTaskId === source.id);
      const allRelated = [source, ...instances];
      const latestDate = allRelated
        .map((t) => t.dueDate)
        .sort()
        .reverse()[0] || source.dueDate;

      const startFrom = instances.length === 0
        ? source.dueDate
        : addToDate(latestDate, source.recurrenceType, source.recurrenceInterval);

      let nextDate = startFrom;

      while (nextDate <= today) {
        if (source.recurrenceEndDate && nextDate > source.recurrenceEndDate) break;

        if (instances.some((inst) => inst.dueDate === nextDate)) {
          nextDate = addToDate(nextDate, source.recurrenceType, source.recurrenceInterval);
          continue;
        }

        const now = new Date();
        const instance: Task = {
          id: generateId(),
          userId: uid,
          goalId: source.goalId,
          title: source.title,
          description: source.description,
          estimatedMinutes: source.estimatedMinutes,
          actualMinutes: 0,
          actualStartTime: null,
          actualEndTime: null,
          dueDate: nextDate,
          dueTime: source.dueTime,
          reminderEnabled: source.reminderEnabled,
          reminderTime: source.reminderTime,
          priority: source.priority,
          tags: source.tags,
          recurrenceType: source.recurrenceType,
          recurrenceInterval: source.recurrenceInterval,
          recurrenceEndDate: source.recurrenceEndDate,
          sourceTaskId: source.id,
          score: null,
          reflection: '',
          notes: source.notes,
          images: [],
          status: 'pending',
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        };

        // Insert into Supabase — use upsert to handle unique constraint
        const { error: insertErr } = await supabase
          .from('tasks')
          .insert(toSnakeCase(instance as unknown as Record<string, unknown>));

        if (insertErr) {
          // If duplicate, just skip (another device may have created it)
          if (insertErr.code === '23505') {
            nextDate = addToDate(nextDate, source.recurrenceType, source.recurrenceInterval);
            continue;
          }
          console.error('fetchTasks auto-generate:', insertErr.message);
        } else {
          newInstances.push(instance);
        }

        nextDate = addToDate(nextDate, source.recurrenceType, source.recurrenceInterval);
      }
    }

    if (newInstances.length > 0) {
      tasks = [...tasks, ...newInstances];
    }

    set({ tasks, loading: false });
  },

  fetchTasksByDate: async (date: string) => {
    const uid = await getUserId();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', uid)
      .eq('due_date', date);

    if (error) {
      console.error('fetchTasksByDate:', error.message);
      return [];
    }

    return mapRowsToCamelCase<Task>(data ?? []);
  },

  createTask: async (data) => {
    const uid = await getUserId();
    const now = new Date();
    const task: Task = {
      id: generateId(),
      userId: uid,
      goalId: data.goalId ?? null,
      title: data.title,
      description: data.description ?? '',
      estimatedMinutes: data.estimatedMinutes ?? 30,
      actualMinutes: 0,
      actualStartTime: null,
      actualEndTime: null,
      dueDate: data.dueDate,
      dueTime: data.dueTime ?? null,
      reminderEnabled: data.reminderEnabled ?? false,
      reminderTime: data.reminderTime ?? null,
      priority: data.priority ?? 'not-urgent-important',
      tags: data.tags ?? [],
      recurrenceType: data.recurrenceType ?? 'none',
      recurrenceInterval: data.recurrenceInterval ?? 1,
      recurrenceEndDate: data.recurrenceEndDate ?? null,
      score: null,
      reflection: '',
      notes: data.description ?? '',
      sourceTaskId: null,
      images: [],
      status: 'pending',
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const { error } = await supabase
      .from('tasks')
      .insert(toSnakeCase(task as unknown as Record<string, unknown>));

    if (error) {
      console.error('createTask:', error.message);
      throw error;
    }

    set((s) => ({ tasks: [...s.tasks, task] }));
    return task;
  },

  updateTask: async (id, data) => {
    const uid = await getUserId();
    const updateData = { ...data, updatedAt: new Date() };

    const { error } = await supabase
      .from('tasks')
      .update(toSnakeCase(updateData as unknown as Record<string, unknown>))
      .eq('id', id)
      .eq('user_id', uid);

    if (error) {
      console.error('updateTask:', error.message);
      return;
    }

    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updateData } : t)),
    }));
  },

  toggleTask: async (id) => {
    const uid = await getUserId();
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;

    // Source tasks with recurrence are templates — toggle their child instance instead
    if (task.sourceTaskId == null && task.recurrenceType !== 'none') {
      const child = get().tasks.find(
        (t) => t.sourceTaskId === task.id && t.dueDate === task.dueDate,
      );
      if (child) {
        return get().toggleTask(child.id);
      }

      // No child exists yet — create one and complete it
      const now = new Date();
      const newChild: Task = {
        id: generateId(),
        userId: uid,
        goalId: task.goalId,
        title: task.title,
        description: task.description,
        estimatedMinutes: task.estimatedMinutes,
        actualMinutes: task.actualMinutes || task.estimatedMinutes,
        actualStartTime: null,
        actualEndTime: now.toISOString(),
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        reminderEnabled: task.reminderEnabled,
        reminderTime: task.reminderTime,
        priority: task.priority,
        tags: task.tags,
        recurrenceType: task.recurrenceType,
        recurrenceInterval: task.recurrenceInterval,
        recurrenceEndDate: task.recurrenceEndDate,
        sourceTaskId: task.id,
        score: null,
        reflection: '',
        notes: task.notes,
        images: [],
        status: 'completed',
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      const { error: childErr } = await supabase
        .from('tasks')
        .insert(toSnakeCase(newChild as unknown as Record<string, unknown>));

      if (childErr) {
        console.error('toggleTask create child:', childErr.message);
        return;
      }

      set((s) => ({ tasks: [...s.tasks, newChild] }));

      // Auto-create next instance
      const nextDate = addToDate(task.dueDate, task.recurrenceType, task.recurrenceInterval);
      if (!task.recurrenceEndDate || nextDate <= task.recurrenceEndDate) {
        const nextInstance: Task = {
          id: generateId(),
          userId: uid,
          goalId: task.goalId,
          title: task.title,
          description: task.description,
          estimatedMinutes: task.estimatedMinutes,
          actualMinutes: 0,
          actualStartTime: null,
          actualEndTime: null,
          dueDate: nextDate,
          dueTime: task.dueTime,
          reminderEnabled: task.reminderEnabled,
          reminderTime: task.reminderTime,
          priority: task.priority,
          tags: task.tags,
          recurrenceType: task.recurrenceType,
          recurrenceInterval: task.recurrenceInterval,
          recurrenceEndDate: task.recurrenceEndDate,
          sourceTaskId: task.id,
          score: null,
          reflection: '',
          notes: task.notes,
          images: [],
          status: 'pending',
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        };

        const { error: nextErr } = await supabase
          .from('tasks')
          .insert(toSnakeCase(nextInstance as unknown as Record<string, unknown>));

        if (nextErr) {
          console.error('toggleTask create next:', nextErr.message);
        } else {
          set((s) => ({ tasks: [...s.tasks, nextInstance] }));
        }
      }
      return;
    }

    // Regular toggle (non-recurring tasks or child instances)
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const completedAt = newStatus === 'completed' ? new Date() : null;

    const { error } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        completed_at: completedAt?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', uid);

    if (error) {
      console.error('toggleTask:', error.message);
      return;
    }

    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, status: newStatus, completedAt, updatedAt: new Date() } : t,
      ),
    }));

    // Auto-create next recurring instance on complete (for child instances)
    if (newStatus === 'completed' && task.recurrenceType !== 'none' && task.sourceTaskId != null) {
      const sourceId = task.sourceTaskId;
      const source = get().tasks.find((t) => t.id === sourceId);
      if (!source) return;

      const allInstances = get().tasks.filter((t) => t.sourceTaskId === sourceId);
      const latestDate = [source, ...allInstances]
        .map((t) => t.dueDate)
        .sort()
        .reverse()[0] || task.dueDate;

      const nextDate = addToDate(latestDate, source.recurrenceType, source.recurrenceInterval);
      if (source.recurrenceEndDate && nextDate > source.recurrenceEndDate) return;

      const now = new Date();
      const nextInstance: Task = {
        id: generateId(),
        userId: uid,
        goalId: source.goalId,
        title: source.title,
        description: source.description,
        estimatedMinutes: source.estimatedMinutes,
        actualMinutes: 0,
        actualStartTime: null,
        actualEndTime: null,
        dueDate: nextDate,
        dueTime: source.dueTime,
        reminderEnabled: source.reminderEnabled,
        reminderTime: source.reminderTime,
        priority: source.priority,
        tags: source.tags,
        recurrenceType: source.recurrenceType,
        recurrenceInterval: source.recurrenceInterval,
        recurrenceEndDate: source.recurrenceEndDate,
        sourceTaskId: sourceId,
        score: null,
        reflection: '',
        notes: source.notes,
        images: [],
        status: 'pending',
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      const { error: nextErr } = await supabase
        .from('tasks')
        .insert(toSnakeCase(nextInstance as unknown as Record<string, unknown>));

      if (nextErr) {
        console.error('toggleTask create next instance:', nextErr.message);
        return;
      }

      set((s) => ({ tasks: [...s.tasks, nextInstance] }));
    }
  },

  deleteTask: async (id) => {
    const uid = await getUserId();

    // Cascade-delete child instances for recurring source tasks
    const childIds = get().tasks
      .filter((t) => t.sourceTaskId === id)
      .map((t) => t.id);

    for (const cid of childIds) {
      const { error: childErr } = await supabase
        .from('tasks')
        .delete()
        .eq('id', cid)
        .eq('user_id', uid);

      if (childErr) {
        console.error('deleteTask cascade:', childErr.message);
      }
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', uid);

    if (error) {
      console.error('deleteTask:', error.message);
      return;
    }

    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id && !childIds.includes(t.id)),
    }));
  },
}));

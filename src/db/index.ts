import Dexie, { type Table } from 'dexie';
import type { Goal, Task, TaskRecord, JournalEntry, DailySummary, Tag, FocusSession } from './schema';

export class TaskTrackerDB extends Dexie {
  goals!: Table<Goal, string>;
  tasks!: Table<Task, string>;
  taskRecords!: Table<TaskRecord, string>;
  journalEntries!: Table<JournalEntry, string>;
  dailySummaries!: Table<DailySummary, string>;
  tags!: Table<Tag, string>;
  focusSessions!: Table<FocusSession, string>;

  constructor() {
    super('TaskTrackerDB');

    this.version(1).stores({
      goals: 'id, status',
      tasks: 'id, goalId, dueDate, status, priority, *tags',
      taskRecords: 'id, taskId, date',
      journalEntries: 'id, date',
      dailySummaries: 'id, date',
      tags: 'id, name',
    });

    this.version(2).stores({
      goals: 'id, status',
      tasks: 'id, goalId, dueDate, status, priority, *tags',
      taskRecords: 'id, taskId, date',
      journalEntries: 'id, date',
      dailySummaries: 'id, date',
      tags: 'id, name',
      focusSessions: 'id, taskId, date',
    });

    this.version(3).stores({
      goals: 'id, status',
      tasks: 'id, goalId, dueDate, status, priority, *tags',
      taskRecords: 'id, taskId, date',
      journalEntries: 'id, date',
      dailySummaries: 'id, date',
      tags: 'id, name, parentId',
      focusSessions: 'id, taskId, date',
    }).upgrade(async (tx) => {
      await tx.table('tags').toCollection().modify((tag) => {
        tag.parentId = null;
      });
      await tx.table('tasks').toCollection().modify((task) => {
        if (!task.images) task.images = [];
      });
    });

    this.version(4).stores({
      goals: 'id, status',
      tasks: 'id, goalId, dueDate, status, priority, *tags',
      taskRecords: 'id, taskId, date',
      journalEntries: 'id, date',
      dailySummaries: 'id, date',
      tags: 'id, name, parentId',
      focusSessions: 'id, taskId, date',
    }).upgrade(async (tx) => {
      await tx.table('tasks').toCollection().modify((task) => {
        if (!task.sourceTaskId) task.sourceTaskId = null;
      });
      await tx.table('dailySummaries').toCollection().modify((s) => {
        if (!s.images) s.images = [];
      });
      await tx.table('journalEntries').toCollection().modify((e) => {
        if (!e.weather) e.weather = null;
      });
    });

    this.version(5).stores({
      goals: 'id, status',
      tasks: 'id, goalId, dueDate, status, priority, *tags',
      taskRecords: 'id, taskId, date',
      journalEntries: 'id, date',
      dailySummaries: 'id, date',
      tags: 'id, name, parentId',
      focusSessions: 'id, taskId, date',
    }).upgrade(async (tx) => {
      await tx.table('tasks').toCollection().modify((task) => {
        if (!task.actualStartTime) task.actualStartTime = null;
        if (!task.actualEndTime) task.actualEndTime = null;
      });
      await tx.table('journalEntries').toCollection().modify((e) => {
        if (!e.summary) e.summary = '';
      });
    });

    this.version(6).stores({
      goals: 'id, status',
      tasks: 'id, goalId, dueDate, status, priority, *tags',
      taskRecords: 'id, taskId, date',
      journalEntries: 'id, date',
      dailySummaries: 'id, date',
      tags: 'id, name, parentId',
      focusSessions: 'id, taskId, date',
    }).upgrade(async (tx) => {
      await tx.table('journalEntries').toCollection().modify((e) => {
        if (!e.images) e.images = [];
      });
    });
  }
}

export const db = new TaskTrackerDB();

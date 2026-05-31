export interface Goal {
  id: string;
  name: string;
  description: string;
  deadline: Date;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'completed' | 'archived';
  color: string;
}

export type Priority =
  | 'urgent-important'
  | 'urgent-not-important'
  | 'not-urgent-important'
  | 'not-urgent-not-important';

export interface Tag {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  createdAt: Date;
}

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Task {
  id: string;
  goalId: string | null;
  title: string;
  description: string;
  estimatedMinutes: number;
  actualMinutes: number;
  actualStartTime: string | null;
  actualEndTime: string | null;
  dueDate: string;
  dueTime: string | null;
  reminderEnabled: boolean;
  reminderTime: string | null;
  priority: Priority;
  tags: string[];
  recurrenceType: RecurrenceType;
  recurrenceInterval: number;
  recurrenceEndDate: string | null;
  score: number | null;
  reflection: string;
  notes: string;
  sourceTaskId: string | null;
  images: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FocusSession {
  id: string;
  taskId: string;
  date: string;
  startTime: Date;
  endTime: Date | null;
  durationSeconds: number;
}

export interface TaskRecord {
  id: string;
  taskId: string;
  date: string;
  completed: boolean;
  score: number | null;
  reflection: string;
  images: Blob[];
  createdAt: Date;
}

export type Mood = 'great' | 'good' | 'okay' | 'bad' | 'terrible';

export interface JournalEntry {
  id: string;
  date: string;
  mood: Mood;
  weather: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'windy' | null;
  content: string;
  summary: string;
  suggestions: string[];
  images: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DailySummary {
  id: string;
  date: string;
  totalTasks: number;
  completedTasks: number;
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
  summary: string;
  images: string[];
  createdAt: Date;
}

export interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  data: {
    goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>;
    tags: Omit<Tag, 'id' | 'createdAt'>[];
    tasks: Omit<Task, 'id' | 'goalId' | 'createdAt' | 'updatedAt'>[];
  };
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Clip {
  id: string;
  url: string;
  title: string;
  summary: string;
  content: string;
  favicon: string;
  image: string;
  tags: string[];
  notes: string;
  relatedJournalDate: string | null;
  convertedTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

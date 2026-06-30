// ============================================================
// Snake_case ↔ camelCase field mapping
// Supabase returns snake_case; app interfaces use camelCase.
// Store 层负责转换，页面/组件零改动。
// ============================================================

const CAMEL_TO_SNAKE: Record<string, string> = {
  userId: 'user_id',
  goalId: 'goal_id',
  estimatedMinutes: 'estimated_minutes',
  actualMinutes: 'actual_minutes',
  actualStartTime: 'actual_start_time',
  actualEndTime: 'actual_end_time',
  dueDate: 'due_date',
  dueTime: 'due_time',
  reminderEnabled: 'reminder_enabled',
  reminderTime: 'reminder_time',
  recurrenceType: 'recurrence_type',
  recurrenceInterval: 'recurrence_interval',
  recurrenceEndDate: 'recurrence_end_date',
  sourceTaskId: 'source_task_id',
  completedAt: 'completed_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  parentId: 'parent_id',
  taskId: 'task_id',
  durationSeconds: 'duration_seconds',
  startTime: 'start_time',
  endTime: 'end_time',
  isBuiltIn: 'is_built_in',
  relatedJournalDate: 'related_journal_date',
  convertedTaskId: 'converted_task_id',
  totalTasks: 'total_tasks',
  completedTasks: 'completed_tasks',
  totalEstimatedMinutes: 'total_estimated_minutes',
  totalActualMinutes: 'total_actual_minutes',
};

const SNAKE_TO_CAMEL: Record<string, string> = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k]),
);

/** Fields that should be converted from ISO string → Date */
const DATE_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'deadline',
  'completedAt',
  'startTime',
  'endTime',
  'actualStartTime',
  'actualEndTime',
  'migratedAt',
]);

/**
 * Convert a camelCase object to snake_case for Supabase insert/update.
 * Also strips undefined values (Supabase ignores them anyway).
 */
export function toSnakeCase<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const mappedKey = CAMEL_TO_SNAKE[key] || key;
    result[mappedKey] = value;
  }
  return result;
}

/**
 * Convert a snake_case object (from Supabase) to camelCase for app use.
 * Also converts known timestamp fields from ISO string → Date.
 */
export function toCamelCase<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const mappedKey = SNAKE_TO_CAMEL[key] || key;
    result[mappedKey] = value;
  }
  // Convert ISO timestamp strings → Date
  for (const field of DATE_FIELDS) {
    const v = result[field];
    if (typeof v === 'string' && v) {
      result[field] = new Date(v);
    }
  }
  return result;
}

/**
 * Map an array of snake_case rows to camelCase.
 */
export function mapRowsToCamelCase<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) => toCamelCase(r) as unknown as T);
}

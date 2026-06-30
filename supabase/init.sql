-- ============================================================
-- TaskTracker Supabase 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- GOALS 目标表
-- ============================================================
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  deadline DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  color TEXT NOT NULL DEFAULT '#6366F1'
);
CREATE INDEX idx_goals_user_id ON goals(user_id);

-- ============================================================
-- TAGS 标签表（支持三级层级）
-- ============================================================
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366F1',
  parent_id UUID REFERENCES tags(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tags_user_id ON tags(user_id);
CREATE INDEX idx_tags_parent_id ON tags(parent_id);

-- ============================================================
-- TASKS 任务表
-- ============================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  actual_minutes INTEGER NOT NULL DEFAULT 0,
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_time TIME,
  reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  reminder_time TIME,
  priority TEXT NOT NULL DEFAULT 'not-urgent-important'
    CHECK (priority IN ('urgent-important','urgent-not-important','not-urgent-important','not-urgent-not-important')),
  tags UUID[] NOT NULL DEFAULT '{}',
  recurrence_type TEXT NOT NULL DEFAULT 'none' CHECK (recurrence_type IN ('none','daily','weekly','monthly')),
  recurrence_interval INTEGER NOT NULL DEFAULT 1,
  recurrence_end_date DATE,
  score INTEGER CHECK (score >= 1 AND score <= 5),
  reflection TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  images TEXT[] NOT NULL DEFAULT '{}',
  calendar_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in-progress', 'completed', 'skipped')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_goal_id ON tasks(goal_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_source_task_id ON tasks(source_task_id);
CREATE INDEX idx_tasks_tags ON tasks USING GIN(tags);

-- 防止周期任务重复实例
ALTER TABLE tasks ADD CONSTRAINT unique_recurring_instance
  UNIQUE NULLS NOT DISTINCT (source_task_id, due_date);

-- ============================================================
-- TASK_RECORDS 任务完成记录表
-- ============================================================
CREATE TABLE task_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  score INTEGER CHECK (score >= 1 AND score <= 5),
  reflection TEXT NOT NULL DEFAULT '',
  images TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_records_user_id ON task_records(user_id);
CREATE INDEX idx_task_records_task_id ON task_records(task_id);
CREATE INDEX idx_task_records_date ON task_records(date);

-- ============================================================
-- JOURNAL_ENTRIES 日记表
-- ============================================================
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood TEXT NOT NULL DEFAULT 'okay'
    CHECK (mood IN ('great','good','okay','bad','terrible')),
  weather TEXT CHECK (weather IN ('sunny','cloudy','rainy','stormy','snowy','windy')),
  content TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  suggestions TEXT[] NOT NULL DEFAULT '{}',
  images TEXT[] NOT NULL DEFAULT '{}',
  tags UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(date);
CREATE INDEX idx_journal_entries_tags ON journal_entries USING GIN(tags);

-- ============================================================
-- DAILY_SUMMARIES 每日小结表
-- ============================================================
CREATE TABLE daily_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_tasks INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  total_estimated_minutes INTEGER NOT NULL DEFAULT 0,
  total_actual_minutes INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  images TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_daily_summaries_user_id ON daily_summaries(user_id);
CREATE INDEX idx_daily_summaries_date ON daily_summaries(date);

-- ============================================================
-- FOCUS_SESSIONS 专注计时表
-- ============================================================
CREATE TABLE focus_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_focus_sessions_user_id ON focus_sessions(user_id);
CREATE INDEX idx_focus_sessions_task_id ON focus_sessions(task_id);
CREATE INDEX idx_focus_sessions_date ON focus_sessions(date);

-- ============================================================
-- GOAL_TEMPLATES 目标模板表
-- ============================================================
CREATE TABLE goal_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL,
  is_built_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_goal_templates_user_id ON goal_templates(user_id);

-- ============================================================
-- CLIPS 剪藏表
-- ============================================================
CREATE TABLE clips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  favicon TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  tags UUID[] NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  related_journal_date DATE,
  converted_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clips_user_id ON clips(user_id);
CREATE INDEX idx_clips_created_at ON clips(created_at);
CREATE INDEX idx_clips_tags ON clips USING GIN(tags);

-- ============================================================
-- USER_PREFERENCES 用户偏好表（迁移状态标记等）
-- ============================================================
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  migration_completed BOOLEAN NOT NULL DEFAULT false,
  migrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY — 所有表启用 RLS
-- ============================================================

-- 辅助：生成每个表的 RLS 策略的模板
-- 每个表需要 4 条策略：SELECT、INSERT、UPDATE、DELETE

-- goals
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own goals" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (auth.uid() = user_id);

-- tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tags" ON tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tags" ON tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON tags FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON tags FOR DELETE USING (auth.uid() = user_id);

-- tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- task_records
ALTER TABLE task_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task_records" ON task_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task_records" ON task_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own task_records" ON task_records FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own task_records" ON task_records FOR DELETE USING (auth.uid() = user_id);

-- journal_entries
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own journal_entries" ON journal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own journal_entries" ON journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own journal_entries" ON journal_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own journal_entries" ON journal_entries FOR DELETE USING (auth.uid() = user_id);

-- daily_summaries
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own daily_summaries" ON daily_summaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily_summaries" ON daily_summaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily_summaries" ON daily_summaries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily_summaries" ON daily_summaries FOR DELETE USING (auth.uid() = user_id);

-- focus_sessions
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own focus_sessions" ON focus_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own focus_sessions" ON focus_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own focus_sessions" ON focus_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own focus_sessions" ON focus_sessions FOR DELETE USING (auth.uid() = user_id);

-- goal_templates
ALTER TABLE goal_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own goal_templates" ON goal_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goal_templates" ON goal_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goal_templates" ON goal_templates FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own goal_templates" ON goal_templates FOR DELETE USING (auth.uid() = user_id);

-- clips
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own clips" ON clips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clips" ON clips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clips" ON clips FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own clips" ON clips FOR DELETE USING (auth.uid() = user_id);

-- user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 完成！所有表已创建并启用 RLS
-- ============================================================

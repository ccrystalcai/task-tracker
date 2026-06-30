import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/utils/id';
import type { FocusSession } from '@/db/schema';

const today = new Date().toISOString().split('T')[0];

async function getUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

export function useTimer(taskId: string) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing sessions for this task today
  const loadSessions = useCallback(async () => {
    const uid = await getUserId();
    const { data, error } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', uid)
      .eq('task_id', taskId)
      .eq('date', today);

    if (error) {
      console.error('loadSessions:', error.message);
      return;
    }

    const all = (data ?? []).map((s) => ({
      id: s.id as string,
      userId: s.user_id as string,
      taskId: s.task_id as string,
      date: s.date as string,
      startTime: new Date(s.start_time as string),
      endTime: s.end_time ? new Date(s.end_time as string) : null,
      durationSeconds: s.duration_seconds as number,
    })) as FocusSession[];

    setSessions(all);

    const active = all.find((s) => s.endTime === null);
    if (active) {
      setActiveSessionId(active.id);
      const soFar = active.durationSeconds +
        Math.floor((Date.now() - new Date(active.startTime).getTime()) / 1000);
      setElapsed(soFar);
      startInterval(active.startTime, active.durationSeconds);
    }

    const total = all
      .filter((s) => s.endTime !== null)
      .reduce((sum, s) => sum + s.durationSeconds, 0);
    setTotalSeconds(total);
  }, [taskId]);

  useEffect(() => {
    loadSessions();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadSessions]);

  const startInterval = (startTime: Date, baseSeconds: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const s = baseSeconds + Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
      setElapsed(s);
    }, 1000);
  };

  const start = async () => {
    const uid = await getUserId();
    const now = new Date();
    const session: FocusSession = {
      id: generateId(),
      userId: uid,
      taskId,
      date: today,
      startTime: now,
      endTime: null,
      durationSeconds: 0,
    };

    const { error } = await supabase
      .from('focus_sessions')
      .insert({
        id: session.id,
        user_id: uid,
        task_id: taskId,
        date: today,
        start_time: now.toISOString(),
        end_time: null,
        duration_seconds: 0,
      });

    if (error) {
      console.error('start session:', error.message);
      return;
    }

    setActiveSessionId(session.id);
    setElapsed(0);
    startInterval(now, 0);
  };

  const pause = async () => {
    if (!activeSessionId) return;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    const uid = await getUserId();
    const now = new Date();

    const { data: sessionData } = await supabase
      .from('focus_sessions')
      .select('start_time, duration_seconds')
      .eq('id', activeSessionId)
      .eq('user_id', uid)
      .single();

    if (!sessionData) return;

    const duration = (sessionData.duration_seconds as number) +
      Math.floor((now.getTime() - new Date(sessionData.start_time as string).getTime()) / 1000);

    await supabase
      .from('focus_sessions')
      .update({ end_time: now.toISOString(), duration_seconds: duration })
      .eq('id', activeSessionId)
      .eq('user_id', uid);

    setActiveSessionId(null);
    setTotalSeconds((prev) => prev + duration);
    await loadSessions();

    // Update task's actualMinutes
    const { data: task } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .eq('user_id', uid)
      .single();

    if (task) {
      const { data: totalSessions } = await supabase
        .from('focus_sessions')
        .select('duration_seconds')
        .eq('user_id', uid)
        .eq('task_id', taskId);

      const totalSecs = (totalSessions ?? []).reduce(
        (s: number, sess) => s + (sess.duration_seconds as number), 0,
      );

      await supabase
        .from('tasks')
        .update({ actual_minutes: Math.round(totalSecs / 60) })
        .eq('id', taskId)
        .eq('user_id', uid);
    }
  };

  const resume = async () => {
    await start();
  };

  const sessionCount = sessions.filter((s) => s.endTime !== null).length;

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return {
    isRunning: activeSessionId !== null,
    elapsed,
    elapsedDisplay: formatTimer(elapsed),
    totalSeconds,
    totalDisplay: formatTimer(totalSeconds),
    sessionCount,
    sessions,
    start: activeSessionId ? resume : start,
    pause,
    loadSessions,
  };
}

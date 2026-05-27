import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/db';
import { generateId } from '@/utils/id';
import type { FocusSession } from '@/db/schema';

const today = new Date().toISOString().split('T')[0];

export function useTimer(taskId: string) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing sessions for this task today
  const loadSessions = useCallback(async () => {
    const all = await db.focusSessions
      .where('taskId').equals(taskId)
      .and((s) => s.date === today)
      .toArray();
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
    const now = new Date();
    const session: FocusSession = {
      id: generateId(),
      taskId,
      date: today,
      startTime: now,
      endTime: null,
      durationSeconds: 0,
    };
    await db.focusSessions.put(session);
    setActiveSessionId(session.id);
    setElapsed(0);
    startInterval(now, 0);
  };

  const pause = async () => {
    if (!activeSessionId) return;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    const now = new Date();
    const session = await db.focusSessions.get(activeSessionId);
    if (!session) return;
    const duration = session.durationSeconds +
      Math.floor((now.getTime() - new Date(session.startTime).getTime()) / 1000);
    await db.focusSessions.update(activeSessionId, { endTime: now, durationSeconds: duration });
    setActiveSessionId(null);
    setTotalSeconds((prev) => prev + duration);
    await loadSessions();
    // Update task's actualMinutes
    const task = await db.tasks.get(taskId);
    if (task) {
      const totalSessions = await db.focusSessions
        .where('taskId').equals(taskId)
        .toArray();
      const totalSecs = totalSessions.reduce((s, sess) => s + sess.durationSeconds, 0);
      await db.tasks.update(taskId, { actualMinutes: Math.round(totalSecs / 60) });
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

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const GSI_SCRIPT = 'https://accounts.google.com/gsi/client';

let gsiLoaded = false;
let gsiLoadPromise: Promise<void> | null = null;

function loadGSIScript(): Promise<void> {
  if (gsiLoaded) return Promise.resolve();
  if (gsiLoadPromise) return gsiLoadPromise;

  gsiLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gsiLoaded = true;
      resolve();
    };
    script.onerror = () => {
      gsiLoadPromise = null;
      reject(new Error('Failed to load Google Identity Services'));
    };
    document.head.appendChild(script);
  });

  return gsiLoadPromise;
}

export function getStoredToken(): { accessToken: string; expiresAt: number } | null {
  try {
    const raw = localStorage.getItem('google_calendar_token');
    if (!raw) return null;
    const token = JSON.parse(raw);
    if (token.expiresAt < Date.now()) {
      localStorage.removeItem('google_calendar_token');
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function getClientId(): string {
  return localStorage.getItem('google_client_id') || '';
}

export function setClientId(id: string): void {
  localStorage.setItem('google_client_id', id);
}

export function isConfigured(): boolean {
  return !!getClientId();
}

export function isConnected(): boolean {
  return !!getStoredToken();
}

export function disconnect(): void {
  const stored = getStoredToken();
  localStorage.removeItem('google_calendar_token');
  if (window.google?.accounts?.oauth2) {
    try { window.google.accounts.oauth2.revoke(stored?.accessToken || ''); } catch { /* ignore */ }
  }
}

export async function requestAccessToken(): Promise<string> {
  const clientId = getClientId();
  if (!clientId) throw new Error('请先设置 Google Client ID');

  await loadGSIScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services 加载失败');
  }

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CALENDAR_SCOPE,
      callback: (response: { access_token: string; expires_in: number; error?: string }) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        const token = {
          accessToken: response.access_token,
          expiresAt: Date.now() + (response.expires_in - 60) * 1000,
        };
        localStorage.setItem('google_calendar_token', JSON.stringify(token));
        resolve(response.access_token);
      },
      error_callback: (error: { type: string }) => {
        reject(new Error(error.type === 'popup_closed' ? '授权窗口被关闭' : `授权失败: ${error.type}`));
      },
    });
    client.requestAccessToken();
  });
}

async function getValidToken(): Promise<string> {
  const stored = getStoredToken();
  if (stored) return stored.accessToken;
  return requestAccessToken();
}

// Calendar API calls
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export async function fetchCalendars(): Promise<{ id: string; summary: string }[]> {
  const token = await getValidToken();
  const res = await fetch(`${CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('获取日历列表失败');
  const data = await res.json();
  return (data.items || []).map((c: { id: string; summary: string }) => ({
    id: c.id,
    summary: c.summary,
  }));
}

export async function createCalendarEvent(
  calendarId: string,
  task: { title: string; description?: string; dueDate: string; dueTime?: string | null; estimatedMinutes?: number }
): Promise<string> {
  const token = await getValidToken();

  const start: Record<string, string> = { date: task.dueDate };
  const end: Record<string, string> = { date: task.dueDate };

  if (task.dueTime) {
    const [h, m] = task.dueTime.split(':');
    const startDt = `${task.dueDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    start.dateTime = startDt;
    start.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // End time = start + estimated minutes
    const endDate = new Date(startDt);
    endDate.setMinutes(endDate.getMinutes() + (task.estimatedMinutes || 30));
    end.dateTime = endDate.toISOString();
    end.timeZone = start.timeZone;
    delete start.date;
    delete end.date;
  }

  const event = {
    summary: task.title,
    description: task.description || '',
    start,
    end,
  };

  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message || '创建日历事件失败');
  }

  const created = await res.json();
  return created.id;
}

export async function listCalendarEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<{ id: string; summary: string; description?: string; start: { date?: string; dateTime?: string }; end: { date?: string; dateTime?: string } }[]> {
  const token = await getValidToken();
  const params = new URLSearchParams({
    timeMin: `${timeMin}T00:00:00Z`,
    timeMax: `${timeMax}T23:59:59Z`,
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) throw new Error('获取日历事件失败');
  const data = await res.json();
  return data.items || [];
}

// Add type declaration for window.google
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string; expires_in: number; error?: string }) => void;
            error_callback?: (error: { type: string }) => void;
          }) => { requestAccessToken: () => void };
          revoke: (token: string) => void;
        };
      };
    };
  }
}

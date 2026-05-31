const TOKEN_KEY = 'tasktracker-gdrive-token';
const CLIENT_ID_KEY = 'tasktracker-gdrive-client-id';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getGoogle(): any {
  return (window as any).google;
}

export function getStoredClientId(): string | null {
  return localStorage.getItem(CLIENT_ID_KEY);
}

export function setStoredClientId(id: string): void {
  localStorage.setItem(CLIENT_ID_KEY, id);
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function authorizeGoogleDrive(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const google = getGoogle();
    if (!google) {
      reject(new Error('Google API 未加载，请刷新页面后重试'));
      return;
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (resp: { error?: string; access_token?: string }) => {
        if (resp.error) {
          reject(new Error(resp.error));
        } else if (resp.access_token) {
          setStoredToken(resp.access_token);
          setStoredClientId(clientId);
          resolve(resp.access_token);
        } else {
          reject(new Error('授权失败'));
        }
      },
    });

    tokenClient.requestAccessToken();
  });
}

export async function uploadToDrive(
  fileName: string,
  content: string,
  token: string,
): Promise<void> {
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: ['appDataFolder'], // App-specific folder, not visible in user's main Drive
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'application/json' }));

  const resp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message || `上传失败 (${resp.status})`);
  }
}

export async function listBackups(token: string): Promise<Array<{ id: string; name: string; createdTime: string }>> {
  const resp = await fetch(
    'https://www.googleapis.com/drive/v3/files?q=name+contains+%22tasktracker-backup%22&orderBy=createdTime+desc&pageSize=20&fields=files(id,name,createdTime)',
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!resp.ok) throw new Error(`查询失败 (${resp.status})`);

  const data = await resp.json();
  return (data.files || []) as Array<{ id: string; name: string; createdTime: string }>;
}

export function disconnectDrive(): void {
  setStoredToken(null);
}

export function isDriveConnected(): boolean {
  return !!getStoredToken();
}

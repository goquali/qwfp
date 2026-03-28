const BASE = "/api/v1";

export interface ApiError {
  error: string;
  message: string;
  details?: any;
}

// Current user context — set by persona switcher
let currentUser: { id: string; role: string; name: string } | null = null;

export function setCurrentUser(user: { id: string; role: string; name: string }) {
  currentUser = user;
}

export function getCurrentUser() {
  return currentUser;
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(currentUser ? { "X-User-Id": currentUser.id, "X-User-Role": currentUser.role } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw body;
  }

  return res.json();
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, body: any) => api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = <T = any>(path: string, body: any) => api<T>(path, { method: "PATCH", body: JSON.stringify(body) });

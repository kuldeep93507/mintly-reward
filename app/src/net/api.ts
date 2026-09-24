import type { AuthResponse, LeaderboardEntry, Profile, RewardResponse, ServerConfig } from '@ludo/engine';

let baseUrl = '';
let token: string | null = null;

export function setServer(url: string) { baseUrl = url.replace(/\/+$/, ''); }
export function getServer() { return baseUrl; }
export function setToken(t: string | null) { token = t; }
export function getToken() { return token; }

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 8000, base = baseUrl): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError((data as { error?: string }).error || `Server error (${res.status})`, res.status);
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("Can't reach the game server", 0);
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  guest: (deviceId: string, name?: string, avatar?: number) =>
    request<AuthResponse>('POST', '/api/auth/guest', { deviceId, name, avatar }),
  me: () => request<{ profile: Profile }>('GET', '/api/me'),
  updateMe: (patch: { name?: string; avatar?: number }) => request<{ profile: Profile }>('PATCH', '/api/me', patch),
  deleteMe: () => request<{ ok: boolean }>('DELETE', '/api/me'),
  daily: () => request<RewardResponse>('POST', '/api/daily', {}),
  freeCoins: () => request<RewardResponse>('POST', '/api/free-coins', {}),
  leaderboard: () => request<{ top: LeaderboardEntry[] }>('GET', '/api/leaderboard'),
  config: () => request<ServerConfig>('GET', '/api/config'),
  health: (url: string) => request<{ ok: boolean }>('GET', '/health', undefined, 5000, url.replace(/\/+$/, '')),
};

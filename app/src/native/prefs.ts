import { Preferences } from '@capacitor/preferences';

// Preferences falls back to localStorage on the web; wrap in try/catch because
// storage can be unavailable (private mode etc.).
export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const { value } = await Preferences.get({ key });
    return value ? { ...fallback, ...(JSON.parse(value) as T) } : fallback;
  } catch {
    return fallback;
  }
}
export async function getString(key: string): Promise<string | null> {
  try { return (await Preferences.get({ key })).value; } catch { return null; }
}
export async function setString(key: string, value: string) {
  try { await Preferences.set({ key, value }); } catch { /* ignore */ }
}
export async function setJSON(key: string, value: unknown) {
  await setString(key, JSON.stringify(value));
}

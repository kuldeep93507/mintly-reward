// App-wide constants.
export const APP_VERSION = '1.0.0';
/** Support / grievance contact shown in Settings and the privacy policy. Set before publishing. */
export const SUPPORT_EMAIL: string = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || 'sebastianfinnley5@gmail.com';
/** Server address box in Settings: only in test builds (VITE_DEV_SETTINGS=1), never in the store build. */
export const SHOW_SERVER_SETTING = import.meta.env.VITE_DEV_SETTINGS === '1';
export const PRIVACY_POLICY_URL = 'https://sites.google.com/view/ludomintlyprivacypolicy';
export const DEFAULT_SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) || 'http://localhost:3000';

/** Test hook: window.__ludoSpeed = 0.1 makes animations and bot delays 10x faster. */
export function speed(): number {
  const s = (window as unknown as { __ludoSpeed?: number }).__ludoSpeed;
  return typeof s === 'number' && s > 0 ? s : 1;
}
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms * speed()));

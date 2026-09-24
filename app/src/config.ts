// App-wide constants.
export const APP_VERSION = '1.0.0';
export const PRIVACY_POLICY_URL = 'https://kuldeep93507.github.io/mintly-reward/privacy-policy.html';
export const DEFAULT_SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) || 'http://localhost:3000';

/** Test hook: window.__ludoSpeed = 0.1 makes animations and bot delays 10x faster. */
export function speed(): number {
  const s = (window as unknown as { __ludoSpeed?: number }).__ludoSpeed;
  return typeof s === 'number' && s > 0 ? s : 1;
}
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms * speed()));

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export const isNative = () => Capacitor.isNativePlatform();

export async function hideSplash() {
  if (!isNative()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#1a1446' });
  } catch { /* not critical */ }
  try { await SplashScreen.hide(); } catch { /* ignore */ }
}

/** Android hardware back button. Returns an unsubscribe function. */
export function onBackButton(cb: () => void): () => void {
  if (!isNative()) return () => {};
  const h = App.addListener('backButton', cb);
  return () => { void h.then((x) => x.remove()); };
}

export function exitApp() {
  if (isNative()) void App.exitApp();
}

/** Fires when the app returns to the foreground (native) or the tab becomes visible (web). */
export function onResume(cb: () => void): () => void {
  const vis = () => { if (document.visibilityState === 'visible') cb(); };
  document.addEventListener('visibilitychange', vis);
  let h: Promise<{ remove: () => Promise<void> }> | null = null;
  if (isNative()) h = App.addListener('resume', cb);
  return () => {
    document.removeEventListener('visibilitychange', vis);
    void h?.then((x) => x.remove());
  };
}

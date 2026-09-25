import { LocalNotifications } from '@capacitor/local-notifications';
import type { Invite } from '@ludo/engine';
import { isNative } from './platform';

let asked = false;

/** Ask for the Android 13+ notification permission while the app is on screen (invites need it). */
export async function askNotifyPermission() {
  if (!isNative() || asked) return;
  asked = true;
  try {
    const p = await LocalNotifications.checkPermissions();
    if (p.display === 'prompt' || p.display === 'prompt-with-rationale') await LocalNotifications.requestPermissions();
  } catch { /* best effort */ }
}
let nextId = 1;

/** Android notification for a room invite, only while the app is in the background. */
export async function notifyInvite(i: Invite) {
  if (!isNative() || document.visibilityState === 'visible') return;
  try {
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
    await LocalNotifications.schedule({
      notifications: [{
        id: nextId++,
        title: `${i.fromName} invited you`,
        body: `Join room ${i.roomCode} in Ludo Mintly`,
        extra: { roomCode: i.roomCode },
      }],
    });
  } catch { /* notifications are best effort */ }
}

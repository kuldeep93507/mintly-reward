import { LocalNotifications } from '@capacitor/local-notifications';
import type { Invite } from '@ludo/engine';
import { isNative } from './platform';

let asked = false;
let nextId = 1;

/** Android notification for a room invite, only while the app is in the background. */
export async function notifyInvite(i: Invite) {
  if (!isNative() || document.visibilityState === 'visible') return;
  try {
    if (!asked) {
      asked = true;
      const p = await LocalNotifications.checkPermissions();
      if (p.display !== 'granted') await LocalNotifications.requestPermissions();
    }
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

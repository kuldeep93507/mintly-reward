import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './platform';

let enabled = true;
export function setHapticsEnabled(on: boolean) { enabled = on; }

export function buzz(kind: 'light' | 'heavy' | 'success') {
  if (!enabled || !isNative()) return;
  try {
    if (kind === 'success') void Haptics.notification({ type: NotificationType.Success });
    else void Haptics.impact({ style: kind === 'heavy' ? ImpactStyle.Heavy : ImpactStyle.Light });
  } catch { /* ignore */ }
}

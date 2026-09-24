import { Share } from '@capacitor/share';

/** Returns 'shared' | 'copied' | 'failed'. */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if ((await Share.canShare()).value) {
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    }
  } catch { /* user cancelled or unsupported */ }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

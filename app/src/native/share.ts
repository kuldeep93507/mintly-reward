import { Share } from '@capacitor/share';

/** Returns 'shared' | 'copied' | 'cancelled' | 'failed'. */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  let canShare = false;
  try { canShare = (await Share.canShare()).value; } catch { /* unsupported */ }
  if (canShare) {
    try {
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    } catch (e) {
      // Closing the share sheet is not an error; don't fall back to the clipboard.
      if (/cancel/i.test(String((e as Error)?.message ?? e))) return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

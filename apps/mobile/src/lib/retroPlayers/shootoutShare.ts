import { Share } from 'react-native';
import RNShare, { Social } from 'react-native-share';

import { isShareCancelled } from '../shareToSocial';

/**
 * Sends Shootout text to WhatsApp, for players who won't get a push.
 * Falls back to the share sheet if WhatsApp isn't installed.
 */
export async function shareShootoutText(message: string, target: 'whatsapp' | 'more' = 'whatsapp'): Promise<void> {
  if (target === 'whatsapp') {
    try {
      await RNShare.shareSingle({ social: Social.Whatsapp, message });
      return;
    } catch (error) {
      if (isShareCancelled(error)) return;
      // Not installed, or the share failed: use the sheet instead.
    }
  }
  try {
    await Share.share({ message });
  } catch (error) {
    if (!isShareCancelled(error)) throw error;
  }
}

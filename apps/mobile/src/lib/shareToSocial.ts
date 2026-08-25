import { Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import RNShare, { Social } from 'react-native-share';

export type SocialShareTarget = 'instagram' | 'whatsapp' | 'more';

export function isShareCancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /cancel|dismiss|did not share/i.test(message);
}

function toFileUrl(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

async function fileToImageDataUrl(filePath: string): Promise<string> {
  const uri = toFileUrl(filePath);
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/png;base64,${base64}`;
}

async function ensurePhotoLibraryAccess(): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return true;
  const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return asked.granted;
}

async function shareViaSystemSheet(fileUrl: string, message: string, title: string): Promise<void> {
  try {
    await RNShare.open({
      url: fileUrl,
      type: 'image/png',
      filename: 'totl-share.png',
      message,
      title,
      failOnCancel: false,
    });
    return;
  } catch (error) {
    if (isShareCancelled(error)) return;
  }

  try {
    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(fileUrl, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: title,
      });
      return;
    }
  } catch (error) {
    if (isShareCancelled(error)) return;
  }

  await Share.share({ message, url: fileUrl, title });
}

/**
 * Share a captured PNG to Instagram, WhatsApp, or the system sheet.
 *
 * Instagram on iOS only treats the payload as an image when `url` is a
 * `data:image...` URI. A `file://` path is handled as a video library id and
 * never opens the composer. Photo library access is required because the
 * native Instagram path saves the image to Camera Roll first.
 */
export async function shareCapturedImage({
  filePath,
  target,
  message,
  title,
}: {
  filePath: string | null;
  target: SocialShareTarget;
  message: string;
  title: string;
}): Promise<void> {
  if (!filePath) {
    await Share.share({ message, title });
    return;
  }

  const fileUrl = toFileUrl(filePath);
  const dataUrl = await fileToImageDataUrl(fileUrl);

  if (target === 'instagram') {
    await ensurePhotoLibraryAccess();
    try {
      await RNShare.shareSingle({
        social: Social.Instagram,
        url: dataUrl,
        type: 'image/png',
      });
      return;
    } catch (error) {
      if (isShareCancelled(error)) return;
    }
    await shareViaSystemSheet(fileUrl, message, title);
    return;
  }

  if (target === 'whatsapp') {
    try {
      await RNShare.shareSingle({
        social: Social.Whatsapp,
        url: dataUrl,
        type: 'image/png',
        message,
      });
      return;
    } catch (error) {
      if (isShareCancelled(error)) return;
    }
    await shareViaSystemSheet(fileUrl, message, title);
    return;
  }

  await shareViaSystemSheet(fileUrl, message, title);
}

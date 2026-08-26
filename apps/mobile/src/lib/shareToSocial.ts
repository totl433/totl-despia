import { Linking, Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
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

async function fileToDataUrl(filePath: string, mimeType: 'image/png' | 'image/jpeg'): Promise<string> {
  const uri = toFileUrl(filePath);
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mimeType};base64,${base64}`;
}

async function toJpegFile(filePath: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(toFileUrl(filePath), [], {
    compress: 0.92,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

async function shareViaSystemSheet(
  fileUrl: string,
  message: string,
  title: string,
  options?: { dataUrl?: string; mimeType?: 'image/png' | 'image/jpeg'; filename?: string }
): Promise<void> {
  const mimeType = options?.mimeType ?? 'image/png';
  const filename = options?.filename ?? (mimeType === 'image/jpeg' ? 'totl-share.jpg' : 'totl-share.png');

  try {
    await RNShare.open({
      url: options?.dataUrl ?? fileUrl,
      type: mimeType,
      filename,
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
        mimeType,
        UTI: mimeType === 'image/jpeg' ? 'public.jpeg' : 'public.png',
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
 * Instagram's iOS share picker (Story / Feed / Messages) loads a Photos asset
 * by local identifier. react-native-share passes an unencoded placeholder id,
 * which Instagram opens then fails with "Something went wrong."
 */
async function shareToInstagramIos(filePath: string, message: string, title: string): Promise<void> {
  const jpegUri = await toJpegFile(filePath);
  const jpegUrl = toFileUrl(jpegUri);
  const jpegDataUrl = await fileToDataUrl(jpegUri, 'image/jpeg');

  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (permission.granted) {
    try {
      const asset = await MediaLibrary.createAssetAsync(jpegUri);
      await new Promise((resolve) => setTimeout(resolve, 400));
      const canOpen = await Linking.canOpenURL('instagram://app');
      if (canOpen && asset.id) {
        await Linking.openURL(`instagram://library?LocalIdentifier=${encodeURIComponent(asset.id)}`);
        return;
      }
    } catch (error) {
      if (isShareCancelled(error)) return;
    }
  }

  await shareViaSystemSheet(jpegUrl, message, title, {
    dataUrl: jpegDataUrl,
    mimeType: 'image/jpeg',
    filename: 'totl-share.jpg',
  });
}

/**
 * Share a captured PNG to Instagram, WhatsApp, or the system sheet.
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

  if (target === 'instagram') {
    if (Platform.OS === 'ios') {
      await shareToInstagramIos(filePath, message, title);
      return;
    }

    try {
      await RNShare.shareSingle({
        social: Social.Instagram,
        url: await fileToDataUrl(fileUrl, 'image/png'),
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
        url: await fileToDataUrl(fileUrl, 'image/png'),
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

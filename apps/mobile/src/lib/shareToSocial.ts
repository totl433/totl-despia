import { Platform, Share } from 'react-native';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import RNShare, { Social } from 'react-native-share';

import { canOpenInApp, openInInstagram, openInWhatsApp } from 'totl-social-share';

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

async function ensureImageFileUrl(filePath: string, extension: 'png' | 'jpg'): Promise<string> {
  const fileUrl = toFileUrl(filePath);
  if (/\.(png|jpe?g|gif)$/i.test(fileUrl)) return fileUrl;

  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDir) return fileUrl;
  const dest = `${baseDir}totl-share-${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: fileUrl, to: dest });
  return toFileUrl(dest);
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
 * Prefer Instagram's share extension (Reel / Post / Story / Message), which is
 * the same flow as More → Instagram. Fall back to Stories pasteboard.
 */
async function shareToInstagramIos(filePath: string): Promise<void> {
  const jpegUri = await toJpegFile(filePath);
  const jpegUrl = toFileUrl(jpegUri);

  if (canOpenInApp()) {
    try {
      const opened = await openInInstagram(jpegUrl);
      if (opened) return;
    } catch (error) {
      console.warn('[shareToSocial] Instagram share extension failed, falling back to Stories', error);
    }
  }

  await RNShare.shareSingle({
    social: Social.InstagramStories,
    backgroundImage: jpegUrl,
    appId: Application.applicationId ?? 'com.jmiddleton.totldev',
  });
}

async function shareToWhatsapp(filePath: string, message: string): Promise<void> {
  if (Platform.OS === 'ios' && canOpenInApp()) {
    const jpegUri = await toJpegFile(filePath);
    const opened = await openInWhatsApp(toFileUrl(jpegUri));
    if (opened) return;
  }

  const fileUrl = await ensureImageFileUrl(filePath, 'png');
  await RNShare.shareSingle({
    social: Social.Whatsapp,
    url: fileUrl,
    type: 'image/png',
    filename: 'totl-share.png',
    message: message.trim() ? message : ' ',
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
      await shareToInstagramIos(filePath);
      return;
    }
    await RNShare.shareSingle({
      social: Social.Instagram,
      url: await fileToDataUrl(fileUrl, 'image/jpeg'),
      type: 'image/jpeg',
    });
    return;
  }

  if (target === 'whatsapp') {
    await shareToWhatsapp(filePath, message);
    return;
  }

  await shareViaSystemSheet(fileUrl, message, title);
}

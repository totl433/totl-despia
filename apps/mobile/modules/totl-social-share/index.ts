import { requireOptionalNativeModule } from 'expo-modules-core';

type TotlSocialShareNative = {
  openInApp: (fileUri: string, uti: string, fileExtension: string) => Promise<boolean>;
};

const native = requireOptionalNativeModule<TotlSocialShareNative>('TotlSocialShare');

export function canOpenInApp(): boolean {
  return native != null;
}

export async function openInInstagram(fileUri: string): Promise<boolean> {
  if (!native) return false;
  // Route through Instagram's share extension (Reel / Post / Story / Message).
  return native.openInApp(fileUri, 'instagram', 'jpg');
}

export async function openInWhatsApp(fileUri: string): Promise<boolean> {
  if (!native) return false;
  return native.openInApp(fileUri, 'net.whatsapp.image', 'jpg');
}

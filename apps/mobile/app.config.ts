import type { ExpoConfig, ConfigContext } from 'expo/config';
import fs from 'node:fs';
import path from 'node:path';

function parseSimpleEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = value;
  }
  return out;
}

function readEnvLocal(projectRoot: string): Record<string, string> {
  // We can't rely on `.env` files here due to global ignore rules in this setup.
  // Instead, we support `env.local` (not hidden) and pass values via Expo config `extra`.
  const envPath = path.join(projectRoot, 'env.local');
  if (!fs.existsSync(envPath)) return {};
  const contents = fs.readFileSync(envPath, 'utf8');
  return parseSimpleEnvFile(contents);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectRoot = __dirname;
  const envLocal = readEnvLocal(projectRoot);
  const storybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true';

  const pick = (key: string) => {
    const fromLocal = envLocal[key];
    if (typeof fromLocal === 'string' && fromLocal.trim() && fromLocal !== 'PASTE_ANON_KEY_HERE') return fromLocal;

    // Prefer EAS/CI injected env vars next.
    // Important: locally, Expo CLI may load `.env` into `process.env` automatically.
    // We intentionally prioritize `env.local` (non-hidden) to avoid stale `.env` overriding local dev.
    const isEasBuild = process.env.EAS_BUILD === 'true';
    const isCi = process.env.CI === 'true' || process.env.CI === '1';
    const preferProcess = isEasBuild || isCi;
    const fromProcess = process.env[key];
    if (preferProcess && typeof fromProcess === 'string' && fromProcess.trim() && fromProcess !== 'PASTE_ANON_KEY_HERE')
      return fromProcess;
    if (!preferProcess && typeof fromProcess === 'string' && fromProcess.trim() && fromProcess !== 'PASTE_ANON_KEY_HERE') {
      // Still allow `process.env` locally, but only after `env.local`.
      return fromProcess;
    }

    const fromConfig = (config.extra as Record<string, unknown> | undefined)?.[key];
    return typeof fromConfig === 'string' ? fromConfig : undefined;
  };

  const oneSignalAppId = pick('EXPO_PUBLIC_ONESIGNAL_APP_ID');
  const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production';
  const oneSignalMode =
    process.env.EXPO_PUBLIC_ONESIGNAL_MODE === 'production' || isProductionBuild ? 'production' : 'development';

  const oneSignalAppGroup = 'group.com.despia.totlnative.onesignal';
  const existingIosEntitlements =
    (config.ios as any)?.entitlements && typeof (config.ios as any).entitlements === 'object' ? (config.ios as any).entitlements : {};
  const existingAppGroups = Array.isArray(existingIosEntitlements['com.apple.security.application-groups'])
    ? (existingIosEntitlements['com.apple.security.application-groups'] as string[])
    : [];
  const nextAppGroups = Array.from(new Set([...existingAppGroups, oneSignalAppGroup]));

  return {
    ...config,
    // `ConfigContext.config` is typed as partially-defined; ensure required fields exist.
    name: config.name ?? 'TOTL',
    slug: config.slug ?? 'totl',
    // Ensure the dev-client deep link works reliably on iOS.
    // Expo will try to open `exp+<slug>://...` by default; on some iOS versions that scheme
    // doesn't route correctly. Force a known-good scheme that iOS registers for this app.
    scheme: 'com.despia.totlnative',
    // Reanimated v4 (pulled in by Storybook UI deps) requires New Architecture.
    // Keep the main app on legacy for stability unless Storybook is enabled.
    newArchEnabled: storybookEnabled ? true : (config as any).newArchEnabled ?? false,
    ios: {
      ...(config.ios ?? {}),
      entitlements: {
        ...existingIosEntitlements,
        // OneSignal notification service extension needs this app group entitlement.
        'com.apple.security.application-groups': nextAppGroups,
      },
    },
    plugins: [
      ...(oneSignalAppId
        ? ([
            [
              'onesignal-expo-plugin',
              {
                mode: oneSignalMode,
              },
            ],
          ] as any[])
        : []),
      ...(config.plugins ?? []),
      '@react-native-community/datetimepicker',
    ],
    extra: {
      ...(config.extra ?? {}),
      EXPO_PUBLIC_SUPABASE_URL: pick('EXPO_PUBLIC_SUPABASE_URL'),
      EXPO_PUBLIC_SUPABASE_ANON_KEY: pick('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
      EXPO_PUBLIC_BFF_URL: pick('EXPO_PUBLIC_BFF_URL'),
      EXPO_PUBLIC_SITE_URL: pick('EXPO_PUBLIC_SITE_URL'),
      EXPO_PUBLIC_ONESIGNAL_APP_ID: oneSignalAppId,
    },
  };
};


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

  return {
    ...config,
    // `ConfigContext.config` is typed as partially-defined; ensure required fields exist.
    name: config.name ?? 'TOTL',
    slug: config.slug ?? 'totl',
    // Ensure the dev-client deep link works reliably on iOS.
    // Expo will try to open `exp+<slug>://...` unless a scheme is provided.
    scheme: (config as any).scheme ?? 'mobile',
    extra: {
      ...(config.extra ?? {}),
      EXPO_PUBLIC_SUPABASE_URL: envLocal.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: envLocal.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_BFF_URL: envLocal.EXPO_PUBLIC_BFF_URL,
    },
    // Reanimated v4 (pulled in by Storybook UI deps) requires New Architecture.
    // Keep the main app on legacy for stability unless Storybook is enabled.
    newArchEnabled: storybookEnabled ? true : (config as any).newArchEnabled ?? false,
    plugins: [...(config.plugins ?? []), '@react-native-community/datetimepicker'],
  };
};


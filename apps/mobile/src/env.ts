import { z } from 'zod';
import Constants from 'expo-constants';

const EnvSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  EXPO_PUBLIC_BFF_URL: z.string().url().default('http://localhost:8787'),
  // Base URL for Netlify functions (push notifications, etc).
  // Set to https://playtotl.com in prod; default to playtotl.com for convenience.
  EXPO_PUBLIC_SITE_URL: z.string().url().default('https://playtotl.com'),
});

export type MobileEnv = z.infer<typeof EnvSchema>;

function getExtraValue(key: string): unknown {
  // SDK 54: prefer Expo config `extra` (works for dev client + production).
  // Fall back to `process.env` for cases where Metro inlines vars.
  // Note: in some dev-client / Expo Go setups, `expoConfig` can be missing and
  // the values live on `manifest` or `manifest2` instead.
  const anyConstants = Constants as unknown as {
    expoConfig?: { extra?: Record<string, unknown> };
    manifest?: { extra?: Record<string, unknown> };
    manifest2?: { extra?: Record<string, unknown> };
  };

  const extra =
    (anyConstants.expoConfig?.extra as Record<string, unknown> | undefined) ??
    (anyConstants.manifest?.extra as Record<string, unknown> | undefined) ??
    (anyConstants.manifest2?.extra as Record<string, unknown> | undefined);

  return extra?.[key] ?? process.env[key];
}

function readRawEnv() {
  return {
    EXPO_PUBLIC_SUPABASE_URL: getExtraValue('EXPO_PUBLIC_SUPABASE_URL'),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: getExtraValue('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
    EXPO_PUBLIC_BFF_URL: getExtraValue('EXPO_PUBLIC_BFF_URL'),
    EXPO_PUBLIC_SITE_URL: getExtraValue('EXPO_PUBLIC_SITE_URL'),
  } as const;
}

const parsed = EnvSchema.safeParse(readRawEnv());

export const envStatus:
  | { ok: true }
  | { ok: false; message: string; raw: Record<string, unknown> } = parsed.success
  ? { ok: true }
  : {
      ok: false,
      message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      raw: readRawEnv() as unknown as Record<string, unknown>,
    };

// Never throw at module-load time in RN (it causes a red screen / white screen).
// Instead, let the app render a friendly "config missing" screen.
export const env: MobileEnv = parsed.success
  ? parsed.data
  : {
      EXPO_PUBLIC_SUPABASE_URL: 'https://invalid.local',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'invalid',
      EXPO_PUBLIC_BFF_URL: 'http://localhost:8787',
      EXPO_PUBLIC_SITE_URL: 'https://playtotl.com',
    };


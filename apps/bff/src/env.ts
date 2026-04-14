import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().optional(),
  SITE_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  REVENUECAT_SECRET_KEY: z.string().min(1).optional(),
  REVENUECAT_PROJECT_ID: z.string().min(1).optional(),
  REPORT_EMAIL_TO: z.string().email().default('hello+onlinesafety@playtotl.com'),
  REPORT_EMAIL_FROM: z.string().email().default('hello@playtotl.com'),
  REPORT_EMAIL_FROM_NAME: z.string().min(1).default('Top of the League'),
});

export type Env = z.infer<typeof EnvSchema>;

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

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const contents = fs.readFileSync(filePath, 'utf8');
  return parseSimpleEnvFile(contents);
}

function sanitizeAnonKey(v: string | undefined): string | undefined {
  if (!v) return v;
  // Guard against accidental duplication like "SUPABASE_ANON_KEY=SUPABASE_ANON_KEY=..."
  return v.startsWith('SUPABASE_ANON_KEY=') ? v.slice('SUPABASE_ANON_KEY='.length) : v;
}

export function loadEnv(input: NodeJS.ProcessEnv): Env {
  // In this environment, dotfiles like `.env` may be blocked/awkward to manage.
  // Support a visible `env.local` file for local development.
  const cwd = process.cwd();
  const fromBffEnvLocal = readEnvFile(path.join(cwd, 'env.local'));

  // Convenience: if BFF env vars are missing, reuse the mobile app's local values.
  const fromMobileEnvLocal = readEnvFile(path.resolve(cwd, '..', 'mobile', 'env.local'));

  const merged: Record<string, string | undefined> = {
    ...Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v ?? undefined])),
    ...fromBffEnvLocal,
  };

  merged.SUPABASE_URL =
    merged.SUPABASE_URL ??
    fromMobileEnvLocal.EXPO_PUBLIC_SUPABASE_URL ??
    fromMobileEnvLocal.SUPABASE_URL;
  merged.SUPABASE_ANON_KEY =
    sanitizeAnonKey(merged.SUPABASE_ANON_KEY) ??
    sanitizeAnonKey(fromMobileEnvLocal.EXPO_PUBLIC_SUPABASE_ANON_KEY) ??
    sanitizeAnonKey(fromMobileEnvLocal.SUPABASE_ANON_KEY);
  merged.SITE_URL = merged.SITE_URL ?? fromMobileEnvLocal.EXPO_PUBLIC_SITE_URL;

  return EnvSchema.parse(merged);
}


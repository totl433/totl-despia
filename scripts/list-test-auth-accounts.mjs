#!/usr/bin/env node
/**
 * List test auth accounts for cleanup.
 *
 * Usage:
 *   node scripts/list-test-auth-accounts.mjs
 *
 * Requires env (prefer .env.local):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Outputs matching Supabase auth.users + public.users profile row (if present).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnvLocal() {
  const envPath = join(__dirname, '..', '.env.local');
  const envVars = {};
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...valueParts] = trimmed.split('=');
      if (!key || valueParts.length === 0) return;
      envVars[key.trim()] = valueParts
        .join('=')
        .trim()
        .replace(/^["']|["']$/g, '');
    });
  } catch {
    // ignore (no .env.local)
  }
  return envVars;
}

const envLocal = loadEnvLocal();
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  envLocal.VITE_SUPABASE_URL ||
  envLocal.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  envLocal.SUPABASE_SERVICE_ROLE_KEY ||
  envLocal.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env. Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (prefer .env.local).');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const needles = ['sotbjof', 'jof.middleton'];

function matchesEmail(email) {
  if (!email) return false;
  const e = String(email).toLowerCase();
  return needles.some((n) => e.includes(n));
}

async function listAllAuthUsers() {
  const perPage = 1000;
  let page = 1;
  /** @type {any[]} */
  const matches = [];

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    for (const u of users) {
      if (matchesEmail(u.email)) matches.push(u);
    }
    const total = data?.total ?? users.length;
    const fetched = page * perPage;
    if (users.length === 0 || fetched >= total || users.length < perPage) break;
    page += 1;
  }

  return matches;
}

async function fetchProfiles(ids) {
  if (ids.length === 0) return new Map();
  const { data, error } = await admin.from('users').select('id, name, avatar_url').in('id', ids);
  if (error) throw error;
  const map = new Map();
  for (const row of data || []) map.set(row.id, row);
  return map;
}

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toISOString();
  } catch {
    return String(d);
  }
}

async function main() {
  const authUsers = await listAllAuthUsers();
  const ids = authUsers.map((u) => u.id).filter(Boolean);
  const profiles = await fetchProfiles(ids);

  const rows = authUsers
    .map((u) => {
      const p = profiles.get(u.id);
      return {
        id: u.id,
        email: u.email || '',
        created_at: fmtDate(u.created_at),
        confirmed_at: fmtDate(u.email_confirmed_at),
        last_sign_in_at: fmtDate(u.last_sign_in_at),
        provider: u.app_metadata?.provider || '',
        profile_name: p?.name || '',
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));

  console.log('Matching auth accounts (email contains):', needles.join(', '));
  console.log('Total:', rows.length);
  console.log('');
  console.table(rows);
}

main().catch((e) => {
  console.error('Error:', e?.message || e);
  process.exit(1);
});


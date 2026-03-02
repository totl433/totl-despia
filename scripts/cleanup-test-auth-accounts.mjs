#!/usr/bin/env node
/**
 * Cleanup test accounts for sotbjof / jof.middleton (including + aliases).
 *
 * Safety:
 * - Defaults to dry-run (prints what would be deleted)
 * - Requires explicit `--confirm` to delete anything
 * - Will ONLY target emails containing one of the needles below
 * - Will ALWAYS exclude the KEEP_USER_IDS below
 *
 * Usage:
 *   node scripts/cleanup-test-auth-accounts.mjs          # dry-run
 *   node scripts/cleanup-test-auth-accounts.mjs --confirm
 *
 * Requires env (prefer .env.local):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const NEEDLES = ['sotbjof', 'jof.middleton'];

// Keep these two accounts (VERY IMPORTANT)
const KEEP_USER_IDS = new Set([
  '4542c037-5b38-40d0-b189-847b8f17c222', // jof.middleton@gmail.com (Jof)
  '41f23cc8-427c-40d4-a8b5-2527a63f39c5', // sotbjof+test@gmail.com (HomeWins)
]);

const argv = new Set(process.argv.slice(2));
const confirm = argv.has('--confirm');

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

function matchesNeedles(email) {
  if (!email) return false;
  const e = String(email).toLowerCase();
  return NEEDLES.some((n) => e.includes(n));
}

async function listMatchingAuthUsers() {
  const perPage = 1000;
  let page = 1;
  /** @type {any[]} */
  const matches = [];

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    for (const u of users) {
      if (matchesNeedles(u.email)) matches.push(u);
    }
    const total = data?.total ?? users.length;
    const fetched = page * perPage;
    if (users.length === 0 || fetched >= total || users.length < perPage) break;
    page += 1;
  }

  return matches;
}

async function preCount(table, column, value) {
  try {
    const { count, error } = await admin
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(column, value);
    if (error) return { ok: false, count: 0, error };
    return { ok: true, count: count ?? 0, error: null };
  } catch (e) {
    return { ok: false, count: 0, error: e };
  }
}

async function deleteWhere(table, column, value) {
  const { error } = await admin.from(table).delete().eq(column, value);
  if (error) throw error;
}

async function cleanupUser(user) {
  const userId = user.id;
  const email = user.email || '';
  console.log(`\n🧹 Deleting user ${email} (${userId})`);

  // Tables that commonly reference a user_id (try best-effort; skip when table/column doesn't exist).
  const userIdTables = [
    'picks',
    'app_picks',
    'gw_picks',
    'test_api_picks',
    'gw_submissions',
    'app_gw_submissions',
    'league_members',
    'league_messages',
    'league_message_reactions',
    'chat_presence',
    'push_subscriptions',
    'user_notification_preferences',
    'email_preferences',
    'league_notification_settings',
    'notification_state',
    'notification_send_log',
  ];

  for (const table of userIdTables) {
    const counted = await preCount(table, 'user_id', userId);
    if (!counted.ok) {
      // Common: column doesn't exist or table not exposed. Skip.
      continue;
    }
    if (counted.count > 0) {
      console.log(`- ${table}: ${counted.count} rows`);
      if (confirm) {
        await deleteWhere(table, 'user_id', userId);
      }
    }
  }

  // Delete profile row in public.users (id matches auth user id)
  const profileCount = await preCount('users', 'id', userId);
  if (profileCount.ok && profileCount.count > 0) {
    console.log(`- users(profile): ${profileCount.count} rows`);
    if (confirm) {
      await deleteWhere('users', 'id', userId);
    }
  }

  // Finally delete auth user
  console.log(`- auth.users: 1 row`);
  if (confirm) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
}

async function main() {
  const matches = await listMatchingAuthUsers();

  // Compute deletions (exclude keep IDs)
  const toDelete = matches
    .filter((u) => u?.id && u?.email)
    .filter((u) => !KEEP_USER_IDS.has(u.id))
    .sort((a, b) => String(a.email).localeCompare(String(b.email)));

  // Safety assertions
  for (const u of toDelete) {
    if (!matchesNeedles(u.email)) {
      throw new Error(`Safety check failed: would delete non-matching email: ${u.email}`);
    }
  }
  for (const keepId of KEEP_USER_IDS) {
    if (toDelete.some((u) => u.id === keepId)) {
      throw new Error(`Safety check failed: keep user id included in delete set: ${keepId}`);
    }
  }

  console.log('Needles:', NEEDLES.join(', '));
  console.log('Keep IDs:', Array.from(KEEP_USER_IDS).join(', '));
  console.log(confirm ? '\n🚨 CONFIRM MODE: WILL DELETE' : '\n🧪 DRY RUN: no deletions will occur');

  console.log(`\nFound ${matches.length} matching auth users.`);
  console.log(`Will delete ${toDelete.length} of them (excluding keep IDs).`);
  console.log('');

  console.table(
    toDelete.map((u) => ({
      id: u.id,
      email: u.email,
      confirmed_at: u.email_confirmed_at || '',
      last_sign_in_at: u.last_sign_in_at || '',
    }))
  );

  if (!confirm) {
    console.log('\nRun again with --confirm to perform deletions.');
    return;
  }

  for (const u of toDelete) {
    await cleanupUser(u);
  }

  const after = await listMatchingAuthUsers();
  const remaining = after.filter((u) => !KEEP_USER_IDS.has(u.id));
  console.log('\n✅ Done.');
  console.log(`Remaining matching users (excluding keep IDs): ${remaining.length}`);
  if (remaining.length > 0) {
    console.log('Remaining emails:', remaining.map((u) => u.email).join(', '));
  }
}

main().catch((e) => {
  console.error('\n❌ Cleanup failed:', e?.message || e);
  process.exit(1);
});


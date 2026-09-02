#!/usr/bin/env node
/**
 * Swap SP's highest_scorer and most_assists in season_prediction_picks.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env or .env.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const SP_USER_ID = '9c0bcf50-370d-412d-8826-95371a72b4fe';
const SEASON_KEY = '2026-27';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: row, error: readError } = await admin
  .from('season_prediction_picks')
  .select('*')
  .eq('season_key', SEASON_KEY)
  .eq('user_id', SP_USER_ID)
  .maybeSingle();

if (readError) {
  console.error('Read failed:', readError.message);
  process.exit(1);
}
if (!row) {
  console.error('No row found for SP');
  process.exit(1);
}

console.log('Before:', {
  highest_scorer: row.highest_scorer,
  most_assists: row.most_assists,
});

const { error: deleteError } = await admin
  .from('season_prediction_picks')
  .delete()
  .eq('season_key', SEASON_KEY)
  .eq('user_id', SP_USER_ID);

if (deleteError) {
  console.error('Delete failed:', deleteError.message);
  process.exit(1);
}

const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...rest } = row;
const { data: updated, error: insertError } = await admin
  .from('season_prediction_picks')
  .insert({
    ...rest,
    highest_scorer: row.most_assists,
    most_assists: row.highest_scorer,
  })
  .select('highest_scorer, most_assists, submitted_at')
  .single();

if (insertError) {
  console.error('Insert failed:', insertError.message);
  process.exit(1);
}

console.log('After:', updated);
console.log('Done.');

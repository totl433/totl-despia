/**
 * Preview or backfill Game Centre posts for a gameweek from its live_scores rows.
 *
 *   npx tsx scripts/game-centre-posts-backfill.ts --gw 7            # dry run: prints posts, writes nothing
 *   npx tsx scripts/game-centre-posts-backfill.ts --gw 7 --write    # inserts missing posts (service role)
 *
 * Reads SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY (needed for --write) or SUPABASE_ANON_KEY.
 * Backfilled posts get an estimated published_at (kickoff plus the event's minute), since
 * nobody saw them arrive. Existing posts are never changed: inserts are on conflict do nothing.
 */
import { createClient } from '@supabase/supabase-js';

import { reconcileMatchPosts, type LiveRowForPosts, type PostInsert, type StoredPost } from '../netlify/functions/lib/gameCentrePosts';

const MINUTE = 60_000;

function arg(name: string): string | null {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] ?? null : null;
}

/** When the event would have landed: XIs 75' before kickoff, second-half minutes after a 15' break. */
function estimatePublishedAt(post: PostInsert, kickoffMs: number): string {
  const minute = post.occurred_minute ?? 0;
  const offset =
    post.kind === 'lineup' || post.kind === 'xi'
      ? -75 * MINUTE
      : post.kind === 'full-time'
        ? 112 * MINUTE
        : minute > 45
          ? (minute + 15) * MINUTE
          : minute * MINUTE;
  return new Date(kickoffMs + offset).toISOString();
}

async function main() {
  const gw = Number(arg('--gw'));
  const write = process.argv.includes('--write');
  if (!Number.isInteger(gw)) throw new Error('Pass --gw <number>');
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = write ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error(write ? 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' : 'Set SUPABASE_URL and a key');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await supabase.from('live_scores').select('*').eq('gw', gw).order('kickoff_time');
  if (error) throw error;
  let stored: StoredPost[] = [];
  if (write) {
    const existing = await supabase.from('game_centre_posts').select('*').eq('gw', gw);
    if (existing.error) throw existing.error;
    stored = (existing.data ?? []) as StoredPost[];
  }

  const inserts: Array<PostInsert & { published_at: string }> = [];
  for (const row of (rows ?? []) as Array<LiveRowForPosts & { kickoff_time: string | null; updated_at: string | null }>) {
    const kickoffMs = Date.parse(row.kickoff_time ?? '');
    const result = reconcileMatchPosts({ live: row, stored, sourceUpdatedAt: row.updated_at ?? new Date().toISOString() });
    for (const post of result.inserts) {
      inserts.push({ ...post, published_at: estimatePublishedAt(post, kickoffMs) });
      if (post.kind === 'opener') stored = [...stored, { ...post, revision: 1 }];
    }
  }
  // The opener lands just before the first line-up.
  const opener = inserts.find((post) => post.kind === 'opener');
  const firstXi = inserts.filter((post) => post.kind === 'lineup').sort((a, b) => a.published_at.localeCompare(b.published_at))[0];
  if (opener && firstXi) opener.published_at = new Date(Date.parse(firstXi.published_at) - 1000).toISOString();

  inserts.sort((a, b) => a.published_at.localeCompare(b.published_at));
  for (const post of inserts) {
    const goal = post.kind === 'goal' ? ` ${post.details.scorer} ${post.details.minute}' → ${JSON.stringify(post.details.score_after)}` : '';
    const score = post.details.score ? ` ${JSON.stringify(post.details.score)}` : '';
    console.log(`${post.published_at}  ${post.id.padEnd(28)} ${post.kind}${goal}${score}`);
  }
  console.log(`\n${inserts.length} posts for GW ${gw}${write ? '' : ' (dry run, nothing written)'}`);

  if (write && inserts.length > 0) {
    const { error: insertError } = await supabase.from('game_centre_posts').upsert(inserts, { onConflict: 'id', ignoreDuplicates: true });
    if (insertError) throw insertError;
    console.log('Inserted missing posts.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

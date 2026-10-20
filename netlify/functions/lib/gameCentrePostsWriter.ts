import type { SupabaseClient } from '@supabase/supabase-js';

import { postId, reconcileMatchPosts, type LiveRowForPosts, type StoredPost } from './gameCentrePosts';

/**
 * Off unless GAME_CENTRE_POSTS_WRITE=on, so this ships dark: the table must exist first
 * (supabase/sql/game_centre_posts.sql), then the flag turns writes on.
 */
export function gameCentrePostsEnabled(): boolean {
  return process.env.GAME_CENTRE_POSTS_WRITE?.trim().toLowerCase() === 'on';
}

const POST_COLUMNS = 'id, gw, api_match_id, fixture_index, kind, status, details, occurred_minute, revision, source_updated_at';

/**
 * Bring the stored posts in line with the live rows this run just wrote. Never throws:
 * a posts failure is logged and must not affect live scores.
 */
export async function syncGameCentrePosts(
  supabase: SupabaseClient,
  rows: LiveRowForPosts[],
  sourceUpdatedAt: string = new Date().toISOString()
): Promise<{ inserted: number; updated: number } | null> {
  const live = rows.filter((row) => Number.isInteger(row.fixture_index) && Number.isInteger(row.gw));
  if (live.length === 0) return { inserted: 0, updated: 0 };
  try {
    const matchIds = [...new Set(live.map((row) => row.api_match_id))];
    const openerIds = [...new Set(live.map((row) => postId(row.gw, `gw-open:${row.gw}`)))];
    const [byMatch, openers] = await Promise.all([
      supabase.from('game_centre_posts').select(POST_COLUMNS).in('api_match_id', matchIds),
      supabase.from('game_centre_posts').select(POST_COLUMNS).in('id', openerIds),
    ]);
    if (byMatch.error) throw byMatch.error;
    if (openers.error) throw openers.error;
    const stored = [...(byMatch.data ?? []), ...(openers.data ?? [])] as StoredPost[];

    const inserts = new Map<string, ReturnType<typeof reconcileMatchPosts>['inserts'][number]>();
    const updates: ReturnType<typeof reconcileMatchPosts>['updates'] = [];
    for (const row of live) {
      const result = reconcileMatchPosts({ live: row, stored, sourceUpdatedAt });
      // Two matches can both want the gameweek opener; one insert is enough.
      result.inserts.forEach((insert) => inserts.set(insert.id, insert));
      updates.push(...result.updates);
      // Later matches in this run see the opener as already posted.
      result.inserts
        .filter((insert) => insert.kind === 'opener')
        .forEach((insert) => stored.push({ ...insert, revision: 1 }));
    }

    if (inserts.size > 0) {
      // On conflict do nothing: an overlapping run can't post an event twice or move
      // its published_at.
      const { error } = await supabase
        .from('game_centre_posts')
        .upsert([...inserts.values()], { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;
    }
    for (const update of updates) {
      const { id, ...fields } = update;
      const { error } = await supabase
        .from('game_centre_posts')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .or(`source_updated_at.is.null,source_updated_at.lte.${sourceUpdatedAt}`);
      if (error) throw error;
    }
    if (inserts.size || updates.length) {
      console.log(`[gameCentrePosts] ${inserts.size} new, ${updates.length} updated`);
    }
    return { inserted: inserts.size, updated: updates.length };
  } catch (error) {
    console.error('[gameCentrePosts] sync failed (live scores unaffected):', error);
    return null;
  }
}

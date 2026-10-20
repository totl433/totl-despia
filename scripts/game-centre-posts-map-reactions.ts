/**
 * Move a gameweek's goal-card reactions from the old position-based card ids
 * (mc:gw7:goal:9:14:0, mc:gw7:score:9:1-0) to their stored posts (mc:gw7:goal:9:H1).
 * Every other card keeps its id, so its reactions need nothing.
 *
 *   npx tsx scripts/game-centre-posts-map-reactions.ts --gw 7           # dry run: prints the mapping
 *   npx tsx scripts/game-centre-posts-map-reactions.ts --gw 7 --write   # updates card_id on those rows
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (reactions are only readable signed in).
 * Run after the gameweek's posts exist. Nothing is deleted: a reaction with no matching post
 * keeps its old id, and one that would clash with the same person's reaction on the new id
 * is left where it is and reported.
 */
import { createClient } from '@supabase/supabase-js';

import { newCardId, type PostForReactions as Post } from '../netlify/functions/lib/gameCentrePostsReactions';

type Reaction = { id: string; card_id: string; user_id: string; emoji: string };

function arg(name: string): string | null {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] ?? null : null;
}

async function main() {
  const gw = Number(arg('--gw'));
  const write = process.argv.includes('--write');
  if (!Number.isInteger(gw)) throw new Error('Pass --gw <number>');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const [{ data: posts, error: postsError }, { data: reactions, error: reactionsError }] = await Promise.all([
    supabase.from('game_centre_posts').select('id, fixture_index, kind, details').eq('gw', gw),
    supabase
      .from('match_center_card_reactions')
      .select('id, card_id, user_id, emoji')
      .or(`card_id.like.mc:gw${gw}:goal:%,card_id.like.mc:gw${gw}:score:%`),
  ]);
  if (postsError) throw postsError;
  if (reactionsError) throw reactionsError;
  const postIds = new Set((posts ?? []).map((post) => post.id));

  // Reactions already on post ids, so a move can't break the one-per-person rule.
  const taken = new Set((reactions ?? []).filter((r) => postIds.has(r.card_id)).map((r) => `${r.card_id}|${r.user_id}`));
  const moves: Array<{ reaction: Reaction; to: string }> = [];
  const unmatched: Reaction[] = [];
  const clashes: Array<{ reaction: Reaction; to: string }> = [];
  for (const reaction of (reactions ?? []) as Reaction[]) {
    if (postIds.has(reaction.card_id)) continue;
    const to = newCardId(reaction.card_id, gw, (posts ?? []) as Post[]);
    if (!to) unmatched.push(reaction);
    else if (taken.has(`${to}|${reaction.user_id}`)) clashes.push({ reaction, to });
    else {
      taken.add(`${to}|${reaction.user_id}`);
      moves.push({ reaction, to });
    }
  }

  const summary = new Map<string, number>();
  moves.forEach(({ reaction, to }) => summary.set(`${reaction.card_id} → ${to}`, (summary.get(`${reaction.card_id} → ${to}`) ?? 0) + 1));
  summary.forEach((count, line) => console.log(`${line}  (${count})`));
  console.log(`\n${moves.length} to move, ${clashes.length} left (already reacted on the new card), ${unmatched.length} with no post`);
  unmatched.forEach((reaction) => console.log(`  no post for ${reaction.card_id}`));
  if (!write) {
    console.log('Dry run: nothing written.');
    return;
  }
  for (const { reaction, to } of moves) {
    const { error } = await supabase.from('match_center_card_reactions').update({ card_id: to }).eq('id', reaction.id).eq('card_id', reaction.card_id);
    if (error) throw error;
  }
  console.log(`Moved ${moves.length} reactions.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * A stored Game Centre post (game_centre_posts): one row per public match event, written
 * by the live score poller. Its id is the card's permanent identity, the same key
 * reactions and comments use (mc:gw7:goal:9:H1).
 */
export type GameCentrePost = {
  id: string;
  gw: number;
  api_match_id: number | null;
  fixture_index: number | null;
  kind: 'opener' | 'lineup' | 'xi' | 'kickoff' | 'goal' | 'half-time' | 'second-half' | 'full-time';
  status: 'active' | 'ruled_out' | 'void';
  details: Record<string, unknown>;
  occurred_minute: number | null;
  published_at: string;
  updated_at: string;
  revision: number;
};

/** Keep the newer revision of each post, in place, so a card never forks or reorders. */
export function mergeGameCentrePosts(current: GameCentrePost[], incoming: GameCentrePost[]): GameCentrePost[] {
  const byId = new Map(current.map((post) => [post.id, post]));
  let changed = false;
  for (const post of incoming) {
    const have = byId.get(post.id);
    if (have && have.revision >= post.revision) continue;
    byId.set(post.id, post);
    changed = true;
  }
  return changed ? [...byId.values()] : current;
}

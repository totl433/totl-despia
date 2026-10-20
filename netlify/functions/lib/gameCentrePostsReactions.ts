/**
 * Old goal-card ids were built from the goal's minute and list position
 * (mc:gw7:goal:9:14:0) or its score (mc:gw7:score:9:1-0). Map one to its stored post so
 * existing reactions move to the post (scripts/game-centre-posts-map-reactions.ts).
 */
export type PostForReactions = { id: string; fixture_index: number | null; kind: string; details: Record<string, unknown> };

/** Old id → post id: same fixture and minute (goal), or the goal that made that score (score). */
export function newCardId(oldId: string, gw: number, posts: PostForReactions[]): string | null {
  const prefix = `mc:gw${gw}:`;
  if (!oldId.startsWith(prefix)) return null;
  const key = oldId.slice(prefix.length);
  const goals = posts.filter((post) => post.kind === 'goal');
  const goal = /^goal:(\d+):(\d+):(\d+)$/.exec(key);
  if (goal) {
    const [, idx, minute, index] = goal.map(Number) as number[];
    const sameMinute = goals.filter((post) => post.fixture_index === idx && post.details.minute === minute);
    if (sameMinute.length === 1) return (sameMinute[0] as PostForReactions).id;
    // Two goals in one minute: the old id's list position breaks the tie.
    const ordered = goals
      .filter((post) => post.fixture_index === idx)
      .sort((a, b) => Number(a.details.minute ?? 0) - Number(b.details.minute ?? 0));
    return ordered[index as number]?.id ?? null;
  }
  const score = /^score:(\d+):(\d+)-(\d+)$/.exec(key);
  if (score) {
    const [, idx, home, away] = score.map(Number) as number[];
    const hit = goals.find((post) => {
      const after = post.details.score_after as { home?: number; away?: number } | undefined;
      return post.fixture_index === idx && after?.home === home && after?.away === away;
    });
    return hit?.id ?? null;
  }
  return null;
}

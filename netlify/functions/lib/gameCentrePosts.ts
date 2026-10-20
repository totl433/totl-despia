/**
 * Game Centre posts: one stored row per public match event, so every feed card has one
 * permanent id and one publish time. `reconcileMatchPosts` is pure: given the posts already
 * stored for a match and its live_scores row, it returns the posts to insert and update.
 * It always works from the full current state, so running it twice changes nothing.
 * Design: "Game Centre posts — design" doc.
 */
import { splitGoalsBySide } from './liveMatchGuards';

export type PostKind = 'opener' | 'lineup' | 'xi' | 'kickoff' | 'goal' | 'half-time' | 'second-half' | 'full-time';
export type PostStatus = 'active' | 'ruled_out' | 'void';
type Side = 'H' | 'A';
type Score = { home: number; away: number };

export type StoredPost = {
  id: string;
  gw: number;
  api_match_id: number | null;
  fixture_index: number | null;
  kind: PostKind;
  status: PostStatus;
  details: Record<string, unknown>;
  occurred_minute: number | null;
  revision: number;
  source_updated_at: string | null;
};

export type LiveRowForPosts = {
  api_match_id: number;
  gw: number;
  fixture_index: number;
  status: string | null;
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  home_team: string | null;
  away_team: string | null;
  goals: unknown;
  lineups?: unknown;
};

export type PostInsert = Omit<StoredPost, 'revision'>;
export type PostUpdate = Pick<StoredPost, 'id' | 'status' | 'details' | 'occurred_minute' | 'revision' | 'source_updated_at'>;

type LiveGoal = {
  minute?: number | null;
  scorer?: string | null;
  scorerId?: number | null;
  team?: string | null;
  teamId?: number | null;
  isOwnGoal?: boolean;
};

type GoalFacts = {
  side: Side;
  n: number;
  scorer: string | null;
  scorer_id: number | null;
  team_id: number | null;
  own_goal: boolean;
  minute: number | null;
  score_after: Score;
};

/** Same prefix as the app's reaction card ids, so reactions and comments carry over. */
export function postId(gw: number, key: string): string {
  return `mc:gw${gw}:${key}`;
}

const VOID_STATUSES = new Set(['POSTPONED', 'SUSPENDED', 'CANCELLED', 'CANCELED', 'ABANDONED']);
/** A minute correction this close is the same goal. */
const SAME_GOAL_MINUTES = 3;

function lineupIsIn(lineups: unknown): boolean {
  if (!lineups || typeof lineups !== 'object') return false;
  const row = lineups as { home?: { players?: unknown[] }; away?: { players?: unknown[] } };
  return (row.home?.players?.length ?? 0) >= 11 && (row.away?.players?.length ?? 0) >= 11;
}

function readGoals(raw: unknown): LiveGoal[] {
  return Array.isArray(raw) ? raw.filter((goal): goal is LiveGoal => !!goal && typeof goal === 'object') : [];
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

type Pairing = { goal: LiveGoal; post: StoredPost | null };

/**
 * Pair the provider's goals for one side with the goal posts already stored for it:
 * same scorer and minute, then a minute within 3, then the same scorer, then the rest in
 * minute order. Ruled-out posts can be matched too, so a goal that comes back after VAR
 * gets its old post (and its reactions) back.
 */
function pairGoals(goals: LiveGoal[], posts: StoredPost[]): { pairs: Pairing[]; unmatched: StoredPost[] } {
  const free = [...posts].sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1));
  const pairs: Pairing[] = goals.map((goal) => ({ goal, post: null }));
  const minuteOf = (post: StoredPost) => num(post.details.minute);
  const scorerOf = (post: StoredPost) => num(post.details.scorer_id);
  const tiers: Array<(goal: LiveGoal, post: StoredPost) => boolean> = [
    (goal, post) => goal.scorerId != null && goal.scorerId === scorerOf(post) && goal.minute === minuteOf(post),
    (goal, post) => {
      const a = num(goal.minute);
      const b = minuteOf(post);
      return a != null && b != null && Math.abs(a - b) <= SAME_GOAL_MINUTES;
    },
    (goal, post) => goal.scorerId != null && goal.scorerId === scorerOf(post),
  ];
  for (const matches of tiers) {
    for (const pair of pairs) {
      if (pair.post) continue;
      const at = free.findIndex((post) => matches(pair.goal, post));
      if (at >= 0) pair.post = free.splice(at, 1)[0] ?? null;
    }
  }
  // Whatever is left pairs up in minute order (a goal corrected beyond recognition).
  const leftActive = free.filter((post) => post.status === 'active').sort((a, b) => (minuteOf(a) ?? 0) - (minuteOf(b) ?? 0));
  for (const pair of pairs) {
    if (pair.post || leftActive.length === 0) continue;
    const post = leftActive.shift() as StoredPost;
    free.splice(free.indexOf(post), 1);
    pair.post = post;
  }
  return { pairs, unmatched: free };
}

export function reconcileMatchPosts(input: {
  live: LiveRowForPosts;
  /** Every post stored for this match, plus the gameweek opener if it exists. */
  stored: StoredPost[];
  /** Orders writes: an older source never overwrites a newer one. */
  sourceUpdatedAt: string;
}): { inserts: PostInsert[]; updates: PostUpdate[] } {
  const { live, sourceUpdatedAt } = input;
  const gw = live.gw;
  const idx = live.fixture_index;
  const status = String(live.status ?? '').toUpperCase();
  const byId = new Map(input.stored.map((post) => [post.id, post]));
  const inserts: PostInsert[] = [];
  const updates: PostUpdate[] = [];

  const want = (key: string, kind: PostKind, details: Record<string, unknown>, occurred: number | null, postStatus: PostStatus = 'active') => {
    const id = postId(gw, key);
    const current = byId.get(id);
    if (!current) {
      inserts.push({
        id,
        gw,
        api_match_id: kind === 'opener' ? null : live.api_match_id,
        fixture_index: kind === 'opener' ? null : idx,
        kind,
        status: postStatus,
        details,
        occurred_minute: occurred,
        source_updated_at: sourceUpdatedAt,
      });
      return;
    }
    change(current, { status: postStatus, details, occurred_minute: occurred });
  };

  const change = (current: StoredPost, next: Pick<StoredPost, 'status' | 'details' | 'occurred_minute'>) => {
    const same =
      current.status === next.status &&
      current.occurred_minute === next.occurred_minute &&
      stable(current.details) === stable(next.details);
    if (same) return;
    if (current.source_updated_at && Date.parse(current.source_updated_at) > Date.parse(sourceUpdatedAt)) return;
    updates.push({ id: current.id, ...next, revision: current.revision + 1, source_updated_at: sourceUpdatedAt });
  };

  const matchPosts = input.stored.filter((post) => post.api_match_id === live.api_match_id);

  // Postponed or abandoned: void what was posted, add nothing.
  if (VOID_STATUSES.has(status)) {
    for (const post of matchPosts) {
      if (post.status !== 'void') change(post, { status: 'void', details: post.details, occurred_minute: post.occurred_minute });
    }
    return { inserts, updates };
  }

  const started = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED';
  const minute = num(live.minute);
  const homeScore = Math.max(0, num(live.home_score) ?? 0);
  const awayScore = Math.max(0, num(live.away_score) ?? 0);

  if (lineupIsIn(live.lineups)) {
    want(`gw-open:${gw}`, 'opener', {}, null);
    want(`xi:${idx}`, 'lineup', {}, null);
    want(`xi-sheet:${idx}`, 'xi', {}, null);
  }
  if (started) want(`ko:${idx}`, 'kickoff', {}, 0);

  // Goals, per side, matched to the posts already stored for that side.
  const firstHalf: Score = { home: 0, away: 0 };
  if (started) {
    const sides = splitGoalsBySide(readGoals(live.goals), homeScore, awayScore, live.home_team, live.away_team);
    const goalPosts = matchPosts.filter((post) => post.kind === 'goal');
    const facts: Array<{ side: Side; goal: LiveGoal; post: StoredPost | null }> = [];
    const leftovers: StoredPost[] = [];
    for (const side of ['H', 'A'] as const) {
      const posts = goalPosts.filter((post) => post.details.side === side && post.status !== 'void');
      const { pairs, unmatched } = pairGoals(side === 'H' ? sides.home : sides.away, posts);
      pairs.forEach((pair) => facts.push({ side, ...pair }));
      leftovers.push(...unmatched);
    }

    // Score after each goal, in match order.
    facts.sort((a, b) => (a.goal.minute ?? 0) - (b.goal.minute ?? 0));
    const running: Score = { home: 0, away: 0 };
    const nextN: Record<Side, number> = { H: 0, A: 0 };
    for (const post of goalPosts) {
      const side = post.details.side === 'A' ? 'A' : 'H';
      nextN[side] = Math.max(nextN[side], num(post.details.n) ?? 0);
    }
    for (const { side, goal, post } of facts) {
      if (side === 'H') running.home += 1;
      else running.away += 1;
      if ((goal.minute ?? 0) <= 45) {
        if (side === 'H') firstHalf.home += 1;
        else firstHalf.away += 1;
      }
      // A new goal takes the next unused number for its side, never a ruled-out one's.
      const n = post ? (num(post.details.n) ?? 0) : (nextN[side] += 1);
      const details: GoalFacts = {
        side,
        n,
        scorer: goal.scorer ?? null,
        scorer_id: num(goal.scorerId),
        team_id: num(goal.teamId),
        own_goal: goal.isOwnGoal === true,
        minute: num(goal.minute),
        score_after: { ...running },
      };
      if (post) change(post, { status: 'active', details, occurred_minute: details.minute });
      else want(`goal:${idx}:${side}${n}`, 'goal', details, details.minute);
    }
    // A stored goal the provider no longer lists (the score dropped): VAR, or a correction.
    for (const post of leftovers) {
      if (post.status === 'active') change(post, { status: 'ruled_out', details: post.details, occurred_minute: post.occurred_minute });
    }
  }

  const htPost = byId.get(postId(gw, `ht:${idx}`));
  const pastHalf = status === 'PAUSED' || status === 'FINISHED' || (status === 'IN_PLAY' && minute != null && minute >= 46);
  if (pastHalf) {
    // At the break the live score is the half-time score. After it, keep what was posted,
    // or (if the break was missed) count the first-half goals.
    const atBreak: Score =
      status === 'PAUSED'
        ? { home: homeScore, away: awayScore }
        : (htPost?.details.score as Score | undefined) ?? firstHalf;
    want(`ht:${idx}`, 'half-time', { score: atBreak }, 45);
  }
  // A finished match had a second half too (a backfill, or a poll that missed it).
  if ((status === 'IN_PLAY' && ((minute != null && minute >= 46) || !!htPost)) || status === 'FINISHED') {
    want(`sh:${idx}`, 'second-half', {}, 46);
  }
  if (status === 'FINISHED') {
    want(`ft:${idx}`, 'full-time', { score: { home: homeScore, away: awayScore } }, 90);
  }

  return { inserts, updates };
}

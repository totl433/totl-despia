import { describe, expect, it } from 'vitest';

import { reconcileMatchPosts, type LiveRowForPosts, type StoredPost } from './gameCentrePosts';

const XI = {
  home: { players: Array.from({ length: 11 }, (_, i) => ({ name: `H${i}` })) },
  away: { players: Array.from({ length: 11 }, (_, i) => ({ name: `A${i}` })) },
};
const maddison = { team: 'Spurs', minute: 14, scorer: 'James Maddison', scorerId: 3992, teamId: 73, isOwnGoal: false };
const rudoni = { team: 'Coventry City', minute: 49, scorer: 'Jack Rudoni', scorerId: 5001, teamId: 1076, isOwnGoal: false };
const marmoush = { team: 'Spurs', minute: 58, scorer: 'Omar Marmoush', scorerId: 6002, teamId: 73, isOwnGoal: false };

function row(overrides: Partial<LiveRowForPosts>): LiveRowForPosts {
  return {
    api_match_id: 560606,
    gw: 7,
    fixture_index: 9,
    status: 'TIMED',
    minute: null,
    home_score: 0,
    away_score: 0,
    home_team: 'Spurs',
    away_team: 'Coventry City',
    goals: null,
    lineups: XI,
    ...overrides,
  };
}

/** A tiny in-memory table with the same rules as the poller's writes. */
function table() {
  const rows = new Map<string, StoredPost & { published_at: string }>();
  let clock = Date.parse('2026-10-19T17:45:00Z');
  const writes: string[] = [];
  return {
    rows,
    writes,
    run(live: LiveRowForPosts, sourceUpdatedAt?: string) {
      clock += 60_000;
      const source = sourceUpdatedAt ?? new Date(clock).toISOString();
      const { inserts, updates } = reconcileMatchPosts({ live, stored: [...rows.values()], sourceUpdatedAt: source });
      for (const insert of inserts) {
        if (rows.has(insert.id)) continue; // on conflict do nothing
        rows.set(insert.id, { ...insert, revision: 1, published_at: new Date(clock).toISOString() });
        writes.push(`+${insert.id}`);
      }
      for (const update of updates) {
        const current = rows.get(update.id);
        if (!current) continue;
        rows.set(update.id, { ...current, ...update });
        writes.push(`~${update.id}`);
      }
      return { inserts, updates };
    },
    get(key: string) {
      return rows.get(`mc:gw7:${key}`);
    },
    ids() {
      return [...rows.keys()].sort();
    },
  };
}

describe('Spurs v Coventry, GW7 (the screenshot match)', () => {
  const timeline: LiveRowForPosts[] = [
    row({}),
    row({ status: 'IN_PLAY', minute: 3 }),
    row({ status: 'IN_PLAY', minute: 15, home_score: 1, goals: [maddison] }),
    row({ status: 'PAUSED', minute: 45, home_score: 1, goals: [maddison] }),
    row({ status: 'IN_PLAY', minute: 47, home_score: 1, goals: [maddison] }),
    row({ status: 'IN_PLAY', minute: 50, home_score: 1, away_score: 1, goals: [maddison, rudoni] }),
    row({ status: 'IN_PLAY', minute: 59, home_score: 2, away_score: 1, goals: [maddison, rudoni, marmoush] }),
    row({ status: 'FINISHED', minute: null, home_score: 2, away_score: 1, goals: [maddison, rudoni, marmoush] }),
  ];

  it('posts each event once, however often the poller sees it', () => {
    const posts = table();
    for (const state of timeline) {
      posts.run(state);
      posts.run(state); // a retry or overlapping run
    }
    expect(posts.ids()).toEqual(
      [
        'mc:gw7:ft:9',
        'mc:gw7:goal:9:A1',
        'mc:gw7:goal:9:H1',
        'mc:gw7:goal:9:H2',
        'mc:gw7:gw-open:7',
        'mc:gw7:ht:9',
        'mc:gw7:ko:9',
        'mc:gw7:sh:9',
        'mc:gw7:xi-sheet:9',
        'mc:gw7:xi:9',
      ].sort()
    );
    expect(posts.writes.filter((write) => write.startsWith('~'))).toEqual([]);
  });

  it('shows 1–0 at half-time, matching the goal before it', () => {
    const posts = table();
    timeline.forEach((state) => posts.run(state));
    expect(posts.get('ht:9')?.details).toEqual({ score: { home: 1, away: 0 } });
    expect(posts.get('goal:9:H1')?.details).toMatchObject({ scorer: 'James Maddison', minute: 14, score_after: { home: 1, away: 0 } });
    expect(posts.get('goal:9:H2')?.details).toMatchObject({ score_after: { home: 2, away: 1 } });
    expect(posts.get('ft:9')?.details).toEqual({ score: { home: 2, away: 1 } });
  });

  it('adds a second half for a match first seen at full-time', () => {
    const posts = table();
    posts.run(timeline[timeline.length - 1] as LiveRowForPosts);
    expect(posts.get('sh:9')).toMatchObject({ kind: 'second-half', occurred_minute: 46 });
    expect(posts.get('ht:9')?.details).toEqual({ score: { home: 1, away: 0 } });
  });

  it('keeps the first publish time when nothing new happens', () => {
    const posts = table();
    timeline.slice(0, 3).forEach((state) => posts.run(state));
    const published = posts.get('goal:9:H1')?.published_at;
    posts.run(timeline[2] as LiveRowForPosts);
    posts.run(timeline[3] as LiveRowForPosts);
    expect(posts.get('goal:9:H1')?.published_at).toBe(published);
  });
});

describe('corrections', () => {
  const live = (goals: unknown[], home = 1, away = 0) => row({ status: 'IN_PLAY', minute: 30, home_score: home, away_score: away, goals });

  it('updates the same post when the scorer is corrected', () => {
    const posts = table();
    posts.run(live([maddison]));
    const published = posts.get('goal:9:H1')?.published_at;
    posts.run(live([{ ...maddison, scorer: 'Dominic Solanke', scorerId: 7003 }]));
    expect(posts.ids().filter((id) => id.includes(':goal:'))).toEqual(['mc:gw7:goal:9:H1']);
    expect(posts.get('goal:9:H1')).toMatchObject({ revision: 2, published_at: published, details: { scorer: 'Dominic Solanke' } });
  });

  it('updates the same post when the minute is corrected', () => {
    const posts = table();
    posts.run(live([maddison]));
    posts.run(live([{ ...maddison, minute: 16 }]));
    expect(posts.get('goal:9:H1')).toMatchObject({ occurred_minute: 16, details: { minute: 16 } });
  });

  it('rules out a disallowed goal and brings it back if VAR changes its mind', () => {
    const posts = table();
    posts.run(live([maddison]));
    posts.run(live([], 0, 0));
    expect(posts.get('goal:9:H1')?.status).toBe('ruled_out');
    posts.run(live([maddison]));
    expect(posts.get('goal:9:H1')?.status).toBe('active');
    expect(posts.ids().filter((id) => id.includes(':goal:'))).toEqual(['mc:gw7:goal:9:H1']);
  });

  it('gives a later goal a new number, never a ruled-out one', () => {
    const posts = table();
    posts.run(live([maddison]));
    posts.run(live([], 0, 0));
    posts.run(live([{ ...marmoush, minute: 40 }]));
    expect(posts.get('goal:9:H1')?.status).toBe('ruled_out');
    expect(posts.get('goal:9:H2')).toMatchObject({ status: 'active', details: { scorer: 'Omar Marmoush' } });
  });

  it('moves an own goal reclassified to the other side', () => {
    const posts = table();
    posts.run(live([maddison]));
    posts.run(live([{ ...maddison, team: 'Coventry City', isOwnGoal: true }], 0, 1));
    expect(posts.get('goal:9:H1')?.status).toBe('ruled_out');
    expect(posts.get('goal:9:A1')).toMatchObject({ status: 'active', details: { own_goal: true, side: 'A' } });
  });

  it('never lets an older source overwrite a newer one', () => {
    const posts = table();
    posts.run(live([maddison]), '2026-10-19T19:20:00Z');
    posts.run(live([{ ...maddison, scorer: 'Old Name' }]), '2026-10-19T19:10:00Z');
    expect(posts.get('goal:9:H1')?.details).toMatchObject({ scorer: 'James Maddison' });
  });

  it('voids the match when it is postponed', () => {
    const posts = table();
    posts.run(live([maddison]));
    posts.run(row({ status: 'POSTPONED' }));
    expect([...posts.rows.values()].filter((post) => post.api_match_id === 560606).every((post) => post.status === 'void')).toBe(true);
  });
});

describe('the gameweek opener', () => {
  it('is posted once, by the first match with line-ups', () => {
    const posts = table();
    posts.run(row({}));
    const { inserts } = posts.run(row({ api_match_id: 560607, fixture_index: 4, home_team: 'Newcastle', away_team: 'Villa' }));
    expect(inserts.map((insert) => insert.id)).toEqual(['mc:gw7:xi:4', 'mc:gw7:xi-sheet:4']);
  });
});

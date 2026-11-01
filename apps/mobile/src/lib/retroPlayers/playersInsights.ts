import { createPlayersPuzzle, parseSeasonStartYear, type PlayersCard } from './buildPuzzle';
import { playersDaySeedFromKey } from './day';
import type { PlayerClubApp } from './seedApps';
import type { PlayersScoreStore } from './scores';

export type PlayersClubInsight = {
  code: string;
  name: string;
  correct: number;
  seen: number;
  percentage: number;
};

export type PlayersEraKey = '90s' | '00s' | 'recent';

export type PlayersEraInsight = {
  key: PlayersEraKey;
  label: string;
  correct: number;
  seen: number;
};

export type PlayersInsightStats = {
  know: PlayersClubInsight | null;
  fool: PlayersClubInsight | null;
  eras: PlayersEraInsight[];
};

const ERA_LABEL: Record<PlayersEraKey, string> = {
  '90s': '90s',
  '00s': '00s',
  recent: 'Recent',
};

const ERA_ORDER: PlayersEraKey[] = ['90s', '00s', 'recent'];

/** A miss ends the run, so only the hits plus the one miss were seen. */
export function inferPlayedOutcomes(correct: number, total: number): Array<'hit' | 'miss'> {
  const hits = Math.max(0, Math.min(Math.floor(correct), Math.floor(total)));
  const out: Array<'hit' | 'miss'> = [];
  for (let i = 0; i < hits; i++) out.push('hit');
  if (hits < total) out.push('miss');
  return out;
}

export function eraForQuestionSeason(season: string | null | undefined): PlayersEraKey | null {
  const year = season ? parseSeasonStartYear(season) : null;
  if (year == null) return null;
  if (year < 2000) return '90s';
  if (year < 2010) return '00s';
  return 'recent';
}

type InsightCard = Pick<PlayersCard, 'questionSeason'> & {
  correct: { clubCode: string; clubName: string };
};

export function accumulatePlayersInsights(
  days: Array<{ cards: InsightCard[]; correct: number; total: number }>
): PlayersInsightStats {
  const clubs = new Map<string, { name: string; correct: number; seen: number }>();
  const eras = new Map<PlayersEraKey, { correct: number; seen: number }>();

  for (const day of days) {
    const outcomes = inferPlayedOutcomes(day.correct, day.total);
    for (let i = 0; i < outcomes.length; i++) {
      const card = day.cards[i];
      if (!card) break;
      const hit = outcomes[i] === 'hit';
      const code = String(card.correct.clubCode ?? '')
        .trim()
        .toUpperCase();
      if (code) {
        const cur = clubs.get(code) ?? { name: card.correct.clubName, correct: 0, seen: 0 };
        cur.seen += 1;
        if (hit) cur.correct += 1;
        cur.name = card.correct.clubName || cur.name;
        clubs.set(code, cur);
      }
      const era = eraForQuestionSeason(card.questionSeason);
      if (era) {
        const cur = eras.get(era) ?? { correct: 0, seen: 0 };
        cur.seen += 1;
        if (hit) cur.correct += 1;
        eras.set(era, cur);
      }
    }
  }

  const clubList: PlayersClubInsight[] = [];
  clubs.forEach((row, code) => {
    if (row.seen < 1) return;
    clubList.push({
      code,
      name: row.name,
      correct: row.correct,
      seen: row.seen,
      percentage: (row.correct / row.seen) * 100,
    });
  });

  const minSeen = clubList.some((c) => c.seen >= 2) ? 2 : 1;
  const eligible = clubList.filter((c) => c.seen >= minSeen);
  const pick = (preferHigh: boolean): PlayersClubInsight | null => {
    let best: PlayersClubInsight | null = null;
    for (const club of eligible) {
      if (!best) {
        best = club;
        continue;
      }
      const betterPct = preferHigh ? club.percentage > best.percentage : club.percentage < best.percentage;
      const samePct = club.percentage === best.percentage && club.seen > best.seen;
      if (betterPct || samePct) best = club;
    }
    return best;
  };

  return {
    know: pick(true),
    fool: pick(false),
    eras: ERA_ORDER.flatMap((key) => {
      const row = eras.get(key);
      if (!row || row.seen < 1) return [];
      return [{ key, label: ERA_LABEL[key], correct: row.correct, seen: row.seen }];
    }),
  };
}

/** Rebuild each day's puzzle from the shared seed, then credit only cards that were actually seen. */
export function computePlayersInsightStats(
  store: PlayersScoreStore | undefined,
  rows: PlayerClubApp[] | undefined
): PlayersInsightStats {
  if (!store || !rows?.length) return { know: null, fool: null, eras: [] };
  const days = Object.entries(store).flatMap(([dayKey, score]) => {
    const correct = Number(score?.correct);
    const total = Number(score?.total);
    if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) return [];
    const puzzle = createPlayersPuzzle(rows, playersDaySeedFromKey(dayKey));
    return [{ cards: puzzle.cards, correct, total }];
  });
  return accumulatePlayersInsights(days);
}

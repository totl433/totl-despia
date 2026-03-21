import { areTeamNamesSimilar } from '../../../../src/lib/teamNames';

export type GoalEventLike = {
  team?: string | null;
  scorer?: string | null;
  minute?: number | null;
  isOwnGoal?: boolean | null;
  isPenalty?: boolean | null;
  type?: string | null;
};

export type RedCardEventLike = {
  team?: string | null;
  player?: string | null;
  minute?: number | null;
  playerId?: number | null;
  teamId?: number | null;
};

function normalizeTeamMatchValue(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseGoalEvents(raw: unknown): GoalEventLike[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((goal) => (goal && typeof goal === 'object' ? (goal as Record<string, unknown>) : null))
    .filter(Boolean)
    .map((goal) => {
      const rawType = typeof goal?.type === 'string' ? goal.type.trim().toUpperCase() : null;
      const scorer = typeof goal?.scorer === 'string' ? goal.scorer : null;
      const inferredOwnGoal =
        rawType === 'OWN' ||
        rawType === 'OWN_GOAL' ||
        rawType === 'OWN GOAL' ||
        (typeof scorer === 'string' && scorer.toLowerCase().includes('own goal'));
      const inferredPenalty = rawType === 'PENALTY' || rawType === 'PEN';

      return {
        team: typeof goal?.team === 'string' ? goal.team : null,
        scorer,
        minute: typeof goal?.minute === 'number' ? goal.minute : null,
        isOwnGoal: typeof goal?.isOwnGoal === 'boolean' ? goal.isOwnGoal : inferredOwnGoal,
        isPenalty: typeof goal?.isPenalty === 'boolean' ? goal.isPenalty : inferredPenalty,
        type: rawType,
      };
    });
}

export function parseRedCardEvents(raw: unknown): RedCardEventLike[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((card) => (card && typeof card === 'object' ? (card as Record<string, unknown>) : null))
    .filter(Boolean)
    .map((card) => ({
      team: typeof card?.team === 'string' ? card.team : null,
      player: typeof card?.player === 'string' ? card.player : null,
      minute: typeof card?.minute === 'number' ? card.minute : null,
      playerId: typeof card?.playerId === 'number' ? card.playerId : null,
      teamId: typeof card?.teamId === 'number' ? card.teamId : null,
    }));
}

export function countRedCardsForTeam(raw: unknown, candidates: string[]): number {
  const normalizedCandidates = candidates.map((candidate) => normalizeTeamMatchValue(candidate)).filter(Boolean);
  if (!normalizedCandidates.length) return 0;

  return parseRedCardEvents(raw).filter((card) => {
    const team = normalizeTeamMatchValue(card.team);
    if (!team) return false;
    return normalizedCandidates.some((candidate) =>
      team.includes(candidate) ||
      candidate.includes(team) ||
      areTeamNamesSimilar(team, candidate)
    );
  }).length;
}

export function getGoalTag(goal: GoalEventLike): 'OG' | 'Pen' | null {
  if (goal.isOwnGoal === true) return 'OG';
  if (goal.isPenalty === true) return 'Pen';
  return null;
}

export function formatGoalMinuteForScorerLine(goal: GoalEventLike): string {
  if (typeof goal.minute !== 'number') return '';
  const tag = getGoalTag(goal);
  return tag ? `${goal.minute}' (${tag})` : `${goal.minute}'`;
}

export function formatGoalMinuteForTicker(goal: GoalEventLike): string {
  if (typeof goal.minute !== 'number') return '';
  const tag = getGoalTag(goal);
  return tag ? `(${goal.minute}' ${tag})` : `(${goal.minute}')`;
}

function getScorerSurname(value: string | null | undefined): string {
  const full = String(value ?? '').trim();
  if (!full) return 'Unknown';
  const parts = full.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? full;
}

export function buildGoalScorerLines(raw: unknown, teamCandidates: string[]): string[] {
  const goals = parseGoalEvents(raw);
  if (!goals.length) return [];

  const filteredGoals = goals.filter((goal) => {
    const team = String(goal.team ?? '');
    if (!team) return false;
    return teamCandidates.some((candidate) => areTeamNamesSimilar(team, candidate) || team.toLowerCase() === candidate.toLowerCase());
  });
  if (!filteredGoals.length) return [];

  const byScorer = new Map<string, GoalEventLike[]>();
  filteredGoals.forEach((goal) => {
    if (typeof goal.minute !== 'number') return;
    const scorer = getScorerSurname(goal.scorer);
    const group = byScorer.get(scorer) ?? [];
    group.push(goal);
    byScorer.set(scorer, group);
  });

  return Array.from(byScorer.entries()).map(([scorer, scorerGoals]) => {
    const minutes = [...scorerGoals]
      .sort((a, b) => Number(a.minute ?? 0) - Number(b.minute ?? 0))
      .map((goal) => formatGoalMinuteForScorerLine(goal))
      .join(', ');
    return `${scorer} ${minutes}`.trim();
  });
}

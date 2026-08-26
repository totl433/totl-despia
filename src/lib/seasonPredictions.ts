/** Season Predictions side game for the four Prem Predictions players. Web only. */

export const SEASON_PREDICTIONS_SEASON_KEY = '2026-27';

/** 10pm UK on 1 Sep 2026. UK is on BST then, so 21:00 UTC. */
export const SEASON_PREDICTIONS_DEADLINE = new Date('2026-09-01T21:00:00.000Z');

export const JOF_USER_ID = '4542c037-5b38-40d0-b189-847b8f17c222';

export const SEASON_PREDICTION_PLAYER_IDS = [
  JOF_USER_ID,
  '9c0bcf50-370d-412d-8826-95371a72b4fe', // SP
  '36f31625-6d6c-4aa4-815a-1493a812841b', // ThomasJamesBird
  'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
] as const;

export const SEASON_PREDICTION_PLAYER_NAMES: Record<string, string> = {
  [JOF_USER_ID]: 'Jof',
  '9c0bcf50-370d-412d-8826-95371a72b4fe': 'SP',
  '36f31625-6d6c-4aa4-815a-1493a812841b': 'ThomasJamesBird',
  'f8a1669e-2512-4edf-9c21-b9f87b3efbe2': 'Carl',
};

export type SeasonPredictionClub = {
  code: string;
  name: string;
};

export const SEASON_PREDICTION_CLUBS: SeasonPredictionClub[] = [
  { code: 'ARS', name: 'Arsenal' },
  { code: 'AVL', name: 'Aston Villa' },
  { code: 'BOU', name: 'Bournemouth' },
  { code: 'BRE', name: 'Brentford' },
  { code: 'BHA', name: 'Brighton' },
  { code: 'CHE', name: 'Chelsea' },
  { code: 'COV', name: 'Coventry' },
  { code: 'CRY', name: 'Crystal Palace' },
  { code: 'EVE', name: 'Everton' },
  { code: 'FUL', name: 'Fulham' },
  { code: 'HUL', name: 'Hull City' },
  { code: 'IPS', name: 'Ipswich' },
  { code: 'LEE', name: 'Leeds' },
  { code: 'LIV', name: 'Liverpool' },
  { code: 'MCI', name: 'Manchester City' },
  { code: 'MUN', name: 'Manchester United' },
  { code: 'NEW', name: 'Newcastle' },
  { code: 'NFO', name: 'Nottingham Forest' },
  { code: 'SUN', name: 'Sunderland' },
  { code: 'TOT', name: 'Tottenham' },
];

export type SeasonPredictionManager = {
  id: string;
  name: string;
  club: string;
};

/** 20 starting 2026/27 managers. id is the club code they started at. */
export const SEASON_PREDICTION_MANAGERS: SeasonPredictionManager[] = [
  { id: 'ARS', name: 'Mikel Arteta', club: 'Arsenal' },
  { id: 'AVL', name: 'Unai Emery', club: 'Aston Villa' },
  { id: 'BOU', name: 'Marco Rose', club: 'Bournemouth' },
  { id: 'BRE', name: 'Keith Andrews', club: 'Brentford' },
  { id: 'BHA', name: 'Fabian Hürzeler', club: 'Brighton' },
  { id: 'CHE', name: 'Xabi Alonso', club: 'Chelsea' },
  { id: 'COV', name: 'Frank Lampard', club: 'Coventry' },
  { id: 'CRY', name: 'Pierre Sage', club: 'Crystal Palace' },
  { id: 'EVE', name: 'David Moyes', club: 'Everton' },
  { id: 'FUL', name: 'Álvaro Arbeloa', club: 'Fulham' },
  { id: 'HUL', name: 'Sergej Jakirović', club: 'Hull City' },
  { id: 'IPS', name: "Gary O'Neil", club: 'Ipswich' },
  { id: 'LEE', name: 'Daniel Farke', club: 'Leeds' },
  { id: 'LIV', name: 'Andoni Iraola', club: 'Liverpool' },
  { id: 'MCI', name: 'Enzo Maresca', club: 'Manchester City' },
  { id: 'MUN', name: 'Michael Carrick', club: 'Manchester United' },
  { id: 'NEW', name: 'Matthias Jaissle', club: 'Newcastle' },
  { id: 'NFO', name: 'Oliver Glasner', club: 'Nottingham Forest' },
  { id: 'SUN', name: 'Régis Le Bris', club: 'Sunderland' },
  { id: 'TOT', name: 'Roberto De Zerbi', club: 'Tottenham' },
];

export const TOP_POSITIONS = [1, 2, 3, 4, 5, 6] as const;
export const BOTTOM_POSITIONS = [18, 19, 20] as const;

export type TopPosition = (typeof TOP_POSITIONS)[number];
export type BottomPosition = (typeof BOTTOM_POSITIONS)[number];
export type TablePosition = TopPosition | BottomPosition;

export type SeasonPredictionPicks = {
  pos1: string | null;
  pos2: string | null;
  pos3: string | null;
  pos4: string | null;
  pos5: string | null;
  pos6: string | null;
  pos18: string | null;
  pos19: string | null;
  pos20: string | null;
  haalandGoals: number | null;
  firstManagerId: string | null;
  highestScorer: string;
  mostAssists: string;
};

export type SeasonPredictionResults = SeasonPredictionPicks;

export type SeasonPredictionScoreBreakdown = {
  top: number[];
  bottom: number[];
  haalandGoals: number;
  firstManager: number;
  highestScorer: number;
  mostAssists: number;
  total: number;
};

export type NamedSeasonPicks = {
  userId: string;
  name: string;
  submitted: boolean;
  picks: SeasonPredictionPicks;
};

export type SeasonPredictionPlayerStatus = {
  userId: string;
  name: string;
  submitted: boolean;
};

const CLUB_BY_CODE = new Map(SEASON_PREDICTION_CLUBS.map((club) => [club.code, club]));
const MANAGER_BY_ID = new Map(SEASON_PREDICTION_MANAGERS.map((manager) => [manager.id, manager]));

export function isSeasonPredictionsPlayer(userId: string | null | undefined): boolean {
  return !!userId && (SEASON_PREDICTION_PLAYER_IDS as readonly string[]).includes(userId);
}

export function isSeasonPredictionsResultsEditor(userId: string | null | undefined): boolean {
  return userId === JOF_USER_ID;
}

export function playerStatusFromRows(
  rows: Array<{ user_id: string; submitted: boolean }>
): SeasonPredictionPlayerStatus[] {
  const byId = new Map(rows.map((row) => [row.user_id, row.submitted]));
  return SEASON_PREDICTION_PLAYER_IDS.map((userId) => ({
    userId,
    name: SEASON_PREDICTION_PLAYER_NAMES[userId] || 'Player',
    submitted: !!byId.get(userId),
  }));
}

export function allPlayersSubmitted(status: SeasonPredictionPlayerStatus[]): boolean {
  return (
    status.length === SEASON_PREDICTION_PLAYER_IDS.length &&
    status.every((player) => player.submitted)
  );
}

/** Waiting-room mock for Storybook and the Jof-only `?preview=lobby` view. */
export function mockSeasonPredictionLobby(): SeasonPredictionPlayerStatus[] {
  return playerStatusFromRows([
    { user_id: JOF_USER_ID, submitted: true },
    { user_id: '9c0bcf50-370d-412d-8826-95371a72b4fe', submitted: false },
    { user_id: '36f31625-6d6c-4aa4-815a-1493a812841b', submitted: false },
    { user_id: 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', submitted: false },
  ]);
}

export function emptySeasonPredictionPicks(): SeasonPredictionPicks {
  return {
    pos1: null,
    pos2: null,
    pos3: null,
    pos4: null,
    pos5: null,
    pos6: null,
    pos18: null,
    pos19: null,
    pos20: null,
    haalandGoals: null,
    firstManagerId: null,
    highestScorer: '',
    mostAssists: '',
  };
}

export function clubName(code: string | null | undefined): string {
  if (!code) return '—';
  return CLUB_BY_CODE.get(code)?.name ?? code;
}

export function managerLabel(id: string | null | undefined): string {
  if (!id) return '—';
  const manager = MANAGER_BY_ID.get(id);
  return manager ? `${manager.name} (${manager.club})` : id;
}

export function getPositionClub(picks: SeasonPredictionPicks, position: TablePosition): string | null {
  return picks[`pos${position}` as const];
}

export function setPositionClub(
  picks: SeasonPredictionPicks,
  position: TablePosition,
  code: string | null
): SeasonPredictionPicks {
  return { ...picks, [`pos${position}`]: code };
}

export function usedClubCodes(picks: SeasonPredictionPicks, exceptPosition?: TablePosition): string[] {
  const positions: TablePosition[] = [...TOP_POSITIONS, ...BOTTOM_POSITIONS];
  return positions
    .filter((position) => position !== exceptPosition)
    .map((position) => getPositionClub(picks, position))
    .filter((code): code is string => !!code);
}

export function isSeasonPredictionsDeadlinePassed(now: Date = new Date()): boolean {
  return now.getTime() >= SEASON_PREDICTIONS_DEADLINE.getTime();
}

export function formatSeasonPredictionsDeadline(): string {
  return '10pm UK, 1 September 2026';
}

export function normalizePlayerName(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function playerNamesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizePlayerName(a);
  const right = normalizePlayerName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length >= 4 && longer.includes(shorter)) return true;
  const leftLast = left.split(' ').pop() || '';
  const rightLast = right.split(' ').pop() || '';
  return leftLast.length >= 4 && leftLast === rightLast;
}

export function validateSeasonPredictionPicks(picks: SeasonPredictionPicks): string[] {
  const errors: string[] = [];
  const clubs: string[] = [];

  for (const position of TOP_POSITIONS) {
    const code = getPositionClub(picks, position);
    if (!code) errors.push(`Pick the team in ${position}${ordinalSuffix(position)}`);
    else clubs.push(code);
  }

  for (const position of BOTTOM_POSITIONS) {
    const code = getPositionClub(picks, position);
    if (!code) errors.push(`Pick the team in ${position}${ordinalSuffix(position)}`);
    else clubs.push(code);
  }

  if (new Set(clubs).size !== clubs.length) {
    errors.push('Top 6 and bottom 3 must be nine different clubs');
  }

  if (picks.haalandGoals == null || !Number.isInteger(picks.haalandGoals) || picks.haalandGoals < 0) {
    errors.push('Enter Haaland’s Premier League goals as a whole number');
  }

  if (!picks.firstManagerId) {
    errors.push('Pick the first starting manager to be sacked');
  }

  if (!normalizePlayerName(picks.highestScorer)) {
    errors.push('Enter the highest scorer (not Haaland)');
  }

  if (!normalizePlayerName(picks.mostAssists)) {
    errors.push('Enter the player with the most assists');
  }

  return errors;
}

export function positionPoints(predicted: string | null, actualGroup: string[], actualAtPosition: string | null): number {
  if (!predicted || !actualAtPosition) return 0;
  if (predicted === actualAtPosition) return 3;
  if (actualGroup.includes(predicted)) return 1;
  return 0;
}

function groupCodes(results: SeasonPredictionResults, positions: readonly TablePosition[]): string[] {
  return positions
    .map((position) => getPositionClub(results, position))
    .filter((code): code is string => !!code);
}

function closestAward(values: Array<{ userId: string; value: number | null }>, actual: number | null): Record<string, number> {
  const points: Record<string, number> = {};
  if (actual == null || !Number.isFinite(actual)) return points;

  const eligible = values.filter((entry) => entry.value != null && Number.isFinite(entry.value));
  if (eligible.length === 0) return points;

  const best = Math.min(...eligible.map((entry) => Math.abs((entry.value as number) - actual)));
  for (const entry of eligible) {
    points[entry.userId] = Math.abs((entry.value as number) - actual) === best ? 1 : 0;
  }
  return points;
}

function exactAward(
  values: Array<{ userId: string; value: string | null }>,
  actual: string | null,
  matches: (guess: string | null, official: string | null) => boolean
): Record<string, number> {
  const points: Record<string, number> = {};
  if (!actual) return points;

  for (const entry of values) {
    points[entry.userId] = matches(entry.value, actual) ? 1 : 0;
  }
  return points;
}

export function scoreSeasonPredictions(
  entries: NamedSeasonPicks[],
  results: SeasonPredictionResults | null
): Record<string, SeasonPredictionScoreBreakdown> {
  const submitted = entries.filter((entry) => entry.submitted);
  const emptyBreakdown = (): SeasonPredictionScoreBreakdown => ({
    top: [0, 0, 0, 0, 0, 0],
    bottom: [0, 0, 0],
    haalandGoals: 0,
    firstManager: 0,
    highestScorer: 0,
    mostAssists: 0,
    total: 0,
  });

  const scores: Record<string, SeasonPredictionScoreBreakdown> = {};
  for (const entry of submitted) scores[entry.userId] = emptyBreakdown();
  if (!results) return scores;

  const actualTop = groupCodes(results, TOP_POSITIONS);
  const actualBottom = groupCodes(results, BOTTOM_POSITIONS);

  for (const entry of submitted) {
    const breakdown = scores[entry.userId];
    TOP_POSITIONS.forEach((position, index) => {
      breakdown.top[index] = positionPoints(
        getPositionClub(entry.picks, position),
        actualTop,
        getPositionClub(results, position)
      );
    });
    BOTTOM_POSITIONS.forEach((position, index) => {
      breakdown.bottom[index] = positionPoints(
        getPositionClub(entry.picks, position),
        actualBottom,
        getPositionClub(results, position)
      );
    });
  }

  const haaland = closestAward(
    submitted.map((entry) => ({ userId: entry.userId, value: entry.picks.haalandGoals })),
    results.haalandGoals
  );
  const firstManager = exactAward(
    submitted.map((entry) => ({ userId: entry.userId, value: entry.picks.firstManagerId })),
    results.firstManagerId,
    (guess, official) => String(guess || '').trim().toUpperCase() === String(official || '').trim().toUpperCase()
  );
  const highestScorer = exactAward(
    submitted.map((entry) => ({ userId: entry.userId, value: entry.picks.highestScorer })),
    results.highestScorer,
    playerNamesMatch
  );
  const mostAssists = exactAward(
    submitted.map((entry) => ({ userId: entry.userId, value: entry.picks.mostAssists })),
    results.mostAssists,
    playerNamesMatch
  );

  for (const entry of submitted) {
    const breakdown = scores[entry.userId];
    breakdown.haalandGoals = haaland[entry.userId] ?? 0;
    breakdown.firstManager = firstManager[entry.userId] ?? 0;
    breakdown.highestScorer = highestScorer[entry.userId] ?? 0;
    breakdown.mostAssists = mostAssists[entry.userId] ?? 0;
    breakdown.total =
      breakdown.top.reduce((sum, value) => sum + value, 0) +
      breakdown.bottom.reduce((sum, value) => sum + value, 0) +
      breakdown.haalandGoals +
      breakdown.firstManager +
      breakdown.highestScorer +
      breakdown.mostAssists;
  }

  return scores;
}

export type SeasonPredictionPicksRow = {
  user_id: string;
  pos_1: string | null;
  pos_2: string | null;
  pos_3: string | null;
  pos_4: string | null;
  pos_5: string | null;
  pos_6: string | null;
  pos_18: string | null;
  pos_19: string | null;
  pos_20: string | null;
  haaland_goals: number | null;
  first_manager_id: string | null;
  highest_scorer: string | null;
  most_assists: string | null;
  submitted_at: string | null;
};

export function picksFromRow(row: Partial<SeasonPredictionPicksRow> | null | undefined): SeasonPredictionPicks {
  return {
    pos1: row?.pos_1 ?? null,
    pos2: row?.pos_2 ?? null,
    pos3: row?.pos_3 ?? null,
    pos4: row?.pos_4 ?? null,
    pos5: row?.pos_5 ?? null,
    pos6: row?.pos_6 ?? null,
    pos18: row?.pos_18 ?? null,
    pos19: row?.pos_19 ?? null,
    pos20: row?.pos_20 ?? null,
    haalandGoals: row?.haaland_goals ?? null,
    firstManagerId: row?.first_manager_id ?? null,
    highestScorer: row?.highest_scorer ?? '',
    mostAssists: row?.most_assists ?? '',
  };
}

export function picksToRow(picks: SeasonPredictionPicks): Omit<SeasonPredictionPicksRow, 'user_id' | 'submitted_at'> {
  return {
    pos_1: picks.pos1,
    pos_2: picks.pos2,
    pos_3: picks.pos3,
    pos_4: picks.pos4,
    pos_5: picks.pos5,
    pos_6: picks.pos6,
    pos_18: picks.pos18,
    pos_19: picks.pos19,
    pos_20: picks.pos20,
    haaland_goals: picks.haalandGoals,
    first_manager_id: picks.firstManagerId,
    highest_scorer: picks.highestScorer.trim() || null,
    most_assists: picks.mostAssists.trim() || null,
  };
}

/** Fake reveal used for Storybook and the Jof-only `?preview=reveal` mockup. */
export function mockSeasonPredictionReveal(): {
  entries: NamedSeasonPicks[];
  results: SeasonPredictionPicks;
} {
  const results: SeasonPredictionPicks = {
    ...emptySeasonPredictionPicks(),
    pos1: 'ARS',
    pos2: 'MCI',
    pos3: 'LIV',
    pos4: 'CHE',
    pos5: 'MUN',
    pos6: 'TOT',
    pos18: 'HUL',
    pos19: 'IPS',
    pos20: 'COV',
    haalandGoals: 31,
    firstManagerId: 'HUL',
    highestScorer: 'Alexander Isak',
    mostAssists: 'Bukayo Saka',
  };

  const entries: NamedSeasonPicks[] = [
    {
      userId: JOF_USER_ID,
      name: 'Jof',
      submitted: true,
      picks: {
        ...emptySeasonPredictionPicks(),
        pos1: 'ARS',
        pos2: 'MCI',
        pos3: 'LIV',
        pos4: 'CHE',
        pos5: 'MUN',
        pos6: 'TOT',
        pos18: 'HUL',
        pos19: 'IPS',
        pos20: 'COV',
        haalandGoals: 30,
        firstManagerId: 'HUL',
        highestScorer: 'Isak',
        mostAssists: 'Saka',
      },
    },
    {
      userId: '9c0bcf50-370d-412d-8826-95371a72b4fe',
      name: 'SP',
      submitted: true,
      picks: {
        ...emptySeasonPredictionPicks(),
        pos1: 'MCI',
        pos2: 'ARS',
        pos3: 'CHE',
        pos4: 'LIV',
        pos5: 'TOT',
        pos6: 'NEW',
        pos18: 'COV',
        pos19: 'HUL',
        pos20: 'IPS',
        haalandGoals: 28,
        firstManagerId: 'IPS',
        highestScorer: 'Watkins',
        mostAssists: 'Palmer',
      },
    },
    {
      userId: '36f31625-6d6c-4aa4-815a-1493a812841b',
      name: 'ThomasJamesBird',
      submitted: true,
      picks: {
        ...emptySeasonPredictionPicks(),
        pos1: 'ARS',
        pos2: 'LIV',
        pos3: 'MCI',
        pos4: 'MUN',
        pos5: 'CHE',
        pos6: 'AVL',
        pos18: 'IPS',
        pos19: 'COV',
        pos20: 'HUL',
        haalandGoals: 35,
        firstManagerId: 'HUL',
        highestScorer: 'Alexander Isak',
        mostAssists: 'Saka',
      },
    },
    {
      userId: 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2',
      name: 'Carl',
      submitted: true,
      picks: {
        ...emptySeasonPredictionPicks(),
        pos1: 'LIV',
        pos2: 'ARS',
        pos3: 'CHE',
        pos4: 'MCI',
        pos5: 'NFO',
        pos6: 'BHA',
        pos18: 'HUL',
        pos19: 'SUN',
        pos20: 'COV',
        haalandGoals: 32,
        firstManagerId: 'COV',
        highestScorer: 'Salah',
        mostAssists: 'Bukayo Saka',
      },
    },
  ];

  return { entries, results };
}

export function ordinalSuffix(value: number): string {
  const remainder10 = value % 10;
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return 'th';
  if (remainder10 === 1) return 'st';
  if (remainder10 === 2) return 'nd';
  if (remainder10 === 3) return 'rd';
  return 'th';
}

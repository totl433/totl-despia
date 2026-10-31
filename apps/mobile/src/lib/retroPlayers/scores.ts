import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../supabase';
import { playersMonthKey, playersWeekStart, shiftPlayersDay } from './day';

/** Monday–Sunday headers on The Players week scoreboard. */
export const PLAYERS_WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/**
 * Each account keeps its own copy of its scores on the phone, keyed by user id,
 * so several people can play the same day on one phone and each gets their own
 * results back when they sign in again. The database is the record, so a player
 * still gets one scored game per day on any device.
 * (v2 used one key for the whole phone. It is no longer read: it can't be told
 * whose scores it holds.)
 */
const storageKey = (userId: string) => `totl.players.dailyScores.v3.${userId}`;

export type PlayersDayScore = {
  correct: number;
  total: number;
  /** False while the attempt is being played. Missing means finished. */
  finished?: boolean;
};

export type PlayersScoreStore = Record<string, PlayersDayScore>;

/**
 * Raises the day's attempt to `score`, finishing it if `finished`. A day with no
 * attempt yet starts one. A finished day never changes, and a score never goes down.
 */
export function recordPlayersProgress(
  store: PlayersScoreStore,
  dayKey: string,
  score: { correct: number; total: number },
  finished: boolean
): PlayersScoreStore {
  const current = store[dayKey];
  if (current && current.finished !== false) return store;
  const correct = Math.max(current?.correct ?? 0, Math.min(score.correct, current?.total ?? score.total));
  const next: PlayersDayScore = { correct, total: current?.total ?? score.total };
  if (!finished) next.finished = false;
  return { ...store, [dayKey]: next };
}

/** Attempts left unfinished (the app was closed mid-game) keep the score they had. */
export function settlePlayersAttempts(store: PlayersScoreStore): PlayersScoreStore {
  if (!Object.values(store).some((score) => score?.finished === false)) return store;
  const next: PlayersScoreStore = {};
  for (const [day, score] of Object.entries(store)) next[day] = { correct: score.correct, total: score.total };
  return next;
}

async function signedInUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

async function readLocal(userId: string): Promise<PlayersScoreStore> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PlayersScoreStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeLocal(userId: string, store: PlayersScoreStore): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(store));
}

/** Read-modify-writes of the phone's copy run one at a time, so answers saved in quick succession don't overwrite each other. */
let localQueue: Promise<unknown> = Promise.resolve();
function updateLocal(userId: string, change: (store: PlayersScoreStore) => PlayersScoreStore): Promise<PlayersScoreStore> {
  const run = localQueue.then(async () => {
    const store = await readLocal(userId);
    const next = change(store);
    if (next !== store) await writeLocal(userId, next);
    return next;
  });
  localQueue = run.catch(() => undefined);
  return run;
}

function toScore(row: { correct: unknown; total: unknown }): PlayersDayScore | null {
  const score = { correct: Number(row.correct), total: Number(row.total) };
  return Number.isFinite(score.correct) && Number.isFinite(score.total) ? score : null;
}

/** The database functions from supabase/sql/players_daily_scores_attempts.sql aren't there yet. */
function missingFunction(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST202' || error?.code === '42883';
}

/**
 * The signed-in player's own scores: their copy on this phone, filled in from the
 * database (so history follows them to a new phone or a reinstall).
 */
export async function readPlayersScores(): Promise<PlayersScoreStore> {
  const userId = await signedInUserId();
  if (!userId) return {};
  const local = await readLocal(userId);
  await publishPlayersScores(userId, local);
  const { data, error } = await supabase
    .from('players_daily_scores')
    .select('day_key, correct, total')
    .eq('user_id', userId);
  if (error) {
    console.error('[players scores] read own:', error.message);
    return local;
  }
  return updateLocal(userId, (current) => {
    const merged: PlayersScoreStore = { ...current };
    for (const row of data ?? []) {
      const score = toScore(row);
      // A game being played on this phone keeps its own copy.
      if (score && merged[String(row.day_key)]?.finished !== false) merged[String(row.day_key)] = score;
    }
    return merged;
  });
}

/**
 * Whether the signed-in player already has an attempt for the day, on any device.
 * An attempt in their copy on this phone is uploaded if the server does not have it yet.
 * An attempt already on the server is copied onto the phone.
 */
export async function playersDayAlreadySaved(dayKey: string): Promise<boolean> {
  const userId = await signedInUserId();
  if (!userId) return false;
  const local = await readLocal(userId);
  if (local[dayKey]) {
    await publishPlayersScores(userId, { [dayKey]: local[dayKey] });
    return true;
  }
  const { data, error } = await supabase
    .from('players_daily_scores')
    .select('correct, total')
    .eq('user_id', userId)
    .eq('day_key', dayKey)
    .maybeSingle();
  if (error || !data) return false;
  const score = toScore(data);
  if (!score) return false;
  await updateLocal(userId, (current) => (current[dayKey] ? current : { ...current, [dayKey]: score }));
  return true;
}

/**
 * Finishes any attempt this phone left unfinished, with the score it had. Call when
 * The Players opens, before a game can be in progress.
 */
export async function settlePlayersAttemptsOnPhone(): Promise<void> {
  const userId = await signedInUserId();
  if (!userId) return;
  const before = await readLocal(userId);
  const unfinished = Object.fromEntries(Object.entries(before).filter(([, score]) => score?.finished === false));
  if (!Object.keys(unfinished).length) return;
  const settled = await updateLocal(userId, settlePlayersAttempts);
  await publishPlayersScores(userId, Object.fromEntries(Object.keys(unfinished).map((day) => [day, settled[day]])));
}

/**
 * Starts the day's scored game. It is saved before the first question, so closing
 * the app can't wipe it. False if this account already has an attempt for the day,
 * here or on another device. Offline, the copy on this phone counts and is uploaded later.
 */
export async function startPlayersDay(dayKey: string, total: number): Promise<boolean> {
  const userId = await signedInUserId();
  if (!userId) return true;
  let hadAttempt = false;
  await updateLocal(userId, (store) => {
    hadAttempt = !!store[dayKey];
    return hadAttempt ? store : recordPlayersProgress(store, dayKey, { correct: 0, total }, false);
  });
  if (hadAttempt) return false;
  const { data, error } = await supabase.rpc('players_start_day', { p_day_key: dayKey, p_total: total });
  if (error) {
    // Older database: the score is saved at the end, as before. Offline: the phone's copy stands.
    if (!missingFunction(error)) console.error('[players scores] start:', error.message);
    return true;
  }
  if (data === false) {
    // Already played on another device. Its attempt is the one that counts.
    await updateLocal(userId, (store) => {
      const { [dayKey]: _ours, ...rest } = store;
      return rest;
    });
    await playersDayAlreadySaved(dayKey);
    return false;
  }
  return true;
}

/** Saves the day's attempt after an answer. `finished` once the game is over. */
export async function savePlayersDayProgress(
  dayKey: string,
  score: { correct: number; total: number },
  finished: boolean
): Promise<void> {
  const userId = await signedInUserId();
  if (!userId) return;
  const store = await updateLocal(userId, (current) => recordPlayersProgress(current, dayKey, score, finished));
  if (store[dayKey]) await publishPlayersScores(userId, { [dayKey]: store[dayKey] });
}

/** Scores for every player this account can see, including this account's offline ones. */
export async function readSharedPlayersScores(): Promise<Record<string, PlayersScoreStore>> {
  const userId = await signedInUserId();
  const local = userId ? await readLocal(userId) : {};
  if (userId) await publishPlayersScores(userId, local);

  const shared: Record<string, PlayersScoreStore> = {};
  const { data, error } = await supabase.from('players_daily_scores').select('user_id, day_key, correct, total');
  if (error) {
    console.error('[players scores] read:', error.message);
  } else {
    for (const row of data ?? []) {
      const score = toScore(row);
      if (!score) continue;
      const id = String(row.user_id);
      const bag = shared[id] ?? {};
      bag[String(row.day_key)] = score;
      shared[id] = bag;
    }
  }
  if (userId) shared[userId] = { ...local, ...(shared[userId] ?? {}) };
  return shared;
}

/**
 * Uploads only ever go under the account whose copy they came from. New days are
 * added; an attempt in progress is raised; a finished day on the server never changes.
 */
async function publishPlayersScores(userId: string, store: PlayersScoreStore): Promise<void> {
  const rows = Object.entries(store).flatMap(([day_key, score]) => {
    if (!score || !Number.isFinite(score.correct) || !Number.isFinite(score.total)) return [];
    return [{ day_key, correct: score.correct, total: score.total, finished: score.finished !== false }];
  });
  if (!rows.length) return;
  const { error } = await supabase.rpc('players_record_days', { p_rows: rows });
  if (!error) return;
  if (!missingFunction(error)) {
    console.error('[players scores] publish:', error.message);
    return;
  }
  // Older database: insert finished days only, as before.
  const finishedRows = rows.filter((row) => row.finished).map(({ finished: _f, ...row }) => ({ user_id: userId, ...row }));
  if (!finishedRows.length) return;
  const { error: insertError } = await supabase.from('players_daily_scores').upsert(finishedRows, {
    onConflict: 'user_id,day_key',
    ignoreDuplicates: true,
  });
  if (insertError) console.error('[players scores] publish:', insertError.message);
}

export function scoreForDay(store: PlayersScoreStore, dayKey: string): number | null {
  const row = store[dayKey];
  return row ? row.correct : null;
}

/** Monday (GMT) up to and including the given day, matching the weekly result card. */
export function scoreForWeek(store: PlayersScoreStore, dayKey: string): number | null {
  const monday = playersWeekStart(dayKey);
  const keys = Object.keys(store).filter((key) => key >= monday && key <= dayKey);
  if (!keys.length) return null;
  return keys.reduce((sum, key) => sum + (store[key]?.correct ?? 0), 0);
}

/** One cell per weekday this week (Mon–Sun). Days not played yet, or still ahead, are empty. */
export function scoresForWeekDays(store: PlayersScoreStore, dayKey: string): Array<number | null> {
  const monday = playersWeekStart(dayKey);
  return Array.from({ length: 7 }, (_, index) => {
    const key = shiftPlayersDay(monday, index);
    if (key > dayKey) return null;
    return scoreForDay(store, key);
  });
}

export function scoreForMonth(store: PlayersScoreStore, dayKey: string): number | null {
  const month = playersMonthKey(dayKey);
  const keys = Object.keys(store).filter((key) => key.startsWith(`${month}-`) && key <= dayKey);
  if (!keys.length) return null;
  return keys.reduce((sum, key) => sum + (store[key]?.correct ?? 0), 0);
}

export function scoreOverall(store: PlayersScoreStore): number | null {
  const keys = Object.keys(store);
  if (!keys.length) return null;
  return keys.reduce((sum, key) => sum + (store[key]?.correct ?? 0), 0);
}

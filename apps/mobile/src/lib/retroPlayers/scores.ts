import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../supabase';
import { playersMonthKey, playersWeekStart } from './day';

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
};

export type PlayersScoreStore = Record<string, PlayersDayScore>;

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

function toScore(row: { correct: unknown; total: unknown }): PlayersDayScore | null {
  const score = { correct: Number(row.correct), total: Number(row.total) };
  return Number.isFinite(score.correct) && Number.isFinite(score.total) ? score : null;
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
  const merged: PlayersScoreStore = { ...local };
  for (const row of data ?? []) {
    const score = toScore(row);
    if (score) merged[String(row.day_key)] = score;
  }
  await writeLocal(userId, merged);
  return merged;
}

/**
 * Whether the signed-in player already has a saved score for the day, on any device.
 * A score in their copy on this phone is uploaded if the server does not have it yet.
 * A score already on the server is copied onto the phone.
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
  local[dayKey] = score;
  await writeLocal(userId, local);
  return true;
}

/** First finish of a Players day is the one that counts. Later writes are ignored. */
export async function savePlayersDayScore(dayKey: string, score: PlayersDayScore): Promise<void> {
  const userId = await signedInUserId();
  if (!userId) return;
  const store = await readLocal(userId);
  if (!store[dayKey]) {
    store[dayKey] = score;
    await writeLocal(userId, store);
  }
  await publishPlayersScores(userId, { [dayKey]: store[dayKey] });
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

/** Uploads only ever go under the account whose copy they came from. */
async function publishPlayersScores(userId: string, store: PlayersScoreStore): Promise<void> {
  const rows = Object.entries(store).flatMap(([day_key, score]) => {
    if (!score || !Number.isFinite(score.correct) || !Number.isFinite(score.total)) return [];
    return [{ user_id: userId, day_key, correct: score.correct, total: score.total }];
  });
  if (!rows.length) return;
  const { error } = await supabase.from('players_daily_scores').upsert(rows, {
    onConflict: 'user_id,day_key',
    ignoreDuplicates: true,
  });
  if (error) console.error('[players scores] publish:', error.message);
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

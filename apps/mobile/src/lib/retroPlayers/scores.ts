import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../supabase';
import { playersMonthKey } from './day';

const STORAGE_KEY = 'totl.players.dailyScores.v2';

export type PlayersDayScore = {
  correct: number;
  total: number;
};

export type PlayersScoreStore = Record<string, PlayersDayScore>;

export async function readPlayersScores(): Promise<PlayersScoreStore> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PlayersScoreStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Whether this player already has a saved score for the day.
 * The database is the record. A score already on the phone is uploaded if the
 * server does not have it yet. A score already on the server is copied onto the phone.
 */
export async function playersDayAlreadySaved(dayKey: string): Promise<boolean> {
  const local = await readPlayersScores();
  if (local[dayKey]) {
    await publishPlayersScores({ [dayKey]: local[dayKey] });
    return true;
  }
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return false;
  const { data, error } = await supabase
    .from('players_daily_scores')
    .select('correct, total')
    .eq('user_id', userId)
    .eq('day_key', dayKey)
    .maybeSingle();
  if (error || !data) return false;
  const score = { correct: Number(data.correct), total: Number(data.total) };
  if (!Number.isFinite(score.correct) || !Number.isFinite(score.total)) return false;
  local[dayKey] = score;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(local));
  return true;
}

/** First finish of a Players day is the one that counts. Later writes are ignored. */
export async function savePlayersDayScore(dayKey: string, score: PlayersDayScore): Promise<void> {
  const store = await readPlayersScores();
  if (!store[dayKey]) {
    store[dayKey] = score;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  await publishPlayersScores({ [dayKey]: store[dayKey] });
}

/** Scores for every player this account can see, including this phone's own. */
export async function readSharedPlayersScores(): Promise<Record<string, PlayersScoreStore>> {
  const local = await readPlayersScores();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  if (userId) await publishPlayersScores(local);

  const shared: Record<string, PlayersScoreStore> = {};
  const { data, error } = await supabase.from('players_daily_scores').select('user_id, day_key, correct, total');
  if (error) {
    console.error('[players scores] read:', error.message);
  } else {
    for (const row of data ?? []) {
      const id = String(row.user_id);
      const bag = shared[id] ?? {};
      bag[String(row.day_key)] = { correct: Number(row.correct), total: Number(row.total) };
      shared[id] = bag;
    }
  }
  if (userId) shared[userId] = { ...local, ...(shared[userId] ?? {}) };
  return shared;
}

async function publishPlayersScores(store: PlayersScoreStore): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;
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

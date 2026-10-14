import AsyncStorage from '@react-native-async-storage/async-storage';

import { playersMonthKey } from './day';

const STORAGE_KEY = 'totl.players.dailyScores.v1';

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

/** First finish of a Players day is the one that counts. Later writes are ignored. */
export async function savePlayersDayScore(dayKey: string, score: PlayersDayScore): Promise<void> {
  const store = await readPlayersScores();
  if (store[dayKey]) return;
  store[dayKey] = score;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function scoreForDay(store: PlayersScoreStore, dayKey: string): number | null {
  const row = store[dayKey];
  return row ? row.correct : null;
}

export function scoreForMonth(store: PlayersScoreStore, dayKey: string): number | null {
  const month = playersMonthKey(dayKey);
  const keys = Object.keys(store).filter((key) => key.startsWith(`${month}-`));
  if (!keys.length) return null;
  return keys.reduce((sum, key) => sum + (store[key]?.correct ?? 0), 0);
}

export function scoreOverall(store: PlayersScoreStore): number | null {
  const keys = Object.keys(store);
  if (!keys.length) return null;
  return keys.reduce((sum, key) => sum + (store[key]?.correct ?? 0), 0);
}

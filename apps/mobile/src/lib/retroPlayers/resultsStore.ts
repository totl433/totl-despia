import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../supabase';
import {
  markPlayersResultSeen,
  mergePlayersResultsSeen,
  parsePlayersResultsSeen,
  pendingPlayersResults,
  type PlayersResult,
  type PlayersResultPeriod,
  type PlayersResultsSeen,
} from './results';
import { readSharedPlayersScores } from './scores';

/**
 * Loading the result cards, and remembering which ones a player has acknowledged.
 * Acknowledgements are kept on the account (auth user metadata, as the display
 * name is) so they follow the player to another phone, with a copy on this phone
 * per account for offline use.
 */
const METADATA_KEY = 'players_results_seen';
const storageKey = (userId: string) => `totl.players.resultsSeen.v1.${userId}`;

async function readLocal(userId: string): Promise<PlayersResultsSeen> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    return raw ? parsePlayersResultsSeen(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

async function readAccount(): Promise<PlayersResultsSeen> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return {};
  return parsePlayersResultsSeen(data.user?.user_metadata?.[METADATA_KEY]);
}

export async function readPlayersResultsSeen(userId: string): Promise<PlayersResultsSeen> {
  const [local, account] = await Promise.all([readLocal(userId), readAccount()]);
  return mergePlayersResultsSeen(local, account);
}

export async function markPlayersResultSeenFor(
  userId: string,
  period: PlayersResultPeriod,
  key: string
): Promise<void> {
  const local = await readLocal(userId);
  const nextLocal = markPlayersResultSeen(local, period, key);
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(nextLocal));
  } catch {
    // The account copy below still records it.
  }
  const account = await readAccount();
  const nextAccount = markPlayersResultSeen(mergePlayersResultsSeen(account, nextLocal), period, key);
  if (JSON.stringify(nextAccount) === JSON.stringify(account)) return;
  const { error } = await supabase.auth.updateUser({ data: { [METADATA_KEY]: nextAccount } });
  if (error) console.error('[players results] save seen:', error.message);
}

export type PlayersResultCards = {
  userId: string;
  results: PlayersResult[];
  /** Display names of the winners the cards mention. */
  names: Record<string, string>;
};

/** The signed-in player's unseen result cards for the day, monthly first. */
export async function loadPlayersResultCards(todayKey: string): Promise<PlayersResultCards | null> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return null;
  const [scoresByUser, seen] = await Promise.all([readSharedPlayersScores(), readPlayersResultsSeen(userId)]);
  const results = pendingPlayersResults({ scoresByUser, userId, todayKey, seen });

  const ids = [...new Set(results.flatMap((r) => (r.winners.userIds.length === 1 ? r.winners.userIds : [])))].filter(
    (id) => id !== userId
  );
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: rows, error } = await supabase.from('users').select('id, name').in('id', ids);
    if (error) console.error('[players results] names:', error.message);
    for (const row of rows ?? []) {
      if (typeof row.name === 'string' && row.name.trim()) names[String(row.id)] = row.name.trim();
    }
  }
  return { userId, results, names };
}

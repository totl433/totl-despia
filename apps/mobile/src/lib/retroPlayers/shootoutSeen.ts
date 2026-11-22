import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which Shootout result moments this phone has shown, so each game's win/lose/draw
 * screen appears once. Keys: `g<number>` per game, `final` for the Shootout result.
 * The admin sandbox keeps them in memory only.
 */

const memory = new Map<string, Set<string>>();
const storageKey = (id: string) => `players-shootout-seen:${id}`;

export async function loadShootoutSeen(id: string, sandbox: boolean): Promise<Set<string>> {
  const cached = memory.get(id);
  if (cached) return cached;
  let seen = new Set<string>();
  if (!sandbox) {
    try {
      const raw = await AsyncStorage.getItem(storageKey(id));
      if (raw) seen = new Set(JSON.parse(raw) as string[]);
    } catch {
      // A broken entry just means the moment shows again.
    }
  }
  memory.set(id, seen);
  return seen;
}

export function markShootoutSeen(id: string, sandbox: boolean, keys: string[]): void {
  const seen = memory.get(id) ?? new Set<string>();
  for (const k of keys) seen.add(k);
  memory.set(id, seen);
  if (!sandbox) void AsyncStorage.setItem(storageKey(id), JSON.stringify(Array.from(seen))).catch(() => undefined);
}

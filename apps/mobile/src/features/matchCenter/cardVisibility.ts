/**
 * Which feed cards have been on screen this app session, so a card's entrance animation (the
 * pick bar filling) plays once, the first time you see it, and not again when you scroll back.
 * Kept in memory only: a fresh launch plays them again.
 */
const seen = new Set<string>();
const listeners = new Map<string, Set<() => void>>();

export function markCardsSeen(ids: Iterable<string>): void {
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    listeners.get(id)?.forEach((notify) => notify());
  }
}

export function cardSeen(id: string): boolean {
  return seen.has(id);
}

/** Called once when `id` first comes on screen. Returns an unsubscribe. */
export function onCardSeen(id: string, notify: () => void): () => void {
  let set = listeners.get(id);
  if (!set) listeners.set(id, (set = new Set()));
  set.add(notify);
  return () => {
    set!.delete(notify);
    if (!set!.size) listeners.delete(id);
  };
}

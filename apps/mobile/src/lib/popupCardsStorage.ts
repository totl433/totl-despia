import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'totl.popupCards.v1';

function buildSeenKey(userId: string, eventKey: string) {
  return `${STORAGE_PREFIX}:seen:${userId}:${eventKey}`;
}

export async function hasSeenPopupCard(userId: string | null | undefined, eventKey: string | null | undefined): Promise<boolean> {
  if (!userId || !eventKey) return false;
  try {
    const value = await AsyncStorage.getItem(buildSeenKey(userId, eventKey));
    return value === '1';
  } catch {
    return false;
  }
}

export async function markPopupCardSeen(userId: string | null | undefined, eventKey: string | null | undefined): Promise<void> {
  if (!userId || !eventKey) return;
  try {
    await AsyncStorage.setItem(buildSeenKey(userId, eventKey), '1');
  } catch {
    // Ignore local persistence failures so the UI never blocks on storage.
  }
}

export async function markPopupCardsSeen(
  userId: string | null | undefined,
  eventKeys: Array<string | null | undefined>
): Promise<void> {
  if (!userId) return;
  const entries = eventKeys
    .filter((eventKey): eventKey is string => typeof eventKey === 'string' && eventKey.trim().length > 0)
    .map((eventKey) => [buildSeenKey(userId, eventKey), '1'] as const);

  if (!entries.length) return;

  try {
    await AsyncStorage.multiSet(entries);
  } catch {
    // Ignore local persistence failures so the UI never blocks on storage.
  }
}

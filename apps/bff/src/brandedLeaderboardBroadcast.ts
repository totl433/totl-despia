export const BRANDED_LEADERBOARD_BROADCAST_WELCOME_SEED_KEY = 'welcome';
export const BRANDED_BROADCAST_VOLLEY_USER_ID = '00000000-0000-0000-0000-000000000001';

export function canAccessBrandedBroadcast(input: {
  hasAccess: boolean;
  isHost: boolean;
  isAdmin: boolean;
}): boolean {
  return input.hasAccess || input.isHost || input.isAdmin;
}

export function canPostBrandedBroadcast(input: { isHost: boolean; isAdmin: boolean }): boolean {
  return input.isHost || input.isAdmin;
}

export function buildBrandedBroadcastWelcomeMessage(input: {
  leaderboardName: string;
  hostNames: Array<string | null | undefined>;
}): string {
  const trimmedHostNames = Array.from(
    new Set(
      input.hostNames
        .map((name) => name?.trim())
        .filter((name): name is string => Boolean(name))
    )
  );

  if (trimmedHostNames.length === 0) {
    return `Welcome to ${input.leaderboardName}. Hosts will post updates for subscribers here throughout the season.`;
  }

  if (trimmedHostNames.length === 1) {
    return `Welcome to ${input.leaderboardName}. ${trimmedHostNames[0]} will post updates for subscribers here throughout the season.`;
  }

  if (trimmedHostNames.length === 2) {
    return `Welcome to ${input.leaderboardName}. ${trimmedHostNames[0]} and ${trimmedHostNames[1]} will post updates for subscribers here throughout the season.`;
  }

  const leadingNames = trimmedHostNames.slice(0, 2).join(', ');
  const remainingCount = trimmedHostNames.length - 2;
  const plural = remainingCount === 1 ? '' : 's';
  return `Welcome to ${input.leaderboardName}. ${leadingNames}, and ${remainingCount} other host${plural} will post updates for subscribers here throughout the season.`;
}

export async function seedBrandedBroadcastWelcomeIfMissing(input: {
  hasExistingWelcome: () => Promise<boolean>;
  insertWelcome: (payload: {
    seedKey: string;
    userId: string;
    content: string;
    createdAt: string;
  }) => Promise<void>;
  leaderboardName: string;
  leaderboardCreatedAt?: string | null;
  hostNames: Array<string | null | undefined>;
}): Promise<void> {
  if (await input.hasExistingWelcome()) return;

  try {
    await input.insertWelcome({
      seedKey: BRANDED_LEADERBOARD_BROADCAST_WELCOME_SEED_KEY,
      userId: BRANDED_BROADCAST_VOLLEY_USER_ID,
      content: buildBrandedBroadcastWelcomeMessage({
        leaderboardName: input.leaderboardName,
        hostNames: input.hostNames,
      }),
      createdAt: input.leaderboardCreatedAt ?? new Date().toISOString(),
    });
  } catch (error: any) {
    if (error?.code === '23505') return;
    throw error;
  }
}

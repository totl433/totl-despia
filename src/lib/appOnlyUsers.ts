/**
 * App-only user IDs
 * 
 * These users submit picks via the mobile app, and their picks are automatically
 * mirrored from app_picks to picks via database triggers. They should be excluded
 * from being identified as "Web users" in the UI (e.g., blue outline on Home page).
 * 
 * Note: This is a workaround until we have a proper database flag for app-only users.
 */
export const APP_ONLY_USER_IDS: string[] = [
  '4542c037-5b38-40d0-b189-847b8f17c222', // Jof
  'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
  '9c0bcf50-370d-412d-8826-95371a72b4fe', // SP
  '36f31625-6d6c-4aa4-815a-1493a812841b', // ThomasJamesBird
  'c94f9804-ba11-4cd2-8892-49657aa6412c', // Sim
  '42b48136-040e-42a3-9b0a-dc9550dd1cae', // Will Middleton
  'd2cbeca9-7dae-4be1-88fb-706911d67256', // David Bird
  '027502c5-1cd7-4922-abd5-f9bcc569bb4d'  // cakehurst
];


export const APP_ONLY_USER_ID_SET = new Set(APP_ONLY_USER_IDS);

export function isAppOnlyUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return APP_ONLY_USER_ID_SET.has(userId);
}

/**
 * Filter helper for leaderboards/stats:
 * - Excludes app-only "stub" accounts by default
 * - Optionally keeps a specific user visible even if they are app-only
 */
export function filterOutAppOnlyUsers<T extends { user_id: string }>(
  rows: T[],
  opts?: { includeUserId?: string | null }
): T[] {
  const includeUserId = opts?.includeUserId ?? null;
  return rows.filter((r) => r.user_id === includeUserId || !APP_ONLY_USER_ID_SET.has(r.user_id));
}


/**
 * Centralized "who should appear on leaderboards" logic.
 *
 * We key off `user_id` (stable) rather than email (not present in public tables).
 * This hides test accounts from Global + mini-league leaderboard surfaces,
 * while allowing explicit exceptions like HomeWins.
 */

// Keep this account visible (requested exception).
const ALWAYS_VISIBLE_USER_IDS = new Set<string>([
  // HomeWins
  '41f23cc8-427c-40d4-a8b5-2527a63f39c5',
]);

// Hide these test accounts from leaderboards.
// Includes the known sotbjof auth accounts plus other local test usernames seen on Overall.
const HIDDEN_LEADERBOARD_USER_IDS = new Set<string>([
  // sotbjof auth accounts (excluding HomeWins)
  '033a4a04-2418-4791-92e1-5dfd51696132',
  '10a4244a-580b-4ef3-8fd2-bd141f66550c',
  '7415ef5e-d74e-44eb-bfec-90a59ac1c9ae',
  '516a6169-54e0-4973-802e-4bedfe4a7b13',
  'fa7483ef-4fa7-4924-9b51-e9ece47f0ed4',
  '7307b8cb-ca37-4831-be47-686e88b016c0',
  'd2eeae8d-c3c2-4981-a795-5fd11951d428',
  'a81c40c6-49cb-4736-b977-0ace213db6b9',
  '8fc2fdf0-045f-4e14-b741-ff3d99029e99',

  // Other test users seen on Overall leaderboard
  '6c4e2a47-def4-48af-8fea-ea06767772b3', // tbjof
  'd37b6624-8a61-4748-90e5-56808f3b765e', // Test10
  'bc3120b2-9b12-4be9-b576-dfd3ec5bfa11', // test111
  '35464f1c-986b-4d1d-92bb-7e6bbc21205c', // test1111
  'f9428ad5-4185-48e5-b47c-6a8c79107a17', // test123
  '799fd573-debb-4ea4-8fcb-5048cb00e42d', // test123434
  '74ad4558-0ca9-4e67-8344-be7d3fb79d01', // testststs

  // Orphaned profiles likely created during early "same email" era
  '9b0a64ae-68e5-4250-a2b4-04135eeac01f', // Jof3
  'b69b8a92-71d0-428f-9881-2857e36e3758', // jsjsjsj
  'c14413f4-da35-4283-acf6-4a89aefdab73', // Sotbjof
]);

export function isHiddenFromLeaderboards(userId: string): boolean {
  if (!userId) return false;
  if (ALWAYS_VISIBLE_USER_IDS.has(userId)) return false;
  return HIDDEN_LEADERBOARD_USER_IDS.has(userId);
}

export function filterHiddenLeaderboardRows<T extends { user_id: string }>(rows: T[]): T[] {
  return rows.filter((r) => !isHiddenFromLeaderboards(r.user_id));
}

export function filterHiddenMembers<T extends { id: string }>(members: T[]): T[] {
  return members.filter((m) => !isHiddenFromLeaderboards(m.id));
}


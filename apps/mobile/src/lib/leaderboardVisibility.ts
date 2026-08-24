/**
 * Centralized "who should appear on leaderboards" logic.
 *
 * We key off `user_id` (stable) rather than email (not present in public tables).
 * This hides test accounts from Global + mini-league leaderboard surfaces,
 * while allowing explicit exceptions like HomeWins and Jof.
 */

const ALWAYS_VISIBLE_USER_IDS = new Set<string>([
  '41f23cc8-427c-40d4-a8b5-2527a63f39c5', // HomeWins (sotbjof+test)
  '4542c037-5b38-40d0-b189-847b8f17c222', // Jof (jof.middleton@gmail.com)
]);

const HIDDEN_LEADERBOARD_USER_IDS = new Set<string>([
  '3b4fe473-fe72-40e7-b5ce-32ae19978f92', // sotbjof+2627
  'c483e6d2-2c2b-4134-8eba-bdde4605297d', // sotbjof+brandnew
  '048b8821-eaec-46ed-b3f8-4eaf0c6344b8', // sotbjof+cursor / Cursor
  'bfe8e2d7-2dbd-4cda-9d1c-9fa82d5b4481', // sotbjof+newseason
  '8e875ad5-6199-448e-89d7-7bada9a0391a', // sotbjof+test27 / Jof 27
  '318e876b-24b7-4112-8c3b-d035df37659d', // sotbjof+testuser4 / DDDJOF
  '6836a693-972f-4144-a347-159abcb00cd5', // sotbjof+twentyseven
  '1047b535-7fbf-4a49-b797-8193dcdde084', // sotbjof+username / AAAJOF
  '8ca79657-979e-48b7-9d7b-88d086250564', // sotbjof+username2 / BBBJOF
  'e3095e5d-727c-4659-bbf2-3bf3894532ee', // sotbjof+username3 / CCCJOF
  'a0e188a2-0097-4627-9b98-220da22b2b81', // sotbjof+weds
  '67287840-764f-4999-b951-a0817380d119', // jof.middleton+aug / JofAug
  '97ee8429-7af6-4d37-a3fa-acb9bc40e5b6', // jof.middleton+test / Jof Test
  '0c8cb8e7-2790-43c4-b72c-4719e2296e72', // jof.middlton+signup / jof.middleton
  '6c4e2a47-def4-48af-8fea-ea06767772b3', // tbjof
  'd37b6624-8a61-4748-90e5-56808f3b765e', // Test10
  'bc3120b2-9b12-4be9-b576-dfd3ec5bfa11', // test111
  '35464f1c-986b-4d1d-92bb-7e6bbc21205c', // test1111
  'f9428ad5-4185-48e5-b47c-6a8c79107a17', // test123
  '799fd573-debb-4ea4-8fcb-5048cb00e42d', // test123434
  '74ad4558-0ca9-4e67-8344-be7d3fb79d01', // testststs
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

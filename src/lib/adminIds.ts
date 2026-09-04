/** Founder admin user IDs (match Expo BFF ADMIN_IDS). */
export const ADMIN_IDS = new Set<string>([
  '4542c037-5b38-40d0-b189-847b8f17c222',
  '36f31625-6d6c-4aa4-815a-1493a812841b',
  'f8a1669e-2512-4edf-9c21-b9f87b3efbe2',
  '9c0bcf50-370d-412d-8826-95371a72b4fe',
]);

export function isFounderAdmin(userId: string | null | undefined): boolean {
  return !!userId && ADMIN_IDS.has(userId);
}

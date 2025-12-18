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
  '36f31625-6d6c-4aa4-815a-1493a812841b'  // ThomasJamesBird
];


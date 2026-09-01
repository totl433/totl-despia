/**
 * Admin-only growth alerts (new sign-ups + new mini-leagues).
 * Recipients are configured via ADMIN_GROWTH_NOTIFY_USER_IDS
 * (defaults to Prem Predictions quartet: Jof, Carl, SP, Thomas).
 */

const JOF_USER_ID = '4542c037-5b38-40d0-b189-847b8f17c222';
const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2'; // Prem predictions Carl
const SP_USER_ID = '9c0bcf50-370d-412d-8826-95371a72b4fe'; // SP
const THOMAS_USER_ID = '36f31625-6d6c-4aa4-815a-1493a812841b'; // ThomasJamesBird

export const DEFAULT_ADMIN_GROWTH_NOTIFY_USER_IDS = [
  JOF_USER_ID,
  CARL_USER_ID,
  SP_USER_ID,
  THOMAS_USER_ID,
];

export function getAdminGrowthNotifyUserIds(): string[] {
  const raw = (process.env.ADMIN_GROWTH_NOTIFY_USER_IDS || '').trim();
  if (!raw) return DEFAULT_ADMIN_GROWTH_NOTIFY_USER_IDS;
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export interface SupabaseWebhookPayload {
  type?: string;
  table?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown> | null;
}

export function parseSupabaseWebhookPayload(body: string): SupabaseWebhookPayload {
  try {
    return JSON.parse(body || '{}') as SupabaseWebhookPayload;
  } catch {
    return {};
  }
}

function normalizeName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** True when a users row gets a display name for the first time. */
export function isFirstTimeUserName(payload: SupabaseWebhookPayload): boolean {
  const type = payload.type;
  const record = payload.record;
  const oldRecord = payload.old_record;
  if (!record) return false;

  const newName = normalizeName(record.name);
  if (!newName) return false;

  if (type === 'INSERT') return true;

  if (type === 'UPDATE') {
    const oldName = normalizeName(oldRecord?.name);
    return !oldName;
  }

  return false;
}

export function formatNewUserNotification(name: string): { title: string; body: string } {
  return {
    title: '🎉 New player alert!',
    body: `${name} just joined TOTL — the squad grows! ⚽✨`,
  };
}

export function formatNewLeagueNotification(
  leagueName: string,
  creatorName: string | null
): { title: string; body: string } {
  const byLine = creatorName ? ` by ${creatorName}` : '';
  return {
    title: '🏆 Fresh mini league!',
    body: `"${leagueName}" just opened for business${byLine} 👀🔥`,
  };
}

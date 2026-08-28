/**
 * Admin-only growth alerts (new sign-ups + new mini-leagues).
 * Recipients are configured via ADMIN_GROWTH_NOTIFY_USER_IDS (defaults to Jof).
 */

const JOF_USER_ID = '4542c037-5b38-40d0-b189-847b8f17c222';

export const DEFAULT_ADMIN_GROWTH_NOTIFY_USER_IDS = [JOF_USER_ID];

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

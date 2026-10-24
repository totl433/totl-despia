import { createApiClient } from '@totl/api-client';

import { env } from '../env';
import { api } from './api';
import {
  acceptMyLeagueInviteLocal,
  dismissMyLeagueInviteLocal,
  listMyLeagueInvitesLocal,
} from './leagueInvitesLocal';
import { supabase } from './supabase';

const localApi = createApiClient({
  baseUrl: 'http://127.0.0.1:8787',
  getAccessToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});

function isMissingRoute(error: unknown): boolean {
  const status = error && typeof error === 'object' && 'status' in error ? Number((error as { status?: number }).status) : 0;
  const message = error instanceof Error ? error.message : '';
  return status === 404 || /Route (GET|POST):/i.test(message);
}

export function inviteErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (isMissingRoute(error) || /Route (GET|POST):/i.test(message)) {
    return fallback;
  }
  if (/Network request failed|timed out/i.test(message)) {
    return 'Could not reach the server. Try again.';
  }
  if (message && message.length < 90 && !/^Request failed/i.test(message)) return message;
  return fallback;
}

async function withInviteBff<T>(run: (client: typeof api) => Promise<T>): Promise<T> {
  try {
    return await run(api);
  } catch (error) {
    const usingLocal = /localhost|127\.0\.0\.1/.test(String(env.EXPO_PUBLIC_BFF_URL ?? ''));
    if (!__DEV__ || usingLocal || !isMissingRoute(error)) throw error;
    return await run(localApi);
  }
}

export const leagueInviteApi = {
  listMine: async () => {
    try {
      return await listMyLeagueInvitesLocal();
    } catch {
      return withInviteBff((client) => client.listLeagueInvites());
    }
  },
  listInvitees: (leagueId: string) => withInviteBff((client) => client.listLeagueInvitees(leagueId)),
  invite: (leagueId: string, username: string) => withInviteBff((client) => client.inviteToLeague(leagueId, username)),
  accept: async (inviteId: string) => {
    try {
      return await withInviteBff((client) => client.acceptLeagueInvite(inviteId));
    } catch {
      return acceptMyLeagueInviteLocal(inviteId);
    }
  },
  dismiss: async (inviteId: string) => {
    try {
      return await withInviteBff((client) => client.dismissLeagueInvite(inviteId));
    } catch {
      return dismissMyLeagueInviteLocal(inviteId);
    }
  },
};

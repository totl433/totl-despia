import { createApiClient } from '@totl/api-client';

import { env } from '../env';
import { api } from './api';
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

async function withBroadcastBff<T>(run: (client: typeof api) => Promise<T>): Promise<T> {
  try {
    return await run(api);
  } catch (error) {
    const usingLocal = /localhost|127\.0\.0\.1/.test(String(env.EXPO_PUBLIC_BFF_URL ?? ''));
    if (!__DEV__ || usingLocal || !isMissingRoute(error)) throw error;
    return await run(localApi);
  }
}

export function broadcastErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (isMissingRoute(error)) return 'Could not reach the broadcast service. Is the local BFF running?';
  if (/Network request failed|timed out/i.test(message)) return 'Could not reach the server. Try again.';
  if (message && message.length < 90 && !/^Request failed/i.test(message)) return message;
  return 'Could not post. Try again.';
}

export const matchCenterBroadcastApi = {
  list: () => withBroadcastBff((client) => client.listMatchCenterAdminPosts()),
  post: (input: { title: string; body: string; comments: boolean; shareable: boolean; reacts: boolean }) =>
    withBroadcastBff((client) => client.postMatchCenterBroadcast(input)),
};

import { createApiClient } from '@totl/api-client';
import { env } from '../env';
import { supabase } from './supabase';

export const api = createApiClient({
  baseUrl: env.EXPO_PUBLIC_BFF_URL,
  getAccessToken: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});


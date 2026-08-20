import { supabase } from './supabase';
import { isAuthCallbackUrl } from './authCallbackUrl';

export { AUTH_CALLBACK_URL, isAuthCallbackUrl } from './authCallbackUrl';

type AuthCallbackParams = {
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  type: string | null;
  email: string | null;
  code: string | null;
};

function collectParams(rawUrl: string): AuthCallbackParams {
  const params = new URLSearchParams();
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.forEach((value, key) => params.set(key, value));
    const hash = parsed.hash.replace(/^#/, '');
    if (hash) {
      new URLSearchParams(hash).forEach((value, key) => {
        if (!params.has(key)) params.set(key, value);
      });
    }
  } catch {
    const query = rawUrl.split('?')[1]?.split('#')[0] ?? '';
    const hash = rawUrl.includes('#') ? rawUrl.slice(rawUrl.indexOf('#') + 1) : '';
    new URLSearchParams(query).forEach((value, key) => params.set(key, value));
    new URLSearchParams(hash).forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  }

  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    tokenHash: params.get('token_hash'),
    type: params.get('type'),
    email: params.get('email'),
    code: params.get('code'),
  };
}

export async function consumeAuthCallbackUrl(rawUrl: string): Promise<boolean> {
  if (!isAuthCallbackUrl(rawUrl)) return false;

  const params = collectParams(rawUrl);

  if (params.accessToken && params.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    if (error) throw error;
    return true;
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return true;
  }

  if (params.tokenHash) {
    const type =
      params.type === 'recovery' || params.type === 'magiclink' || params.type === 'email' || params.type === 'signup'
        ? params.type
        : 'signup';
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: params.tokenHash,
      ...(params.email ? { email: params.email } : {}),
    });
    if (error) throw error;
    if (data.session?.access_token && data.session.refresh_token) {
      const persist = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (persist.error) throw persist.error;
    }
    return true;
  }

  return false;
}

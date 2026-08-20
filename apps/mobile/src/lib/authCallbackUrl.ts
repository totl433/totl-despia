export const AUTH_CALLBACK_URL = 'com.despia.totlnative://auth/callback';

export function isAuthCallbackUrl(rawUrl: string): boolean {
  const url = String(rawUrl ?? '').trim();
  if (!url) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\/auth(\/|$|\?|#)/i.test(url)) return true;
  if (/\/auth(\/callback)?\/?(?:\?|#|$)/i.test(url)) {
    return /access_token=|refresh_token=|token_hash=|type=signup|type=recovery|type=magiclink|type=email/i.test(url);
  }
  return false;
}

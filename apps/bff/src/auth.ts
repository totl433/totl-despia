import type { FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AuthedRequest = FastifyRequest & { userId: string; accessToken: string };

export function getBearerToken(req: FastifyRequest): string | null {
  const raw = req.headers.authorization;
  if (!raw) return null;
  const [scheme, token] = raw.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function requireUser(req: FastifyRequest, supabase: SupabaseClient) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    throw Object.assign(new Error('Missing Authorization header'), { statusCode: 401 });
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    throw Object.assign(new Error('Invalid token'), { statusCode: 401 });
  }

  (req as AuthedRequest).userId = data.user.id;
  (req as AuthedRequest).accessToken = accessToken;
}


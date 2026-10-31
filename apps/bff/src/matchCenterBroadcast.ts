import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireUser } from './auth.js';
import type { Env } from './env.js';
import { isTotlAdmin } from './profile.js';
import { createSupabaseAdminClient, createSupabaseClient } from './supabase.js';

const BroadcastBodySchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(2000),
  comments: z.boolean(),
  shareable: z.boolean(),
  reacts: z.boolean(),
});

export type AdminBroadcastPost = {
  id: string;
  title: string;
  body: string;
  comments: boolean;
  shareable: boolean;
  reacts: boolean;
  publishedAt: string;
};

function broadcastId(raw: string): string {
  const parts = raw.split('admin:');
  return (parts[parts.length - 1] || raw).trim();
}

function supabaseMessage(error: { message?: string } | null | undefined): string {
  const message = String(error?.message ?? '').trim();
  return message.length > 0 && message.length < 90 ? message : 'Could not save the broadcast.';
}

function asPost(row: {
  id?: string;
  title?: string | null;
  body?: string | null;
  comments?: boolean | null;
  shareable?: boolean | null;
  reacts?: boolean | null;
  published_at?: string | null;
  details?: Record<string, unknown> | null;
}): AdminBroadcastPost | null {
  const details = row.details && typeof row.details === 'object' ? row.details : {};
  const title = String(row.title ?? details.title ?? '').trim();
  const body = String(row.body ?? details.body ?? '').trim();
  const publishedAt = String(row.published_at ?? '');
  if (!row.id || !title || !body || !publishedAt) return null;
  const id = broadcastId(String(row.id));
  return {
    id,
    title,
    body,
    comments: row.comments ?? details.comments !== false,
    shareable: row.shareable ?? details.shareable === true,
    reacts: row.reacts ?? details.reacts !== false,
    publishedAt,
  };
}

async function requireBroadcastAdmin(req: { userId?: string }, env: Env) {
  const userId = String(req.userId ?? '');
  if (isTotlAdmin(userId)) return userId;
  const admin = createSupabaseAdminClient(env);
  const { data, error } = await admin.from('users').select('is_admin').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!data?.is_admin) {
    throw Object.assign(new Error('Admin access required'), { statusCode: 403 });
  }
  return userId;
}

async function latestGw(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<number> {
  const { data } = await admin.from('app_gw_results').select('gw').order('gw', { ascending: false }).limit(1).maybeSingle();
  const gw = Number(data?.gw ?? 0);
  return Number.isFinite(gw) && gw > 0 ? gw : 1;
}

async function listBroadcasts(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<AdminBroadcastPost[]> {
  const dedicated = await admin
    .from('game_centre_admin_posts')
    .select('id, title, body, comments, shareable, reacts, published_at')
    .order('published_at', { ascending: true })
    .limit(50);
  if (!dedicated.error && dedicated.data) {
    return dedicated.data.flatMap((row) => {
      const post = asPost(row);
      return post ? [post] : [];
    });
  }

  const fallback = await admin.from('game_centre_posts').select('id, details, published_at').like('id', '%:admin:%').order('published_at', { ascending: true }).limit(50);
  if (fallback.error) throw fallback.error;
  return (fallback.data ?? []).flatMap((row) => {
    const post = asPost(row);
    return post ? [post] : [];
  });
}

async function insertBroadcast(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  input: z.infer<typeof BroadcastBodySchema>,
  userId: string
): Promise<AdminBroadcastPost> {
  const id = randomUUID();
  const publishedAt = new Date().toISOString();
  const dedicated = await admin
    .from('game_centre_admin_posts')
    .insert({
      id,
      title: input.title,
      body: input.body,
      comments: input.comments,
      shareable: input.shareable,
      reacts: input.reacts,
      published_at: publishedAt,
      created_by: userId,
    })
    .select('id, title, body, comments, shareable, reacts, published_at')
    .single();
  if (!dedicated.error && dedicated.data) {
    const post = asPost(dedicated.data);
    if (post) return post;
  }

  const gw = await latestGw(admin);
  const fallback = await admin
    .from('game_centre_posts')
    .insert({
      id: `mc:gw${gw}:admin:${id}`,
      gw,
      api_match_id: null,
      fixture_index: null,
      kind: 'goal',
      status: 'active',
      details: {
        broadcast: true,
        title: input.title,
        body: input.body,
        comments: input.comments,
        shareable: input.shareable,
        reacts: input.reacts,
      },
      occurred_minute: null,
      published_at: publishedAt,
      updated_at: publishedAt,
      revision: 1,
    })
    .select('id, details, published_at')
    .single();
  if (fallback.error) {
    throw Object.assign(new Error(supabaseMessage(fallback.error)), { statusCode: 500 });
  }
  const post = asPost(fallback.data);
  if (!post) throw Object.assign(new Error('Could not post broadcast'), { statusCode: 500 });
  return post;
}

export function registerMatchCenterBroadcastRoutes(app: FastifyInstance, env: Env) {
  app.get('/v1/match-center/admin-posts', async (req) => {
    await requireUser(req, createSupabaseClient(env));
    const admin = createSupabaseAdminClient(env);
    return { posts: await listBroadcasts(admin) };
  });

  app.post('/v1/admin/match-center/broadcast', async (req) => {
    await requireUser(req, createSupabaseClient(env));
    const userId = await requireBroadcastAdmin(req as { userId?: string }, env);
    const body = BroadcastBodySchema.parse((req as { body?: unknown }).body);
    const admin = createSupabaseAdminClient(env);
    const post = await insertBroadcast(admin, body, userId);
    return { ok: true as const, post };
  });
}

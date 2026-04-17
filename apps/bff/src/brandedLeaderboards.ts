import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUser } from './auth.js';
import { createSupabaseAdminClient, createSupabaseClient } from './supabase.js';
import { captureException } from './sentry.js';
import type { Env } from './env.js';
import {
  canJoinBrandedLeaderboard,
  getExpectedLeaderboardProductIds,
  hasVerifiedRevenueCatV2ProductAccess,
  mapRevenueCatV1SubscriberToSnapshot,
  selectRedeemableRevenueCatGrant,
  summarizeBrandedLeaderboardAccess,
  type RevenueCatCustomerSnapshot,
  type RevenueCatRedemptionCandidate,
  type RevenueCatV1Subscriber,
} from './brandedLeaderboardAccess.js';
import {
  BRANDED_BROADCAST_VOLLEY_USER_ID,
  BRANDED_LEADERBOARD_BROADCAST_WELCOME_SEED_KEY,
  canAccessBrandedBroadcast,
  canPostBrandedBroadcast,
  seedBrandedBroadcastWelcomeIfMissing,
} from './brandedLeaderboardBroadcast.js';

function getAuthedSupa(req: FastifyRequest, env: Env) {
  const userId = (req as any).userId as string;
  const accessToken = (req as any).accessToken as string;
  return { userId, supa: createSupabaseClient(env, { bearerToken: accessToken }) };
}

async function requireAdmin(req: FastifyRequest, supabase: SupabaseClient, env: Env) {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req, env);
  const { data, error } = await (supa as any)
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.is_admin) {
    throw Object.assign(new Error('Admin access required'), { statusCode: 403 });
  }
  return { userId, supa };
}

async function requireHostOrAdminForLeaderboard(
  req: FastifyRequest,
  supabase: SupabaseClient,
  env: Env,
  leaderboardId: string
) {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req, env);

  const [{ data: userRow, error: userError }, { data: hostRow, error: hostError }] = await Promise.all([
    (supa as any).from('users').select('is_admin').eq('id', userId).maybeSingle(),
    (supa as any)
      .from('branded_leaderboard_hosts')
      .select('id')
      .eq('leaderboard_id', leaderboardId)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (userError) throw userError;
  if (hostError) throw hostError;

  const isAdmin = Boolean(userRow?.is_admin);
  const isHost = Boolean(hostRow);

  if (!isAdmin && !isHost) {
    throw Object.assign(new Error('Host or admin access required'), { statusCode: 403 });
  }

  return { userId, supa, isAdmin, isHost };
}

function generateJoinCode(length = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const JOIN_CODE_REGEX = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3,50}$/;

function normalizeJoinCode(value: string): string {
  return value.trim().toUpperCase();
}

function parseJoinCode(value: string): string {
  const normalized = normalizeJoinCode(value);
  if (!JOIN_CODE_REGEX.test(normalized)) {
    throw Object.assign(
      new Error('Join codes must be 3-50 characters and use only A-Z letters and digits 2-9.'),
      { statusCode: 400 }
    );
  }
  return normalized;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// ============================================
// Zod schemas for request validation
// ============================================
const IdParamSchema = z.object({ id: z.string().uuid() });
const IdOrSlugParamSchema = z.object({ idOrSlug: z.string().min(1) });
const CodeParamSchema = z.object({ code: z.string().min(3).max(50) });
const HostIdParamSchema = z.object({ id: z.string().uuid(), hostId: z.string().uuid() });
const CodeIdParamSchema = z.object({ id: z.string().uuid(), codeId: z.string().uuid() });

const CreateLeaderboardBodySchema = z.object({
  name: z.string().min(1).max(200),
  display_name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  slug: z.string().min(1).max(60).optional(),
  visibility: z.enum(['public', 'private', 'unlisted']).optional(),
  price_type: z.enum(['free', 'paid']).optional(),
  season_price_cents: z.number().int().nonnegative().optional(),
  currency: z.string().max(3).optional(),
  revenue_share_pct: z.number().min(0).max(100).optional(),
  payout_owner_id: z.string().uuid().nullable().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  season: z.string().optional(),
  start_gw: z.number().int().positive().nullable().optional(),
  rc_offering_id: z.string().nullable().optional(),
  rc_entitlement_id: z.string().nullable().optional(),
  rc_product_id: z.string().nullable().optional(),
  header_image_url: z.string().nullable().optional(),
});

const UpdateLeaderboardBodySchema = CreateLeaderboardBodySchema.partial();

const AddHostBodySchema = z.object({
  user_id: z.string().uuid(),
  display_order: z.number().int().nonnegative().optional(),
});

const CreateCodeBodySchema = z.object({
  code: z.string().optional(),
  expires_at: z.string().optional(),
  max_uses: z.number().int().positive().optional(),
});

const UpdateCodeBodySchema = z.object({
  code: z.string().optional(),
  active: z.boolean().optional(),
  expires_at: z.string().nullable().optional(),
  max_uses: z.number().int().positive().nullable().optional(),
});

const JoinBodySchema = z.object({ code: z.string().min(3).max(50) });

const ActivateBodySchema = z.object({
  rc_subscription_id: z.string().min(1),
  rc_product_id: z.string().min(1),
});

const BroadcastMessageBodySchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

const BroadcastReadBodySchema = z.object({
  lastReadAt: z.string().datetime().nullable().optional(),
});

const StandingsQuerySchema = z.object({
  scope: z.enum(['gw', 'month', 'season']).optional().default('gw'),
  gw: z.coerce.number().int().positive().optional(),
});

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(100),
});

const UpdatePayoutBodySchema = z.object({
  status: z.enum(['pending', 'paid', 'held']).optional(),
  notes: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
});

export function registerBrandedLeaderboardRoutes(app: FastifyInstance, env: Env) {
  const supabase = createSupabaseClient(env);
  const adminSupabase = env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient(env) : null;

  async function isJoinCodeTaken(supa: SupabaseClient, code: string, excludeId?: string) {
    let query = (supa as any).from('branded_leaderboard_join_codes').select('id').eq('code', code);
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return !!data;
  }

  async function getDefaultJoinCodeId(supa: SupabaseClient, leaderboardId: string) {
    const { data, error } = await (supa as any)
      .from('branded_leaderboard_join_codes')
      .select('id')
      .eq('leaderboard_id', leaderboardId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.id ? String(data.id) : null;
  }

  function normalizeProductId(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function uniqueStrings(values: Array<string | null | undefined>): string[] {
    return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
  }

  function countLegacyUsedProducts(input: {
    allowedProductIds: string[];
    currentRevenueCatIdentifiers: Iterable<string>;
    existingRedemptions: Array<{ leaderboardId: string; productId: string | null; redemptionIdentifier: string | null }>;
    currentLeaderboardId: string;
  }): Record<string, number> {
    const allowed = new Set(input.allowedProductIds.filter(Boolean));
    const currentIdentifiers = new Set(Array.from(input.currentRevenueCatIdentifiers).filter(Boolean));
    const counts: Record<string, number> = {};

    for (const redemption of input.existingRedemptions) {
      if (redemption.leaderboardId === input.currentLeaderboardId) continue;
      if (!redemption.productId || !allowed.has(redemption.productId)) continue;
      if (redemption.redemptionIdentifier && currentIdentifiers.has(redemption.redemptionIdentifier)) continue;
      counts[redemption.productId] = (counts[redemption.productId] ?? 0) + 1;
    }

    return counts;
  }

  function normalizeBrandedLeaderboardRow(row: any) {
    if (!row) return row;
    return {
      ...row,
      rc_product_id: row.rc_product_id ?? null,
    };
  }

  async function getLeaderboardAccessContext(
    supa: SupabaseClient,
    leaderboardId: string,
    userId: string
  ) {
    const [lbRes, memRes, subRes] = await Promise.all([
      (supa as any).from('branded_leaderboards').select('*').eq('id', leaderboardId).maybeSingle(),
      (supa as any)
        .from('branded_leaderboard_memberships')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .eq('user_id', userId)
        .is('left_at', null)
        .maybeSingle(),
      (supa as any)
        .from('branded_leaderboard_subscriptions')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle(),
    ]);

    if (lbRes.error) throw lbRes.error;
    if (!lbRes.data) throw Object.assign(new Error('Leaderboard not found'), { statusCode: 404 });
    if (memRes.error) throw memRes.error;
    if (subRes.error) throw subRes.error;

    const leaderboard = normalizeBrandedLeaderboardRow(lbRes.data as any);
    const membership = memRes.data ?? null;
    const subscription = subRes.data ?? null;
    const access = summarizeBrandedLeaderboardAccess({
      priceType: leaderboard.price_type,
      isMember: Boolean(membership),
      hasActivePurchase: Boolean(subscription),
    });

    return { leaderboard, membership, subscription, access };
  }

  async function getBrandedBroadcastViewerRole(
    supa: SupabaseClient,
    leaderboardId: string,
    userId: string
  ) {
    const [{ data: userRow, error: userError }, { data: hostRow, error: hostError }] = await Promise.all([
      (supa as any).from('users').select('is_admin').eq('id', userId).maybeSingle(),
      (supa as any)
        .from('branded_leaderboard_hosts')
        .select('id')
        .eq('leaderboard_id', leaderboardId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);
    if (userError) throw userError;
    if (hostError) throw hostError;
    return {
      isAdmin: Boolean(userRow?.is_admin),
      isHost: Boolean(hostRow),
    };
  }

  function normalizeBroadcastMessageRow(row: any) {
    return {
      id: row.id,
      leaderboard_id: row.leaderboard_id,
      user_id: row.user_id,
      content: row.content,
      message_type: row.message_type,
      seed_key: row.seed_key ?? null,
      created_at: row.created_at,
      user_name: row.users?.name ?? null,
      user_avatar_url: row.users?.avatar_url ?? null,
    };
  }

  async function listBrandedBroadcastMessages(supa: SupabaseClient, leaderboardId: string) {
    const { data, error } = await (supa as any)
      .from('branded_leaderboard_broadcast_messages')
      .select('*, users:user_id(name, avatar_url)')
      .eq('leaderboard_id', leaderboardId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(normalizeBroadcastMessageRow);
  }

  async function ensureBrandedBroadcastWelcomeMessage(input: {
    leaderboard: { id: string; display_name: string; created_at?: string | null };
    hostNames: Array<string | null | undefined>;
  }) {
    if (!adminSupabase) return;

    await seedBrandedBroadcastWelcomeIfMissing({
      hasExistingWelcome: async () => {
        const { data: existing, error } = await (adminSupabase as any)
          .from('branded_leaderboard_broadcast_messages')
          .select('id')
          .eq('leaderboard_id', input.leaderboard.id)
          .eq('seed_key', BRANDED_LEADERBOARD_BROADCAST_WELCOME_SEED_KEY)
          .maybeSingle();
        if (error) throw error;
        return Boolean(existing?.id);
      },
      insertWelcome: async (payload) => {
        const { error } = await (adminSupabase as any).from('branded_leaderboard_broadcast_messages').insert({
          leaderboard_id: input.leaderboard.id,
          user_id: payload.userId,
          content: payload.content,
          message_type: 'system',
          seed_key: payload.seedKey,
          created_at: payload.createdAt,
        });
        if (error) throw error;
      },
      leaderboardName: input.leaderboard.display_name,
      leaderboardCreatedAt: input.leaderboard.created_at,
      hostNames: input.hostNames,
    });
  }

  async function getBrandedBroadcastLastReadAt(supa: SupabaseClient, leaderboardId: string, userId: string) {
    const { data, error } = await (supa as any)
      .from('branded_leaderboard_broadcast_reads')
      .select('last_read_at')
      .eq('leaderboard_id', leaderboardId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data?.last_read_at ? String(data.last_read_at) : null;
  }

  async function getBrandedBroadcastUnreadCount(supa: SupabaseClient, leaderboardId: string, userId: string) {
    const lastReadAt = await getBrandedBroadcastLastReadAt(supa, leaderboardId, userId);

    let query = (supa as any)
      .from('branded_leaderboard_broadcast_messages')
      .select('id', { count: 'exact', head: true })
      .eq('leaderboard_id', leaderboardId)
      .neq('user_id', userId)
      .neq('user_id', BRANDED_BROADCAST_VOLLEY_USER_ID);

    if (lastReadAt) {
      query = query.gt('created_at', lastReadAt);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  async function requireBrandedBroadcastAccess(supa: SupabaseClient, leaderboardId: string, userId: string) {
    const [accessCtx, viewerRole] = await Promise.all([
      getLeaderboardAccessContext(supa, leaderboardId, userId),
      getBrandedBroadcastViewerRole(supa, leaderboardId, userId),
    ]);

    if (
      !canAccessBrandedBroadcast({
        hasAccess: accessCtx.access.hasAccess,
        isHost: viewerRole.isHost,
        isAdmin: viewerRole.isAdmin,
      })
    ) {
      throw Object.assign(new Error('You do not have access to this broadcast yet.'), {
        statusCode: accessCtx.access.requiresPurchase ? 402 : 403,
      });
    }

    return {
      ...accessCtx,
      ...viewerRole,
    };
  }

  async function fetchRevenueCatCustomerSnapshot(appUserId: string): Promise<RevenueCatCustomerSnapshot> {
    if (!env.REVENUECAT_SECRET_KEY) {
      return mapRevenueCatV1SubscriberToSnapshot({ subscriber: null });
    }

    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: {
        Authorization: `Bearer ${env.REVENUECAT_SECRET_KEY}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw Object.assign(new Error(`RevenueCat v1 lookup failed: ${res.status} ${body || res.statusText}`), {
        statusCode: 502,
      });
    }

    const body = (await res.json()) as {
      subscriber?: RevenueCatV1Subscriber | null;
      value?: { subscriber?: RevenueCatV1Subscriber | null } | null;
    };
    const subscriber = body.subscriber ?? body.value?.subscriber ?? null;
    return mapRevenueCatV1SubscriberToSnapshot({ subscriber });
  }

  async function getExistingRedemptions(
    supa: SupabaseClient,
    userId: string
  ): Promise<Array<{ leaderboardId: string; productId: string | null; redemptionIdentifier: string | null }>> {
    const { data, error } = await (supa as any)
      .from('branded_leaderboard_subscriptions')
      .select('leaderboard_id, rc_product_id, rc_subscription_id')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      leaderboardId: String(row.leaderboard_id),
      productId: normalizeProductId(row.rc_product_id),
      redemptionIdentifier: normalizeProductId(row.rc_subscription_id),
    }));
  }

  async function verifyLeaderboardPurchase(opts: {
    userId: string;
    leaderboard: any;
    purchasedProductId: string;
    req: FastifyRequest;
    supa: SupabaseClient;
  }): Promise<RevenueCatRedemptionCandidate | null> {
    const allowedProductIds = getExpectedLeaderboardProductIds({
      configuredProductId: opts.leaderboard.rc_product_id,
      priceCents: opts.leaderboard.season_price_cents,
    });
    if (allowedProductIds.length === 0) {
      throw Object.assign(new Error('This leaderboard is missing a RevenueCat product mapping.'), { statusCode: 409 });
    }

    if (!allowedProductIds.includes(opts.purchasedProductId)) {
      throw Object.assign(new Error('Purchase does not match this leaderboard price tier.'), { statusCode: 403 });
    }

    if (!env.REVENUECAT_SECRET_KEY) {
      opts.req.log.warn(
        {
          leaderboardId: opts.leaderboard.id,
          userId: opts.userId,
          productId: opts.purchasedProductId,
          hasSecret: Boolean(env.REVENUECAT_SECRET_KEY),
        },
        'Skipping RevenueCat server verification because RevenueCat secret is missing'
      );
      return {
        productId: opts.purchasedProductId,
        redemptionIdentifier: opts.purchasedProductId,
        source: 'purchase',
      };
    }

    const activationRetryDelaysMs = [0, 1000, 2000];
    let sawVerifiedPurchase = false;

    for (let attempt = 0; attempt < activationRetryDelaysMs.length; attempt += 1) {
      const delayMs = activationRetryDelaysMs[attempt];
      if (delayMs > 0) {
        await sleep(delayMs);
      }

      const [customerSnapshot, existingRedemptions] = await Promise.all([
        fetchRevenueCatCustomerSnapshot(opts.userId),
        getExistingRedemptions(opts.supa, opts.userId),
      ]);
      const usedRedemptionIdentifiers = new Set(
        existingRedemptions.map((item) => item.redemptionIdentifier).filter((value): value is string => Boolean(value))
      );
      const currentRevenueCatIdentifiers = uniqueStrings([
        ...customerSnapshot.purchases.map((item) => item.store_purchase_identifier ?? null),
        ...customerSnapshot.subscriptions.map((item) => item.store_subscription_identifier ?? null),
      ]);
      const legacyUsedProductCounts = countLegacyUsedProducts({
        allowedProductIds,
        currentRevenueCatIdentifiers,
        existingRedemptions,
        currentLeaderboardId: opts.leaderboard.id,
      });

      const verified = hasVerifiedRevenueCatV2ProductAccess({
        subscriptions: customerSnapshot.subscriptions,
        purchases: customerSnapshot.purchases,
        productId: opts.purchasedProductId,
      });
      if (verified) {
        sawVerifiedPurchase = true;
      }

      const redemption = verified
        ? selectRedeemableRevenueCatGrant({
            subscriptions: customerSnapshot.subscriptions,
            purchases: customerSnapshot.purchases,
            allowedProductIds,
            preferredProductId: opts.purchasedProductId,
            usedRedemptionIdentifiers,
            legacyUsedProductCounts,
          })
        : null;

      opts.req.log.info(
        {
          leaderboardId: opts.leaderboard.id,
          userId: opts.userId,
          productId: opts.purchasedProductId,
          allowedProductIds,
          attempt: attempt + 1,
          delayMs,
          verified,
          verificationSource: 'revenuecat_v1_subscriber',
          rcOriginalAppUserId: customerSnapshot.originalAppUserId,
          rcEnvironment: customerSnapshot.environment,
          activeEntitlementIds: customerSnapshot.activeEntitlementIds,
          activeEntitlementProductIds: customerSnapshot.activeEntitlementProductIds,
          subscriptionProductIds: uniqueStrings(customerSnapshot.subscriptions.map((item) => item.product_id ?? null)),
          purchaseProductIds: uniqueStrings(customerSnapshot.purchases.map((item) => item.product_id ?? null)),
          currentRevenueCatIdentifiers,
          usedRedemptionIdentifiers: Array.from(usedRedemptionIdentifiers),
          legacyUsedProductCounts,
          redemptionIdentifier: redemption?.redemptionIdentifier ?? null,
          redemptionSource: redemption?.source ?? null,
        },
        'branded leaderboard activation verification attempt'
      );

      if (redemption) {
        return redemption;
      }
    }

    if (sawVerifiedPurchase) {
      throw Object.assign(new Error('A fresh purchase is required for this leaderboard.'), {
        statusCode: 402,
        code: 'PURCHASE_REQUIRED',
      });
    }

    throw Object.assign(new Error('No verified purchase was found for this leaderboard yet. Please try again shortly.'), {
      statusCode: 403,
      code: 'PURCHASE_NOT_VISIBLE_YET',
    });
  }

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  app.get('/v1/admin/branded-leaderboards', async (req) => {
    const { supa } = await requireAdmin(req, supabase, env);
    const { data, error } = await (supa as any)
      .from('branded_leaderboards')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { leaderboards: data ?? [] };
  });

  app.post('/v1/admin/branded-leaderboards', async (req) => {
    const { supa } = await requireAdmin(req, supabase, env);
    const body = CreateLeaderboardBodySchema.parse((req as any).body);
    const slug = body.slug || slugify(body.name);

    const { data, error } = await (supa as any)
      .from('branded_leaderboards')
      .insert({
        ...body,
        slug,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (error) throw error;
    return { leaderboard: normalizeBrandedLeaderboardRow(data) };
  });

  app.get('/v1/admin/branded-leaderboards/:id', async (req) => {
    const { supa } = await requireAdmin(req, supabase, env);
    const { id } = IdParamSchema.parse((req as any).params);

    const [lbRes, hostsRes, codesRes] = await Promise.all([
      (supa as any).from('branded_leaderboards').select('*').eq('id', id).maybeSingle(),
      (supa as any)
        .from('branded_leaderboard_hosts')
        .select('*, users:user_id(id, name, avatar_url)')
        .eq('leaderboard_id', id)
        .order('display_order', { ascending: true }),
      (supa as any)
        .from('branded_leaderboard_join_codes')
        .select('*')
        .eq('leaderboard_id', id)
        .order('created_at', { ascending: false }),
    ]);
    if (lbRes.error) throw lbRes.error;
    if (!lbRes.data) throw Object.assign(new Error('Leaderboard not found'), { statusCode: 404 });
    if (hostsRes.error) throw hostsRes.error;
    if (codesRes.error) throw codesRes.error;

    const hosts = (hostsRes.data ?? []).map((h: any) => ({
      id: h.id,
      leaderboard_id: h.leaderboard_id,
      user_id: h.user_id,
      display_order: h.display_order,
      name: h.users?.name ?? null,
      avatar_url: h.users?.avatar_url ?? null,
    }));

    return { leaderboard: normalizeBrandedLeaderboardRow(lbRes.data), hosts, codes: codesRes.data ?? [] };
  });

  app.put('/v1/admin/branded-leaderboards/:id', async (req) => {
    const { supa } = await requireAdmin(req, supabase, env);
    const { id } = IdParamSchema.parse((req as any).params);
    const body = UpdateLeaderboardBodySchema.parse((req as any).body);

    const { data, error } = await (supa as any)
      .from('branded_leaderboards')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return { leaderboard: normalizeBrandedLeaderboardRow(data) };
  });

  app.delete('/v1/admin/branded-leaderboards/:id', async (req) => {
    const { supa } = await requireAdmin(req, supabase, env);
    const { id } = IdParamSchema.parse((req as any).params);
    const { error } = await (supa as any).from('branded_leaderboards').delete().eq('id', id);
    if (error) throw error;
    return { ok: true };
  });

  // Hosts
  app.post('/v1/admin/branded-leaderboards/:id/hosts', async (req) => {
    const { supa } = await requireAdmin(req, supabase, env);
    const { id } = IdParamSchema.parse((req as any).params);
    const body = AddHostBodySchema.parse((req as any).body);

    const { data, error } = await (supa as any)
      .from('branded_leaderboard_hosts')
      .insert({
        leaderboard_id: id,
        user_id: body.user_id,
        display_order: body.display_order ?? 0,
      })
      .select('*')
      .single();
    if (error) throw error;

    const { error: membershipError } = await (supa as any)
      .from('branded_leaderboard_memberships')
      .upsert(
        {
          leaderboard_id: id,
          user_id: body.user_id,
          joined_at: new Date().toISOString(),
          left_at: null,
          source: 'admin',
        },
        { onConflict: 'leaderboard_id,user_id' }
      );
    if (membershipError) throw membershipError;

    return { host: data };
  });

  app.delete('/v1/admin/branded-leaderboards/:id/hosts/:hostId', async (req) => {
    const { supa } = await requireAdmin(req, supabase, env);
    const { hostId } = HostIdParamSchema.parse((req as any).params);
    const { error } = await (supa as any).from('branded_leaderboard_hosts').delete().eq('id', hostId);
    if (error) throw error;
    return { ok: true };
  });

  // Join codes
  app.get('/v1/admin/branded-leaderboards/:id/codes', async (req) => {
    const { supa } = await requireAdmin(req, supabase, env);
    const { id } = IdParamSchema.parse((req as any).params);
    const { data, error } = await (supa as any)
      .from('branded_leaderboard_join_codes')
      .select('*')
      .eq('leaderboard_id', id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { codes: data ?? [] };
  });

  app.post('/v1/admin/branded-leaderboards/:id/codes', async (req) => {
    const { userId, supa } = await requireAdmin(req, supabase, env);
    const { id } = IdParamSchema.parse((req as any).params);
    const body = CreateCodeBodySchema.parse((req as any).body);

    let code = body.code ? parseJoinCode(body.code) : generateJoinCode();
    if (body.code) {
      if (await isJoinCodeTaken(supa, code)) {
        throw Object.assign(new Error('That join code is already taken.'), { statusCode: 409 });
      }
    } else {
      let attempts = 0;
      while (attempts < 10) {
        if (!(await isJoinCodeTaken(supa, code))) break;
        code = generateJoinCode();
        attempts++;
      }
    }

    const { data, error } = await (supa as any)
      .from('branded_leaderboard_join_codes')
      .insert({
        code,
        leaderboard_id: id,
        created_by: userId,
        expires_at: body.expires_at ?? null,
        max_uses: body.max_uses ?? null,
      })
      .select('*')
      .single();
    if ((error as any)?.code === '23505') {
      throw Object.assign(new Error('That join code is already taken.'), { statusCode: 409 });
    }
    if (error) throw error;
    return { joinCode: data };
  });

  app.put('/v1/admin/branded-leaderboards/:id/codes/:codeId', async (req) => {
    const { supa } = await requireAdmin(req, supabase, env);
    const { id, codeId } = CodeIdParamSchema.parse((req as any).params);
    const body = UpdateCodeBodySchema.parse((req as any).body);
    const nextBody = {
      ...body,
      ...(body.code ? { code: parseJoinCode(body.code) } : {}),
    };

    if (nextBody.code) {
      const defaultCodeId = await getDefaultJoinCodeId(supa, id);
      if (!defaultCodeId || defaultCodeId !== codeId) {
        throw Object.assign(new Error('Only the default join code can be renamed.'), { statusCode: 403 });
      }
    }

    if (nextBody.code && (await isJoinCodeTaken(supa, nextBody.code, codeId))) {
      throw Object.assign(new Error('That join code is already taken.'), { statusCode: 409 });
    }

    const { data, error } = await (supa as any)
      .from('branded_leaderboard_join_codes')
      .update(nextBody)
      .eq('id', codeId)
      .select('*')
      .single();
    if ((error as any)?.code === '23505') {
      throw Object.assign(new Error('That join code is already taken.'), { statusCode: 409 });
    }
    if (error) throw error;
    return { joinCode: data };
  });

  // Metrics & Revenue
  app.get('/v1/admin/branded-leaderboards/:id/metrics', async (req) => {
    const { supa } = await requireAdmin(req, supabase, env);
    const { id } = IdParamSchema.parse((req as any).params);
    const { data, error } = await (supa as any)
      .from('branded_leaderboard_metrics')
      .select('*')
      .eq('leaderboard_id', id)
      .order('period_start', { ascending: false })
      .limit(90);
    if (error) throw error;
    return { metrics: data ?? [] };
  });

  app.get('/v1/admin/branded-leaderboards/:id/revenue', async (req) => {
    const { supa } = await requireAdmin(req, supabase, env);
    const { id } = IdParamSchema.parse((req as any).params);

    const [eventsRes, payoutsRes, subsRes] = await Promise.all([
      (supa as any)
        .from('branded_leaderboard_revenue_events')
        .select('*')
        .eq('leaderboard_id', id)
        .order('created_at', { ascending: false })
        .limit(200),
      (supa as any)
        .from('branded_leaderboard_payouts')
        .select('*')
        .eq('leaderboard_id', id)
        .order('created_at', { ascending: false }),
      (supa as any)
        .from('branded_leaderboard_subscriptions')
        .select('id, status')
        .eq('leaderboard_id', id),
    ]);
    if (eventsRes.error) throw eventsRes.error;
    if (payoutsRes.error) throw payoutsRes.error;
    if (subsRes.error) throw subsRes.error;

    const activeSubs = (subsRes.data ?? []).filter((s: any) => s.status === 'active').length;
    const totalSubs = (subsRes.data ?? []).length;

    return {
      events: eventsRes.data ?? [],
      payouts: payoutsRes.data ?? [],
      activeSubs,
      totalSubs,
    };
  });

  // Payouts
  app.get('/v1/admin/payouts', async (req) => {
    const { supa } = await requireAdmin(req, supabase, env);
    const { data, error } = await (supa as any)
      .from('branded_leaderboard_payouts')
      .select('*, branded_leaderboards(display_name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return { payouts: data ?? [] };
  });

  app.put('/v1/admin/payouts/:id', async (req) => {
    const { supa } = await requireAdmin(req, supabase, env);
    const { id } = IdParamSchema.parse((req as any).params);
    const body = UpdatePayoutBodySchema.parse((req as any).body);

    const { data, error } = await (supa as any)
      .from('branded_leaderboard_payouts')
      .update(body)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return { payout: data };
  });

  // User search
  app.get('/v1/admin/users/search', async (req) => {
    const { supa } = await requireAdmin(req, supabase, env);
    const { q } = SearchQuerySchema.parse((req as any).query);

    const { data, error } = await (supa as any)
      .from('users')
      .select('id, name, avatar_url')
      .or(`name.ilike.%${q}%`)
      .limit(20);
    if (error) throw error;
    return { users: data ?? [] };
  });

  app.get('/v1/host/branded-leaderboards/:id/review', async (req) => {
    const { id } = IdParamSchema.parse((req as any).params);
    const { supa, isAdmin, isHost } = await requireHostOrAdminForLeaderboard(req, supabase, env, id);

    const [lbRes, hostsRes, defaultCodeRes] = await Promise.all([
      (supa as any).from('branded_leaderboards').select('*').eq('id', id).maybeSingle(),
      (supa as any)
        .from('branded_leaderboard_hosts')
        .select('*, users:user_id(id, name, avatar_url)')
        .eq('leaderboard_id', id)
        .order('display_order', { ascending: true }),
      (supa as any)
        .from('branded_leaderboard_join_codes')
        .select('*')
        .eq('leaderboard_id', id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (lbRes.error) throw lbRes.error;
    if (!lbRes.data) throw Object.assign(new Error('Leaderboard not found'), { statusCode: 404 });
    if (hostsRes.error) throw hostsRes.error;
    if (defaultCodeRes.error) throw defaultCodeRes.error;

    const hosts = (hostsRes.data ?? []).map((h: any) => ({
      id: h.id,
      leaderboard_id: h.leaderboard_id,
      user_id: h.user_id,
      display_order: h.display_order,
      name: h.users?.name ?? null,
      avatar_url: h.users?.avatar_url ?? null,
    }));

    return {
      leaderboard: normalizeBrandedLeaderboardRow(lbRes.data),
      hosts,
      defaultJoinCode: defaultCodeRes.data ?? null,
      viewer: {
        isAdmin,
        isHost,
      },
    };
  });

  // ============================================
  // PUBLIC ENDPOINTS
  // ============================================

  app.get('/v1/branded-leaderboards/resolve-code/:code', async (req) => {
    await requireUser(req, supabase);
    const { supa } = getAuthedSupa(req, env);
    const { code } = CodeParamSchema.parse((req as any).params);

    const { data: codeData, error: codeErr } = await (supa as any)
      .from('branded_leaderboard_join_codes')
      .select('leaderboard_id, max_uses, use_count, active, expires_at')
      .eq('code', code.toUpperCase())
      .eq('active', true)
      .maybeSingle();
    if (codeErr) throw codeErr;
    if (!codeData) throw Object.assign(new Error('Invalid join code'), { statusCode: 404 });

    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      throw Object.assign(new Error('Join code has expired'), { statusCode: 410 });
    }
    if (codeData.max_uses && codeData.use_count >= codeData.max_uses) {
      throw Object.assign(new Error('Join code has reached its usage limit'), { statusCode: 410 });
    }

    const { data: lb, error: lbErr } = await (supa as any)
      .from('branded_leaderboards')
      .select('*')
      .eq('id', codeData.leaderboard_id)
      .eq('status', 'active')
      .maybeSingle();
    if (lbErr) throw lbErr;
    if (!lb) throw Object.assign(new Error('Leaderboard not found or inactive'), { statusCode: 404 });

    return { leaderboard: normalizeBrandedLeaderboardRow(lb) };
  });

  app.get('/v1/branded-leaderboards/mine', async (req) => {
    await requireUser(req, supabase);
    const { userId, supa } = getAuthedSupa(req, env);

    const { data: memberships, error: memErr } = await (supa as any)
      .from('branded_leaderboard_memberships')
      .select('*, branded_leaderboards(*)')
      .eq('user_id', userId)
      .is('left_at', null);
    if (memErr) throw memErr;

    if (!memberships || memberships.length === 0) {
      return { leaderboards: [] };
    }

    const leaderboardIds = memberships.map((m: any) => m.leaderboard_id);

    const { data: subs, error: subErr } = await (supa as any)
      .from('branded_leaderboard_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('leaderboard_id', leaderboardIds);
    if (subErr) throw subErr;

    const subByLb = new Map<string, any>();
    (subs ?? []).forEach((s: any) => {
      const existing = subByLb.get(s.leaderboard_id);
      if (!existing || s.status === 'active') subByLb.set(s.leaderboard_id, s);
    });

    const items = memberships
      .map((m: any) => {
        const subscription = subByLb.get(m.leaderboard_id) ?? null;
        const access = summarizeBrandedLeaderboardAccess({
          priceType: m.branded_leaderboards?.price_type ?? 'free',
          isMember: true,
          hasActivePurchase: Boolean(subscription),
        });

        if (!access.hasAccess) {
          return null;
        }

        return {
          leaderboard: normalizeBrandedLeaderboardRow(m.branded_leaderboards),
          membership: {
            id: m.id,
            leaderboard_id: m.leaderboard_id,
            user_id: m.user_id,
            joined_at: m.joined_at,
            left_at: m.left_at,
            source: m.source,
          },
          subscription,
        };
      })
      .filter(Boolean);

    return { leaderboards: items };
  });

  app.get('/v1/branded-leaderboards/:idOrSlug', async (req) => {
    await requireUser(req, supabase);
    const { userId, supa } = getAuthedSupa(req, env);
    const { idOrSlug } = IdOrSlugParamSchema.parse((req as any).params);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const lbQuery = (supa as any).from('branded_leaderboards').select('*');
    const lbRes = isUuid
      ? await lbQuery.eq('id', idOrSlug).maybeSingle()
      : await lbQuery.eq('slug', idOrSlug).maybeSingle();

    if (lbRes.error) throw lbRes.error;
    if (!lbRes.data) throw Object.assign(new Error('Leaderboard not found'), { statusCode: 404 });

    const lb = lbRes.data;
    const lbId = lb.id;

    const [hostsRes, accessCtx, viewerRole] = await Promise.all([
      (supa as any)
        .from('branded_leaderboard_hosts')
        .select('*, users:user_id(id, name, avatar_url)')
        .eq('leaderboard_id', lbId)
        .order('display_order', { ascending: true }),
      getLeaderboardAccessContext(supa, lbId, userId),
      getBrandedBroadcastViewerRole(supa, lbId, userId),
    ]);
    if (hostsRes.error) throw hostsRes.error;

    const hosts = (hostsRes.data ?? []).map((h: any) => ({
      id: h.id,
      leaderboard_id: h.leaderboard_id,
      user_id: h.user_id,
      display_order: h.display_order,
      name: h.users?.name ?? null,
      avatar_url: h.users?.avatar_url ?? null,
    }));
    const { membership, subscription, access } = accessCtx;
    const canPostBroadcastValue = canPostBrandedBroadcast(viewerRole);
    const canReadBroadcast =
      access.hasAccess ||
      canPostBroadcastValue;
    const broadcastUnreadCount = canReadBroadcast
      ? await getBrandedBroadcastUnreadCount(supa, lbId, userId)
      : 0;

    req.log.info(
      {
        leaderboardId: lbId,
        userId,
        priceType: lb.price_type,
        membership: Boolean(membership),
        hasActivePurchase: access.hasActivePurchase,
        hasAccess: access.hasAccess,
        accessReason: access.accessReason,
      },
      'branded leaderboard access decision'
    );

    return {
      leaderboard: normalizeBrandedLeaderboardRow(lb),
      hosts,
      membership,
      subscription,
      hasAccess: access.hasAccess,
      hasActivePurchase: access.hasActivePurchase,
      requiresPurchase: access.requiresPurchase,
      accessReason: access.accessReason,
      canPostBroadcast: canPostBroadcastValue,
      broadcastUnreadCount,
    };
  });

  app.post('/v1/branded-leaderboards/:id/join', async (req) => {
    await requireUser(req, supabase);
    const { userId, supa } = getAuthedSupa(req, env);
    const { id } = IdParamSchema.parse((req as any).params);
    const body = JoinBodySchema.parse((req as any).body);

    const { data: codeData, error: codeErr } = await (supa as any)
      .from('branded_leaderboard_join_codes')
      .select('id, leaderboard_id, max_uses, use_count, active, expires_at')
      .eq('code', body.code.toUpperCase())
      .eq('leaderboard_id', id)
      .eq('active', true)
      .maybeSingle();
    if (codeErr) throw codeErr;
    if (!codeData) throw Object.assign(new Error('Invalid join code for this leaderboard'), { statusCode: 400 });

    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      throw Object.assign(new Error('Join code has expired'), { statusCode: 410 });
    }
    if (codeData.max_uses && codeData.use_count >= codeData.max_uses) {
      throw Object.assign(new Error('Join code has reached its usage limit'), { statusCode: 410 });
    }

    const { leaderboard, access } = await getLeaderboardAccessContext(supa, id, userId);
    const canJoin = canJoinBrandedLeaderboard({
      priceType: leaderboard.price_type,
      hasActivePurchase: access.hasActivePurchase,
    });

    req.log.info(
      {
        leaderboardId: id,
        userId,
        code: body.code.toUpperCase(),
        priceType: leaderboard.price_type,
        hasActivePurchase: access.hasActivePurchase,
        canJoin,
      },
      'branded leaderboard join decision'
    );

    if (!canJoin) {
      throw Object.assign(new Error('Purchase required for this leaderboard.'), {
        statusCode: 402,
        code: 'PURCHASE_REQUIRED',
      });
    }

    const { data: membership, error: memErr } = await (supa as any)
      .from('branded_leaderboard_memberships')
      .upsert(
        {
          leaderboard_id: id,
          user_id: userId,
          joined_at: new Date().toISOString(),
          left_at: null,
          source: 'join_code',
        },
        { onConflict: 'leaderboard_id,user_id' }
      )
      .select('*')
      .single();
    if (memErr) throw memErr;

    await (supa as any)
      .from('branded_leaderboard_join_codes')
      .update({ use_count: (codeData.use_count ?? 0) + 1 })
      .eq('id', codeData.id);

    return { membership };
  });

  app.post('/v1/branded-leaderboards/:id/leave', async (req) => {
    await requireUser(req, supabase);
    const { userId, supa } = getAuthedSupa(req, env);
    const { id } = IdParamSchema.parse((req as any).params);

    const { error } = await (supa as any)
      .from('branded_leaderboard_memberships')
      .update({ left_at: new Date().toISOString() })
      .eq('leaderboard_id', id)
      .eq('user_id', userId);
    if (error) throw error;
    return { ok: true };
  });

  app.post('/v1/branded-leaderboards/:id/activate', async (req) => {
    await requireUser(req, supabase);
    const { userId, supa } = getAuthedSupa(req, env);
    const { id } = IdParamSchema.parse((req as any).params);
    const body = ActivateBodySchema.parse((req as any).body);
    const { leaderboard } = await getLeaderboardAccessContext(supa, id, userId);

    const redemption = await verifyLeaderboardPurchase({
      userId,
      leaderboard,
      purchasedProductId: body.rc_product_id,
      req,
      supa,
    });

    req.log.info(
      {
        leaderboardId: id,
        userId,
        productId: body.rc_product_id,
        redemptionIdentifier: redemption?.redemptionIdentifier ?? null,
        redemptionSource: redemption?.source ?? null,
      },
      'branded leaderboard purchase verified'
    );

    const { data: sub, error: subErr } = await (supa as any)
      .from('branded_leaderboard_subscriptions')
      .upsert(
        {
          leaderboard_id: id,
          user_id: userId,
          rc_subscription_id: redemption?.redemptionIdentifier ?? body.rc_subscription_id,
          rc_product_id: redemption?.productId ?? body.rc_product_id,
          status: 'active',
          started_at: new Date().toISOString(),
        },
        { onConflict: 'leaderboard_id,user_id' }
      )
      .select('*')
      .single();
    if (subErr) throw subErr;

    return { subscription: sub };
  });

  app.get('/v1/branded-leaderboards/:id/broadcast/messages', async (req) => {
    await requireUser(req, supabase);
    const { userId, supa } = getAuthedSupa(req, env);
    const { id } = IdParamSchema.parse((req as any).params);
    const viewer = await requireBrandedBroadcastAccess(supa, id, userId);

    const { data: hosts, error: hostsError } = await (supa as any)
      .from('branded_leaderboard_hosts')
      .select('users:user_id(name)')
      .eq('leaderboard_id', id)
      .order('display_order', { ascending: true });
    if (hostsError) throw hostsError;

    await ensureBrandedBroadcastWelcomeMessage({
      leaderboard: viewer.leaderboard,
      hostNames: (hosts ?? []).map((host: any) => host.users?.name ?? null),
    });

    const [messages, lastReadAt] = await Promise.all([
      listBrandedBroadcastMessages(supa, id),
      getBrandedBroadcastLastReadAt(supa, id, userId),
    ]);

    return {
      messages,
      lastReadAt,
    };
  });

  app.post('/v1/branded-leaderboards/:id/broadcast/messages', async (req) => {
    await requireUser(req, supabase);
    const { userId, supa } = getAuthedSupa(req, env);
    const { id } = IdParamSchema.parse((req as any).params);
    const body = BroadcastMessageBodySchema.parse((req as any).body);
    const viewer = await requireBrandedBroadcastAccess(supa, id, userId);

    if (!canPostBrandedBroadcast(viewer)) {
      throw Object.assign(new Error('Only hosts can send broadcast messages.'), { statusCode: 403 });
    }

    const { data, error } = await (supa as any)
      .from('branded_leaderboard_broadcast_messages')
      .insert({
        leaderboard_id: id,
        user_id: userId,
        content: body.content,
        message_type: 'host',
      })
      .select('*, users:user_id(name, avatar_url)')
      .single();
    if (error) throw error;

    return { message: normalizeBroadcastMessageRow(data) };
  });

  app.post('/v1/branded-leaderboards/:id/broadcast/read', async (req) => {
    await requireUser(req, supabase);
    const { userId, supa } = getAuthedSupa(req, env);
    const { id } = IdParamSchema.parse((req as any).params);
    const body = BroadcastReadBodySchema.parse((req as any).body);
    await requireBrandedBroadcastAccess(supa, id, userId);

    const lastReadAt = body.lastReadAt ?? new Date().toISOString();
    const { error } = await (supa as any)
      .from('branded_leaderboard_broadcast_reads')
      .upsert(
        {
          leaderboard_id: id,
          user_id: userId,
          last_read_at: lastReadAt,
        },
        { onConflict: 'leaderboard_id,user_id' }
      );
    if (error) throw error;

    return {
      ok: true,
      lastReadAt,
    };
  });

  app.get('/v1/branded-leaderboards/:id/standings', async (req) => {
    await requireUser(req, supabase);
    const { userId, supa } = getAuthedSupa(req, env);
    const { id } = IdParamSchema.parse((req as any).params);
    const query = StandingsQuerySchema.parse((req as any).query);
    const { access } = await getLeaderboardAccessContext(supa, id, userId);

    if (!access.hasAccess) {
      throw Object.assign(new Error('You do not have access to this leaderboard yet.'), {
        statusCode: access.requiresPurchase ? 402 : 403,
      });
    }

    const { data: members, error: memErr } = await (supa as any)
      .from('branded_leaderboard_memberships')
      .select('user_id')
      .eq('leaderboard_id', id)
      .is('left_at', null);
    if (memErr) throw memErr;

    const memberIds = (members ?? []).map((m: any) => m.user_id);
    if (memberIds.length === 0) return { rows: [], userRank: null };

    const [{ data: userProfiles }, { data: hosts }] = await Promise.all([
      (supa as any)
        .from('users')
        .select('id, name, avatar_url')
        .in('id', memberIds),
      (supa as any)
        .from('branded_leaderboard_hosts')
        .select('user_id')
        .eq('leaderboard_id', id),
    ]);
    const profileMap = new Map<string, any>();
    (userProfiles ?? []).forEach((u: any) => profileMap.set(u.id, u));
    const hostIds = new Set((hosts ?? []).map((h: any) => h.user_id));

    const { data: meta } = await (supa as any)
      .from('app_meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle();
    const currentGw = (meta?.current_gw as number | null) ?? 1;
    const gw = query.gw ?? currentGw;

    let gwRange: number[] = [];
    if (query.scope === 'gw') {
      gwRange = [gw];
    } else if (query.scope === 'month') {
      const start = Math.max(1, gw - 3);
      gwRange = Array.from({ length: gw - start + 1 }, (_, i) => start + i);
    } else {
      gwRange = Array.from({ length: gw }, (_, i) => i + 1);
    }

    const { data: points, error: ptsErr } = await (supa as any)
      .from('app_v_gw_points')
      .select('user_id, gw, points')
      .in('user_id', memberIds)
      .in('gw', gwRange);
    if (ptsErr) throw ptsErr;

    const scoreMap = new Map<string, number>();
    (points ?? []).forEach((p: any) => {
      const uid = String(p.user_id);
      scoreMap.set(uid, (scoreMap.get(uid) ?? 0) + Number(p.points ?? 0));
    });

    const rows = (members ?? []).map((m: any) => {
      const profile = profileMap.get(m.user_id);
      return {
        rank: 0,
        user_id: m.user_id,
        name: profile?.name ?? 'User',
        avatar_url: profile?.avatar_url ?? null,
        value: scoreMap.get(m.user_id) ?? 0,
        is_host: hostIds.has(m.user_id),
      };
    });

    rows.sort((a: any, b: any) => b.value - a.value || a.name.localeCompare(b.name));
    rows.forEach((r: any, i: number) => {
      r.rank = i + 1;
    });

    const userRow = rows.find((r: any) => r.user_id === userId);
    return { rows, userRank: userRow?.rank ?? null };
  });

  // ============================================
  // REVENUECAT WEBHOOK
  // ============================================
  app.post('/webhooks/revenuecat', async (req) => {
    const body = (req as any).body as any;
    if (!body?.event) {
      return { ok: true };
    }

    const event = body.event;
    const appUserId = event.app_user_id as string | undefined;
    const productId = event.product_id as string | undefined;
    const eventType = event.type as string | undefined;

    if (!appUserId || !eventType) return { ok: true };

    const serviceSupa = supabase;

    try {
      const normalizedProductId = normalizeProductId(productId);
      const redemptionIdentifier = normalizeProductId(event.original_transaction_id ?? event.transaction_id ?? null);
      if (!normalizedProductId) {
        return { ok: true };
      }

      if (!redemptionIdentifier) {
        req.log.warn({ appUserId, productId, eventType }, 'RC webhook: no redemption identifier supplied');
        return { ok: true };
      }

      const { data: redeemedSubscription, error: redeemedSubscriptionErr } = await (serviceSupa as any)
        .from('branded_leaderboard_subscriptions')
        .select('leaderboard_id, user_id, rc_subscription_id')
        .eq('user_id', appUserId)
        .eq('rc_subscription_id', redemptionIdentifier)
        .maybeSingle();

      if (redeemedSubscriptionErr) throw redeemedSubscriptionErr;
      let matchedSubscription = redeemedSubscription ?? null;
      if (!matchedSubscription?.leaderboard_id) {
        const { data: aliasedSubscription, error: aliasedSubscriptionErr } = await (serviceSupa as any)
          .from('branded_leaderboard_subscriptions')
          .select('leaderboard_id, user_id, rc_subscription_id')
          .eq('rc_subscription_id', redemptionIdentifier)
          .maybeSingle();
        if (aliasedSubscriptionErr) throw aliasedSubscriptionErr;
        matchedSubscription = aliasedSubscription ?? null;
        if (matchedSubscription?.leaderboard_id && matchedSubscription.user_id !== appUserId) {
          req.log.warn(
            {
              appUserId,
              matchedUserId: matchedSubscription.user_id,
              productId,
              eventType,
              redemptionIdentifier,
            },
            'RC webhook: matched redeemed leaderboard purchase via redemption identifier alias fallback'
          );
        }
      }

      if (!matchedSubscription?.leaderboard_id) {
        req.log.warn(
          { appUserId, productId, eventType, redemptionIdentifier },
          'RC webhook: purchase not yet redeemed to a leaderboard'
        );
        return { ok: true };
      }

      const statusMap: Record<string, string> = {
        INITIAL_PURCHASE: 'active',
        RENEWAL: 'active',
        CANCELLATION: 'cancelled',
        EXPIRATION: 'expired',
        BILLING_ISSUE_DETECTED: 'billing_retry',
      };

      const newStatus = statusMap[eventType];
      if (newStatus && normalizedProductId) {
        const updatePayload: any = {
          leaderboard_id: matchedSubscription.leaderboard_id,
          user_id: matchedSubscription.user_id,
          rc_subscription_id: redemptionIdentifier,
          rc_product_id: normalizedProductId,
          status: newStatus,
          started_at: event.purchased_at_ms
            ? new Date(event.purchased_at_ms).toISOString()
            : new Date().toISOString(),
        };
        if (eventType === 'CANCELLATION') updatePayload.cancelled_at = new Date().toISOString();
        if (event.expiration_at_ms) updatePayload.expires_at = new Date(event.expiration_at_ms).toISOString();

        await (serviceSupa as any)
          .from('branded_leaderboard_subscriptions')
          .upsert(updatePayload, { onConflict: 'leaderboard_id,user_id' });
      }

      const revenueEventTypes: Record<string, string> = {
        INITIAL_PURCHASE: 'purchase',
        RENEWAL: 'renewal',
        CANCELLATION: 'cancellation',
        NON_RENEWING_PURCHASE: 'purchase',
      };

      const revType = revenueEventTypes[eventType];
      if (revType) {
        await (serviceSupa as any)
          .from('branded_leaderboard_revenue_events')
          .insert({
            leaderboard_id: matchedSubscription.leaderboard_id,
            user_id: matchedSubscription.user_id,
            event_type: revType,
            rc_event_id: event.id ?? null,
            amount_cents: Math.round((event.price ?? 0) * 100),
            currency: event.currency ?? 'GBP',
          });
      }
    } catch (err) {
      req.log.error({ err, appUserId, eventType }, 'RC webhook processing error');
      captureException(err);
    }

    return { ok: true };
  });
}

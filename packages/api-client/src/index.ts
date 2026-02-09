import { z } from 'zod';
import {
  GwResultsSchema,
  HomeRanksSchema,
  HomeSnapshotSchema,
  PredictionsResponseSchema,
  EmailPreferencesSchema,
  ProfileSummarySchema,
  UnicornCardSchema,
  UserStatsDataSchema,
  type GwResults,
  type EmailPreferences,
  type HomeRanks,
  type HomeSnapshot,
  type ProfileSummary,
  type PredictionsResponse,
  type UnicornCard,
  type UserStatsData,
} from '@totl/domain';

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, opts: { status: number; body: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.body = opts.body;
  }
}

class RequestTimeoutError extends Error {
  url: string;
  timeoutMs: number;

  constructor(url: string, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'RequestTimeoutError';
    this.url = url;
    this.timeoutMs = timeoutMs;
  }
}

async function requestJson<T>(
  opts: ApiClientOptions,
  input: string,
  init: RequestInit & { validate?: (data: unknown) => T }
): Promise<T> {
  const token = await opts.getAccessToken();
  const url = `${opts.baseUrl}${input}`;
  const timeoutMs = 12_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new RequestTimeoutError(url, timeoutMs);
    }

    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Network request failed (${url}): ${msg}`);
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const serverMessage =
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof (body as any).message === 'string'
        ? String((body as any).message)
        : null;

    throw new ApiError(serverMessage ?? `Request failed (${url}): ${res.status} ${res.statusText}`, {
      status: res.status,
      body,
    });
  }

  return init.validate ? init.validate(body) : (body as T);
}

export function createApiClient(opts: ApiClientOptions) {
  return {
    async getHomeSnapshot(params?: { gw?: number }): Promise<HomeSnapshot> {
      const q = params?.gw ? `?gw=${encodeURIComponent(String(params.gw))}` : '';
      return requestJson<HomeSnapshot>(opts, `/v1/home${q}`, {
        method: 'GET',
        validate: (data) => HomeSnapshotSchema.parse(data),
      });
    },

    async getHomeRanks(): Promise<HomeRanks> {
      return requestJson<HomeRanks>(opts, `/v1/home/ranks`, {
        method: 'GET',
        validate: (data) => HomeRanksSchema.parse(data),
      });
    },

    async getGwResults(gw: number): Promise<GwResults> {
      return requestJson<GwResults>(opts, `/v1/gw/${encodeURIComponent(String(gw))}/results`, {
        method: 'GET',
        validate: (data) => GwResultsSchema.parse(data),
      });
    },

    async registerExpoPushToken(input: { expoPushToken: string; platform?: 'ios' | 'android' }) {
      return requestJson<{ ok: true }>(opts, `/v1/push/register`, {
        method: 'POST',
        body: JSON.stringify(input),
        validate: (data) => (data as any) as { ok: true },
      });
    },

    async listLeagues(): Promise<{
      leagues: Array<{ id: string; name: string; code: string; avatar?: string | null }>;
    }> {
      return requestJson(opts, `/v1/leagues`, { method: 'GET' });
    },

    async getLeague(
      leagueId: string
    ): Promise<{ league: any; members: Array<{ id: string; name: string; avatar_url?: string | null }> }> {
      return requestJson(opts, `/v1/leagues/${encodeURIComponent(leagueId)}`, { method: 'GET' });
    },

    async getLeagueGwTable(
      leagueId: string,
      gw: number
    ): Promise<{
      leagueId: string;
      gw: number;
      rows: Array<{ user_id: string; name: string; avatar_url?: string | null; score: number; unicorns: number }>;
      submittedUserIds: string[];
      submittedCount: number;
      totalMembers: number;
    }> {
      return requestJson(opts, `/v1/leagues/${encodeURIComponent(leagueId)}/gw/${encodeURIComponent(String(gw))}/table`, { method: 'GET' });
    },

    async getPredictions(params?: { gw?: number }): Promise<PredictionsResponse> {
      const q = params?.gw ? `?gw=${encodeURIComponent(String(params.gw))}` : '';
      return requestJson(opts, `/v1/predictions${q}`, {
        method: 'GET',
        validate: (data) => PredictionsResponseSchema.parse(data),
      });
    },

    async savePredictions(input: { gw: number; picks: Array<{ fixture_index: number; pick: 'H' | 'D' | 'A' }> }) {
      return requestJson<{ ok: true }>(opts, `/v1/predictions/save`, {
        method: 'POST',
        body: JSON.stringify(input),
        validate: (data) => (data as any) as { ok: true },
      });
    },

    async submitPredictions(input: { gw: number }) {
      return requestJson<{ ok: true }>(opts, `/v1/predictions/submit`, {
        method: 'POST',
        body: JSON.stringify(input),
        validate: (data) => (data as any) as { ok: true },
      });
    },

    async getOverallLeaderboard(): Promise<{ rows: Array<{ user_id: string; name: string | null; ocp: number | null }> }> {
      return requestJson(opts, `/v1/leaderboards/overall`, { method: 'GET' });
    },

    async getNotificationPrefs(): Promise<{ preferences: Record<string, boolean>; current_viewing_gw: number | null }> {
      return requestJson(opts, `/v1/notification-prefs`, { method: 'GET' });
    },

    async updateNotificationPrefs(input: { preferences?: Record<string, boolean>; current_viewing_gw?: number | null }) {
      return requestJson<{ ok: true }>(opts, `/v1/notification-prefs`, {
        method: 'PUT',
        body: JSON.stringify(input),
        validate: (data) => (data as any) as { ok: true },
      });
    },

    async getProfileSummary(): Promise<ProfileSummary> {
      return requestJson<ProfileSummary>(opts, `/v1/profile/summary`, {
        method: 'GET',
        validate: (data) => ProfileSummarySchema.parse(data),
      });
    },

    async getProfileStats(): Promise<UserStatsData> {
      return requestJson<UserStatsData>(opts, `/v1/profile/stats`, {
        method: 'GET',
        validate: (data) => UserStatsDataSchema.parse(data),
      });
    },

    async getProfileUnicorns(): Promise<{ unicorns: UnicornCard[] }> {
      return requestJson(opts, `/v1/profile/unicorns`, {
        method: 'GET',
        validate: (data) =>
          (z.object({ unicorns: z.array(UnicornCardSchema) }).parse(data) as unknown) as { unicorns: UnicornCard[] },
      });
    },

    async getEmailPreferences(): Promise<{ preferences: EmailPreferences }> {
      return requestJson(opts, `/v1/email-preferences`, {
        method: 'GET',
        validate: (data) =>
          (z.object({ preferences: EmailPreferencesSchema }).parse(data) as unknown) as { preferences: EmailPreferences },
      });
    },

    async updateEmailPreferences(input: Partial<EmailPreferences>): Promise<{ ok: true; preferences: EmailPreferences }> {
      return requestJson(opts, `/v1/email-preferences`, {
        method: 'PUT',
        body: JSON.stringify(input),
        validate: (data) =>
          (z
            .object({ ok: z.literal(true), preferences: EmailPreferencesSchema })
            .parse(data) as unknown) as { ok: true; preferences: EmailPreferences },
      });
    },
  };
}


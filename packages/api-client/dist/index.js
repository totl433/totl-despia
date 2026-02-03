import { GwResultsSchema, HomeRanksSchema, HomeSnapshotSchema, } from '@totl/domain';
export class ApiError extends Error {
    status;
    body;
    constructor(message, opts) {
        super(message);
        this.name = 'ApiError';
        this.status = opts.status;
        this.body = opts.body;
    }
}
async function requestJson(opts, input, init) {
    const token = await opts.getAccessToken();
    const res = await fetch(`${opts.baseUrl}${input}`, {
        ...init,
        headers: {
            ...(init.headers ?? {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'Content-Type': 'application/json',
        },
    });
    const text = await res.text();
    let body = null;
    if (text) {
        try {
            body = JSON.parse(text);
        }
        catch {
            body = text;
        }
    }
    if (!res.ok) {
        const serverMessage = body &&
            typeof body === 'object' &&
            'message' in body &&
            typeof body.message === 'string'
            ? String(body.message)
            : null;
        throw new ApiError(serverMessage ?? `Request failed: ${res.status} ${res.statusText}`, {
            status: res.status,
            body,
        });
    }
    return init.validate ? init.validate(body) : body;
}
export function createApiClient(opts) {
    return {
        async getHomeSnapshot(params) {
            const q = params?.gw ? `?gw=${encodeURIComponent(String(params.gw))}` : '';
            return requestJson(opts, `/v1/home${q}`, {
                method: 'GET',
                validate: (data) => HomeSnapshotSchema.parse(data),
            });
        },
        async getHomeRanks() {
            return requestJson(opts, `/v1/home/ranks`, {
                method: 'GET',
                validate: (data) => HomeRanksSchema.parse(data),
            });
        },
        async getGwResults(gw) {
            return requestJson(opts, `/v1/gw/${encodeURIComponent(String(gw))}/results`, {
                method: 'GET',
                validate: (data) => GwResultsSchema.parse(data),
            });
        },
        async registerExpoPushToken(input) {
            return requestJson(opts, `/v1/push/register`, {
                method: 'POST',
                body: JSON.stringify(input),
                validate: (data) => data,
            });
        },
        async listLeagues() {
            return requestJson(opts, `/v1/leagues`, { method: 'GET' });
        },
        async getLeague(leagueId) {
            return requestJson(opts, `/v1/leagues/${encodeURIComponent(leagueId)}`, { method: 'GET' });
        },
        async getLeagueGwTable(leagueId, gw) {
            return requestJson(opts, `/v1/leagues/${encodeURIComponent(leagueId)}/gw/${encodeURIComponent(String(gw))}/table`, { method: 'GET' });
        },
        async getPredictions(params) {
            const q = params?.gw ? `?gw=${encodeURIComponent(String(params.gw))}` : '';
            return requestJson(opts, `/v1/predictions${q}`, { method: 'GET' });
        },
        async savePredictions(input) {
            return requestJson(opts, `/v1/predictions/save`, {
                method: 'POST',
                body: JSON.stringify(input),
                validate: (data) => data,
            });
        },
        async submitPredictions(input) {
            return requestJson(opts, `/v1/predictions/submit`, {
                method: 'POST',
                body: JSON.stringify(input),
                validate: (data) => data,
            });
        },
        async getOverallLeaderboard() {
            return requestJson(opts, `/v1/leaderboards/overall`, { method: 'GET' });
        },
        async getNotificationPrefs() {
            return requestJson(opts, `/v1/notification-prefs`, { method: 'GET' });
        },
        async updateNotificationPrefs(input) {
            return requestJson(opts, `/v1/notification-prefs`, {
                method: 'PUT',
                body: JSON.stringify(input),
                validate: (data) => data,
            });
        },
    };
}

import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  isKickoffTooOldForPolling,
  parseKickoffMs,
  shouldRunScheduledPollForSite,
} from './lib/liveMatchGuards';
import {
  loadDualStackFixturesToPoll,
  resolveDualStackRuntime,
  upsertDualStackResults,
  fetchGwPickerUserIds,
  isGwAllFinished,
  type FinishedResultRow,
  type PollFixture,
  type ResolvedRuntime,
} from './lib/seasonStackPoll';
import { sendGameweekCompleteNotification } from './lib/notifications/scoreHelpers';
import { countNotificationEventSends } from './lib/notifications/idempotency';
import { buildGameweekCompleteEventId } from './lib/notifications/scoreTransitionGuards';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY?.trim() || '';
const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';

/**
 * Normalize team name from API to our canonical medium name
 * This ensures consistency across the app regardless of API variations
 */
function normalizeTeamName(apiTeamName: string | null | undefined): string | null {
  if (!apiTeamName) return null;
  
  const normalized = apiTeamName
    .toLowerCase()
    .replace(/\s+fc\s*$/i, '') // Remove "FC" at end
    .replace(/\s+&amp;\s+/g, ' ') // Replace &amp; with space
    .replace(/\s*&\s*/g, ' ') // Replace & with space
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();
  
  // Map common API variations to our canonical medium names
  const teamNameMap: Record<string, string> = {
    'manchester city': 'Man City',
    'manchester united': 'Man United',
    'newcastle united': 'Newcastle',
    'west ham united': 'West Ham',
    'tottenham hotspur': 'Spurs',
    'wolverhampton wanderers': 'Wolves',
    'brighton and hove albion': 'Brighton',
    'brighton hove albion': 'Brighton',
    'leeds united': 'Leeds',
    'nottingham forest': 'Forest',
    'crystal palace': 'Palace',
    'aston villa': 'Villa',
  };
  
  // Check if we have a mapping
  if (teamNameMap[normalized]) {
    return teamNameMap[normalized];
  }
  
  // If no mapping, capitalize first letter of each word (fallback)
  return apiTeamName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .replace(/\s+FC\s*$/i, '')
    .trim();
}

// Initialize Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function fetchMatchScore(apiMatchId: number): Promise<any> {
  const apiUrl = `${FOOTBALL_DATA_BASE_URL}/matches/${apiMatchId}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'X-Auth-Token': FOOTBALL_DATA_API_KEY,
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      console.warn(`[pollLiveScores] Rate limited for match ${apiMatchId}, retry after ${retryAfter}s`);
      return null; // Will retry on next scheduled run
    }
    console.error(`[pollLiveScores] API error for match ${apiMatchId}:`, response.status, response.statusText);
    return null;
  }

  return await response.json();
}

async function maybeBackfillSeasonGameweekComplete(runtime: ResolvedRuntime) {
  if (!runtime.seasonId || runtime.seasonGw == null) return;

  const seasonFinished = await isGwAllFinished(
    supabase,
    'season',
    runtime.seasonGw,
    runtime.seasonId
  );
  if (!seasonFinished) return;

  const eventId = buildGameweekCompleteEventId(runtime.seasonGw, runtime.seasonId);
  const gwUserIds = await fetchGwPickerUserIds(
    supabase,
    'season',
    runtime.seasonGw,
    runtime.seasonId
  );
  if (gwUserIds.length === 0) {
    console.warn(
      `[pollLiveScores] Season GW ${runtime.seasonGw} is finished but no pickers found`
    );
    return;
  }

  const alreadySent = await countNotificationEventSends('gameweek-complete', eventId);
  if (alreadySent >= gwUserIds.length) return;

  const result = await sendGameweekCompleteNotification(
    gwUserIds,
    runtime.seasonGw,
    runtime.seasonId
  );
  console.log(
    `[pollLiveScores] Gameweek complete backfill (season GW ${runtime.seasonGw}): ${result.results.accepted} sent (${alreadySent} already logged / ${gwUserIds.length} pickers)`
  );
}

async function pollAllLiveScores() {
  try {
    // Dual-stack: poll both legacy (app_meta + app_fixtures) and Pile B
    // (app_season_runtime + app_season_fixtures). Results write to the right table(s).
    const runtime = await resolveDualStackRuntime(supabase);
    console.log('[pollLiveScores] Dual-stack runtime:', {
      legacyGw: runtime.legacyGw,
      seasonId: runtime.seasonId,
      seasonGw: runtime.seasonGw,
    });

    if (runtime.legacyGw == null && !(runtime.seasonId && runtime.seasonGw != null)) {
      console.error('[pollLiveScores] No current GW on either stack — aborting poll');
      return;
    }

    const { fixtures: dualFixtures, debug: dualDebug } = await loadDualStackFixturesToPoll(
      supabase,
      runtime
    );
    dualDebug.forEach((line) => console.log(`[pollLiveScores] ${line}`));

    // Dedupe by api_match_id already done in helper
    const allFixtures: PollFixture[] = dualFixtures;

    if (allFixtures.length === 0) {
      console.log('[pollLiveScores] No fixtures with api_match_id found on either stack');
      try {
        await maybeBackfillSeasonGameweekComplete(runtime);
      } catch (e) {
        console.error('[pollLiveScores] Gameweek complete backfill failed:', e);
      }
      return;
    }

    console.log(
      `[pollLiveScores] Found ${allFixtures.length} unique fixtures to consider across stacks`
    );

    // Check current status of fixtures in database to skip FINISHED games
    const apiMatchIds = allFixtures.map(f => f.api_match_id);
    const { data: existingScores } = await supabase
      .from('live_scores')
      .select('api_match_id, status')
      .in('api_match_id', apiMatchIds);

    const finishedMatchIds = new Set<number>();
    (existingScores || []).forEach((score: any) => {
      if (score.status === 'FINISHED') {
        finishedMatchIds.add(score.api_match_id);
      }
    });

    // Filter fixtures to only poll games that have started (or should have started)
    // We continue polling until the API explicitly says the game is FINISHED
    const now = Date.now();
    
    const fixturesToPoll = allFixtures.filter(f => {
      // Skip if already finished (according to our database)
      if (finishedMatchIds.has(f.api_match_id)) {
        return false;
      }

      // Hard stop for historical fixtures (e.g. current_gw accidentally reset in off-season).
      // Never re-poll matches whose kickoff was days ago — Football Data still returns them
      // as FINISHED with full goal lists, which re-triggers push notifications.
      if (isKickoffTooOldForPolling(f.kickoff_time, now)) {
        console.log(
          `[pollLiveScores] Skipping stale fixture api_match_id=${f.api_match_id} kickoff=${f.kickoff_time}`
        );
        return false;
      }
      
      // If we have a kickoff time, only poll if the game has started (or should have started)
      if (f.kickoff_time) {
        try {
          const kickoffTime = new Date(f.kickoff_time).getTime();
          const hasStarted = now >= kickoffTime;
          
          // Poll if:
          // 1. Game has started (current time >= kickoff time)
          // 2. Game is not yet marked as FINISHED in our database
          // We continue polling until the API tells us it's FINISHED
          return hasStarted;
        } catch (e) {
          // If we can't parse the kickoff time, include it to be safe
          console.warn(`[pollLiveScores] Error parsing kickoff_time for fixture ${f.api_match_id}:`, e);
          return true;
        }
      }
      
      // If no kickoff time, check if we have an existing status
      // If status exists and is not FINISHED, poll it
      // If no status exists, poll it (might be a game without kickoff time)
      const existingScore = (existingScores || []).find((s: any) => s.api_match_id === f.api_match_id);
      if (existingScore) {
        return existingScore.status !== 'FINISHED';
      }
      
      // No kickoff time and no existing status - include it to be safe
      return true;
    });

    if (fixturesToPoll.length === 0) {
      console.log('[pollLiveScores] No fixtures currently eligible for polling');
      // Last FT can miss the webhook; still send GW-complete once games are done.
      try {
        await maybeBackfillSeasonGameweekComplete(runtime);
      } catch (e) {
        console.error('[pollLiveScores] Gameweek complete backfill failed:', e);
      }
      return;
    }

    const skippedCount = allFixtures.length - fixturesToPoll.length;
    const finishedCount = Array.from(finishedMatchIds).length;
    const notStartedCount = skippedCount - finishedCount;
    console.log(`[pollLiveScores] Polling ${fixturesToPoll.length} fixtures (skipped ${skippedCount}: ${finishedCount} finished, ${notStartedCount} not yet started)`);

    // Poll each fixture with a small delay to avoid rate limits
    const updates: any[] = [];
    const resultsUpserts: FinishedResultRow[] = [];
    // Fallback GW for live_scores when fixture.gw is missing
    const defaultGw = runtime.seasonGw ?? runtime.legacyGw ?? 1;
    
    for (let i = 0; i < fixturesToPoll.length; i++) {
      const fixture = fixturesToPoll[i];
      const apiMatchId = fixture.api_match_id;

      // Small delay between requests (stagger by 2 seconds per fixture)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const matchData = await fetchMatchScore(apiMatchId);
      
      if (!matchData) {
        continue; // Skip if rate limited or error
      }

      let status = matchData.status || 'SCHEDULED';
      const kickoffIso = fixture.kickoff_time || matchData.utcDate || null;
      const kickoffMs = parseKickoffMs(kickoffIso);
      const kickoffPassed = kickoffMs != null && Date.now() >= kickoffMs;
      const kickoffStillLiveWindow =
        kickoffIso != null && !isKickoffTooOldForPolling(kickoffIso);

      // Football Data (esp. free/standard plans) often leaves status TIMED for
      // several minutes after kickoff. Our UI only treats IN_PLAY/PAUSED as live,
      // so coerce once KO has passed within the live poll window.
      if (
        kickoffPassed &&
        kickoffStillLiveWindow &&
        (status === 'TIMED' || status === 'SCHEDULED')
      ) {
        console.log(
          `[pollLiveScores] Coercing match ${apiMatchId} ${status} → IN_PLAY (kickoff passed, API lag)`
        );
        status = 'IN_PLAY';
      }

      const isLive = status === 'IN_PLAY' || status === 'PAUSED';
      
      // Extract goals and bookings from API response FIRST
      // Goals array contains: { minute, scorer: { name, id }, team: { id, name }, type: "REGULAR" | "OWN_GOAL" | "PENALTY" }
      // IMPORTANT: For own goals, goal.team is the player's team, but we need to use the OPPOSITE team
      // Check if there's a type field or if we need to infer from teamId vs homeTeamId/awayTeamId
      const homeTeamId = matchData.homeTeam?.id;
      const awayTeamId = matchData.awayTeam?.id;
      
      const goals = (matchData.goals || []).map((goal: any) => {
        let goalTeam = goal.team;
        let goalTeamId = goal.team?.id;
        
        // Check if this is an own goal - API uses "OWN" for own goals
        // If goal.type is "OWN", then the goal counts for the OPPOSITE team
        const isOwnGoal = goal.type === 'OWN' || 
                         goal.type === 'OWN_GOAL' || 
                         goal.type === 'OWN GOAL' || 
                         (goal.scorer?.name && goal.scorer.name.toLowerCase().includes('own goal'));
        
        if (isOwnGoal) {
          // Own goal: if player's team is home, goal counts for away (and vice versa)
          if (goalTeamId === homeTeamId) {
            goalTeam = matchData.awayTeam;
            goalTeamId = awayTeamId;
          } else if (goalTeamId === awayTeamId) {
            goalTeam = matchData.homeTeam;
            goalTeamId = homeTeamId;
          }
          console.log(`[pollLiveScores] OWN GOAL detected: ${goal.scorer?.name} ${goal.minute}' - player's team: "${goal.team?.name}", goal counts for: "${goalTeam?.name}"`);
        }
        
        const normalizedTeam = normalizeTeamName(goalTeam?.name);
        console.log(`[pollLiveScores] Goal: ${goal.scorer?.name} ${goal.minute}' - API team: "${goalTeam?.name}" -> normalized: "${normalizedTeam}"${isOwnGoal ? ' (OWN GOAL)' : ''}`);
        return {
          minute: goal.minute ?? null,
          scorer: goal.scorer?.name ?? null,
          scorerId: goal.scorer?.id ?? null,
          team: normalizedTeam ?? null, // Normalize to canonical name
          teamId: goalTeamId ?? null,
          isOwnGoal: isOwnGoal,
        };
      });

      // Use API score directly - it's the source of truth
      // The API knows which team is home and which is away
      // For live games, use current if available, otherwise use fullTime (API updates fullTime even for live games)
      let homeScore: number;
      let awayScore: number;

      const currentHome = matchData.score?.current?.home;
      const currentAway = matchData.score?.current?.away;
      const fullTimeHome = matchData.score?.fullTime?.home;
      const fullTimeAway = matchData.score?.fullTime?.away;
      
      if (isLive) {
        // Incomplete live payloads (all null) used to fall through to 0-0 and
        // falsely trigger "goal disallowed" pushes. Skip the match this poll —
        // unless kickoff has passed and FD is still on TIMED with null scores
        // (coerce path): then 0-0 is the correct live state.
        if (
          currentHome == null &&
          currentAway == null &&
          fullTimeHome == null &&
          fullTimeAway == null
        ) {
          if (kickoffPassed && kickoffStillLiveWindow) {
            homeScore = 0;
            awayScore = 0;
          } else {
            console.warn(
              `[pollLiveScores] Skipping match ${apiMatchId}: live payload has no score fields`
            );
            continue;
          }
        } else {
          // Live games: prefer current, but use fullTime if current is null
          homeScore = currentHome ?? fullTimeHome ?? 0;
          awayScore = currentAway ?? fullTimeAway ?? 0;
        }
      } else {
        // Finished games: use fullTime
        homeScore = fullTimeHome ?? 0;
        awayScore = fullTimeAway ?? 0;
      }
      
      // Try multiple possible locations for minute in API response
      // The API might provide it as: matchData.minute, matchData.currentMinute, or in score object
      let apiMinute: number | null | undefined = matchData.minute ?? 
                                                 matchData.currentMinute ?? 
                                                 matchData.score?.minute ?? 
                                                 null;

      // For finished games, always set minute to null (FT doesn't need minute)
      // For all other games, use the API minute directly
      const minute = status === 'FINISHED' ? null : (apiMinute ?? null);
      
      // Log minute value being stored
      if (status === 'IN_PLAY' || status === 'PAUSED') {
        console.log(`[pollLiveScores] Match ${apiMatchId} - Storing minute: ${minute} (from API)`);
      }

      console.log(`[pollLiveScores] Match ${apiMatchId} - API minute: ${apiMinute ?? 'null'}, status: ${status}`);
      console.log(`[pollLiveScores] Match ${apiMatchId} - Score from API: ${matchData.score?.current?.home ?? 'null'}-${matchData.score?.current?.away ?? 'null'} (current), ${matchData.score?.fullTime?.home ?? 'null'}-${matchData.score?.fullTime?.away ?? 'null'} (fullTime), using: ${homeScore}-${awayScore}`);

      // Filter bookings to only include red cards
      // API returns "RED" not "RED_CARD" for red cards
      const redCards = (matchData.bookings || [])
        .filter((booking: any) => booking.card === 'RED_CARD' || booking.card === 'RED')
        .map((booking: any) => ({
          minute: booking.minute ?? null,
          player: booking.player?.name ?? null,
          playerId: booking.player?.id ?? null,
          team: normalizeTeamName(booking.team?.name) ?? null, // Normalize to canonical name
          teamId: booking.team?.id ?? null,
        }));

      updates.push({
        api_match_id: apiMatchId,
        gw: fixture.gw || defaultGw,
        fixture_index: fixture.fixture_index,
        home_score: homeScore,
        away_score: awayScore,
        status: status,
        minute: minute,
        home_team: (() => {
          const normalized = normalizeTeamName(matchData.homeTeam?.name);
          console.log(`[pollLiveScores] Home team: API="${matchData.homeTeam?.name}" -> normalized="${normalized}"`);
          return normalized || fixture.home_team || matchData.homeTeam?.name;
        })(),
        away_team: (() => {
          const normalized = normalizeTeamName(matchData.awayTeam?.name);
          console.log(`[pollLiveScores] Away team: API="${matchData.awayTeam?.name}" -> normalized="${normalized}"`);
          return normalized || fixture.away_team || matchData.awayTeam?.name;
        })(),
        kickoff_time: fixture.kickoff_time || matchData.utcDate,
        goals: goals.length > 0 ? goals : null,
        red_cards: redCards.length > 0 ? redCards : null,
      });

      // If finished, write outcomes to every stack that owns this fixture
      if (status === 'FINISHED' || status === 'FT') {
        let outcome: 'H' | 'A' | 'D';
        if (homeScore > awayScore) outcome = 'H';
        else if (awayScore > homeScore) outcome = 'A';
        else outcome = 'D';

        const sources =
          fixture.sources?.length > 0
            ? fixture.sources
            : [
                {
                  stack: 'legacy' as const,
                  gw: fixture.gw || defaultGw,
                  fixture_index: fixture.fixture_index,
                },
              ];

        for (const src of sources) {
          resultsUpserts.push({
            stack: src.stack,
            seasonId: src.seasonId,
            gw: src.gw,
            fixture_index: src.fixture_index,
            result: outcome,
            home_score: homeScore,
            away_score: awayScore,
            api_match_id: apiMatchId,
          });
        }
      }

      const goalsCount = goals.length;
      const redCardsCount = redCards.length;
      console.log(`[pollLiveScores] Updated match ${apiMatchId}: ${homeScore}-${awayScore} (${status}) - ${goalsCount} goals, ${redCardsCount} red cards`);
    }

    // Upsert all updates to Supabase
    if (updates.length > 0) {
      // First, fetch existing records to compare (for old_record in webhook)
      const apiMatchIds = updates.map(u => u.api_match_id);
      const { data: existingRecords } = await supabase
        .from('live_scores')
        .select('*')
        .in('api_match_id', apiMatchIds);
      
      const existingMap = new Map((existingRecords || []).map((r: any) => [r.api_match_id, r]));

      // Don't wipe a populated goals list when the API returns [] but the score
      // did not drop — that glitch looks like every goal was disallowed.
      for (const update of updates) {
        const existing = existingMap.get(update.api_match_id) as
          | { home_score?: number; away_score?: number; goals?: any[] }
          | undefined;
        if (!existing?.goals || !Array.isArray(existing.goals) || existing.goals.length === 0) {
          continue;
        }
        const newGoalsEmpty = !update.goals || (Array.isArray(update.goals) && update.goals.length === 0);
        if (!newGoalsEmpty) continue;

        const existingTotal = (existing.home_score ?? 0) + (existing.away_score ?? 0);
        const newTotal = (update.home_score ?? 0) + (update.away_score ?? 0);
        if (newTotal >= existingTotal) {
          console.warn(
            `[pollLiveScores] Preserving goals for match ${update.api_match_id}: API returned empty goals without a score drop`
          );
          update.goals = existing.goals;
        }
      }

      const { error: upsertError } = await supabase
        .from('live_scores')
        .upsert(updates, {
          onConflict: 'api_match_id',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error('[pollLiveScores] Error upserting live scores:', upsertError);
      } else {
        console.log(`[pollLiveScores] Successfully updated ${updates.length} live scores`);
        // Note: Webhooks are now handled by Supabase Dashboard webhook (see SUPABASE_WEBHOOK_SETUP.md)
        // Supabase will automatically call sendScoreNotificationsWebhook when live_scores is updated
      }
    }

    // Upsert finished results into legacy and/or season results (idempotent)
    if (resultsUpserts.length > 0) {
      await upsertDualStackResults(supabase, resultsUpserts);
    }

    // Completeness check for both stacks
    try {
      if (runtime.legacyGw != null) {
        const gw = runtime.legacyGw;
        const [{ data: fx }, { data: rs }] = await Promise.all([
          supabase
            .from('app_fixtures')
            .select('gw, fixture_index')
            .gte('gw', gw)
            .lte('gw', gw + 5),
          supabase.from('app_gw_results').select('gw, fixture_index'),
        ]);
        const fxByGw = new Map<number, number>();
        (fx || []).forEach((f: any) => fxByGw.set(f.gw, (fxByGw.get(f.gw) || 0) + 1));
        const rsByGw = new Map<number, number>();
        (rs || []).forEach((r: any) => rsByGw.set(r.gw, (rsByGw.get(r.gw) || 0) + 1));
        Array.from(fxByGw.entries()).forEach(([g, fxCount]) => {
          const resCount = rsByGw.get(g) || 0;
          if (resCount < fxCount) {
            console.warn(
              `[pollLiveScores] Legacy results missing GW ${g}: ${resCount}/${fxCount} app_gw_results`
            );
          }
        });
      }

      if (runtime.seasonId && runtime.seasonGw != null) {
        const seasonId = runtime.seasonId;
        const gw = runtime.seasonGw;
        const [{ data: fx }, { data: rs }] = await Promise.all([
          supabase
            .from('app_season_fixtures')
            .select('gw, fixture_index')
            .eq('season_id', seasonId)
            .gte('gw', gw)
            .lte('gw', gw + 5),
          supabase
            .from('app_season_results')
            .select('gw, fixture_index')
            .eq('season_id', seasonId),
        ]);
        const fxByGw = new Map<number, number>();
        (fx || []).forEach((f: any) => fxByGw.set(f.gw, (fxByGw.get(f.gw) || 0) + 1));
        const rsByGw = new Map<number, number>();
        (rs || []).forEach((r: any) => rsByGw.set(r.gw, (rsByGw.get(r.gw) || 0) + 1));
        Array.from(fxByGw.entries()).forEach(([g, fxCount]) => {
          const resCount = rsByGw.get(g) || 0;
          if (resCount < fxCount) {
            console.warn(
              `[pollLiveScores] Season results missing GW ${g}: ${resCount}/${fxCount} app_season_results`
            );
          }
        });
      }
    } catch (e) {
      console.error('[pollLiveScores] Completeness check failed:', e);
    }

    // If the last FT arrived without a webhook fullTime transition, still send
    // season GW-complete (idempotent via notification_send_log).
    try {
      await maybeBackfillSeasonGameweekComplete(runtime);
    } catch (e) {
      console.error('[pollLiveScores] Gameweek complete backfill failed:', e);
    }

  } catch (error: any) {
    console.error('[pollLiveScores] Error:', error);
    throw error;
  }
}

// Handler for scheduled and manual invocation
export const handler: Handler = async (event) => {
  // Can be invoked via:
  // 1. Scheduled function (Netlify cron) - event will have event.source = 'netlify-scheduled-function'
  // 2. Manual HTTP call (GET or POST)
  
  const context = process.env.CONTEXT || process.env.NETLIFY_CONTEXT || 'unknown';
  const branch = process.env.BRANCH || process.env.HEAD || process.env.COMMIT_REF || 'unknown';
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || '';

  if (!shouldRunScheduledPollForSite(siteUrl)) {
    console.log(`[pollLiveScores] Skipping non-canonical site: ${siteUrl}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: false, message: 'Polling is owned by playtotl.com' }),
    };
  }

  if (!FOOTBALL_DATA_API_KEY) {
    console.error('[pollLiveScores] FOOTBALL_DATA_API_KEY is not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Live-score provider is not configured' }),
    };
  }

  // Log environment info for debugging
  console.log(`[pollLiveScores] Environment check:`, {
    context,
    branch,
    siteUrl: siteUrl ? siteUrl.substring(0, 50) + '...' : 'none',
    allEnvVars: {
      CONTEXT: process.env.CONTEXT,
      NETLIFY_CONTEXT: process.env.NETLIFY_CONTEXT,
      BRANCH: process.env.BRANCH,
      HEAD: process.env.HEAD,
      COMMIT_REF: process.env.COMMIT_REF,
      URL: process.env.URL ? process.env.URL.substring(0, 50) + '...' : undefined,
      DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL ? process.env.DEPLOY_PRIME_URL.substring(0, 50) + '...' : undefined,
    }
  });
  
  // Use meta table to store lock timestamp with aggressive check
  // For test API, we want 15-second polling, but Netlify cron minimum is 1 minute
  // So we allow runs every 15 seconds minimum (to handle manual triggers or multiple scheduled functions)
  const MIN_RUN_INTERVAL_MS = 15 * 1000; // 15 seconds minimum between runs (for test API)
  
  try {
    // Add small random delay (0-2 seconds) to prevent thundering herd
    const randomDelay = Math.floor(Math.random() * 2000);
    await new Promise(resolve => setTimeout(resolve, randomDelay));
    
    // Check lock immediately before starting work
    // Try to read last_poll_time, but handle gracefully if column doesn't exist yet
    let lastPollTime: string | null = null;
    let metaCurrentGw: number | null = null;
    try {
      const { data: metaData, error: metaError } = await supabase
        .from('app_meta')
        .select('current_gw, last_poll_time')
        .eq('id', 1)
        .maybeSingle();
      
      if (metaError) {
        // If column doesn't exist (PGRST204 or 42703), that's ok - we'll create it
        if (metaError.code === 'PGRST204' || metaError.code === '42703') {
          console.log('[pollLiveScores] last_poll_time column does not exist yet - will be created on first run');
        } else if (metaError.code !== 'PGRST116') {
          console.warn('[pollLiveScores] Error checking lock:', metaError);
        }
      } else if (metaData) {
        metaCurrentGw = (metaData as any).current_gw ?? null;
        lastPollTime = (metaData as any).last_poll_time;
        if (lastPollTime) {
          const lastPoll = new Date(lastPollTime).getTime();
          const now = Date.now();
          const timeSinceLastRun = now - lastPoll;
          
          if (timeSinceLastRun < MIN_RUN_INTERVAL_MS) {
            console.log(`[pollLiveScores] Ran ${Math.floor(timeSinceLastRun / 1000)}s ago, skipping (minimum interval: ${MIN_RUN_INTERVAL_MS / 1000}s)`);
            return {
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ success: false, message: 'Too soon since last run, skipped' }),
            };
          }
        }
      }
    } catch (e: any) {
      // Column might not exist - that's ok, continue
      if (e.code !== 'PGRST204' && e.code !== '42703') {
        console.warn('[pollLiveScores] Error checking lock (non-fatal):', e);
      }
    }
    
    // Update lock timestamp IMMEDIATELY to claim the lock
    // Use upsert to create/update the app_meta row with last_poll_time
    const lockTimestamp = new Date().toISOString();
    try {
      // First try to update existing row
      const { error: updateError } = await supabase
        .from('app_meta')
        .update({ last_poll_time: lockTimestamp } as any)
        .eq('id', 1);
      
      if (updateError) {
        // If update fails (maybe column doesn't exist or row doesn't exist), try upsert
        if (updateError.code === 'PGRST204' || updateError.code === '42703') {
          console.log('[pollLiveScores] last_poll_time column missing - attempting to add via upsert (may require manual migration)');
        }
        // Try upsert as fallback
        const { error: upsertError } = await supabase
          .from('app_meta')
          .upsert(
            { id: 1, last_poll_time: lockTimestamp, current_gw: metaCurrentGw ?? 1 } as any,
            { onConflict: 'id' }
          );
        
        if (upsertError && upsertError.code !== 'PGRST204' && upsertError.code !== '42703') {
          console.warn('[pollLiveScores] Failed to update lock timestamp:', upsertError);
        }
      }
    } catch (e: any) {
      // If column doesn't exist, we can't use the lock mechanism
      // Log but continue - the function will still run, just without lock protection
      if (e.code === 'PGRST204' || e.code === '42703') {
        console.warn('[pollLiveScores] Cannot use lock mechanism - last_poll_time column does not exist. Please run the migration: supabase/sql/add_poll_lock_column.sql');
      } else {
        console.warn('[pollLiveScores] Error updating lock (non-fatal):', e);
      }
    }
    
    // Double-check: If another function updated the lock between our check and update, bail out
    // Wait a tiny bit then check again (only if we successfully set the lock)
    if (lastPollTime !== undefined) {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        const { data: doubleCheckData } = await supabase
          .from('app_meta')
          .select('last_poll_time')
          .eq('id', 1)
          .maybeSingle();
        
        if (doubleCheckData) {
          const doubleCheckTime = new Date((doubleCheckData as any).last_poll_time).getTime();
          const ourLockTime = new Date(lockTimestamp).getTime();
          // If the lock time changed significantly (more than 1 second), someone else got it
          if (Math.abs(doubleCheckTime - ourLockTime) > 1000) {
            console.log('[pollLiveScores] Lock was updated by another invocation, skipping');
            return {
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ success: false, message: 'Lock acquired by another invocation' }),
            };
          }
        }
      } catch (e: any) {
        // Ignore errors in double-check
        if (e.code !== 'PGRST204' && e.code !== '42703') {
          console.warn('[pollLiveScores] Error in double-check (non-fatal):', e);
        }
      }
    }
    
    // Log more details about the invocation
    const invocationSource = event.source || 'unknown';
    const hasHttpMethod = !!event.httpMethod;
    const isScheduled = invocationSource === 'netlify-scheduled-function';
    console.log('[pollLiveScores] Invoked:', {
      source: invocationSource,
      hasHttpMethod,
      isScheduled,
      httpMethod: event.httpMethod || 'none',
      path: event.path || 'none',
      rawUrl: event.rawUrl || 'none'
    });
    
    await pollAllLiveScores();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: true, message: 'Live scores updated' }),
    };
  } catch (error: any) {
    console.error('[pollLiveScores] Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: error?.message || 'Failed to poll live scores' }),
    };
  }
};


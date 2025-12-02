import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';
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

async function pollAllLiveScores() {
  try {
    // Get current GW from app_meta table (used by the app)
    const { data: metaData, error: metaError } = await supabase
      .from('app_meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle();

    if (metaError || !metaData) {
      console.error('[pollLiveScores] Failed to get current GW from app_meta:', metaError);
      return;
    }

    const currentGw = (metaData as any)?.current_gw ?? 1;
    console.log(`[pollLiveScores] Current GW from app_meta: ${currentGw}`);

    // Get all fixtures for current GW and future GWs from app_fixtures table
    // Focus on app_fixtures (used by TestApiPredictions and the main app)
    // Also check regular fixtures table for backward compatibility
    // Skip test_api_fixtures - those are old test data
    
    // First, check what fixtures exist (even without api_match_id) for debugging
    const { data: allAppFixtures, error: allAppFixturesError } = await supabase
      .from('app_fixtures')
      .select('gw, fixture_index, api_match_id, home_team, away_team')
      .gte('gw', currentGw)
      .lte('gw', currentGw + 5)
      .order('gw', { ascending: true })
      .order('fixture_index', { ascending: true });
    
    if (allAppFixturesError) {
      console.error('[pollLiveScores] Error checking all app_fixtures:', allAppFixturesError);
    } else {
      const fixturesByGw = new Map<number, { total: number; withApiId: number; withoutApiId: number }>();
      (allAppFixtures || []).forEach((f: any) => {
        const gw = f.gw;
        if (!fixturesByGw.has(gw)) {
          fixturesByGw.set(gw, { total: 0, withApiId: 0, withoutApiId: 0 });
        }
        const counts = fixturesByGw.get(gw)!;
        counts.total++;
        if (f.api_match_id) {
          counts.withApiId++;
        } else {
          counts.withoutApiId++;
        }
      });
      console.log('[pollLiveScores] All app_fixtures by GW:');
      Array.from(fixturesByGw.entries()).forEach(([gw, counts]) => {
        console.log(`[pollLiveScores]   GW ${gw}: ${counts.total} total (${counts.withApiId} with api_match_id, ${counts.withoutApiId} without api_match_id)`);
      });
    }
    
    const [regularFixtures, appFixtures] = await Promise.all([
      supabase
        .from('fixtures')
        .select('api_match_id, fixture_index, home_team, away_team, kickoff_time, gw')
        .eq('gw', currentGw)
        .not('api_match_id', 'is', null),
      // Get fixtures for current GW and future GWs (up to current + 5 for upcoming games)
      supabase
        .from('app_fixtures')
        .select('api_match_id, fixture_index, home_team, away_team, kickoff_time, gw')
        .gte('gw', currentGw)
        .lte('gw', currentGw + 5) // Include up to 5 GWs ahead
        .not('api_match_id', 'is', null)
        .order('gw', { ascending: true })
        .order('fixture_index', { ascending: true }),
    ]);

    const allFixtures = [
      ...((regularFixtures.data || []) as any[]).map(f => ({ ...f, gw: f.gw || currentGw })),
      ...((appFixtures.data || []) as any[]).map(f => ({ 
        ...f, 
        gw: f.gw || currentGw, 
        fixture_index: f.fixture_index 
      })),
    ];

    if (allFixtures.length === 0) {
      console.log('[pollLiveScores] No fixtures with api_match_id found');
      console.log(`[pollLiveScores] Checked regular fixtures GW ${currentGw} and app_fixtures GW ${currentGw} to ${currentGw + 5}`);
      return;
    }

    const regularCount = (regularFixtures.data || []).length;
    const appCount = (appFixtures.data || []).length;
    
    // Group app fixtures by GW for logging
    const appGwGroups = new Map<number, number>();
    const appGwDetails: Record<number, number[]> = {};
    ((appFixtures.data || []) as any[]).forEach((f: any) => {
      const gw = f.gw;
      appGwGroups.set(gw, (appGwGroups.get(gw) || 0) + 1);
      if (!appGwDetails[gw]) {
        appGwDetails[gw] = [];
      }
      appGwDetails[gw].push(f.api_match_id);
    });
    const appGwSummary = Array.from(appGwGroups.entries())
      .map(([gw, count]) => `${count} app_fixtures GW ${gw}`)
      .join(', ');
    console.log(`[pollLiveScores] Found ${allFixtures.length} fixtures (${regularCount} regular fixtures GW ${currentGw}, ${appCount} app_fixtures: ${appGwSummary})`);
    // Log detailed breakdown of app fixtures by GW
    Object.entries(appGwDetails).forEach(([gw, matchIds]) => {
      console.log(`[pollLiveScores] App GW ${gw} has ${matchIds.length} fixtures with api_match_ids: ${matchIds.join(', ')}`);
    });

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
      console.log('[pollLiveScores] All fixtures are finished, skipping polling');
      return;
    }

    const skippedCount = allFixtures.length - fixturesToPoll.length;
    const finishedCount = Array.from(finishedMatchIds).length;
    const notStartedCount = skippedCount - finishedCount;
    console.log(`[pollLiveScores] Polling ${fixturesToPoll.length} fixtures (skipped ${skippedCount}: ${finishedCount} finished, ${notStartedCount} not yet started)`);

    // Poll each fixture with a small delay to avoid rate limits
    const updates: any[] = [];
    
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

      const homeScore = matchData.score?.fullTime?.home ?? matchData.score?.halfTime?.home ?? matchData.score?.current?.home ?? 0;
      const awayScore = matchData.score?.fullTime?.away ?? matchData.score?.halfTime?.away ?? matchData.score?.current?.away ?? 0;
      const status = matchData.status || 'SCHEDULED';
      
      // Try multiple possible locations for minute in API response
      // The API might provide it as: matchData.minute, matchData.currentMinute, or in score object
      let apiMinute: number | null | undefined = matchData.minute ?? 
                                                 matchData.currentMinute ?? 
                                                 matchData.score?.minute ?? 
                                                 null;

      console.log(`[pollLiveScores] Match ${apiMatchId} - API minute: ${apiMinute ?? 'null'}, status: ${status}, score: ${homeScore}-${awayScore}`);

      // For finished games, always set minute to null (FT doesn't need minute)
      // For all other games, use the API minute directly
      const minute = status === 'FINISHED' ? null : (apiMinute ?? null);
      
      // Log minute value being stored
      if (status === 'IN_PLAY' || status === 'PAUSED') {
        console.log(`[pollLiveScores] Match ${apiMatchId} - Storing minute: ${minute} (from API)`);
      }

      // Extract goals and bookings from API response
      // Goals array contains: { minute, scorer: { name, id }, team: { id, name } }
      // Bookings array contains: { minute, player: { name, id }, team: { id, name }, card: "YELLOW_CARD" | "RED_CARD" }
      // Normalize team names to our canonical medium names for consistency
      const goals = (matchData.goals || []).map((goal: any) => ({
        minute: goal.minute ?? null,
        scorer: goal.scorer?.name ?? null,
        scorerId: goal.scorer?.id ?? null,
        team: normalizeTeamName(goal.team?.name) ?? null, // Normalize to canonical name
        teamId: goal.team?.id ?? null,
      }));

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
        gw: fixture.gw || currentGw,
        fixture_index: fixture.fixture_index,
        home_score: homeScore,
        away_score: awayScore,
        status: status,
        minute: minute,
        home_team: fixture.home_team || matchData.homeTeam?.name,
        away_team: fixture.away_team || matchData.awayTeam?.name,
        kickoff_time: fixture.kickoff_time || matchData.utcDate,
        goals: goals.length > 0 ? goals : null,
        red_cards: redCards.length > 0 ? redCards : null,
      });

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
  
  // Only run on staging environment
  // Check multiple environment variables that Netlify sets
  const context = process.env.CONTEXT || process.env.NETLIFY_CONTEXT || 'unknown';
  const branch = process.env.BRANCH || process.env.HEAD || process.env.COMMIT_REF || 'unknown';
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
  
  // Consider it staging if:
  // 1. Context is deploy-preview or branch deploy
  // 2. Branch is "Staging"
  // 3. Site URL contains "staging" or "deploy-preview"
  // 4. Or if we're on a branch that's not "main" (scheduled functions typically run on all branches)
  const isStaging = 
    context === 'deploy-preview' || 
    context === 'branch-deploy' ||
    branch === 'Staging' || 
    branch.toLowerCase() === 'staging' ||
    siteUrl.toLowerCase().includes('staging') ||
    siteUrl.toLowerCase().includes('deploy-preview');
  
  // Log environment info for debugging
  console.log(`[pollLiveScores] Environment check:`, {
    context,
    branch,
    siteUrl: siteUrl ? siteUrl.substring(0, 50) + '...' : 'none',
    isStaging,
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
  
  if (!isStaging) {
    console.log(`[pollLiveScores] Skipping - not staging environment (context: ${context}, branch: ${branch})`);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, message: 'Only runs on staging', context, branch }),
    };
  }
  
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
    try {
      const { data: metaData, error: metaError } = await supabase
        .from('app_meta')
        .select('last_poll_time')
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
          .upsert({ id: 1, last_poll_time: lockTimestamp, current_gw: 12 } as any, { onConflict: 'id' });
        
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


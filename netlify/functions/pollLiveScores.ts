import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';
const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';

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
    // Get current GW from meta table
    const { data: metaData, error: metaError } = await supabase
      .from('meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle();

    if (metaError || !metaData) {
      console.error('[pollLiveScores] Failed to get current GW:', metaError);
      return;
    }

    const currentGw = (metaData as any)?.current_gw ?? 1;

    // Get all fixtures for current GW that have api_match_id
    // Check both regular fixtures and test_api_fixtures
    // NOTE: test_api_fixtures may be for any GW, so we query ALL of them (not filtered by test_gw)
    const [regularFixtures, testFixtures] = await Promise.all([
      supabase
        .from('fixtures')
        .select('api_match_id, fixture_index, home_team, away_team, kickoff_time, gw')
        .eq('gw', currentGw)
        .not('api_match_id', 'is', null),
      supabase
        .from('test_api_fixtures')
        .select('api_match_id, fixture_index, home_team, away_team, kickoff_time, test_gw')
        .not('api_match_id', 'is', null),
    ]);

    const allFixtures = [
      ...((regularFixtures.data || []) as any[]).map(f => ({ ...f, gw: f.gw || currentGw })),
      ...((testFixtures.data || []) as any[]).map(f => ({ 
        ...f, 
        gw: f.test_gw || currentGw, 
        fixture_index: f.fixture_index 
      })),
    ];

    if (allFixtures.length === 0) {
      console.log('[pollLiveScores] No fixtures with api_match_id found for GW', currentGw);
      return;
    }

    console.log(`[pollLiveScores] Polling ${allFixtures.length} fixtures for GW ${currentGw}`);

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

    // Filter out finished fixtures - no need to poll them
    const fixturesToPoll = allFixtures.filter(f => !finishedMatchIds.has(f.api_match_id));

    if (fixturesToPoll.length === 0) {
      console.log('[pollLiveScores] All fixtures are finished, skipping polling');
      return;
    }

    console.log(`[pollLiveScores] Polling ${fixturesToPoll.length} live fixtures (skipping ${allFixtures.length - fixturesToPoll.length} finished)`);

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
      let minute: number | null = matchData.minute ?? null;

      // For finished games, always set minute to null (FT doesn't need minute)
      if (status === 'FINISHED') {
        minute = null;
      }
      // If API doesn't provide a minute but game is live/paused, derive it from kickoff time
      else if ((minute === null || minute === undefined) && (status === 'IN_PLAY' || status === 'PAUSED')) {
        const kickoffISO = fixture.kickoff_time || matchData.utcDate;
        if (kickoffISO) {
          try {
            const matchStart = new Date(kickoffISO);
            const now = new Date();
            const diffMinutes = Math.floor((now.getTime() - matchStart.getTime()) / (1000 * 60));

            // Only trust reasonable values
            if (diffMinutes > 0 && diffMinutes < 130) {
              minute = diffMinutes;
            }
          } catch (e) {
            console.warn('[pollLiveScores] Error deriving minute from kickoff time:', e);
          }
        }
      }

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
      });

      console.log(`[pollLiveScores] Updated match ${apiMatchId}: ${homeScore}-${awayScore} (${status})`);
    }

    // Upsert all updates to Supabase
    if (updates.length > 0) {
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
  const MIN_RUN_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes minimum between runs (increased from 3)
  
  try {
    // Add small random delay (0-2 seconds) to prevent thundering herd
    const randomDelay = Math.floor(Math.random() * 2000);
    await new Promise(resolve => setTimeout(resolve, randomDelay));
    
    // Check lock immediately before starting work
    // Try to read last_poll_time, but handle gracefully if column doesn't exist yet
    let lastPollTime: string | null = null;
    try {
      const { data: metaData, error: metaError } = await supabase
        .from('meta')
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
    // Use upsert to create/update the meta row with last_poll_time
    const lockTimestamp = new Date().toISOString();
    try {
      // First try to update existing row
      const { error: updateError } = await supabase
        .from('meta')
        .update({ last_poll_time: lockTimestamp } as any)
        .eq('id', 1);
      
      if (updateError) {
        // If update fails (maybe column doesn't exist or row doesn't exist), try upsert
        if (updateError.code === 'PGRST204' || updateError.code === '42703') {
          console.log('[pollLiveScores] last_poll_time column missing - attempting to add via upsert (may require manual migration)');
        }
        // Try upsert as fallback
        const { error: upsertError } = await supabase
          .from('meta')
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
          .from('meta')
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


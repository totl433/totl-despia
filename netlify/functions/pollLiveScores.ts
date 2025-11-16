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
    const [regularFixtures, testFixtures] = await Promise.all([
      supabase
        .from('fixtures')
        .select('api_match_id, fixture_index, home_team, away_team, kickoff_time')
        .eq('gw', currentGw)
        .not('api_match_id', 'is', null),
      supabase
        .from('test_api_fixtures')
        .select('api_match_id, fixture_index, home_team, away_team, kickoff_time')
        .eq('test_gw', currentGw)
        .not('api_match_id', 'is', null),
    ]);

    const allFixtures = [
      ...((regularFixtures.data || []) as any[]).map(f => ({ ...f, gw: currentGw })),
      ...((testFixtures.data || []) as any[]).map(f => ({ ...f, gw: currentGw, fixture_index: f.fixture_index })),
    ];

    if (allFixtures.length === 0) {
      console.log('[pollLiveScores] No fixtures with api_match_id found for GW', currentGw);
      return;
    }

    console.log(`[pollLiveScores] Polling ${allFixtures.length} fixtures for GW ${currentGw}`);

    // Poll each fixture with a small delay to avoid rate limits
    const updates: any[] = [];
    
    for (let i = 0; i < allFixtures.length; i++) {
      const fixture = allFixtures[i];
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

      // If API doesn't provide a minute but game is live/paused, derive it from kickoff time
      if ((minute === null || minute === undefined) && (status === 'IN_PLAY' || status === 'PAUSED')) {
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
  
  console.log('[pollLiveScores] Invoked', event.source || 'manually');
  
  try {
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


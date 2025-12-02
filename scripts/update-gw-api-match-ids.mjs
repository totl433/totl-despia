import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';
const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Team code mapping from our codes to Football Data API TLA codes
const teamCodeMap = {
  'ARS': 'ARS',
  'AVL': 'AVL',
  'BOU': 'BOU',
  'BRE': 'BRE',
  'BHA': 'BHA',
  'BUR': 'BUR',
  'CHE': 'CHE',
  'CRY': 'CRY',
  'EVE': 'EVE',
  'FUL': 'FUL',
  'LIV': 'LIV',
  'LUT': 'LUT',
  'MCI': 'MCI',
  'MUN': 'MUN',
  'NEW': 'NEW',
  'NFO': 'NFO',
  'SHU': 'SHU',
  'TOT': 'TOT',
  'WHU': 'WHU',
  'WOL': 'WOL',
};

// Get GW from command line argument or default to 14
const targetGw = process.argv[2] ? parseInt(process.argv[2]) : 14;

async function updateGwApiMatchIds(gw) {
  console.log(`🔄 Updating api_match_id for GW ${gw} fixtures...\n`);

  try {
    // 1. Get all fixtures for the target GW
    const { data: fixtures, error: fixturesError } = await supabase
      .from('app_fixtures')
      .select('*')
      .eq('gw', gw)
      .order('fixture_index', { ascending: true });

    if (fixturesError) {
      throw new Error(`Failed to fetch fixtures: ${fixturesError.message}`);
    }

    if (!fixtures || fixtures.length === 0) {
      console.log(`❌ No fixtures found for GW ${gw}`);
      return;
    }

    console.log(`📋 Found ${fixtures.length} fixtures for GW ${gw}\n`);

    // 2. Get the date range for GW 14 fixtures
    const kickoffTimes = fixtures
      .map(f => f.kickoff_time)
      .filter(Boolean)
      .map(t => new Date(t));
    
    if (kickoffTimes.length === 0) {
      console.log('❌ No kickoff times found in fixtures');
      return;
    }

    const minDate = new Date(Math.min(...kickoffTimes.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...kickoffTimes.map(d => d.getTime())));
    
    // Set to start/end of day
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(23, 59, 59, 999);

    const dateFrom = minDate.toISOString().split('T')[0];
    const dateTo = maxDate.toISOString().split('T')[0];

    console.log(`📅 Fetching matches from ${dateFrom} to ${dateTo}\n`);

    // 3. Fetch matches from Football Data API
    const apiUrl = `${FOOTBALL_DATA_BASE_URL}/competitions/PL/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    console.log(`🌐 Fetching from API: ${apiUrl}\n`);

    const response = await fetch(apiUrl, {
      headers: {
        'X-Auth-Token': FOOTBALL_DATA_API_KEY,
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const apiData = await response.json();
    const matches = apiData.matches || [];

    console.log(`✅ Found ${matches.length} matches from API\n`);

    if (matches.length === 0) {
      console.log('❌ No matches found in API for this date range');
      return;
    }

    // 4. Match fixtures to API matches
    const updates = [];
    let matchedCount = 0;

    for (const fixture of fixtures) {
      const homeCode = fixture.home_code?.toUpperCase();
      const awayCode = fixture.away_code?.toUpperCase();
      const fixtureKickoff = fixture.kickoff_time ? new Date(fixture.kickoff_time) : null;

      if (!homeCode || !awayCode) {
        console.log(`⚠️  Skipping fixture ${fixture.fixture_index}: missing team codes`);
        continue;
      }

      // Find matching API match
      const match = matches.find((m) => {
        const apiHomeTla = m.homeTeam?.tla?.toUpperCase();
        const apiAwayTla = m.awayTeam?.tla?.toUpperCase();
        const apiKickoff = m.utcDate ? new Date(m.utcDate) : null;

        // Match by team codes
        const codesMatch = apiHomeTla === homeCode && apiAwayTla === awayCode;
        
        // Also try to match by kickoff time (within 1 hour tolerance)
        let timeMatch = true;
        if (fixtureKickoff && apiKickoff) {
          const timeDiff = Math.abs(fixtureKickoff.getTime() - apiKickoff.getTime());
          timeMatch = timeDiff < 60 * 60 * 1000; // 1 hour tolerance
        }

        return codesMatch && timeMatch;
      });

      if (match) {
        updates.push({
          fixture_index: fixture.fixture_index,
          api_match_id: match.id,
          home_team: match.homeTeam?.shortName || fixture.home_team,
          away_team: match.awayTeam?.shortName || fixture.away_team,
          home_name: match.homeTeam?.name || fixture.home_name,
          away_name: match.awayTeam?.name || fixture.away_name,
        });
        matchedCount++;
        console.log(`✅ Matched fixture ${fixture.fixture_index}: ${homeCode} v ${awayCode} → API match ${match.id}`);
      } else {
        console.log(`⚠️  No match found for fixture ${fixture.fixture_index}: ${homeCode} v ${awayCode}`);
      }
    }

    console.log(`\n📊 Matched ${matchedCount} out of ${fixtures.length} fixtures\n`);

    if (updates.length === 0) {
      console.log('❌ No fixtures to update');
      return;
    }

    // 5. Update fixtures in database
    console.log('💾 Updating fixtures in database...\n');

    for (const update of updates) {
      const { error } = await supabase
        .from('app_fixtures')
        .update({
          api_match_id: update.api_match_id,
          home_team: update.home_team,
          away_team: update.away_team,
          home_name: update.home_name,
          away_name: update.away_name,
        })
        .eq('gw', gw)
        .eq('fixture_index', update.fixture_index);

      if (error) {
        console.error(`❌ Error updating fixture ${update.fixture_index}:`, error);
      } else {
        console.log(`✅ Updated fixture ${update.fixture_index} with api_match_id ${update.api_match_id}`);
      }
    }

    console.log(`\n✅ Successfully updated ${updates.length} fixtures with api_match_id values!`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

updateGwApiMatchIds(targetGw)
  .then(() => {
    console.log(`\n✅ Script completed successfully for GW ${targetGw}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n❌ Script failed for GW ${targetGw}:`, error);
    process.exit(1);
  });


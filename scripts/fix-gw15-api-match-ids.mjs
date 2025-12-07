import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';
const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Team name normalization (same as pollLiveScores)
function normalizeTeamName(apiTeamName) {
  if (!apiTeamName) return null;
  
  const normalized = apiTeamName
    .toLowerCase()
    .replace(/\s+fc\s*$/i, '')
    .replace(/\s+&amp;\s+/g, ' ')
    .replace(/\s*&\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const teamNameMap = {
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
  
  if (teamNameMap[normalized]) {
    return teamNameMap[normalized];
  }
  
  return apiTeamName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .replace(/\s+FC\s*$/i, '')
    .trim();
}

// Team code mapping (common variations)
const teamCodeMap = {
  'MCI': 'Man City',
  'MUN': 'Man United',
  'NEW': 'Newcastle',
  'WHU': 'West Ham',
  'TOT': 'Spurs',
  'WOL': 'Wolves',
  'BHA': 'Brighton',
  'LEE': 'Leeds',
  'NFO': 'Forest',
  'CRY': 'Palace',
  'AVL': 'Villa',
  'ARS': 'Arsenal',
  'BOU': 'Bournemouth',
  'CHE': 'Chelsea',
  'EVE': 'Everton',
  'BUR': 'Burnley',
  'BRE': 'Brentford',
  'FUL': 'Fulham',
  'LIV': 'Liverpool',
  'SUN': 'Sunderland',
};

function getTeamNameFromCode(code) {
  return teamCodeMap[code] || code;
}

// TLA (three-letter abbreviation) to team name mapping from API
const tlaToName = {
  'AVL': 'Aston Villa',
  'ARS': 'Arsenal',
  'BOU': 'Bournemouth',
  'BRE': 'Brentford',
  'BHA': 'Brighton',
  'BUR': 'Burnley',
  'CHE': 'Chelsea',
  'CRY': 'Crystal Palace',
  'EVE': 'Everton',
  'FUL': 'Fulham',
  'LEE': 'Leeds',
  'LEI': 'Leicester',
  'LIV': 'Liverpool',
  'MCI': 'Man City',
  'MUN': 'Man United',
  'NEW': 'Newcastle',
  'NFO': 'Nottingham Forest',
  'SHU': 'Sheffield Utd',
  'SUN': 'Sunderland',
  'TOT': 'Spurs',
  'WHU': 'West Ham',
  'WOL': 'Wolves',
};

async function fetchPremierLeagueMatches() {
  console.log('📡 Fetching Premier League matches from Football Data API...\n');
  
  try {
    // Get current season matches - Premier League ID is 2021
    const response = await fetch(`${FOOTBALL_DATA_BASE_URL}/competitions/2021/matches`, {
      headers: {
        'X-Auth-Token': FOOTBALL_DATA_API_KEY,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        console.error(`❌ Rate limited. Retry after ${retryAfter}s`);
        return null;
      }
      console.error(`❌ API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.matches || [];
  } catch (error) {
    console.error('❌ Error fetching matches:', error);
    return null;
  }
}

function matchFixtureToApiMatch(fixture, apiMatches) {
  // Try to match by:
  // 1. Team codes/TLA (most reliable)
  // 2. Team names (normalized)
  // 3. Kickoff time (within 2 hours)
  
  const fixtureHomeCode = fixture.home_code?.toUpperCase();
  const fixtureAwayCode = fixture.away_code?.toUpperCase();
  const fixtureHome = normalizeTeamName(fixture.home_team || fixture.home_name || getTeamNameFromCode(fixture.home_code));
  const fixtureAway = normalizeTeamName(fixture.away_team || fixture.away_name || getTeamNameFromCode(fixture.away_code));
  const fixtureKickoff = fixture.kickoff_time ? new Date(fixture.kickoff_time).getTime() : null;
  
  for (const match of apiMatches) {
    const apiHomeTla = match.homeTeam?.tla?.toUpperCase();
    const apiAwayTla = match.awayTeam?.tla?.toUpperCase();
    const apiHome = normalizeTeamName(match.homeTeam?.name);
    const apiAway = normalizeTeamName(match.awayTeam?.name);
    const apiKickoff = match.utcDate ? new Date(match.utcDate).getTime() : null;
    
    // First try matching by TLA/code (most reliable)
    // Handle special cases where our codes differ from API TLAs
    const codeMapping = {
      'NFO': 'NOT', // Nottingham Forest
      'LEE': 'LEE', // Leeds
    };
    
    const mappedHomeCode = codeMapping[fixtureHomeCode] || fixtureHomeCode;
    const mappedAwayCode = codeMapping[fixtureAwayCode] || fixtureAwayCode;
    
    let homeMatch = false;
    let awayMatch = false;
    
    if (mappedHomeCode && apiHomeTla) {
      homeMatch = mappedHomeCode === apiHomeTla;
    }
    if (mappedAwayCode && apiAwayTla) {
      awayMatch = mappedAwayCode === apiAwayTla;
    }
    
    // If TLA match didn't work, try name matching
    if (!homeMatch && fixtureHome && apiHome) {
      homeMatch = fixtureHome.toLowerCase() === apiHome.toLowerCase() ||
                  fixtureHome.toLowerCase().includes(apiHome.toLowerCase()) ||
                  apiHome.toLowerCase().includes(fixtureHome.toLowerCase());
    }
    
    if (!awayMatch && fixtureAway && apiAway) {
      awayMatch = fixtureAway.toLowerCase() === apiAway.toLowerCase() ||
                  fixtureAway.toLowerCase().includes(apiAway.toLowerCase()) ||
                  apiAway.toLowerCase().includes(fixtureAway.toLowerCase());
    }
    
    // If teams match, check kickoff time (within 2 hours)
    if (homeMatch && awayMatch) {
      if (fixtureKickoff && apiKickoff) {
        const timeDiff = Math.abs(fixtureKickoff - apiKickoff);
        if (timeDiff <= 2 * 60 * 60 * 1000) { // 2 hours
          return match;
        }
      } else {
        // If no kickoff time, still match if teams match
        return match;
      }
    }
  }
  
  return null;
}

async function fixGw15ApiMatchIds() {
  console.log('🔧 Fixing GW15 api_match_id values...\n');

  try {
    // Get GW15 fixtures
    const { data: fixtures, error: fixturesError } = await supabase
      .from('app_fixtures')
      .select('*')
      .eq('gw', 15)
      .order('fixture_index', { ascending: true });

    if (fixturesError) {
      console.error('❌ Error fetching fixtures:', fixturesError);
      return;
    }

    if (!fixtures || fixtures.length === 0) {
      console.log('❌ No fixtures found for GW15');
      return;
    }

    console.log(`📋 Found ${fixtures.length} fixtures for GW15\n`);

    // Check how many already have api_match_id
    const withApiId = fixtures.filter(f => f.api_match_id);
    const withoutApiId = fixtures.filter(f => !f.api_match_id);
    
    console.log(`✅ ${withApiId.length} fixtures already have api_match_id`);
    console.log(`❌ ${withoutApiId.length} fixtures missing api_match_id\n`);

    if (withoutApiId.length === 0) {
      console.log('🎉 All fixtures already have api_match_id!');
      return;
    }

    // Fetch all Premier League matches
    const apiMatches = await fetchPremierLeagueMatches();
    if (!apiMatches || apiMatches.length === 0) {
      console.error('❌ Could not fetch matches from API');
      return;
    }

    console.log(`📡 Fetched ${apiMatches.length} matches from API\n`);

    // Match fixtures to API matches
    const updates = [];
    const unmatched = [];

    for (const fixture of withoutApiId) {
      const matched = matchFixtureToApiMatch(fixture, apiMatches);
      
      if (matched) {
        updates.push({
          id: fixture.id,
          api_match_id: matched.id,
          fixture_index: fixture.fixture_index,
          home_team: fixture.home_team || normalizeTeamName(matched.homeTeam?.name),
          away_team: fixture.away_team || normalizeTeamName(matched.awayTeam?.name),
        });
        console.log(`✅ Matched fixture ${fixture.fixture_index}: ${fixture.home_team || fixture.home_code} v ${fixture.away_team || fixture.away_code} -> API match ${matched.id}`);
      } else {
        unmatched.push(fixture);
        console.log(`❌ Could not match fixture ${fixture.fixture_index}: ${fixture.home_team || fixture.home_code} v ${fixture.away_team || fixture.away_code}`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Matched: ${updates.length}`);
    console.log(`   Unmatched: ${unmatched.length}\n`);

    // Always show unmatched fixtures info, even if some were matched
    if (unmatched.length > 0) {
      console.log(`\n⚠️  ${unmatched.length} fixtures could not be matched. Checking API for these matches...\n`);
      
      // Try to find unmatched fixtures by date range
      for (const fixture of unmatched) {
        const fixtureDate = fixture.kickoff_time ? new Date(fixture.kickoff_time).toISOString().split('T')[0] : null;
        console.log(`🔍 Searching for: ${fixture.home_team || fixture.home_code} v ${fixture.away_team || fixture.away_code}`);
        console.log(`   Date: ${fixtureDate || 'unknown'}`);
        console.log(`   Home code: ${fixture.home_code}, Away code: ${fixture.away_code}`);
        
        // Filter API matches by date
        const dateMatches = apiMatches.filter(m => {
          if (!fixtureDate || !m.utcDate) return false;
          const matchDate = m.utcDate.split('T')[0];
          return matchDate === fixtureDate;
        });
        
        console.log(`   Found ${dateMatches.length} matches on ${fixtureDate}`);
        
        // Show potential matches
        if (dateMatches.length > 0) {
          dateMatches.forEach(m => {
            console.log(`   - ${m.homeTeam?.tla || '???'} v ${m.awayTeam?.tla || '???'} (${m.homeTeam?.name} v ${m.awayTeam?.name})`);
            console.log(`     ID: ${m.id}, Time: ${m.utcDate}`);
          });
        } else {
          console.log(`   ⚠️  No matches found on this date in the API`);
        }
        console.log('');
      }
    }

    if (updates.length === 0) {
      console.log('❌ No fixtures could be matched. Check team names/codes.');
      return;
    }

    // Update fixtures with api_match_id
    console.log('💾 Updating fixtures with api_match_id values...\n');
    
    for (const update of updates) {
      const { error } = await supabase
        .from('app_fixtures')
        .update({ api_match_id: update.api_match_id })
        .eq('id', update.id);

      if (error) {
        console.error(`❌ Error updating fixture ${update.fixture_index}:`, error);
      } else {
        console.log(`✅ Updated fixture ${update.fixture_index} with api_match_id: ${update.api_match_id}`);
      }
    }

    console.log(`\n🎉 Successfully updated ${updates.length} fixtures!`);
    
    if (unmatched.length > 0) {
      console.log(`\n⚠️  ${unmatched.length} fixtures could not be matched. Checking API for these matches...\n`);
      
      // Try to find unmatched fixtures by date range
      for (const fixture of unmatched) {
        const fixtureDate = fixture.kickoff_time ? new Date(fixture.kickoff_time).toISOString().split('T')[0] : null;
        console.log(`🔍 Searching for: ${fixture.home_team || fixture.home_code} v ${fixture.away_team || fixture.away_code}`);
        console.log(`   Date: ${fixtureDate || 'unknown'}`);
        console.log(`   Home code: ${fixture.home_code}, Away code: ${fixture.away_code}`);
        
        // Filter API matches by date
        const dateMatches = apiMatches.filter(m => {
          if (!fixtureDate || !m.utcDate) return false;
          const matchDate = m.utcDate.split('T')[0];
          return matchDate === fixtureDate;
        });
        
        console.log(`   Found ${dateMatches.length} matches on ${fixtureDate}`);
        
        // Show potential matches
        if (dateMatches.length > 0) {
          dateMatches.forEach(m => {
            console.log(`   - ${m.homeTeam?.tla || '???'} v ${m.awayTeam?.tla || '???'} (${m.homeTeam?.name} v ${m.awayTeam?.name})`);
            console.log(`     ID: ${m.id}, Time: ${m.utcDate}`);
          });
        } else {
          console.log(`   ⚠️  No matches found on this date in the API`);
        }
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixGw15ApiMatchIds();


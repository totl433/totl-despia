import { supabase } from '../lib/supabase';
import { fetchUserLeagues } from './userLeagues';
import { resolveLeagueStartGw } from '../lib/leagueStart';

export interface UnicornCard {
  fixture_index: number;
  gw: number;
  home_team: string;
  away_team: string;
  home_code: string | null;
  away_code: string | null;
  home_name: string | null;
  away_name: string | null;
  kickoff_time: string | null;
  pick: "H" | "D" | "A"; // The user's pick that was correct
  league_names: string[]; // All leagues where this fixture is a unicorn
}

/**
 * Fetch all unicorns for a user across all their mini leagues
 * A unicorn is when the user is the only person in a mini league (with 3+ members) 
 * to correctly predict a fixture
 */
export async function fetchUserUnicorns(userId: string): Promise<UnicornCard[]> {
  if (!userId) return [];

  try {
    // Get all mini leagues the user is in
    const leagues = await fetchUserLeagues(userId);
    if (leagues.length === 0) return [];

    const leagueIds = leagues.map(l => l.id);

    // Get all league members for these leagues
    const { data: leagueMembersData, error: membersError } = await supabase
      .from('league_members')
      .select('league_id, user_id')
      .in('league_id', leagueIds);

    if (membersError) throw membersError;

    // Group members by league
    const membersByLeague = new Map<string, string[]>();
    leagueMembersData?.forEach((lm: any) => {
      const members = membersByLeague.get(lm.league_id) || [];
      members.push(lm.user_id);
      membersByLeague.set(lm.league_id, members);
    });

    // Get all results (to know which fixtures have results)
    const { data: resultsData, error: resultsError } = await supabase
      .from('app_gw_results')
      .select('gw, fixture_index, result')
      .order('gw', { ascending: false });

    if (resultsError) throw resultsError;

    // Create a map of results by gw:fixture_index
    const resultsMap = new Map<string, "H" | "D" | "A">();
    resultsData?.forEach((r: any) => {
      if (r.result) {
        resultsMap.set(`${r.gw}:${r.fixture_index}`, r.result);
      }
    });

    // Get all picks for all members in these leagues
    const allMemberIds = Array.from(new Set(leagueMembersData?.map((lm: any) => lm.user_id) || []));
    
    if (allMemberIds.length === 0) return [];

    // Fetch picks in batches if needed (Supabase limit is 1000 rows)
    const { data: picksData, error: picksError } = await supabase
      .from('app_picks')
      .select('user_id, gw, fixture_index, pick')
      .in('user_id', allMemberIds);

    if (picksError) throw picksError;

    // Get fixtures for all GWs that have results
    const gwsWithResults = Array.from(new Set(resultsData?.map((r: any) => r.gw) || []));
    if (gwsWithResults.length === 0) return [];

    // Get current GW for league start calculation
    const { data: metaData } = await supabase
      .from('app_meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle();
    const currentGw = (metaData as any)?.current_gw ?? Math.max(...gwsWithResults, 0);

    const { data: fixturesData, error: fixturesError } = await supabase
      .from('app_fixtures')
      .select('gw, fixture_index, home_team, away_team, home_code, away_code, home_name, away_name, kickoff_time, api_match_id')
      .in('gw', gwsWithResults)
      .order('gw', { ascending: false })
      .order('fixture_index', { ascending: true });

    if (fixturesError) throw fixturesError;

    // Create fixtures map, excluding test fixtures (those with api_match_id)
    const fixturesMap = new Map<string, any>();
    fixturesData?.forEach((f: any) => {
      // Skip test fixtures (they have api_match_id)
      if (f.api_match_id) return;
      fixturesMap.set(`${f.gw}:${f.fixture_index}`, f);
    });

    // Calculate unicorns for each league
    const unicorns: UnicornCard[] = [];

    console.log('[Unicorns] Starting calculation for user:', userId);
    console.log('[Unicorns] User leagues:', leagues.map(l => ({ name: l.name, id: l.id, members: membersByLeague.get(l.id)?.length || 0 })));

    for (const league of leagues) {
      // Skip API Test league - it's for testing only
      if (league.name === 'API Test') {
        console.log(`[Unicorns] Skipping "${league.name}" - test league`);
        continue;
      }

      const members = membersByLeague.get(league.id) || [];
      
      // Skip leagues with less than 3 members (unicorns require 3+)
      if (members.length < 3) {
        console.log(`[Unicorns] Skipping "${league.name}" - only ${members.length} members`);
        continue;
      }

      // Calculate league start GW (only count unicorns from when league started)
      const leagueStartGw = await resolveLeagueStartGw(league, currentGw);
      console.log(`[Unicorns] Processing "${league.name}" with ${members.length} members, start GW: ${leagueStartGw}`);

      // Get picks for this league's members, filtered by league start GW
      const leaguePicks = picksData?.filter((p: any) => 
        members.includes(p.user_id) && p.gw >= leagueStartGw
      ) || [];
      console.log(`[Unicorns] "${league.name}" has ${leaguePicks.length} picks total (filtered from start GW ${leagueStartGw})`);

      // Group picks by gw:fixture_index
      const picksByFixture = new Map<string, Array<{ user_id: string; pick: "H" | "D" | "A" }>>();
      leaguePicks.forEach((p: any) => {
        const key = `${p.gw}:${p.fixture_index}`;
        const picks = picksByFixture.get(key) || [];
        picks.push({ user_id: p.user_id, pick: p.pick });
        picksByFixture.set(key, picks);
      });

      // Check each fixture for unicorns
      picksByFixture.forEach((picks, key) => {
        const [gw, fixtureIndex] = key.split(':').map(Number);
        
        // Skip fixtures before league started
        if (gw < leagueStartGw) return;
        
        const result = resultsMap.get(key);
        if (!result) return; // No result yet, can't be a unicorn

        // Check if user made a pick for this fixture
        const userPick = picks.find(p => p.user_id === userId);
        if (!userPick) return; // User didn't make a pick, can't be a unicorn

        // Find who got it correct (same logic as League.tsx)
        const correctUsers = picks.filter(p => p.pick === result).map(p => p.user_id);
        
        // Unicorn: only one person correct AND it's the current user AND league has 3+ members
        // Note: We check members.length >= 3 (league members), NOT picks.length >= 3
        if (correctUsers.length === 1 && correctUsers[0] === userId && members.length >= 3) {
          const fixture = fixturesMap.get(key);
          
          if (fixture) {
            unicorns.push({
              fixture_index: fixtureIndex,
              gw,
              home_team: fixture.home_team,
              away_team: fixture.away_team,
              home_code: fixture.home_code,
              away_code: fixture.away_code,
              home_name: fixture.home_name,
              away_name: fixture.away_name,
              kickoff_time: fixture.kickoff_time,
              pick: userPick.pick,
              league_id: league.id,
              league_name: league.name,
            } as any); // Temporary type cast until we group
          }
        }
      });
    }

    console.log(`[Unicorns] Found ${unicorns.length} total unicorns before grouping`);

    // Group unicorns by fixture (gw:fixture_index) and collect all league names
    const groupedByFixture = new Map<string, {
      fixture_index: number;
      gw: number;
      home_team: string;
      away_team: string;
      home_code: string | null;
      away_code: string | null;
      home_name: string | null;
      away_name: string | null;
      kickoff_time: string | null;
      pick: "H" | "D" | "A";
      league_names: string[];
    }>();

    unicorns.forEach((unicorn: any) => {
      const key = `${unicorn.gw}:${unicorn.fixture_index}`;
      const existing = groupedByFixture.get(key);
      
      if (existing) {
        // Add league name if not already present
        if (!existing.league_names.includes(unicorn.league_name)) {
          existing.league_names.push(unicorn.league_name);
        }
      } else {
        // Create new entry
        groupedByFixture.set(key, {
          fixture_index: unicorn.fixture_index,
          gw: unicorn.gw,
          home_team: unicorn.home_team,
          away_team: unicorn.away_team,
          home_code: unicorn.home_code,
          away_code: unicorn.away_code,
          home_name: unicorn.home_name,
          away_name: unicorn.away_name,
          kickoff_time: unicorn.kickoff_time,
          pick: unicorn.pick,
          league_names: [unicorn.league_name],
        });
      }
    });

    const groupedUnicorns: UnicornCard[] = Array.from(groupedByFixture.values());
    
    const premUnicorns = groupedUnicorns.filter(u => u.league_names.includes('Prem Predictions'));
    console.log(`[Unicorns] Prem Predictions unicorns:`, premUnicorns.map(u => `GW${u.gw} fixture ${u.fixture_index} (leagues: ${u.league_names.join(', ')})`));
    console.log(`[Unicorns] Found ${groupedUnicorns.length} unique fixtures after grouping`);

    // Sort by GW ascending, then fixture_index ascending (earliest first)
    groupedUnicorns.sort((a, b) => {
      if (a.gw !== b.gw) return a.gw - b.gw;
      return a.fixture_index - b.fixture_index;
    });

    return groupedUnicorns;
  } catch (error) {
    console.error('[Unicorns] Error fetching unicorns:', error);
    return [];
  }
}


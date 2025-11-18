import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// Football Data API types
type ApiMatch = {
  id: number;
  utcDate: string;
  status: "TIMED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";
  matchday: number;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
};

type TestFixture = {
  id?: string;
  test_gw: number;
  fixture_index: number;
  api_match_id: number;
  home_team: string;
  away_team: string;
  home_code: string | null;
  away_code: string | null;
  home_name: string | null;
  away_name: string | null;
  home_crest: string | null;
  away_crest: string | null;
  kickoff_time: string | null;
  selected: boolean; // Whether this fixture is selected for the GW
};

// Get Netlify function URL dynamically based on current environment
const getFunctionUrl = () => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  
  // For Netlify deployments (staging/production), use current origin
  if (hostname.includes('netlify.app') || hostname.includes('netlify.com')) {
    return `${origin}/.netlify/functions/fetchFootballData`;
  }
  
  // For localhost development, use the staging function URL
  // (since Vite dev server doesn't include Netlify functions)
  // User can run `netlify dev` if they want local functions
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `https://totl-staging.netlify.app/.netlify/functions/fetchFootballData`;
  }
  
  // Fallback: use relative path
  return "/.netlify/functions/fetchFootballData";
};

export default function TestAdminApi() {
  const { user } = useAuth();
  const isAdmin = user?.id === '4542c037-5b38-40d0-b189-847b8f17c222' || user?.id === '36f31625-6d6c-4aa4-815a-1493a812841b';

  // API Test league always uses Test GW 1
  const [availableMatches, setAvailableMatches] = useState<ApiMatch[]>([]);
  const [selectedFixtures, setSelectedFixtures] = useState<Map<number, TestFixture>>(new Map());
  const [saving, setSaving] = useState(false);
  const [fetchingMatches, setFetchingMatches] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [competition, setCompetition] = useState("PL");
  const [apiError, setApiError] = useState<string | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);

  // Fetch available matches from API for the next week
  const fetchUpcomingMatches = async (comp: string, signal?: AbortSignal) => {
    try {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      
      // Format dates as YYYY-MM-DD for the API
      const dateFrom = today.toISOString().split('T')[0];
      const dateTo = nextWeek.toISOString().split('T')[0];
      
      const params = new URLSearchParams({
        competition: comp,
        dateFrom: dateFrom,
        dateTo: dateTo,
      });

      // Get function URL dynamically at request time
      const functionUrl = getFunctionUrl();
      const url = `${functionUrl}?${params.toString()}`;
      console.log('[TestAdminApi] Fetching upcoming matches from:', url);
      console.log('[TestAdminApi] Date range:', { dateFrom, dateTo });

      const response = await fetch(url, {
        signal
      });

      // Read response body once - we'll parse it based on status
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      // Clone response if we might need to read it multiple times, or read text first
      let responseText: string | null = null;
      let responseData: any = null;

      if (!response.ok) {
        // For error responses, read as text first
        try {
          responseText = await response.text();
          
          // Try to parse as JSON if content-type suggests it
          if (isJson || responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
            try {
              responseData = JSON.parse(responseText);
              const errorMessage = responseData.message || responseData.error || `API error: ${response.status}`;
              
              if (response.status === 429) {
                setApiError("Rate limit reached. Please wait a moment.");
                return null;
              }
              
              setApiError(errorMessage);
              return null;
            } catch {
              // Not valid JSON, continue with text error
            }
          }
          
          // Got HTML error page or plain text error
          console.error('[TestAdminApi] Got error response:', responseText.substring(0, 200));
          if (response.status === 404) {
            setApiError("Netlify function not found. Make sure 'fetchFootballData' is deployed.");
          } else {
            setApiError(`Server error (${response.status}). The function may not be deployed correctly.`);
          }
          return null;
        } catch (readError) {
          setApiError(`Failed to read error response: ${response.status}`);
          return null;
        }
      }

      // For successful responses, try to parse as JSON
      try {
        // Read response body (only once)
        responseText = await response.text();
        
        console.log('[TestAdminApi] Response status:', response.status);
        console.log('[TestAdminApi] Response content-type:', contentType);
        console.log('[TestAdminApi] Response preview:', responseText.substring(0, 100));
        
        // Try parsing as JSON
        try {
          responseData = JSON.parse(responseText);
          console.log('[TestAdminApi] Successfully parsed JSON');
        } catch (parseError) {
          // If JSON parse fails, check if we got HTML (error page)
          console.error('[TestAdminApi] Failed to parse JSON. Parse error:', parseError);
          console.error('[TestAdminApi] Response text:', responseText.substring(0, 500));
          
          if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
            setApiError("Server returned an HTML error page. The function may not be deployed correctly. Check browser console for details.");
          } else if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
            // Looks like JSON but failed to parse - might be malformed
            setApiError("Server returned malformed JSON. Check browser console for details.");
          } else {
            setApiError("Server returned invalid response (not JSON). Check browser console for details.");
          }
          return null;
        }
      } catch (readError) {
        console.error('[TestAdminApi] Failed to read response:', readError);
        setApiError("Failed to read response from server.");
        return null;
      }
      
      const result = responseData;

      if (!result.success || !result.data) {
        setApiError("Invalid API response format. Make sure the function is working correctly.");
        return null;
      }

      // Clear any previous errors on success
      setApiError(null);
      return result.data.matches || [];
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log("Fetch aborted");
        return null;
      }
      console.error("Error fetching API matches:", error);
      
      let errorMessage = "Failed to fetch matches";
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = "Network error. Check your connection and make sure the Netlify function is deployed.";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setApiError(errorMessage);
      return null;
    }
  };

  // Load existing test GW fixtures (non-blocking - runs in background)
  useEffect(() => {
    if (!isAdmin) return;
    
    let alive = true;
    // Load in background without blocking UI
    (async () => {
      try {
        // Get current test GW from meta or default to 1
        const { error: metaError } = await supabase
          .from("test_api_meta")
          .select("current_test_gw")
          .eq("id", 1)
          .maybeSingle();
        
        // Silently ignore 404s - table may not exist yet
        if (metaError) {
          // Only log if it's not a 404/table doesn't exist error
          if (metaError.code !== 'PGRST116' && !metaError.message?.includes('404')) {
            console.warn("Error loading test_api_meta:", metaError.message);
          }
        }
        
        // API Test league always uses Test GW 1, so we don't need to set state

        // Load existing fixtures for Test GW 1
        const { data: fixtures, error: fixturesError } = await supabase
          .from("test_api_fixtures")
          .select("*")
          .eq("test_gw", 1)
          .order("fixture_index", { ascending: true });

        // Silently ignore 404s - table may not exist yet
        if (fixturesError) {
          // Only log if it's not a 404/table doesn't exist error
          if (fixturesError.code !== 'PGRST116' && !fixturesError.message?.includes('404')) {
            console.warn("Error loading test_api_fixtures:", fixturesError.message);
          }
        } else if (alive && fixtures && fixtures.length > 0) {
          const fixturesMap = new Map<number, TestFixture>();
          fixtures.forEach((f: any) => {
            fixturesMap.set(f.fixture_index, { ...f, selected: true });
          });
          setSelectedFixtures(fixturesMap);
        }
      } catch (error) {
        // Silently continue - these tables are optional
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-red-600">Access denied. Admin only.</div>
      </div>
    );
  }

  const toggleFixture = (match: ApiMatch) => {
    const newSelected = new Map(selectedFixtures);
    
    // Check if this API match is already selected (by api_match_id)
    const existingEntry = Array.from(newSelected.values()).find(f => f.api_match_id === match.id);
    
    if (existingEntry) {
      // Deselect - remove by fixture_index
      newSelected.delete(existingEntry.fixture_index);
      
      // Re-index remaining fixtures sequentially (0, 1, 2, ...)
      const sortedFixtures = Array.from(newSelected.values())
        .sort((a, b) => a.fixture_index - b.fixture_index);
      const reindexed = new Map<number, TestFixture>();
      sortedFixtures.forEach((f, idx) => {
        reindexed.set(idx, { ...f, fixture_index: idx });
      });
      setSelectedFixtures(reindexed);
    } else {
      // Select - assign next available fixture_index
      const maxIndex = newSelected.size > 0 
        ? Math.max(...Array.from(newSelected.keys())) 
        : -1;
      const nextIndex = maxIndex + 1;
      
      const fixture: TestFixture = {
        test_gw: 1,
        fixture_index: nextIndex,
        api_match_id: match.id,
        home_team: match.homeTeam.shortName,
        away_team: match.awayTeam.shortName,
        home_code: match.homeTeam.tla,
        away_code: match.awayTeam.tla,
        home_name: match.homeTeam.name,
        away_name: match.awayTeam.name,
        home_crest: match.homeTeam.crest || null,
        away_crest: match.awayTeam.crest || null,
        kickoff_time: match.utcDate,
        selected: true,
      };
      newSelected.set(nextIndex, fixture);
      setSelectedFixtures(newSelected);
    }
  };

  const saveTestGameweek = async () => {
    if (selectedFixtures.size === 0) {
      setError("Please select at least one fixture");
      return;
    }

    setSaving(true);
    setError("");
    setOk("");

    try {
      // Delete existing fixtures for Test GW 1
      await supabase
        .from("test_api_fixtures")
        .delete()
        .eq("test_gw", 1);

      // Insert selected fixtures
      const fixturesToInsert = Array.from(selectedFixtures.values()).map(f => ({
        test_gw: f.test_gw,
        fixture_index: f.fixture_index,
        api_match_id: f.api_match_id,
        home_team: f.home_team,
        away_team: f.away_team,
        home_code: f.home_code,
        away_code: f.away_code,
        home_name: f.home_name,
        away_name: f.away_name,
        home_crest: f.home_crest,
        away_crest: f.away_crest,
        kickoff_time: f.kickoff_time,
      }));

      const { error: insertError } = await supabase
        .from("test_api_fixtures")
        .insert(fixturesToInsert);

      if (insertError) throw insertError;

      // Update current test GW in meta (always 1 for API Test league)
      await supabase
        .from("test_api_meta")
        .upsert({ id: 1, current_test_gw: 1 }, { onConflict: 'id' });

      setOk(`Test Gameweek 1 saved with ${selectedFixtures.size} fixtures!`);
    } catch (e: any) {
      setError(e.message ?? "Failed to save test gameweek.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4" style={{ pointerEvents: 'auto' }}>
      <div className="max-w-4xl mx-auto" style={{ pointerEvents: 'auto' }}>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mb-2">
          Test API Admin (STAGING ONLY)
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          Select fixtures from the API to create test gameweeks. This is completely separate from the main game.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {ok && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {ok}
          </div>
        )}

        {apiError && (
          <div data-api-error className="mb-4 p-4 bg-amber-50 border-2 border-amber-400 rounded-lg text-amber-800 text-sm font-medium shadow-md">
            {apiError.startsWith('API Error:') ? apiError : `⚠️ ${apiError}`}
          </div>
        )}

        {/* Test GW Info */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <label className="font-medium text-slate-700">Test Gameweek:</label>
            <span className="text-lg font-semibold text-slate-900">1</span>
            <span className="text-sm text-slate-500">(API Test league always uses GW 1)</span>
          </div>
        </div>

        {/* API Match Selection */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Upcoming Matches (Next 7 Days)</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Competition:</label>
            <select
              value={competition}
              onChange={(e) => {
                setCompetition(e.target.value);
                setAvailableMatches([]);
                setApiError(null);
              }}
              className="w-full border rounded px-3 py-2"
            >
              <option value="PL">Premier League</option>
              <option value="BSA">Brazilian Serie A</option>
              <option value="BL1">Bundesliga</option>
              <option value="SA">Serie A</option>
              <option value="FL1">Ligue 1</option>
              <option value="PD">La Liga</option>
              <option value="CL">Champions League</option>
            </select>
          </div>

          {autoLoading && (
            <div className="text-center py-4 text-slate-600">
              Loading upcoming matches...
            </div>
          )}

          <button
            onClick={() => {
              if (fetchingMatches) {
                console.log('[TestAdminApi] Already fetching, ignoring click');
                return;
              }
              
              console.log('[TestAdminApi] Refreshing upcoming matches', { competition });
              
              const abortController = new AbortController();
              setFetchingMatches(true);
              setApiError(null);
              
              fetchUpcomingMatches(competition, abortController.signal)
                .then((matches) => {
                  console.log('[TestAdminApi] Matches fetched', matches?.length || 0);
                  if (matches && matches.length > 0) {
                    setAvailableMatches(matches);
                    setApiError(null);
                  } else if (matches && matches.length === 0) {
                    setApiError("No upcoming matches found in the next week for this competition.");
                  }
                })
                .catch((error) => {
                  console.error('[TestAdminApi] Error refreshing matches', error);
                  if (error instanceof Error && error.name !== 'AbortError') {
                    setApiError("Failed to fetch matches. Please try again.");
                  }
                })
                .finally(() => {
                  setFetchingMatches(false);
                  setAutoLoading(false);
                });
            }}
            disabled={fetchingMatches}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform relative z-10"
            type="button"
          >
            {fetchingMatches ? "Refreshing..." : "Refresh Matches"}
          </button>
        </div>

        {/* Available Matches List */}
        {availableMatches.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-4 mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Available Matches ({availableMatches.length})
            </h3>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableMatches.map((match) => {
                const isSelected = Array.from(selectedFixtures.values()).some(f => f.api_match_id === match.id);
                const kickoff = new Date(match.utcDate);
                
                // Format date with TODAY/TOMORROW indicator
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                
                const kickoffDate = new Date(kickoff);
                kickoffDate.setHours(0, 0, 0, 0);
                
                let dateLabel = '';
                if (kickoffDate.getTime() === today.getTime()) {
                  dateLabel = 'TODAY';
                } else if (kickoffDate.getTime() === tomorrow.getTime()) {
                  dateLabel = 'TOMORROW';
                } else {
                  dateLabel = kickoff.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                }
                
                const timeStr = `${String(kickoff.getUTCHours()).padStart(2, '0')}:${String(kickoff.getUTCMinutes()).padStart(2, '0')} UTC`;
                const kickoffStr = `${dateLabel} ${timeStr}`;
                
                return (
                  <div
                    key={match.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-purple-50 border-purple-300"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                    onClick={() => toggleFixture(match)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleFixture(match)}
                        className="w-5 h-5"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-slate-800">
                          {match.homeTeam.shortName} vs {match.awayTeam.shortName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {kickoffStr} • {match.status} • Matchday {match.matchday}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Fixtures Summary */}
        {selectedFixtures.size > 0 && (
          <div className="bg-white rounded-xl shadow-md p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">
                Selected Fixtures for Test GW 1 ({selectedFixtures.size})
              </h3>
              <button
                onClick={() => {
                  if (confirm("Clear all selected fixtures?")) {
                    setSelectedFixtures(new Map());
                    setOk("");
                    setError("");
                  }
                }}
                className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                Clear All
              </button>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Array.from(selectedFixtures.values())
                .sort((a, b) => a.fixture_index - b.fixture_index)
                .map((fixture) => (
                  <div
                    key={fixture.fixture_index}
                    className="p-2 bg-purple-50 border border-purple-200 rounded text-sm"
                  >
                    {fixture.fixture_index + 1}. {fixture.home_team} vs {fixture.away_team}
                  </div>
                ))}
            </div>

            <button
              onClick={saveTestGameweek}
              disabled={saving}
              className="mt-4 w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold"
            >
              {saving ? "Saving..." : `Save Test Gameweek 1 (${selectedFixtures.size} fixtures)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


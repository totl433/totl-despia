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
  kickoff_time: string | null;
  selected: boolean; // Whether this fixture is selected for the GW
};

const FOOTBALL_DATA_PROXY_URL = "/.netlify/functions/fetchFootballData";

export default function TestAdminApi() {
  const { user } = useAuth();
  const isAdmin = user?.id === '4542c037-5b38-40d0-b189-847b8f17c222' || user?.id === '36f31625-6d6c-4aa4-815a-1493a812841b';

  const [testGw, setTestGw] = useState<number>(1);
  const [availableMatches, setAvailableMatches] = useState<ApiMatch[]>([]);
  const [selectedFixtures, setSelectedFixtures] = useState<Map<number, TestFixture>>(new Map());
  const [saving, setSaving] = useState(false);
  const [fetchingMatches, setFetchingMatches] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [competition, setCompetition] = useState("PL");
  const [gameweek, setGameweek] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Fetch available matches from API
  const fetchApiMatches = async (comp: string, gw: number | null, signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams({
        competition: comp,
      });
      if (gw !== null) {
        params.append('matchday', gw.toString());
      }

      const url = `${FOOTBALL_DATA_PROXY_URL}?${params.toString()}`;
      console.log('[TestAdminApi] Fetching from:', url);

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
            } catch (e) {
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
        
        // Try parsing as JSON
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          // If JSON parse fails, check if we got HTML (error page)
          console.error('[TestAdminApi] Failed to parse JSON. Response:', responseText.substring(0, 200));
          
          if (responseText.trim().startsWith('<!') || responseText.trim().startsWith('<html')) {
            setApiError("Server returned an HTML error page. The function may not be deployed correctly.");
          } else {
            setApiError("Server returned invalid response (not JSON). The function may not be deployed correctly.");
          }
          return null;
        }
      } catch (readError) {
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
        const { data: meta, error: metaError } = await supabase
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
        
        const currentTestGw = meta?.current_test_gw ?? 1;
        if (alive) setTestGw(currentTestGw);

        // Load existing fixtures for this test GW
        const { data: fixtures, error: fixturesError } = await supabase
          .from("test_api_fixtures")
          .select("*")
          .eq("test_gw", currentTestGw)
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
  }, [isAdmin, testGw]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-red-600">Access denied. Admin only.</div>
      </div>
    );
  }

  const toggleFixture = (match: ApiMatch, index: number) => {
    const newSelected = new Map(selectedFixtures);
    
    if (newSelected.has(index)) {
      // Deselect
      newSelected.delete(index);
    } else {
      // Select - create fixture from API match
      const fixture: TestFixture = {
        test_gw: testGw,
        fixture_index: index,
        api_match_id: match.id,
        home_team: match.homeTeam.shortName,
        away_team: match.awayTeam.shortName,
        home_code: match.homeTeam.tla,
        away_code: match.awayTeam.tla,
        home_name: match.homeTeam.name,
        away_name: match.awayTeam.name,
        kickoff_time: match.utcDate,
        selected: true,
      };
      newSelected.set(index, fixture);
    }
    
    setSelectedFixtures(newSelected);
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
      // Delete existing fixtures for this test GW
      await supabase
        .from("test_api_fixtures")
        .delete()
        .eq("test_gw", testGw);

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
        kickoff_time: f.kickoff_time,
      }));

      const { error: insertError } = await supabase
        .from("test_api_fixtures")
        .insert(fixturesToInsert);

      if (insertError) throw insertError;

      // Update current test GW in meta
      await supabase
        .from("test_api_meta")
        .upsert({ id: 1, current_test_gw: testGw }, { onConflict: 'id' });

      setOk(`Test Gameweek ${testGw} saved with ${selectedFixtures.size} fixtures!`);
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

        {/* Test GW Selection */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <label className="font-medium text-slate-700">Test Gameweek:</label>
            <input
              type="number"
              value={testGw}
              onChange={(e) => setTestGw(parseInt(e.target.value) || 1)}
              min="1"
              className="border rounded px-3 py-2 w-20"
            />
          </div>
        </div>

        {/* API Match Selection */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Fetch Matches from API</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Competition:</label>
              <select
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
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
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Game Week:</label>
              <select
                value={gameweek || ""}
                onChange={(e) => setGameweek(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select Game Week</option>
                {Array.from({ length: 38 }, (_, i) => i + 1).map((gw) => (
                  <option key={gw} value={gw}>
                    Game Week {gw}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onMouseDown={(e) => {
              console.log('[TestAdminApi] Button mousedown', { gameweek, fetchingMatches, disabled: e.currentTarget.disabled });
            }}
            onMouseEnter={() => {
              console.log('[TestAdminApi] Button hover');
            }}
            onClick={(e) => {
              console.log('[TestAdminApi] Button clicked', { gameweek, fetchingMatches, disabled: e.currentTarget.disabled });
              
              if (!gameweek) {
                const errorMsg = "⚠️ Please select a Game Week from the dropdown above";
                console.log('[TestAdminApi] No gameweek selected:', errorMsg);
                setApiError(errorMsg);
                // Also clear any previous matches
                setAvailableMatches([]);
                // Scroll to error message if needed
                setTimeout(() => {
                  const errorEl = document.querySelector('[data-api-error]');
                  if (errorEl) {
                    errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }
                }, 100);
                return;
              }
              
              if (fetchingMatches) {
                console.log('[TestAdminApi] Already fetching, ignoring click');
                return;
              }
              
              console.log('[TestAdminApi] Starting fetch', { competition, gameweek });
              
              const abortController = new AbortController();
              setFetchingMatches(true);
              setApiError(null);
              
              fetchApiMatches(competition, gameweek, abortController.signal)
                .then((matches) => {
                  console.log('[TestAdminApi] Matches fetched', matches?.length || 0);
                  if (matches && matches.length > 0) {
                    setAvailableMatches(matches);
                    // Clear any previous error on success
                    setApiError(null);
                  } else if (matches && matches.length === 0) {
                    setApiError("No matches found for this matchday");
                  }
                })
                .catch((error) => {
                  console.error('[TestAdminApi] Error in button handler', error);
                  if (error instanceof Error && error.name !== 'AbortError') {
                    setApiError("Failed to fetch matches. Please try again.");
                  }
                })
                .finally(() => {
                  setFetchingMatches(false);
                });
            }}
            disabled={fetchingMatches || !gameweek}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform relative z-10"
            type="button"
          >
            {fetchingMatches ? "Loading..." : "Fetch Matches"}
          </button>
        </div>

        {/* Available Matches List */}
        {availableMatches.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-4 mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Available Matches ({availableMatches.length})
            </h3>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableMatches.map((match, index) => {
                const isSelected = selectedFixtures.has(index);
                const kickoff = new Date(match.utcDate);
                const kickoffStr = `${kickoff.toLocaleDateString()} ${String(kickoff.getUTCHours()).padStart(2, '0')}:${String(kickoff.getUTCMinutes()).padStart(2, '0')} UTC`;
                
                return (
                  <div
                    key={match.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-purple-50 border-purple-300"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                    onClick={() => toggleFixture(match, index)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleFixture(match, index)}
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
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Selected Fixtures for Test GW {testGw} ({selectedFixtures.size})
            </h3>
            
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
              {saving ? "Saving..." : `Save Test Gameweek ${testGw}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


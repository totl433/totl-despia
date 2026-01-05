import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { isGameweekFinished } from "../lib/gameweekState";

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

type SelectedFixture = {
 api_match_id: number;
 home_team: string;
 away_team: string;
 home_code: string;
 away_code: string;
 home_name: string;
 away_name: string;
 home_crest: string | null;
 away_crest: string | null;
 kickoff_time: string;
 selected: boolean;
};

// Get Netlify function URL dynamically based on current environment
const getFunctionUrl = () => {
 const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
 const origin = typeof window !== 'undefined' ? window.location.origin : '';
 
 if (hostname.includes('netlify.app') || hostname.includes('netlify.com')) {
 return `${origin}/.netlify/functions/fetchFootballData`;
 }
 
 if (hostname === 'localhost' || hostname === '127.0.0.1') {
 return `https://totl-staging.netlify.app/.netlify/functions/fetchFootballData`;
 }
 
 return "/.netlify/functions/fetchFootballData";
};

export default function ApiAdmin() {
 const { user } = useAuth();
 const isAdmin = user?.id === '4542c037-5b38-40d0-b189-847b8f17c222' || user?.id === '36f31625-6d6c-4aa4-815a-1493a812841b';

 const [nextGw, setNextGw] = useState<number | null>(null);
 const [currentGw, setCurrentGw] = useState<number | null>(null);
 const [availableMatches, setAvailableMatches] = useState<ApiMatch[]>([]);
 const [selectedFixtures, setSelectedFixtures] = useState<Map<number, SelectedFixture>>(new Map());
 const [saving, setSaving] = useState(false);
 const [fetchingMatches, setFetchingMatches] = useState(false);
 const [error, setError] = useState("");
 const [ok, setOk] = useState("");
 const [apiError, setApiError] = useState<string | null>(null);
 const [loadingGw, setLoadingGw] = useState(true);
 const [showPublishConfirm, setShowPublishConfirm] = useState(false);
 const [recalling, setRecalling] = useState(false);
 const [currentGwFinished, setCurrentGwFinished] = useState<boolean | null>(null);
 const [checkingFinished, setCheckingFinished] = useState(false);

 // Load next GW from app_meta
 useEffect(() => {
 if (!isAdmin) return;
 
 let alive = true;
 (async () => {
 try {
 const { data, error } = await supabase
 .from("app_meta")
 .select("current_gw")
 .eq("id", 1)
 .maybeSingle();
 
 if (error) throw error;
 
 if (alive && data) {
 const currentGwValue = data.current_gw || 13;
 setCurrentGw(currentGwValue);
 const next = currentGwValue + 1;
 setNextGw(next);
 
 // Check if current GW is finished
 setCheckingFinished(true);
 const finished = await isGameweekFinished(currentGwValue);
 if (alive) {
 setCurrentGwFinished(finished);
 setCheckingFinished(false);
 }
 
 // Load existing fixtures for next GW if they exist
 const { data: existingFixtures } = await supabase
 .from("app_fixtures")
 .select("*")
 .eq("gw", next)
 .order("fixture_index", { ascending: true });
 
 if (existingFixtures && existingFixtures.length > 0) {
 const fixturesMap = new Map<number, SelectedFixture>();
 existingFixtures.forEach((f: any) => {
 fixturesMap.set(f.fixture_index, {
 api_match_id: f.api_match_id || 0,
 home_team: f.home_team || '',
 away_team: f.away_team || '',
 home_code: f.home_code || '',
 away_code: f.away_code || '',
 home_name: f.home_name || '',
 away_name: f.away_name || '',
 home_crest: f.home_crest || null,
 away_crest: f.away_crest || null,
 kickoff_time: f.kickoff_time || '',
 selected: true,
 });
 });
 setSelectedFixtures(fixturesMap);
 }
 }
 } catch (error) {
 console.error("Error loading next GW:", error);
 } finally {
 if (alive) setLoadingGw(false);
 }
 })();
 
 return () => { alive = false; };
 }, [isAdmin]);

 // Fetch and store team forms from Football Data API standings
 // Expose to window for one-off manual calls
 const fetchAndStoreTeamForms = async (gw: number) => {
 try {
 console.log(`[ApiAdmin] Fetching team forms for GW ${gw}...`);
 
 const functionUrl = getFunctionUrl();
 // Use current date for form calculation
 const today = new Date().toISOString().split('T')[0];
 const params = new URLSearchParams({
 resource: 'standings',
 competition: 'PL',
 date: today,
 });
 const url = `${functionUrl}?${params.toString()}`;

 const response = await fetch(url);

 if (!response.ok) {
 console.warn(`[ApiAdmin] Failed to fetch team forms: ${response.status}`);
 return; // Non-critical error, just skip
 }

 const result = await response.json();

 if (!result.success || !result.data) {
 console.warn('[ApiAdmin] Invalid standings API response');
 return;
 }

 // Parse standings data to extract form
 const formsMap = new Map<string, string>();
 const standings = result.data?.standings || result.data;
 
 if (standings && Array.isArray(standings)) {
 // Standings is an array of tables (usually one for overall, one for home, one for away)
 // We want the overall table
 const overallTable = standings.find((s: any) => s.type === 'TOTAL') || standings[0];
 
 if (overallTable && overallTable.table && Array.isArray(overallTable.table)) {
 overallTable.table.forEach((team: any) => {
 // Use team.tla (three-letter code) as key
 const teamCode = (team.team?.tla || team.team?.shortName || '').toUpperCase().trim();
 // API returns comma-separated format (e.g., "D,L,W,D,W") with newest FIRST
 // Reverse it so newest is LAST for display (oldest → newest)
 const formRaw = (team.form || '').trim().toUpperCase().replace(/,/g, '');
 const form = formRaw ? formRaw.split('').reverse().join('') : '';
 
 if (teamCode && form) {
 formsMap.set(teamCode, form);
 }
 });
 }
 }

 if (formsMap.size > 0) {
 // Store forms in database
 const formsToInsert = Array.from(formsMap.entries()).map(([team_code, form]) => ({
 gw,
 team_code,
 form,
 }));

 const { error: formsError } = await supabase
 .from("app_team_forms")
 .upsert(formsToInsert, {
 onConflict: 'gw,team_code',
 ignoreDuplicates: false,
 });

 if (formsError) {
 console.error('[ApiAdmin] Error storing team forms:', formsError);
 } else {
 console.log(`[ApiAdmin] ✅ Successfully stored ${formsMap.size} team forms for GW ${gw}`);
 }
 } else {
 console.warn('[ApiAdmin] ⚠️ No team forms found in API response');
 }
 } catch (error) {
 console.error('[ApiAdmin] Error fetching team forms:', error);
 // Non-critical error, don't block fixture saving
 }
 };

 // Fetch upcoming Premier League matches for the specific Gameweek (matchday)
 const fetchUpcomingMatches = async (signal?: AbortSignal) => {
 if (!nextGw) {
 setApiError("Next GW not loaded yet.");
 return null;
 }

 try {
 const today = new Date();
 const nextWeek = new Date(today);
 nextWeek.setDate(today.getDate() + 7);
 
 const dateFrom = today.toISOString().split('T')[0];
 const dateTo = nextWeek.toISOString().split('T')[0];
 
 const params = new URLSearchParams({
 competition: "PL", // Premier League only
 dateFrom: dateFrom,
 dateTo: dateTo,
 });

 const functionUrl = getFunctionUrl();
 const url = `${functionUrl}?${params.toString()}`;

 const response = await fetch(url, { signal });

 if (!response.ok) {
 const errorText = await response.text();
 if (response.status === 429) {
 setApiError("Rate limit reached. Please wait a moment.");
 return null;
 }
 setApiError(`Server error (${response.status}). ${errorText.substring(0, 100)}`);
 return null;
 }

 const result = await response.json();

 if (!result.success || !result.data) {
 setApiError("Invalid API response format.");
 return null;
 }

 // Filter matches by matchday (which corresponds to our Gameweek)
 const allMatches = result.data.matches || [];
 const filteredMatches = allMatches.filter((match: ApiMatch) => match.matchday === nextGw);

 setApiError(null);
 return filteredMatches;
 } catch (error) {
 if (error instanceof Error && error.name === 'AbortError') {
 return null;
 }
 console.error("Error fetching matches:", error);
 setApiError("Failed to fetch matches. Check your connection.");
 return null;
 }
 };

 const toggleFixture = (match: ApiMatch) => {
 const newSelected = new Map(selectedFixtures);
 
 // Check if this API match is already selected
 const existingEntry = Array.from(newSelected.entries()).find(([_, f]) => f.api_match_id === match.id);
 
 if (existingEntry) {
 // Deselect - remove by fixture_index
 const [fixtureIndex] = existingEntry;
 newSelected.delete(fixtureIndex);
 
 // Re-index remaining fixtures sequentially
 const sortedFixtures = Array.from(newSelected.entries())
 .sort(([a], [b]) => a - b);
 const reindexed = new Map<number, SelectedFixture>();
 sortedFixtures.forEach(([_, f], idx) => {
 reindexed.set(idx, f);
 });
 setSelectedFixtures(reindexed);
 } else {
 // Select - assign next available fixture_index
 const maxIndex = newSelected.size > 0 
 ? Math.max(...Array.from(newSelected.keys())) 
 : -1;
 const nextIndex = maxIndex + 1;
 
 const fixture: SelectedFixture = {
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

 // Check if next GW is already published (current_gw === nextGw)
 const isPublished = currentGw !== null && nextGw !== null && currentGw >= nextGw;
 
 // Can only publish next GW if current GW is finished
 const canPublishNextGw = currentGwFinished === true;

 const publishGameweek = async () => {
 if (!nextGw) {
 setError("Next GW not loaded");
 return;
 }

 if (!canPublishNextGw) {
 setError(`Cannot publish GW ${nextGw}: GW ${currentGw} is not finished yet. All fixtures must have results before publishing the next gameweek.`);
 return;
 }

 if (selectedFixtures.size === 0) {
 setError("Please select at least one fixture");
 return;
 }

 // Validate that all selected fixtures have api_match_id
 const fixturesWithoutApiId = Array.from(selectedFixtures.values()).filter(f => !f.api_match_id || f.api_match_id === 0);
 if (fixturesWithoutApiId.length > 0) {
 setError(`Cannot publish: ${fixturesWithoutApiId.length} fixture${fixturesWithoutApiId.length === 1 ? '' : 's'} missing api_match_id. Please select fixtures from the API matches list.`);
 return;
 }

 // Show confirmation dialog
 setShowPublishConfirm(true);
 };

 const confirmPublish = async () => {
 if (!nextGw) return;
 
 setShowPublishConfirm(false);

 setSaving(true);
 setError("");
 setOk("");

 try {
 // Prepare fixtures to save to app_fixtures
 const fixturesToInsert = Array.from(selectedFixtures.entries()).map(([fixture_index, f]) => ({
 gw: nextGw,
 fixture_index,
 api_match_id: f.api_match_id,
 home_team: f.home_team,
 away_team: f.away_team,
 home_code: f.home_code,
 away_code: f.away_code,
 home_name: f.home_name,
 away_name: f.away_name,
 home_crest: f.home_crest || null,
 away_crest: f.away_crest || null,
 kickoff_time: f.kickoff_time,
 }));

 // API Admin ONLY saves to app_fixtures (App table)
 // Web users get fixtures from Web Admin page (saves to fixtures table)
 // Mirroring triggers handle copying user data (picks/submissions), not fixtures
 
 console.log(`[ApiAdmin] Saving ${fixturesToInsert.length} fixtures to app_fixtures for GW ${nextGw}...`);
 
 const { data: insertedData, error: insertError } = await supabase
 .from("app_fixtures")
 .upsert(fixturesToInsert, { 
 onConflict: 'gw,fixture_index',
 ignoreDuplicates: false 
 })
 .select();

 if (insertError) {
 console.error('[ApiAdmin] ❌ Error upserting fixtures to app_fixtures:', insertError);
 console.error('[ApiAdmin] Error details:', JSON.stringify(insertError, null, 2));
 throw insertError;
 }

 const savedCount = insertedData?.length || fixturesToInsert.length;
 console.log(`[ApiAdmin] ✅ Successfully saved ${savedCount} fixtures to app_fixtures for GW ${nextGw}`);
 
 // Verify the save worked by checking the database
 const { data: verifyData, error: verifyError } = await supabase
 .from("app_fixtures")
 .select("fixture_index")
 .eq("gw", nextGw);
 
 if (verifyError) {
 console.warn('[ApiAdmin] ⚠️ Could not verify fixtures were saved:', verifyError);
 } else {
 console.log(`[ApiAdmin] ✅ Verified: ${verifyData?.length || 0} fixtures exist in app_fixtures for GW ${nextGw}`);
 if ((verifyData?.length || 0) !== savedCount) {
 console.warn(`[ApiAdmin] ⚠️ Mismatch: Expected ${savedCount} fixtures but found ${verifyData?.length || 0} in database`);
 }
 }

 // CRITICAL: Update app_meta.current_gw to the saved GW
 // This triggers the notification and makes the GW live
 console.log(`[ApiAdmin] ⚠️ PUBLISHING: Updating app_meta.current_gw to ${nextGw}...`);
 const { error: metaError } = await supabase
 .from("app_meta")
 .upsert({ id: 1, current_gw: nextGw }, { onConflict: 'id' });

 if (metaError) {
 console.error('[ApiAdmin] ❌ CRITICAL ERROR updating app_meta:', metaError);
 throw new Error(`Failed to publish: Could not update current_gw to ${nextGw}. ${metaError.message}`);
 } else {
 console.log(`[ApiAdmin] ✅ Successfully published: app_meta.current_gw = ${nextGw}`);
 setCurrentGw(nextGw); // Update local state
 
 // Verify the update
 const { data: verifyMeta, error: verifyMetaError } = await supabase
 .from("app_meta")
 .select("current_gw")
 .eq("id", 1)
 .single();
 
 if (verifyMetaError) {
 console.warn('[ApiAdmin] ⚠️ Could not verify app_meta update:', verifyMetaError);
 } else {
 console.log(`[ApiAdmin] ✅ Verified: app_meta.current_gw = ${verifyMeta?.current_gw}`);
 }
 }

 // Fetch and store team forms for this gameweek (automatic)
 console.log(`[ApiAdmin] 🔄 Automatically fetching team forms for GW ${nextGw}...`);
 try {
 await fetchAndStoreTeamForms(nextGw);
 console.log(`[ApiAdmin] ✅ Team forms fetch completed for GW ${nextGw}`);
 } catch (formsError) {
 console.error('[ApiAdmin] ⚠️ Team forms fetch failed (non-critical):', formsError);
 // Don't throw - gameweek is published, form data fetch failure is non-critical
 }

 // Send push notification to all users - using V2 dispatcher
 try {
 const pushRes = await fetch('/.netlify/functions/sendPushAllV2', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 title: `GAMEWEEK ${nextGw} - FIXTURES ARE OUT!`,
 message: `Make your predictions now!`,
 data: { type: 'fixtures_published', gw: nextGw }
 })
 });

 const pushData = await pushRes.json().catch(() => ({}));
 
 if (pushRes.ok && pushData.ok) {
 console.log(`[ApiAdmin] Push notification sent to ${pushData.sentTo || 0} users (out of ${pushData.userCount || 0} subscribed)`);
 } else {
 console.warn('[ApiAdmin] Push notification failed:', pushData);
 }
 } catch (pushError) {
 console.error('[ApiAdmin] Error sending push notification:', pushError);
 // Don't throw - gameweek is saved, notification failure is non-critical
 }

 // Send Volley messages to all leagues
 try {
 const volleyRes = await fetch('/.netlify/functions/sendVolleyGwReady', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ gameweek: nextGw })
 });

 const volleyData = await volleyRes.json().catch(() => ({}));
 
 if (volleyRes.ok && volleyData.ok) {
 console.log(`[ApiAdmin] Volley messages sent to ${volleyData.totalLeagues || 0} leagues`);
 } else {
 console.warn('[ApiAdmin] Volley message failed:', volleyData);
 }
 } catch (volleyError) {
 console.error('[ApiAdmin] Error sending Volley messages:', volleyError);
 // Don't throw - gameweek is published, Volley message failure is non-critical
 }

 setOk(`✅ Gameweek ${nextGw} PUBLISHED with ${selectedFixtures.size} Premier League fixtures! Notification sent to all users.`);
 } catch (e: any) {
 setError(e.message ?? "Failed to publish gameweek.");
 } finally {
 setSaving(false);
 }
 };

 const recallGameweek = async () => {
 if (!nextGw || !currentGw) return;
 
 if (currentGw !== nextGw) {
 setError(`Cannot recall: GW ${nextGw} is not the current published gameweek (current is GW ${currentGw})`);
 return;
 }

 if (!confirm(`⚠️ Are you sure you want to RECALL GW ${nextGw}?\n\nThis will:\n- Set current_gw back to ${currentGw - 1}\n- Users will no longer see GW ${nextGw} fixtures\n- You can edit and republish later`)) {
 return;
 }

 setRecalling(true);
 setError("");
 setOk("");

 try {
 const previousGw = currentGw - 1;
 console.log(`[ApiAdmin] Recalling GW ${nextGw}, setting current_gw to ${previousGw}...`);
 
 const { error: metaError } = await supabase
 .from("app_meta")
 .upsert({ id: 1, current_gw: previousGw }, { onConflict: 'id' });

 if (metaError) {
 throw new Error(`Failed to recall: ${metaError.message}`);
 }

 setCurrentGw(previousGw);
 setOk(`✅ GW ${nextGw} recalled. Current gameweek is now GW ${previousGw}.`);
 } catch (e: any) {
 setError(e.message ?? "Failed to recall gameweek.");
 } finally {
 setRecalling(false);
 }
 };

 if (!isAdmin) {
 return (
 <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
 <div className="text-red-600">Access denied. Admin only.</div>
 </div>
 );
 }

 if (loadingGw) {
 return (
 <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
 <div className="text-slate-600">Loading...</div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
 <div className="max-w-4xl mx-auto">
 {/* Current GW Status */}
 <div className="bg-white border-2 border-slate-300 rounded-lg p-4 mb-6">
 <div className="flex items-center justify-between">
 <div>
 <div className="text-sm text-slate-600 mb-1">Current Gameweek</div>
 <div className="text-2xl font-bold text-slate-900">GW {currentGw ?? '...'}</div>
 </div>
 <div className="text-right">
 <div className="text-sm text-slate-600 mb-1">Next Gameweek</div>
 <div className="text-2xl font-bold text-slate-900">GW {nextGw ?? '...'}</div>
 </div>
 </div>
 
 <div className="mt-4 pt-4 border-t border-slate-200">
 <div className="flex items-center justify-between">
 <div>
 {checkingFinished ? (
 <span className="text-sm text-slate-500">Checking status...</span>
 ) : currentGwFinished === true ? (
 <span className="text-sm font-medium text-green-700">✅ GW {currentGw} finished - Ready to publish GW {nextGw}</span>
 ) : currentGwFinished === false ? (
 <span className="text-sm font-medium text-amber-700">⏳ GW {currentGw} still in progress - Cannot publish GW {nextGw} yet</span>
 ) : (
 <span className="text-sm text-slate-500">Loading status...</span>
 )}
 </div>
 {currentGw !== null && (
 <button
 onClick={async () => {
 setCheckingFinished(true);
 const finished = await isGameweekFinished(currentGw);
 setCurrentGwFinished(finished);
 setCheckingFinished(false);
 }}
 disabled={checkingFinished}
 className="px-3 py-1 text-sm bg-slate-100 rounded border border-slate-300 disabled:opacity-50"
 >
 {checkingFinished ? 'Checking...' : 'Refresh Status'}
 </button>
 )}
 </div>
 </div>
 </div>

 <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mb-2">
 API Admin - Premier League
 </h2>
 <p className="text-sm text-slate-600 mb-6">
 Select Premier League fixtures for Gameweek {nextGw}. Check the feed for any cancelled or postponed games.
 </p>

 {error && (
 <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
 {error}
 </div>
 )}

 {!canPublishNextGw && currentGw !== null && currentGwFinished === false && (
 <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-400 rounded-lg text-amber-800">
 <div className="font-semibold mb-2">⚠️ Cannot publish GW {nextGw} yet</div>
 <div className="text-sm">
 GW {currentGw} is still in progress. All fixtures must be finished (have results) before you can publish the next gameweek.
 </div>
 </div>
 )}

 {ok && (
 <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
 {ok}
 </div>
 )}

 {apiError && (
 <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-400 rounded-lg text-amber-800 text-sm font-medium shadow-md">
 ⚠️ {apiError}
 </div>
 )}

 {/* Next GW Info */}
 <div className="bg-white rounded-xl shadow-md p-4 mb-6">
 <div className="flex items-center justify-between">
 <div>
 <div className="text-sm text-slate-600 mb-1">Next Gameweek</div>
 <div className="text-2xl font-bold text-slate-900">GW {nextGw}</div>
 {isPublished && (
 <div className="mt-2 inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
 ✅ PUBLISHED (Current GW)
 </div>
 )}
 </div>
 <div className="text-right">
 {selectedFixtures.size > 0 && (
 <>
 <div className="text-sm text-slate-600 mb-1">Selected Fixtures</div>
 <div className="text-2xl font-bold text-[#1C8376]">{selectedFixtures.size}</div>
 </>
 )}
 {isPublished && (
 <button
 onClick={recallGameweek}
 disabled={recalling}
 className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50 font-semibold text-sm"
 >
 {recalling ? "Recalling..." : `RECALL GW ${nextGw}`}
 </button>
 )}
 </div>
 </div>
 </div>

 {/* Fetch Matches */}
 <div className={`bg-white rounded-xl shadow-md p-4 mb-6 ${isPublished ? 'opacity-60' : ''}`}>
 <h3 className="text-lg font-semibold text-slate-800 mb-4">
 Premier League Matches for GW {nextGw} (Matchday {nextGw})
 </h3>
 {isPublished && (
 <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
 ⚠️ This gameweek is published and cannot be edited. Use RECALL to make changes.
 </div>
 )}
 <p className="text-sm text-slate-500 mb-4">
 Loading matches from the API that are tagged with Matchday {nextGw} (corresponds to GW {nextGw}).
 </p>
 
 <button
 onClick={() => {
 if (isPublished) return;
 if (fetchingMatches || !nextGw) return;
 
 setFetchingMatches(true);
 setApiError(null);
 
 const abortController = new AbortController();
 fetchUpcomingMatches(abortController.signal)
 .then((matches) => {
 if (matches && matches.length > 0) {
 setAvailableMatches(matches);
 setApiError(null);
 
 // Auto-select all matches
 const autoSelected = new Map<number, SelectedFixture>();
 matches.forEach((match: ApiMatch, index: number) => {
 autoSelected.set(index, {
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
 });
 });
 setSelectedFixtures(autoSelected);
 } else if (matches && matches.length === 0) {
 setApiError(`No Premier League matches found for Matchday ${nextGw} (GW ${nextGw}) in the next week.`);
 }
 })
 .catch((error) => {
 if (error instanceof Error && error.name !== 'AbortError') {
 setApiError("Failed to fetch matches. Please try again.");
 }
 })
 .finally(() => {
 setFetchingMatches(false);
 });
 }}
 disabled={fetchingMatches || !nextGw || isPublished}
 className="px-4 py-2 bg-[#1C8376] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
 type="button"
 >
 {fetchingMatches ? "Loading..." : `Load GW ${nextGw} Matches (Matchday ${nextGw})`}
 </button>
 </div>

 {/* Available Matches List */}
 {availableMatches.length > 0 && (
 <div className={`bg-white rounded-xl shadow-md p-4 mb-6 ${isPublished ? 'opacity-60' : ''}`}>
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-semibold text-slate-800">
 Available Matches ({availableMatches.length}) - All Selected by Default
 </h3>
 {!isPublished && (
 <button
 onClick={publishGameweek}
 disabled={saving || selectedFixtures.size === 0 || !canPublishNextGw}
 className="px-6 py-3 bg-[#1C8376] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-lg"
 title={!canPublishNextGw ? `GW ${currentGw} must be finished before publishing GW ${nextGw}` : ''}
 >
 {saving ? "Publishing..." : `PUBLISH GW ${nextGw}`}
 </button>
 )}
 </div>
 
 <div className="space-y-2">
 {availableMatches.map((match) => {
 const isSelected = Array.from(selectedFixtures.values()).some(f => f.api_match_id === match.id);
 const kickoff = new Date(match.utcDate);
 
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
 className={`p-3 border-2 rounded-lg ${
 isSelected
 ? "bg-[#1C8376]/10 border-[#1C8376]"
 : "bg-slate-50 border-slate-200"
 }`}
 >
 <label className="flex items-center gap-4 cursor-pointer">
 <div className="relative flex-shrink-0">
 <input
 type="checkbox"
 checked={isSelected}
 onChange={() => !isPublished && toggleFixture(match)}
 disabled={isPublished}
 className="w-6 h-6 cursor-pointer appearance-none border-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
 style={{ 
 minWidth: '24px', 
 minHeight: '24px',
 borderColor: isSelected ? '#1C8376' : '#94a3b8',
 backgroundColor: isSelected ? '#1C8376' : 'white'
 }}
 />
 {isSelected && (
 <svg
 className="absolute top-0 left-0 w-6 h-6 pointer-events-none"
 fill="none"
 stroke="white"
 strokeWidth="3"
 viewBox="0 0 24 24"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 d="M5 13l4 4L19 7"
 />
 </svg>
 )}
 </div>
 <div className="flex-1">
 <div className="font-medium text-slate-800">
 {match.homeTeam.shortName} vs {match.awayTeam.shortName}
 </div>
 <div className="text-xs text-slate-500">
 {kickoffStr} • {match.status} • Matchday {match.matchday}
 </div>
 </div>
 </label>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Publish Confirmation Dialog */}
 {showPublishConfirm && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
 <h3 className="text-2xl font-bold text-slate-900 mb-4">
 ⚠️ PUBLISH GAMEWEEK {nextGw}?
 </h3>
 
 <div className="mb-6 space-y-3 text-sm text-slate-700">
 <p className="font-semibold">This will:</p>
 <ul className="list-disc list-inside space-y-2 ml-2">
 <li>Save {selectedFixtures.size} fixture{selectedFixtures.size === 1 ? '' : 's'} to the database</li>
 <li><strong className="text-red-600">Set current_gw to {nextGw}</strong> (makes it live)</li>
 <li><strong className="text-red-600">Send push notification to ALL users</strong></li>
 <li>Make this gameweek visible to all users</li>
 <li>Lock editing (you'll need to RECALL to make changes)</li>
 </ul>
 <p className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
 <strong>Are you sure?</strong> Once published, users will receive notifications and can start making predictions.
 </p>
 </div>

 <div className="flex gap-3">
 <button
 onClick={() => setShowPublishConfirm(false)}
 className="flex-1 px-4 py-2 bg-slate-200 text-slate-800 rounded-lg font-semibold"
 >
 Cancel
 </button>
 <button
 onClick={confirmPublish}
 disabled={saving}
 className="flex-1 px-4 py-2 bg-[#1C8376] text-white rounded-lg disabled:opacity-50 font-bold"
 >
 {saving ? "Publishing..." : "YES, PUBLISH GW " + nextGw}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}


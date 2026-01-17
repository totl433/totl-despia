import { useEffect, useMemo, useRef, useState } from "react";
import type { TouchEventHandler } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import TeamBadge from "../components/TeamBadge";
import { useNavigate } from "react-router-dom";
import { invalidateUserCache, getCached, setCached, getCacheTimestamp, CACHE_TTL } from "../lib/cache";
import SwipeCard from "../components/predictions/SwipeCard";
import ScoreIndicator from "../components/predictions/ScoreIndicator";
import ConfirmationModal from "../components/predictions/ConfirmationModal";
import DateHeader from "../components/DateHeader";
import { useLiveScores } from "../hooks/useLiveScores";
import { useGameweekState } from "../hooks/useGameweekState";
import { useDisplayGameweek } from "../hooks/useDisplayGameweek";
import { FixtureCard, type Fixture as FixtureCardFixture, type LiveScore as FixtureCardLiveScore } from "../components/FixtureCard";
import Confetti from "react-confetti";
import FirstVisitInfoBanner from "../components/FirstVisitInfoBanner";

// Generate a color from a string (team name or code)
function stringToColor(str: string): string {
 let hash = 0;
 for (let i = 0; i < str.length; i++) {
 hash = str.charCodeAt(i) + ((hash << 5) - hash);
 }
 // Generate a vibrant color
 const hue = Math.abs(hash % 360);
 const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
 const lightness = 45 + (Math.abs(hash) % 15); // 45-60%
 return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Get team color - checks TEAM_COLORS first, then generates from name/code
function getTeamColor(code: string | null | undefined, name: string | null | undefined): string {
 if (code && TEAM_COLORS[code]) {
 return TEAM_COLORS[code].primary;
 }
 // Generate color from team name or code
 const identifier = code || name || 'default';
 return stringToColor(identifier);
}


type Fixture = {
 id: string;
 gw: number;
 fixture_index: number;
 home_team: string;
 away_team: string;
 home_code?: string | null;
 away_code?: string | null;
 home_name?: string | null;
 away_name?: string | null;
 home_crest?: string | null;
 away_crest?: string | null;
 kickoff_time?: string | null;
 api_match_id?: number | null;
};

type Pick = {
 fixture_index: number;
 pick: "H" | "D" | "A";
 matchday: number;
};

type CardState = { x: number; y: number; rotation: number; opacity: number; scale: number };

const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
 ARS: { primary: "#EF0107", secondary: "#023474" },
 AVL: { primary: "#95BFE5", secondary: "#670E36" },
 BOU: { primary: "#DA291C", secondary: "#000000" },
 BRE: { primary: "#E30613", secondary: "#FBB800" },
 BHA: { primary: "#0057B8", secondary: "#FFCD00" },
 CHE: { primary: "#034694", secondary: "#034694" },
 CRY: { primary: "#1B458F", secondary: "#C4122E" },
 EVE: { primary: "#003399", secondary: "#003399" },
 FUL: { primary: "#FFFFFF", secondary: "#000000" },
 LIV: { primary: "#C8102E", secondary: "#00B2A9" },
 MCI: { primary: "#6CABDD", secondary: "#1C2C5B" },
 MUN: { primary: "#DA291C", secondary: "#FBE122" },
 NEW: { primary: "#241F20", secondary: "#FFFFFF" },
 NFO: { primary: "#DD0000", secondary: "#FFFFFF" },
 TOT: { primary: "#132257", secondary: "#FFFFFF" },
 WHU: { primary: "#7A263A", secondary: "#1BB1E7" },
 WOL: { primary: "#FDB913", secondary: "#231F20" },
 SUN: { primary: "#EB172B", secondary: "#211E1F" },
 LEE: { primary: "#FFCD00", secondary: "#1D428A" },
};

export default function PredictionsPage() {
 const { user } = useAuth();
 const navigate = useNavigate();
 
 // #region agent log
 // Off by default: enable only when explicitly debugging with a local collector/proxy.
 const ENABLE_AGENT_LOG = import.meta.env.DEV && import.meta.env.VITE_AGENT_LOG === 'true';

 // IMPORTANT: Cursor in-app browser may not be able to reach 127.0.0.1:7242 directly.
 // Send to a same-origin dev proxy; Vite forwards to the local collector.
 const debugEndpoint = '/__agent_log';
 const debugPost = (payload: {
  sessionId: string;
  runId: string;
  hypothesisId: string;
  location: string;
  message: string;
  data?: unknown;
  timestamp: number;
 }) => {
  if (!ENABLE_AGENT_LOG) return;

  try {
   // NOTE: main.tsx overrides window.fetch and suppresses localhost:7242 calls.
   // Use sendBeacon to bypass the fetch/XHR interceptors.
   if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const queued = navigator.sendBeacon(debugEndpoint, blob);
    if (queued) return;
   }
  } catch {
   // ignore
  }
 
  // Fallback: use fetch (should be fine via same-origin dev proxy).
  try {
   fetch(debugEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
    mode: 'no-cors',
   }).catch(() => {});
  } catch {
   // ignore
  }
 };
 
 // Helps confirm this instrumented build is actually running in the environment being tested.
 useEffect(() => {
  if (typeof window === 'undefined') return;
  if (!ENABLE_AGENT_LOG) return;
  debugPost({
   sessionId:'debug-session',
   runId:'run1',
   hypothesisId:'H0',
   location:'src/pages/Predictions.tsx:mount',
   message:'PredictionsPage mounted',
   data:{href:window.location.href,userIdPrefix:user?.id ? user.id.slice(0,8) : null},
   timestamp:Date.now()
  });
 }, [user?.id]);
 // #endregion agent log

 // Use centralized hook for display GW (single source of truth)
 // This subscribes to real-time updates when user clicks "MOVE ON GW" button
 const { displayGw } = useDisplayGameweek();

 const [currentGw, setCurrentGw] = useState<number | null>(null);
 const [currentIndex, setCurrentIndex] = useState(0);
 
 // Initialize state from cache synchronously to prevent loading flash
 // CRITICAL: Don't load from cache here - it might be for the wrong GW
 // The useEffect will load from cache immediately after determining the correct GW
 // This prevents showing stale data for a different GW
 const loadInitialStateFromCache = () => {
 return {
 fixtures: [],
 picks: new Map<number, { fixture_index: number; pick: "H" | "D" | "A"; matchday: number }>(),
 submitted: false,
 results: new Map<number, "H" | "D" | "A">(),
 loading: true,
 picksChecked: false,
 submissionChecked: false,
 };
 };
 
 const initialState = loadInitialStateFromCache();
 
 // Initialize fixtures, picks, and results from cache
 const [fixtures, setFixtures] = useState<Fixture[]>(initialState.fixtures);
 
 // Track when fixtures change to debug flash of old data
 useEffect(() => {
 }, [fixtures, currentGw]);

 // Use centralized game state system (PR.md rule 10)
 // LIVE state means: first kickoff happened AND last game hasn't finished (FT)
 // Pass userId to get user-specific state (includes GW_PREDICTED)
 const { state: gameState, loading: gameStateLoading } = useGameweekState(currentGw, user?.id);
 const [picks, setPicks] = useState<Map<number, { fixture_index: number; pick: "H" | "D" | "A"; matchday: number }>>(initialState.picks);
 const [results, setResults] = useState<Map<number, "H" | "D" | "A">>(initialState.results);
 const [teamForms, setTeamForms] = useState<Map<string, string>>(new Map()); // Map<teamCode, formString>
 
 // Fetch team forms from database (fetched once per GW when published)
 const fetchTeamForms = async (gw: number) => {
 try {
 const { data, error } = await supabase
 .from("app_team_forms")
 .select("team_code, form")
 .eq("gw", gw);

 if (error) {
 return;
 }

 if (data && data.length > 0) {
 const formsMap = new Map<string, string>();
 data.forEach((row: { team_code: string; form: string }) => {
 const teamCode = row.team_code.toUpperCase().trim();
 const form = row.form.trim().toUpperCase();
 if (teamCode && form) {
 formsMap.set(teamCode, form);
 }
 });
 setTeamForms(formsMap);
 } else {
 setTeamForms(new Map()); // Clear forms if none found
 }
 } catch (error) {
 setTeamForms(new Map()); // Clear on error
 }
 };

 // Fetch team forms when currentGw changes
 useEffect(() => {
 if (currentGw) {
 fetchTeamForms(currentGw);
 } else {
 setTeamForms(new Map()); // Clear forms if no GW
 }
 }, [currentGw]);

 
 // Initialize viewMode - check sessionStorage synchronously to prevent flash
 const getInitialViewMode = (): "cards" | "list" => {
 if (typeof window === 'undefined') return "cards";
 try {
 // Check all sessionStorage keys for test_api_submitted pattern
 // This prevents the flash even if we don't know the exact GW or user ID yet
 for (let i = 0; i < sessionStorage.length; i++) {
 const key = sessionStorage.key(i);
 if (key && key.startsWith(`gw_submitted_`)) {
 const value = sessionStorage.getItem(key);
 if (value === 'true') {
 // If user ID is available, check if it matches
 if (user?.id && key.endsWith(`_${user.id}`)) {
 return "list";
 }
 // If no user ID yet but we found any submission, default to "list" to be safe
 // This prevents flash when user ID loads later
 if (!user?.id) {
 return "list";
 }
 }
 }
 }
 } catch (e) {
 // Ignore errors
 }
 // Also check if we have cached submission status (will be available after initialState is computed)
 // Note: initialState is computed before this, so we can't reference it here directly
 // But we'll check it in the useEffect below
 return "cards";
 };
 
 const [viewMode, setViewMode] = useState<"cards" | "list">(() => {
 const mode = getInitialViewMode();
 // Also check cached submission status
 if (initialState.submitted) {
 return "list";
 }
 return mode;
 });
 const [cardState, setCardState] = useState<CardState>({ x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 });
 const [isDragging, setIsDragging] = useState(false);
 const [isAnimating, setIsAnimating] = useState(false);
 const [showFeedback, setShowFeedback] = useState<"home" | "draw" | "away" | null>(null);
 const [returnToReview, setReturnToReview] = useState(false);
 const [confirmCelebration, setConfirmCelebration] = useState<{ success: boolean; message: string } | null>(null);
 const [showConfetti, setShowConfetti] = useState(false);
 const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
 const [loading, setLoading] = useState(initialState.loading);
 const [picksChecked, setPicksChecked] = useState(initialState.picksChecked);
 const [submissionChecked, setSubmissionChecked] = useState(initialState.submissionChecked);
 
 // Ensure checked flags are set when fixtures are loaded
 useEffect(() => {
 if (fixtures.length > 0 && (!picksChecked || !submissionChecked)) {
 setPicksChecked(true);
 setSubmissionChecked(true);
 setLoading(false);
 dataLoadedRef.current = true;
 }
 }, [fixtures.length, picksChecked, submissionChecked]);
 
 // Helper function to check sessionStorage for submission (defined early to avoid hoisting issues)
 const getHasEverBeenSubmitted = () => {
 if (typeof window === 'undefined' || !currentGw || !user?.id) return false;
 const key = `gw_submitted_${currentGw}_${user.id}`;
 return sessionStorage.getItem(key) === 'true';
 };
 const setHasEverBeenSubmitted = (value: boolean) => {
 if (typeof window === 'undefined' || !currentGw || !user?.id) return;
  const key = `gw_submitted_${currentGw}_${user.id}`;
 if (value) {
 sessionStorage.setItem(key, 'true');
 } else {
 sessionStorage.removeItem(key);
 }
 };
 // Define ref before it's used in state initializers
 const hasEverBeenSubmittedRef = useRef<boolean>(getHasEverBeenSubmitted());
 const dataLoadedRef = useRef<boolean>(false); // Track if data has been successfully loaded
 
 const [submitted, setSubmitted] = useState(() => {
 // CRITICAL: Initialize from cache first (fastest), then fall back to sessionStorage
 if (initialState.submitted) {
 hasEverBeenSubmittedRef.current = true;
 return true;
 }
 
 // Fall back to sessionStorage check
 if (typeof window === 'undefined' || !user?.id) return false;
 try {
 for (let i = 0; i < sessionStorage.length; i++) {
 const key = sessionStorage.key(i);
    if (key && key.startsWith(`gw_submitted_`) && key.endsWith(`_${user.id}`)) {
 const value = sessionStorage.getItem(key);
 if (value === 'true') {
 hasEverBeenSubmittedRef.current = true;
 return true;
 }
 }
 }
 } catch (e) {
 // Ignore errors
 }
 return false;
 });
 
 // Check sessionStorage immediately when currentGw and user are available
 // to prevent swipe cards from showing even briefly
 useEffect(() => {
 if (currentGw && user?.id && typeof window !== 'undefined') {
 try {
 const key = `gw_submitted_${currentGw}_${user.id}`;
 const hasSubmitted = sessionStorage.getItem(key) === 'true';
 if (hasSubmitted) {
 // Set both state values synchronously to prevent any flash
 setViewMode("list");
 setSubmitted(true);
 hasEverBeenSubmittedRef.current = true;
 }
 } catch (e) {
 // Ignore errors
 }
 }
 }, [currentGw, user?.id]);
 
 // Set viewMode to "list" immediately when submitted is detected
 useEffect(() => {
 if (submitted && viewMode === "cards") {
 setViewMode("list");
 }
 }, [submitted, viewMode]);
 
 // Ensure viewMode is "cards" only when not submitted and starting fresh
 useEffect(() => {
 if (!loading && !submitted && fixtures.length > 0 && currentIndex === 0) {
 setViewMode("cards");
 }
 }, [loading, submitted, fixtures.length, currentIndex]);

 // Set data-swipe-mode attribute on body for BottomNav visibility
 useEffect(() => {
 if (viewMode === "cards") {
 document.body.setAttribute('data-swipe-mode', 'true');
 } else {
 document.body.removeAttribute('data-swipe-mode');
 }
 
 // Cleanup on unmount
 return () => {
 document.body.removeAttribute('data-swipe-mode');
 };
 }, [viewMode]);
 
const [topPercent, setTopPercent] = useState<number | null>(null);
const [_allMembersSubmitted, setAllMembersSubmitted] = useState(false);
const [_leagueMembers, setLeagueMembers] = useState<Array<{ id: string; name: string }>>([]);
const [_submittedMemberIds, setSubmittedMemberIds] = useState<Set<string>>(new Set());
 const [apiMatchIds, setApiMatchIds] = useState<number[]>([]);
 const [deadlineTime, setDeadlineTime] = useState<Date | null>(null);
 const [pickPercentages, setPickPercentages] = useState<Map<number, { H: number; D: number; A: number }>>(new Map());
 
 // Subscribe to real-time live scores using the hook
 const { liveScores: liveScoresMap } = useLiveScores(currentGw || undefined, apiMatchIds.length > 0 ? apiMatchIds : undefined);
 
 // Convert liveScoresMap to the format expected by the component
 const liveScores = useMemo(() => {
 const scores: Record<number, {
 homeScore: number; 
 awayScore: number; 
 status: string; 
 minute?: number | null;
 goals?: any[] | null;
 red_cards?: any[] | null;
 home_team?: string | null;
 away_team?: string | null;
 }> = {};
 
 // Convert Map to Record keyed by fixture_index
 fixtures.forEach(f => {
 if (f.api_match_id && liveScoresMap.has(f.api_match_id)) {
 const score = liveScoresMap.get(f.api_match_id)!;
 scores[f.fixture_index] = {
 homeScore: score.home_score ?? 0,
 awayScore: score.away_score ?? 0,
 status: score.status || 'SCHEDULED',
 minute: score.minute,
 goals: score.goals || null,
 red_cards: score.red_cards || null,
 home_team: score.home_team || null,
 away_team: score.away_team || null,
 };
 }
 });
 
 return scores;
 }, [liveScoresMap, fixtures]);
 
 // Use a ref to track if we should show cards - updated synchronously
 // Refs don't cause re-renders, preventing flash
 const getInitialShouldShowCards = (): boolean => {
 // Check synchronously if we should show cards
 if (typeof window === 'undefined') return true;
 try {
 // Check all sessionStorage for any submission
 for (let i = 0; i < sessionStorage.length; i++) {
 const key = sessionStorage.key(i);
 if (key && key.startsWith(`gw_submitted_`)) {
 const value = sessionStorage.getItem(key);
 if (value === 'true') {
 // Found a submission - don't show cards
 return false;
 }
 }
 }
 } catch (e) {
 // Ignore
 }
 return true;
 };
 
 const shouldShowCardsRef = useRef<boolean>(getInitialShouldShowCards());
 
 // Update ref when submission is detected
 useEffect(() => {
 const sessionStorageSubmitted = getHasEverBeenSubmitted();
 const checkSubmitted = submitted || (sessionStorageSubmitted && hasEverBeenSubmittedRef.current);
 if (checkSubmitted) {
 shouldShowCardsRef.current = false;
 }
 }, [submitted]);

 // Cleanup scroll lock on mount - restore scrolling when component loads
 useEffect(() => {
 const html = document.documentElement;
 const body = document.body;
 const root = document.getElementById('root');
 
 // Restore scrolling by removing all scroll prevention styles
 // Use setProperty with empty string to override any !important rules from previous pages
 html.style.setProperty('overflow', '', 'important');
 body.style.setProperty('overflow', '', 'important');
 body.style.setProperty('position', '', 'important');
 body.style.removeProperty('width');
 body.style.removeProperty('height');
 body.style.removeProperty('top');
 if (root) {
 root.style.setProperty('overflow', '', 'important');
 }
 
 // Small delay to ensure styles are applied, then remove them completely
 // This handles cases where styles might be re-applied
 const timeoutId = setTimeout(() => {
 html.style.removeProperty('overflow');
 body.style.removeProperty('overflow');
 body.style.removeProperty('position');
 body.style.removeProperty('width');
 body.style.removeProperty('height');
 body.style.removeProperty('top');
 if (root) {
 root.style.removeProperty('overflow');
 }
 }, 100);
 
 // Return cleanup to ensure scroll is restored when component unmounts
 return () => {
 clearTimeout(timeoutId);
 html.style.setProperty('overflow', '', 'important');
 body.style.setProperty('overflow', '', 'important');
 body.style.setProperty('position', '', 'important');
 body.style.removeProperty('width');
 body.style.removeProperty('height');
 body.style.removeProperty('top');
 if (root) {
 root.style.setProperty('overflow', '', 'important');
 }
 // Final cleanup after a brief delay
 setTimeout(() => {
 html.style.removeProperty('overflow');
 body.style.removeProperty('overflow');
 body.style.removeProperty('position');
 body.style.removeProperty('width');
 body.style.removeProperty('height');
 body.style.removeProperty('top');
 if (root) {
 root.style.removeProperty('overflow');
 }
 }, 50);
 };
 }, []); // Run once on mount

 // Track window size for confetti
 useEffect(() => {
 const updateWindowSize = () => {
 setWindowSize({ width: window.innerWidth, height: window.innerHeight });
 };
 updateWindowSize();
 window.addEventListener('resize', updateWindowSize);
 return () => window.removeEventListener('resize', updateWindowSize);
 }, []);

 useEffect(() => {
 // Only lock scrolling when we are actually in swipe mode AND the GW is pickable.
 // If the deadline has passed (DEADLINE_PASSED/LIVE/RESULTS_PRE_GW), we render list/submitted views and must never lock scroll.
 const isReviewPage = currentIndex >= fixtures.length;
 const canSwipeNow = !gameStateLoading && (gameState === 'GW_OPEN' || gameState === 'GW_PREDICTED');
 const shouldLockScroll = viewMode === "cards" && canSwipeNow && !isReviewPage && fixtures.length > 0 && !submitted;
 
 const html = document.documentElement;
 const body = document.body;
 const root = document.getElementById('root');
 
 // Restore scrolling by removing all scroll prevention styles
 // First override any !important rules, then remove the properties
 const restoreScrolling = () => {
 // Override !important rules first
 html.style.setProperty('overflow', '', 'important');
 body.style.setProperty('overflow', '', 'important');
 body.style.setProperty('position', '', 'important');
 if (root) {
 root.style.setProperty('overflow', '', 'important');
 }
 // Then remove the properties completely
 html.style.removeProperty('overflow');
 body.style.removeProperty('overflow');
 body.style.removeProperty('position');
 body.style.removeProperty('width');
 body.style.removeProperty('height');
 body.style.removeProperty('top');
 if (root) {
 root.style.removeProperty('overflow');
 }
 };
 
 if (!shouldLockScroll) {
 // Restore scrolling if we're on review page, list mode, or submitted
 restoreScrolling();
 // Make sure we clean up any event listeners from previous lock
 return;
 }
 
 window.scrollTo({ top: 0, behavior: "auto" });
 
 // Set overflow hidden with !important via style attribute
 html.style.setProperty('overflow', 'hidden', 'important');
 body.style.setProperty('overflow', 'hidden', 'important');
 body.style.setProperty('position', 'fixed', 'important');
 body.style.setProperty('width', '100%', 'important');
 body.style.setProperty('height', '100%', 'important');
 body.style.setProperty('top', '0', 'important');
 if (root) {
 root.style.setProperty('overflow', 'hidden', 'important');
 }
 
 // Prevent wheel scrolling
 const preventWheel = (e: WheelEvent) => {
 e.preventDefault();
 };
 
 // Prevent scroll via touch on the document (but allow on card elements)
 const preventScroll = (e: TouchEvent) => {
 // Only prevent if touching outside the card area
 const target = e.target as HTMLElement;
 const cardContainer = target.closest('[style*="aspectRatio"]');
 if (!cardContainer) {
 e.preventDefault();
 }
 };
 
 window.addEventListener('wheel', preventWheel, { passive: false });
 document.addEventListener('touchmove', preventScroll, { passive: false });
 
 return () => {
 // Always restore scrolling on cleanup
 restoreScrolling();
 window.removeEventListener('wheel', preventWheel);
 document.removeEventListener('touchmove', preventScroll);
 };
 }, [viewMode, currentIndex, fixtures.length, submitted, gameState, gameStateLoading]);

 const allPicksMade = useMemo(() => {
 if (fixtures.length === 0) return false;
 return fixtures.every(f => picks.has(f.fixture_index));
 }, [fixtures, picks]);

 const cardRef = useRef<HTMLDivElement>(null);
 const startPosRef = useRef({ x: 0, y: 0 });
 // IMPORTANT: Don't rely on React state for gesture classification.
 // State updates can lag behind the last touch/mouse move, which can mis-classify swipes
 // (e.g. a right-swipe saved as "Draw"). Track the latest delta synchronously in a ref.
 const lastDeltaRef = useRef({ x: 0, y: 0 });
 const isResettingRef = useRef(false);

 // Load fixtures and picks from database
 // Track previous GW to detect changes
 const prevGwRef = useRef<number | null>(null);
 const fixturesGwRef = useRef<number | null>(null); // Track GW for fixtures to handle async state updates
 
 useEffect(() => {
 let alive = true;
 (async () => {
 try {
 // Use displayGw from useDisplayGameweek hook (single source of truth)
 // This automatically subscribes to real-time updates when user clicks "MOVE ON GW" button
 const gwToDisplay = displayGw;
   
   // Predictions page is user-specific; avoid doing work (and caching) until userId exists.
   // This prevents cache keys like `predictions:undefined:${gw}` and reduces racey first renders.
   if (!user?.id) {
    setLoading(true);
    return;
   }
 
 if (!gwToDisplay) {
 // Always set state, even if component appears to be unmounting
 setFixtures([]);
 setLoading(false);
 // Always set checked flags to prevent infinite loading
 setPicksChecked(true);
 setSubmissionChecked(true);
 return;
 }
 
 // CRITICAL: Clear fixtures BEFORE setting new GW to prevent flash of old data
 // Only clear if GW actually changed (not on initial load)
 if (prevGwRef.current !== null && prevGwRef.current !== gwToDisplay) {
   // GW changed - clear fixtures immediately to prevent flash
   setFixtures([]);
   setLoading(true);
 }
 prevGwRef.current = gwToDisplay;
 
 setCurrentGw(gwToDisplay);

 // 1. Load from cache immediately (if available)
 const cacheKey = `predictions:${user?.id}:${gwToDisplay}`;
 let loadedFromCache = false;
 
 try {
 const cached = getCached<{
 fixtures: Fixture[];
 picks: Array<{ fixture_index: number; pick: "H" | "D" | "A"; matchday: number }>;
 submitted: boolean;
 results: Array<{ fixture_index: number; result: "H" | "D" | "A" }>;
 }>(cacheKey);
 
 if (cached && cached.fixtures && Array.isArray(cached.fixtures) && cached.fixtures.length > 0) {
 // INSTANT RENDER from cache!
 // Track that fixtures are being set for this GW
 fixturesGwRef.current = gwToDisplay;
 setFixtures(cached.fixtures);
 setLoading(false);
 
        // Restore picks from cache
        if (cached.picks && Array.isArray(cached.picks) && cached.picks.length > 0) {
          const picksMap = new Map<number, { fixture_index: number; pick: "H" | "D" | "A"; matchday: number }>();
          cached.picks.forEach(p => {
            if (p && p.fixture_index !== undefined && p.pick) {
              picksMap.set(p.fixture_index, {
                fixture_index: p.fixture_index,
                pick: p.pick,
                matchday: p.matchday || gwToDisplay
              });
            }
          });
          if (picksMap.size > 0) {
            setPicks(picksMap);
          }
        }

 // Restore submission status
 if (cached.submitted !== undefined) {
 setSubmitted(cached.submitted);
 hasEverBeenSubmittedRef.current = cached.submitted;
 setHasEverBeenSubmitted(cached.submitted);
 }
 // Always set submissionChecked when loading from cache (even if submitted is undefined for new GW)
 setSubmissionChecked(true);
 
 // CRITICAL: If picks aren't in cache but user has submitted, load them from DB immediately (like HomePage does)
 // Check cached.picks, not picks.size (state might not be updated yet)
 // Check cached.fixtures.length, not fixtures.length (state hasn't updated yet after setFixtures)
 if (cached.submitted && user?.id && (!cached.picks || cached.picks.length === 0) && cached.fixtures.length > 0) {
   const { data: pk, error: pkErr } = await supabase
     .from("app_picks")
     .select("gw,fixture_index,pick")
     .eq("gw", gwToDisplay)
     .eq("user_id", user.id);
   
   if (!pkErr && pk && pk.length > 0) {
     const currentFixtureIndices = new Set(cached.fixtures.map(f => f.fixture_index));
     const picksForCurrentFixtures = pk.filter((p: any) => currentFixtureIndices.has(p.fixture_index));
     
     if (picksForCurrentFixtures.length > 0) {
       const picksMap = new Map<number, { fixture_index: number; pick: "H" | "D" | "A"; matchday: number }>();
       picksForCurrentFixtures.forEach((p: any) => {
         if (p && p.fixture_index !== undefined && p.pick) {
           picksMap.set(p.fixture_index, {
             fixture_index: p.fixture_index,
             pick: p.pick,
             matchday: p.gw || gwToDisplay
           });
         }
       });
       
       if (picksMap.size > 0) {
         setPicks(picksMap);
         
         // Cache picks for instant load next time
         try {
           const existingCache = getCached<{
             fixtures: Fixture[];
             picks: Array<{ fixture_index: number; pick: "H" | "D" | "A"; matchday: number }>;
             submitted: boolean;
             results: Array<{ fixture_index: number; result: "H" | "D" | "A" }>;
           }>(cacheKey);
           
           if (existingCache) {
             setCached(cacheKey, {
               ...existingCache,
               picks: Array.from(picksMap.values()),
             }, CACHE_TTL.PREDICTIONS);
           }
         } catch (cacheError) {
           // Failed to cache (non-critical)
         }
       }
     }
   }
 }
 
// Restore results from cache FIRST
if (cached.results && Array.isArray(cached.results)) {
const resultsMap = new Map<number, "H" | "D" | "A">();
cached.results.forEach(r => {
resultsMap.set(r.fixture_index, r.result);
});
setResults(resultsMap);
}
 
 // CRITICAL: If results aren't in cache, load them from DB immediately (like HomePage does)
 // This ensures score calculation works even if cache is missing
 // Check cached.results, not results state (state might not be updated yet)
 // Check cached.fixtures.length, not fixtures.length (state hasn't updated yet after setFixtures)
 if ((!cached.results || cached.results.length === 0) && cached.fixtures.length > 0) {
   const { data: gwResultsData, error: gwResultsError } = await supabase
     .from('app_gw_results')
     .select('fixture_index, result')
     .eq('gw', gwToDisplay);
   
   if (!gwResultsError && gwResultsData && gwResultsData.length > 0) {
     const resultsMap = new Map<number, "H" | "D" | "A">();
     gwResultsData.forEach((r: any) => {
       if (r.result === "H" || r.result === "D" || r.result === "A") {
         resultsMap.set(r.fixture_index, r.result);
       }
     });
     
     if (resultsMap.size > 0) {
       setResults(resultsMap);
       
       // Cache results for instant load next time
       if (user?.id) {
         try {
           const resultsArray: Array<{ fixture_index: number; result: "H" | "D" | "A" }> = [];
           resultsMap.forEach((result, fixture_index) => {
             resultsArray.push({ fixture_index, result });
           });
           
           const existingCache = getCached<{
             fixtures: Fixture[];
             picks: Array<{ fixture_index: number; pick: "H" | "D" | "A"; matchday: number }>;
             submitted: boolean;
             results: Array<{ fixture_index: number; result: "H" | "D" | "A" }>;
           }>(cacheKey);
           
           if (existingCache) {
             setCached(cacheKey, {
               ...existingCache,
               results: resultsArray,
             }, CACHE_TTL.PREDICTIONS);
           }
         } catch (cacheError) {
           // Failed to cache (non-critical)
         }
       }
     }
   }
 }
 
 setPicksChecked(true);
 loadedFromCache = true;
 
 // Check if cache is stale - only refresh in background if stale (>5 minutes old)
 const cacheTimestamp = getCacheTimestamp(cacheKey);
 const cacheAge = cacheTimestamp ? Date.now() - cacheTimestamp : Infinity;
 const isCacheStale = cacheAge > 5 * 60 * 1000; // 5 minutes
 
 if (!isCacheStale) {
  // Cache is fresh - only skip DB fetch if the cache is complete enough.
  // If cache lacks a submission flag, or claims submitted but has no picks, we must still validate/fetch.
  const cacheHasSubmissionFlag = cached.submitted !== undefined;
  const cacheSubmitted = cached.submitted === true;
  const cacheHasPicks = Array.isArray(cached.picks) && cached.picks.length > 0;
  const safeToSkipDbFetch = cacheHasSubmissionFlag && (!cacheSubmitted || cacheHasPicks);
  if (safeToSkipDbFetch) return;
 }
 // Cache is stale - continue with background refresh (non-blocking)
 }
 } catch (error) {
 // If cache is corrupted, just continue with fresh fetch
 // Error loading from cache (non-critical)
 }
 
 // Only set loading if we didn't load from cache
 // Don't reset checked flags unnecessarily - this causes infinite loading
 // The flags will be set to true when data is loaded, so only reset if we're truly starting fresh
 if (!loadedFromCache && fixtures.length === 0) {
 setLoading(true);
 // Only reset if both flags are already true (meaning we had data before)
 // If they're false, we're already in a loading state, so don't reset
 if (picksChecked && submissionChecked) {
 // We had data before but lost it (e.g., GW changed) - reset flags
 setPicksChecked(false);
 setSubmissionChecked(false);
 }
 }

 // Fetch fixtures from app_fixtures table
 const { data: savedFixtures, error: fixturesError } = await supabase
 .from("app_fixtures")
 .select("*")
 .eq("gw", gwToDisplay)
 .order("fixture_index", { ascending: true });
 
 if (fixturesError) {
 throw new Error(`Failed to load fixtures: ${fixturesError.message}`);
 }
 
 if (!savedFixtures || savedFixtures.length === 0) {
 // Always set state, even if component appears to be unmounting
 setFixtures([]);
 setLoading(false);
 // Always set checked flags to prevent infinite loading
 setPicksChecked(true);
 setSubmissionChecked(true);
 return;
 }

 // Convert saved fixtures to our format
 const fixturesData: Fixture[] = savedFixtures.map((f: any) => ({
 id: f.id || String(f.api_match_id || f.fixture_index),
 gw: gwToDisplay,
 fixture_index: f.fixture_index,
 home_team: f.home_team,
 away_team: f.away_team,
 home_code: f.home_code,
 away_code: f.away_code,
 home_name: f.home_name,
 away_name: f.away_name,
 home_crest: null, // app_fixtures doesn't have crest columns
 away_crest: null,
 kickoff_time: f.kickoff_time,
 api_match_id: f.api_match_id || null,
 }));
 
 // Calculate deadline (75 minutes before first kickoff)
 if (fixturesData.length > 0) {
 const kickoffTimes = fixturesData
 .map(f => f.kickoff_time)
 .filter((time): time is string => time !== null && time !== undefined)
 .map(time => new Date(time))
 .filter(date => !isNaN(date.getTime()))
 .sort((a, b) => a.getTime() - b.getTime());
 
 if (kickoffTimes.length > 0) {
 const earliestKickoff = kickoffTimes[0];
 const deadline = new Date(earliestKickoff.getTime() - (75 * 60 * 1000)); // 75 minutes before
 setDeadlineTime(deadline);
 }
 }
 
 // Always set fixtures and loading state, even if component appears to be unmounting
 // React will safely handle state updates even if component unmounts
 // This prevents infinite loading when useEffect restarts
 // Track that fixtures are being set for this GW
 fixturesGwRef.current = gwToDisplay;
 setFixtures(fixturesData);
 // Set loading to false as soon as fixtures are loaded - show page immediately
 setLoading(false);
 // Mark that data has been loaded - do this BEFORE async operations
 dataLoadedRef.current = true;
 // Set checked flags immediately when fixtures are loaded
 // This prevents the page from staying in loading state
 setPicksChecked(true);
 setSubmissionChecked(true);
 
// Load results from app_gw_results (like HomePage does)
// This ensures we have final results even if live scores aren't available
if (alive && fixturesData.length > 0) {
  (async () => {
    try {
      const { data: gwResultsData, error: gwResultsError } = await supabase
        .from('app_gw_results')
        .select('fixture_index, result')
        .eq('gw', gwToDisplay);
      
      if (!gwResultsError && gwResultsData && gwResultsData.length > 0) {
        const resultsMap = new Map<number, "H" | "D" | "A">();
        gwResultsData.forEach((r: any) => {
          if (r.result === "H" || r.result === "D" || r.result === "A") {
            resultsMap.set(r.fixture_index, r.result);
          }
        });
        if (alive && resultsMap.size > 0) {
          setResults(resultsMap);
          
          // Cache the results for instant load next time
          if (user?.id) {
            const resultsArray: Array<{ fixture_index: number; result: "H" | "D" | "A" }> = [];
            resultsMap.forEach((result, fixture_index) => {
              resultsArray.push({ fixture_index, result });
            });
            
            const cacheKey = `predictions:${user.id}:${gwToDisplay}`;
            try {
              const existingCache = getCached<{
                fixtures: Fixture[];
                picks: Array<{ fixture_index: number; pick: "H" | "D" | "A"; matchday: number }>;
                submitted: boolean;
                results: Array<{ fixture_index: number; result: "H" | "D" | "A" }>;
              }>(cacheKey);
              
              if (existingCache) {
                setCached(cacheKey, {
                  ...existingCache,
                  results: resultsArray,
                }, CACHE_TTL.PREDICTIONS);
              }
            } catch (cacheError) {
              // Failed to cache (non-critical)
            }
          }
        }
      }
    } catch (error) {
      // Error loading gw_results (non-critical)
    }
  })();
} else {
  setResults(new Map());
}
 
 
 // Get api_match_ids for live score subscription
 const matchIds = fixturesData
 .map(f => f.api_match_id)
 .filter((id): id is number => id !== null && id !== undefined);
 
 if (alive && matchIds.length > 0) {
 // Store api_match_ids for useLiveScores hook
 setApiMatchIds(matchIds);
 }

 // CRITICAL: Check submission status FIRST before anything else
 // This prevents the swipe view from showing even briefly
 let isSubmitted = false;
 if (user?.id && fixturesData.length > 0) {
 const { data: submission } = await supabase
 .from("app_gw_submissions")
 .select("submitted_at")
 .eq("gw", gwToDisplay)
 .eq("user_id", user.id)
 .maybeSingle();
 
 // Always set submission state, even if component appears to be unmounting
 if (submission?.submitted_at) {
 // Submission exists - set submitted immediately to prevent swipe view
 // We'll validate picks match later, but for now, assume submitted
 isSubmitted = true;
 setSubmitted(true);
 setViewMode("list"); // CRITICAL: Set to list view immediately to prevent swipe cards from showing
 hasEverBeenSubmittedRef.current = true; // Mark that we've seen submitted
 setHasEverBeenSubmitted(true); // Persist in sessionStorage
 setSubmissionChecked(true);
 } else {
 setSubmitted(false);
 // Only trust sessionStorage if it exists AND there's an actual submission in the database
 // If sessionStorage says submitted but database says no submission, clear sessionStorage
 const sessionStorageCheck = getHasEverBeenSubmitted();
 if (sessionStorageCheck && submission?.submitted_at) {
 // Both sessionStorage and database agree - user has submitted
 setSubmitted(true);
 setViewMode("list"); // CRITICAL: Set to list view immediately to prevent swipe cards from showing
 isSubmitted = true;
 hasEverBeenSubmittedRef.current = true; // Sync ref with sessionStorage
 } else {
 // No submission in database - clear sessionStorage and ref
 if (sessionStorageCheck && !submission?.submitted_at) {
 // sessionStorage says submitted but database says no - clear it
 setHasEverBeenSubmitted(false);
 }
 hasEverBeenSubmittedRef.current = false;
 }
 setSubmissionChecked(true);
 }
 } else {
 // No user or no fixtures - mark as checked anyway
 if (alive) {
 setSubmitted(false);
 setSubmissionChecked(true);
 }
 }

 // Fetch user's picks
 let hasPicks = false;
 if (user?.id && fixturesData.length > 0 && !isSubmitted) {
 // Only fetch picks if not submitted (optimization)
 const { data: pk, error: pkErr } = await supabase
 .from("app_picks")
 .select("gw,fixture_index,pick")
 .eq("gw", gwToDisplay)
 .eq("user_id", user.id);

 if (!pkErr && pk && pk.length > 0) {
 // Get current fixture indices
 const currentFixtureIndices = new Set(fixturesData.map(f => f.fixture_index));
 
 // Check if picks match current fixtures
 // If picks exist but don't match ALL current fixtures, they're invalid (old picks for different games)
 const picksForCurrentFixtures = pk.filter((p: any) => currentFixtureIndices.has(p.fixture_index));
 
 // Only consider picks valid if:
 // 1. All current fixtures have picks
 // 2. No picks exist for non-existent fixtures
 // 3. Number of picks matches number of fixtures exactly
 const allFixturesHavePicks = fixturesData.every(f => picksForCurrentFixtures.some((p: any) => p.fixture_index === f.fixture_index));
 const noExtraPicks = picksForCurrentFixtures.length === fixturesData.length;
 const picksAreValid = allFixturesHavePicks && noExtraPicks && picksForCurrentFixtures.length > 0;
 
        if (picksAreValid) {
          // Picks are valid - use them
          const picksMap = new Map<number, Pick>();
          picksForCurrentFixtures.forEach((p: any) => {
            if (p && p.fixture_index !== undefined && p.pick) {
              picksMap.set(p.fixture_index, {
                fixture_index: p.fixture_index,
                pick: p.pick,
                matchday: p.gw || gwToDisplay // Use gw instead of matchday
              });
            }
          });
          
          // Always set picks, even if component appears to be unmounting
          if (picksMap.size > 0) {
            setPicks(picksMap);
            hasPicks = true;
          }
        } else {
          // Picks don't match current fixtures - but don't clear them if we have partial matches
          // Only clear if picks are completely invalid (no matches at all)
          if (pk.length > 0 && picksForCurrentFixtures.length === 0) {
            // No picks match current fixtures - clear invalid picks from database
            await supabase
              .from("app_picks")
              .delete()
              .eq("gw", gwToDisplay)
              .eq("user_id", user.id);
            setPicks(new Map());
            hasPicks = false;
          } else if (picksForCurrentFixtures.length > 0) {
            // Partial matches - use what we have
            const picksMap = new Map<number, Pick>();
            picksForCurrentFixtures.forEach((p: any) => {
              if (p && p.fixture_index !== undefined && p.pick) {
                picksMap.set(p.fixture_index, {
                  fixture_index: p.fixture_index,
                  pick: p.pick,
                  matchday: p.gw || gwToDisplay
                });
              }
            });
            if (picksMap.size > 0) {
              setPicks(picksMap);
              hasPicks = true;
            }
          }
        }
 }
 // ALWAYS load picks if user has submitted (even if not in cache) - just like HomePage does
 // This ensures picks are displayed even if cache is missing
 if ((isSubmitted || submitted) && user?.id && fixturesData.length > 0 && !hasPicks) {
 // User has submitted - fetch picks for display purposes
 const { data: pk, error: pkErr } = await supabase
 .from("app_picks")
 .select("gw,fixture_index,pick")
 .eq("gw", gwToDisplay)
 .eq("user_id", user.id);

 if (!pkErr && pk && pk.length > 0) {
 const currentFixtureIndices = new Set(fixturesData.map(f => f.fixture_index));
 const picksForCurrentFixtures = pk.filter((p: any) => currentFixtureIndices.has(p.fixture_index));
 
        if (picksForCurrentFixtures.length > 0) {
          const picksMap = new Map<number, Pick>();
          picksForCurrentFixtures.forEach((p: any) => {
            if (p && p.fixture_index !== undefined && p.pick) {
              picksMap.set(p.fixture_index, {
                fixture_index: p.fixture_index,
                pick: p.pick,
                matchday: p.gw || gwToDisplay
              });
            }
          });
          
          // CRITICAL: Always set picks, even if component appears to be unmounting
          // React will safely handle state updates even if component unmounts
          if (picksMap.size > 0) {
            setPicks(picksMap); // Remove alive check - always set picks
            hasPicks = true;
            
            // Cache picks for instant load next time (like HomePage does)
            if (user?.id) {
              const picksArray = Array.from(picksMap.values());
              const cacheKey = `predictions:${user.id}:${gwToDisplay}`;
              try {
                const existingCache = getCached<{
                  fixtures: Fixture[];
                  picks: Array<{ fixture_index: number; pick: "H" | "D" | "A"; matchday: number }>;
                  submitted: boolean;
                  results: Array<{ fixture_index: number; result: "H" | "D" | "A" }>;
                }>(cacheKey);
                
                if (existingCache) {
                  setCached(cacheKey, {
                    ...existingCache,
                    picks: picksArray,
                  }, CACHE_TTL.PREDICTIONS);
                }
              } catch (cacheError) {
                // Failed to cache (non-critical)
              }
            }
          }
        }
        }
 }
 
 // Validate submission is still valid (picks match)
 if (!hasPicks) {
 // Submission exists but picks don't match - clear the submission
 setSubmitted(false);
 await supabase
 .from("app_gw_submissions")
 .delete()
 .eq("gw", gwToDisplay)
 .eq("user_id", user.id);
 }
 }
 
 // Check if all members have submitted
 if (alive && fixturesData.length > 0 && user?.id) {
 // Get user's leagues and their members
 const { data: userLeagues } = await supabase
 .from("league_members")
 .select("league_id")
 .eq("user_id", user.id);
 
 if (userLeagues && userLeagues.length > 0) {
 const leagueIds = userLeagues.map(l => l.league_id);
 // Get all members of user's leagues
 const { data: membersData } = await supabase
 .from("league_members")
 .select("user_id, users!inner(id, name)")
 .in("league_id", leagueIds);
 
if (membersData) {
// Deduplicate members by user ID (user can be in multiple leagues)
const membersMap = new Map<string, { id: string; name: string }>();
membersData.forEach((m: any) => {
const userId = m.user_id;
if (!membersMap.has(userId)) {
membersMap.set(userId, {
id: userId,
name: m.users?.name || "Unknown"
});
}
});
const members = Array.from(membersMap.values());

if (alive) {
setLeagueMembers(members);
}
 
 const memberIds = members.map((m: any) => m.id);
 
 // Fetch all submissions for API Test league members
 const { data: allSubmissions } = await supabase
 .from("app_gw_submissions")
 .select("user_id, submitted_at")
 .eq("gw", gwToDisplay)
 .in("user_id", memberIds)
 .not("submitted_at", "is", null);
 
 // Fetch all picks for validation
 const { data: allPicks } = await supabase
 .from("app_picks")
 .select("user_id, fixture_index")
 .eq("gw", gwToDisplay)
 .in("user_id", memberIds);
 
 const currentFixtureIndicesSet = new Set(fixturesData.map(f => f.fixture_index));
 const requiredFixtureCount = currentFixtureIndicesSet.size;
 const cutoffDate = new Date('2025-11-18T00:00:00Z');
 
 // Validate submissions - same logic as League.tsx
 const validSubmissions = new Set<string>();
 
 if (allSubmissions && allPicks && requiredFixtureCount > 0) {
 allSubmissions.forEach((sub: any) => {
 const userPicks = (allPicks ?? []).filter((p: any) => p.user_id === sub.user_id);
 const picksForCurrentFixtures = userPicks.filter((p: any) => currentFixtureIndicesSet.has(p.fixture_index));
 const hasAllRequiredPicks = picksForCurrentFixtures.length === requiredFixtureCount;
 
 const uniqueFixtureIndices = new Set(picksForCurrentFixtures.map((p: any) => p.fixture_index));
 const hasExactMatch = uniqueFixtureIndices.size === requiredFixtureCount;
 
 const submissionDate = sub.submitted_at ? new Date(sub.submitted_at) : null;
 const isRecentSubmission = submissionDate && submissionDate >= cutoffDate;
 
 if (hasAllRequiredPicks && hasExactMatch && isRecentSubmission) {
 validSubmissions.add(sub.user_id);
 }
 });
 }
 
 const allSubmitted = memberIds.length > 0 && validSubmissions.size === memberIds.length;
 
 if (alive) {
 setAllMembersSubmitted(allSubmitted);
 setSubmittedMemberIds(validSubmissions);
 }
 }
 }
 }
 
 // Mark that we've checked for picks - ALWAYS set this, even if there was an error or component unmounting
 setPicksChecked(true);
 // Ensure submissionChecked is set (in case it wasn't set above)
 setSubmissionChecked(true);
 
 // If user has picks for ALL current fixtures but not submitted, show review mode
 // If no picks or incomplete picks, show swipe mode (currentIndex = 0)
 // If submitted with valid picks, we'll show confirmed predictions view (separate from review)
 if (alive && fixturesData.length > 0) {
 if (hasPicks && !isSubmitted) {
 // User has made all picks but not submitted - show review
 setCurrentIndex(fixturesData.length);
 } else if (isSubmitted && hasPicks) {
 // User has submitted with valid picks - show confirmed predictions
 // currentIndex will be handled by the submitted check in render
 } else {
 // No picks or incomplete picks or invalid submission - start at swipe mode (index 0)
 setCurrentIndex(0);
 setViewMode("cards"); // Ensure we're in swipe/cards mode
 }
 }
 
 // 2. Cache the fresh data for instant load on next visit
 if (alive && fixturesData.length > 0 && user?.id) {
 try {
 // Convert picks Map to array for caching
 const picksArray: Array<{ fixture_index: number; pick: "H" | "D" | "A"; matchday: number }> = [];
 picks.forEach((pick, fixture_index) => {
 picksArray.push({ fixture_index, pick: pick.pick, matchday: pick.matchday });
 });
 
 // Convert results Map to array for caching
 const resultsArray: Array<{ fixture_index: number; result: "H" | "D" | "A" }> = [];
 results.forEach((result, fixture_index) => {
 resultsArray.push({ fixture_index, result });
 });
 
 setCached(cacheKey, {
 fixtures: fixturesData,
 picks: picksArray,
 submitted: isSubmitted,
 results: resultsArray,
 }, CACHE_TTL.PREDICTIONS);
 } catch (cacheError) {
 // Failed to cache (non-critical)
 }
 }
 } catch (error) {
 if (alive) {
 // Always mark as checked even on error to prevent infinite loading
 setPicksChecked(true);
 setSubmissionChecked(true);
 setLoading(false);
 }
 } finally {
 // Always set loading to false, even if component unmounted
 // This prevents infinite loading states
 setLoading(false);
 // Also ensure checked flags are set to prevent blocking
 if (!alive) {
 setPicksChecked(true);
 setSubmissionChecked(true);
 }
 }
 })();

 return () => {
 alive = false;
 };
}, [displayGw, user?.id]);

 // Live scores are now handled by useLiveScores hook via Supabase real-time

// Update results map based on live scores
// CRITICAL: Preserve existing results from app_gw_results and only update/add from live scores
// This prevents clearing final results when live scores are empty or incomplete
useEffect(() => {
 // Start with existing results (preserve final results from app_gw_results)
 const updatedResults = new Map<number, "H" | "D" | "A">(results);
 let hasChanges = false;
 
 // Update/add results from live scores for fixtures that have live score data
 const fixturesToCheck = fixtures;
 fixturesToCheck.forEach((f) => {
 const liveScore = liveScores[f.fixture_index];
 if (liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED')) {
 // Determine outcome from live score
 let newResult: "H" | "D" | "A";
 if (liveScore.homeScore > liveScore.awayScore) {
 newResult = 'H';
 } else if (liveScore.awayScore > liveScore.homeScore) {
 newResult = 'A';
 } else {
 newResult = 'D';
 }
 // Only update if result is different (prevents unnecessary updates)
 const existingResult = updatedResults.get(f.fixture_index);
 if (existingResult !== newResult) {
 updatedResults.set(f.fixture_index, newResult);
 hasChanges = true;
 }
 }
 });
 
 // Only update state if there are actual changes (prevents infinite loops)
 if (hasChanges) {
 setResults(updatedResults);
 }
 }, [liveScores, fixtures, results]);

 // Fetch pick percentages for all fixtures after deadline has passed
 useEffect(() => {
 const deadlineHasPassed = gameState === 'DEADLINE_PASSED' || gameState === 'RESULTS_PRE_GW' || gameState === 'LIVE';
 if (!currentGw || !deadlineHasPassed || fixtures.length === 0) {
 setPickPercentages(new Map());
 return;
 }

 (async () => {
 try {
 // Fetch all picks for the current gameweek
 const { data: allPicks, error: picksError } = await supabase
 .from("app_picks")
 .select("fixture_index, pick")
 .eq("gw", currentGw);

 if (picksError) {
 return;
 }

 if (!allPicks || allPicks.length === 0) {
 setPickPercentages(new Map());
 return;
 }

 // Calculate percentages for each fixture
 const percentagesMap = new Map<number, { H: number; D: number; A: number }>();
 
 fixtures.forEach(fixture => {
 const fixturePicks = allPicks.filter(p => p.fixture_index === fixture.fixture_index);
 const total = fixturePicks.length;
 
 if (total === 0) {
 percentagesMap.set(fixture.fixture_index, { H: 0, D: 0, A: 0 });
 return;
 }

 const hCount = fixturePicks.filter(p => p.pick === 'H').length;
 const dCount = fixturePicks.filter(p => p.pick === 'D').length;
 const aCount = fixturePicks.filter(p => p.pick === 'A').length;

 percentagesMap.set(fixture.fixture_index, {
 H: Math.round((hCount / total) * 100),
 D: Math.round((dCount / total) * 100),
 A: Math.round((aCount / total) * 100),
 });
 });

 setPickPercentages(percentagesMap);
 } catch (error) {
 setPickPercentages(new Map());
 }
 })();
 }, [currentGw, gameState, fixtures]);

// Calculate top percentage when we have results and picks
// Use app_v_gw_points view for consistency with other components (UserPicksModal, LeaderboardCard)
// Note: Can calculate even without results if we have picks and fixtures (for live games)
useEffect(() => {
  if (!currentGw || !user?.id || fixtures.length === 0) {
    setTopPercent(null);
    return;
  }
  
  // If no results yet, we can still calculate rank from picks (for live games)
  // Only skip if we have no picks AND no results
  if (results.size === 0 && picks.size === 0) {
    setTopPercent(null);
    return;
  }

  // Calculate top percentage using app_v_gw_points view (same as UserPicksModal)
 (async () => {
 try {
 // Use app_v_gw_points view for consistency - this is the authoritative source
 const { data: gwPointsData, error: gwPointsError } = await supabase
 .from('app_v_gw_points')
 .select('user_id, points')
 .eq('gw', currentGw);

 if (gwPointsError) {
 setTopPercent(null);
 return;
 }

 if (!gwPointsData || gwPointsData.length === 0) {
 setTopPercent(null);
 return;
 }

 // Sort by points descending
 const sorted = [...gwPointsData].sort((a, b) => (b.points || 0) - (a.points || 0));
 
 // Find user's rank (handling ties - same rank for same points)
 let userRank = 1;
 for (let i = 0; i < sorted.length; i++) {
 if (i > 0 && sorted[i - 1].points !== sorted[i].points) {
 userRank = i + 1;
 }
 if (sorted[i].user_id === user.id) {
 break;
 }
 }

 // Calculate rank percentage: (rank / total_users) * 100
 const totalUsers = sorted.length;
 const rankPercent = Math.round((userRank / totalUsers) * 100);
 
 setTopPercent(rankPercent);
 } catch (error) {
 setTopPercent(null);
 }
 })();
 }, [results, picks, fixtures, currentGw, user?.id]);


 const currentFixture = fixtures[currentIndex];

 const myScore = useMemo(() => {
 let score = 0;
 fixtures.forEach(f => {
 const r = results.get(f.fixture_index);
 const p = picks.get(f.fixture_index);
 if (r && p && p.pick === r) score += 1;
 });
 return score;
 }, [fixtures, results, picks]);

 const handleStart = (clientX: number, clientY: number) => {
 if (isAnimating || submitted) return;
 setIsDragging(true);
 startPosRef.current = { x: clientX, y: clientY };
  lastDeltaRef.current = { x: 0, y: 0 };
 setShowFeedback(null);
 };
 const handleMove = (clientX: number, clientY: number) => {
 if (!isDragging || isAnimating || submitted) return;
 const deltaX = clientX - startPosRef.current.x;
 const deltaY = clientY - startPosRef.current.y;
  lastDeltaRef.current = { x: deltaX, y: deltaY };
 const rotation = deltaX * 0.1;
 setCardState({ x: deltaX, y: deltaY, rotation, opacity: 1, scale: 1 });
 if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
 setShowFeedback(deltaX > 0 ? "away" : "home");
 } else if (deltaY > 50 && deltaY > Math.abs(deltaX)) {
 setShowFeedback("draw");
 } else {
 setShowFeedback(null);
 }
 };
 const handleEnd = () => {
 if (!isDragging || isAnimating || submitted) return;
 setIsDragging(false);
  const { x, y } = lastDeltaRef.current;
 const threshold = 100;
 let pick: "H" | "D" | "A" | null = null;
 if (Math.abs(x) > threshold && Math.abs(x) > Math.abs(y)) pick = x > 0 ? "A" : "H";
 else if (y > threshold && y > Math.abs(x)) pick = "D";
 if (pick) animateCardOut(pick);
 else { setCardState({ x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 }); setShowFeedback(null); }
 };

 const handleTouchStart: TouchEventHandler<HTMLDivElement> = (e) => {
 if (e.touches.length !== 1) return;
 handleStart(e.touches[0].clientX, e.touches[0].clientY);
 };

 const handleTouchMove: TouchEventHandler<HTMLDivElement> = (e) => {
 if (e.touches.length !== 1) return;
 if (!isDragging) return;
 e.preventDefault();
 handleMove(e.touches[0].clientX, e.touches[0].clientY);
 };

 const handleTouchEnd: TouchEventHandler<HTMLDivElement> = (e) => {
 if (e.touches.length > 0) return;
 e.preventDefault();
 handleEnd();
 };

 const animateCardOut = async (pick: "H" | "D" | "A") => {
 setIsAnimating(true);
 setShowFeedback(null);
 const direction = pick === "H" ? -1 : pick === "A" ? 1 : 0;
 const targetX = direction * window.innerWidth;
 const targetY = pick === "D" ? window.innerHeight : 0;
 setCardState({ x: targetX, y: targetY, rotation: direction * 30, opacity: 0, scale: 0.8 });
 await savePick(pick);
 setTimeout(() => {
 isResettingRef.current = true;
 if (returnToReview) { setCurrentIndex(fixtures.length); setReturnToReview(false); }
 else { setCurrentIndex(currentIndex + 1); }
 setCardState({ x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 });
 requestAnimationFrame(() => { isResettingRef.current = false; setIsAnimating(false); });
 }, 300);
 };
 const handleButtonClick = (pick: "H" | "D" | "A") => { 
 if (!isAnimating && !submitted) animateCardOut(pick); 
 };
 
 const savePick = (pick: "H" | "D" | "A") => {
 if (!currentFixture || !currentGw) return;
 
 // Only update local state - don't save to database until confirmed
 const newPicks = new Map(picks);
 newPicks.set(currentFixture.fixture_index, { 
 fixture_index: currentFixture.fixture_index, 
 pick, 
 matchday: currentGw // Keep matchday for Pick type compatibility
 });
 setPicks(newPicks);

 // #region agent log
 debugPost({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'src/pages/Predictions.tsx:savePick',message:'savePick (local state update)',data:{gw:currentGw,fixture_index:currentFixture.fixture_index,pick},timestamp:Date.now()});
 // #endregion agent log
 };
 
 const handleConfirmClick = async () => {
 if (!allPicksMade) {
 setConfirmCelebration({ success: false, message: "You still have fixtures to call!" });
 setTimeout(() => setConfirmCelebration(null), 2200);
 return;
 }
 
 if (!user?.id || !currentGw) return;

 try {
  // #region agent log
  (() => {
    const pickValues = Array.from(picks.values());
    const matchdayCounts: Record<string, number> = {};
    const pickCounts: Record<string, number> = {};
    for (const p of pickValues) {
      matchdayCounts[String(p.matchday)] = (matchdayCounts[String(p.matchday)] ?? 0) + 1;
      pickCounts[p.pick] = (pickCounts[p.pick] ?? 0) + 1;
    }
    const p0 = picks.get(0)?.pick ?? null;
    debugPost({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'src/pages/Predictions.tsx:handleConfirmClick:entry',message:'confirmClick entry snapshot',data:{gw:currentGw,userIdPrefix:user.id.slice(0,8),fixturesLen:fixtures.length,picksSize:picks.size,p0,matchdayCounts,pickCounts},timestamp:Date.now()});
  })();
  // #endregion agent log

 // CRITICAL: Ensure we're not already submitted (safety check)
 const { data: existingSubmission } = await supabase
 .from('app_gw_submissions')
 .select('submitted_at')
 .eq('user_id', user.id)
 .eq('gw', currentGw)
 .maybeSingle();
 
 if (existingSubmission?.submitted_at) {
 setSubmitted(true);
 return;
 }
 
 // Save all picks - CRITICAL: Only save picks that match current fixtures
 const picksArray = Array.from(picks.values())
 .filter(pick => pick.matchday === currentGw) // Safety: only current GW
 .map(pick => ({
 user_id: user.id,
 gw: currentGw,
 fixture_index: pick.fixture_index,
 pick: pick.pick
 }));

  // #region agent log
  (() => {
    const counts: Record<string, number> = {};
    for (const p of picksArray) counts[p.pick] = (counts[p.pick] ?? 0) + 1;
    const p0 = picksArray.find((p) => p.fixture_index === 0)?.pick ?? null;
    debugPost({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'src/pages/Predictions.tsx:handleConfirmClick:picksArray',message:'built picksArray for upsert',data:{gw:currentGw,userIdPrefix:user.id.slice(0,8),picksArrayLen:picksArray.length,fixturesLen:fixtures.length,p0,counts,sample:picksArray.slice(0,3)},timestamp:Date.now()});
  })();
  // #endregion agent log

 if (picksArray.length !== fixtures.length) {
 throw new Error(`Expected ${fixtures.length} picks but got ${picksArray.length}`);
 }

 const { error: picksError } = await supabase
 .from('app_picks')
 .upsert(picksArray, { 
 onConflict: 'user_id,gw,fixture_index',
 ignoreDuplicates: false 
 });

 if (picksError) {
 throw picksError;
 }

  // #region agent log
  debugPost({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'src/pages/Predictions.tsx:handleConfirmClick:afterUpsert',message:'app_picks upsert returned ok',data:{gw:currentGw,userIdPrefix:user.id.slice(0,8)},timestamp:Date.now()});
  // #endregion agent log

  // Immediately read back from DB (app_picks + picks) to detect trigger rewrites.
  // NOTE: app_picks.updated_at is not guaranteed to change on updates (no automatic trigger), so we must compare values, not timestamps.
  // #region agent log
  (async () => {
    try {
      const [appRead, webRead] = await Promise.all([
        supabase.from('app_picks').select('fixture_index,pick').eq('gw', currentGw).eq('user_id', user.id),
        supabase.from('picks').select('fixture_index,pick').eq('gw', currentGw).eq('user_id', user.id),
      ]);
      const appRows = (appRead.data ?? []) as Array<{fixture_index:number;pick:"H"|"D"|"A"}>;
      const webRows = (webRead.data ?? []) as Array<{fixture_index:number;pick:"H"|"D"|"A"}>;
      const toMap = (rows: Array<{fixture_index:number;pick:"H"|"D"|"A"}>) => {
        const m = new Map<number, "H" | "D" | "A">();
        rows.forEach(r => m.set(r.fixture_index, r.pick));
        return m;
      };
      const a = toMap(appRows);
      const w = toMap(webRows);
      const p0App = a.get(0) ?? null;
      const p0Web = w.get(0) ?? null;
      debugPost({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'src/pages/Predictions.tsx:handleConfirmClick:readback',message:'readback after submit',data:{gw:currentGw,userIdPrefix:user.id.slice(0,8),appLen:appRows.length,webLen:webRows.length,p0App,p0Web,appFirst3:appRows.sort((x,y)=>x.fixture_index-y.fixture_index).slice(0,3),webFirst3:webRows.sort((x,y)=>x.fixture_index-y.fixture_index).slice(0,3)},timestamp:Date.now()});
    } catch {
      debugPost({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'src/pages/Predictions.tsx:handleConfirmClick:readback',message:'readback after submit failed',data:{gw:currentGw,userIdPrefix:user.id.slice(0,8)},timestamp:Date.now()});
    }
  })();
  // #endregion agent log

 // Save submission - CRITICAL: Only create submission after picks are saved successfully
 // This ensures picks and submission are in sync
 const { error: submissionError } = await supabase
 .from('app_gw_submissions')
 .upsert({
 user_id: user.id,
 gw: currentGw,
 submitted_at: new Date().toISOString()
 }, {
 onConflict: 'user_id,gw'
 });

 if (submissionError) {
 throw submissionError;
 }

 setSubmitted(true);
 hasEverBeenSubmittedRef.current = true;
 setHasEverBeenSubmitted(true); // Persist in sessionStorage immediately
 // Invalidate cache so fresh data loads
 if (user?.id) {
 invalidateUserCache(user.id);
 }
 
 // Show confetti
 setShowConfetti(true);
 
 // Dispatch event for bottom nav
 window.dispatchEvent(new Event('predictionsSubmitted'));
 
 // Set flag for home page to show confetti and navigate immediately
 sessionStorage.setItem('showConfettiOnHome', 'true');
 // Navigate and scroll to top immediately
 navigate("/");
 window.scrollTo({ top: 0, behavior: 'instant' });
 
 // Stop confetti after a brief moment
 setTimeout(() => {
 setShowConfetti(false);
 }, 1000);

 // Check if all members have submitted and notify (fire-and-forget)
 if (user?.id && currentGw) {
 (async () => {
 try {
 const { data: userLeagues } = await supabase
 .from('league_members')
 .select('league_id')
 .eq('user_id', user.id);
 
if (userLeagues && userLeagues.length > 0) {
// Call notifyFinalSubmission for each league (fire-and-forget)
userLeagues.forEach(({ league_id }) => {
fetch('/.netlify/functions/notifyFinalSubmission', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
leagueId: league_id,
gw: currentGw,
}),
}).catch(() => {
// Failed to check final submission (non-critical)
});
});
}
 } catch (err: any) {
 // Failed to fetch user leagues (non-critical)
 }
 })();
 }
 } catch (error) {
 setConfirmCelebration({ success: false, message: "Failed to confirm predictions. Please try again." });
 setTimeout(() => setConfirmCelebration(null), 2200);
 }
 };

 // Never show swipe view until we know for sure the user hasn't submitted
 // Don't render until we know submission status and have fixtures
 // This prevents blank screens and swipe card flashes
 // Game state is used to determine if we should show swipe, but we don't block on it loading
 // If game state is still loading or null, default to not showing swipe (safer default)
 // Check finished/live/deadline states first to avoid TypeScript narrowing issues
 const isFinishedOrLive = gameState === 'RESULTS_PRE_GW' || gameState === 'LIVE';
 const isDeadlinePassed = gameState === 'DEADLINE_PASSED';
 const canShowSwipePredictions = !gameStateLoading && gameState !== null && !isDeadlinePassed && (gameState === 'GW_OPEN' || gameState === 'GW_PREDICTED');
 // If data has been loaded before (even if component remounted), be more lenient with loading check
 // This prevents infinite loading when useEffect restarts due to dependency changes
 // Simplified: only check fixtures.length directly in needsMoreData condition
 // SIMPLIFIED: If deadline has passed (DEADLINE_PASSED, RESULTS_PRE_GW, or LIVE), skip loading checks and show the page
 // This allows users to see the predictions list even if they haven't predicted
 // SAFE: Only show picks if we're CERTAIN deadline has passed (state is not null)
 const deadlinePassed = gameState !== null && 
 (gameState === 'DEADLINE_PASSED' || gameState === 'RESULTS_PRE_GW' || gameState === 'LIVE');
 
 // Only block loading if deadline hasn't passed AND we're still loading AND have no fixtures
 // If deadline has passed, always show the page (even with empty fixtures - we'll show a message)
 // CRITICAL: If fixtures.length > 0, render immediately (fixtures loaded from cache or DB)
 // Only block if we're still loading AND have no fixtures
 const needsMoreData = !deadlinePassed && loading && fixtures.length === 0;
 
 if (needsMoreData) {
 // Show loading spinner - don't render any content until ready
 return (
 <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C8376]"></div>
 </div>
 );
 }
 
 // Additional loading check removed - the condition at line 1858 already handles this case
 // Don't block on picksChecked/submissionChecked if fixtures are loaded
 // The flags will be set in the useEffect, but we don't need to block if fixtures are loaded
 // Only block if we're still loading AND have no fixtures
 // If fixtures.length > 0, render immediately (flags set async in useEffect)
 // This prevents hanging when user moves to new gameweek

 if (fixtures.length === 0) {
 return (
 <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
 <div className="text-center px-4 max-w-md">
 <div className="text-red-600 dark:text-red-400 font-semibold mb-2">No Fixtures Found</div>
 <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
 No fixtures available for this gameweek yet.
 </div>
 </div>
 </div>
 );
 }

// Confirmed Predictions View (after submission OR when deadline has passed)
// Check both state and sessionStorage for maximum safety
const sessionStorageCheck = getHasEverBeenSubmitted();
const isUserSubmitted = submitted || (!submissionChecked && sessionStorageCheck);
// If deadline has passed, show the same view as submitted users (but with empty predictions)
if (isUserSubmitted || deadlinePassed) {
// Always show user's predictions - don't show league member status here
// (League member status belongs in League page, not PredictionsPage)
return (
 <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
 {showConfetti && windowSize.width > 0 && windowSize.height > 0 && (
 <Confetti
 width={windowSize.width}
 height={windowSize.height}
 recycle={false}
 numberOfPieces={500}
 gravity={0.3}
 />
 )}
 <div className="p-4">
 <div className="max-w-2xl mx-auto">
 <div className="relative flex items-center justify-center">
 {!isUserSubmitted && (
 <button 
 onClick={() => navigate("/")} 
 className="absolute left-0 text-slate-600 dark:text-slate-400 text-3xl font-bold w-10 h-10 flex items-center justify-center"
 >
 ✕
 </button>
 )}
 <span className="text-lg font-extrabold text-slate-700 dark:text-slate-200">
 Gameweek {currentGw}
 </span>
 </div>
 </div>
 </div>
 <div className="flex-1 overflow-y-auto p-4 pb-4 bg-slate-50 dark:bg-slate-900">
 <div className="max-w-2xl mx-auto">
 {/* Show deadline banner only for DEADLINE_PASSED state when user hasn't submitted */}
 {gameState === 'DEADLINE_PASSED' && !isUserSubmitted && (
 <div className="mb-4">
 <div className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-700 px-6 py-4 text-center">
 <div className="flex items-center justify-center mb-3 relative">
 <img 
 src="/assets/Volley/Volley-sad.png" 
 alt="Volley" 
 className="w-16 h-16 flex-shrink-0 object-contain absolute -left-8 -top-2"
 style={{ imageRendering: 'pixelated' }}
 />
 <div className="text-slate-900 dark:text-slate-100 font-semibold text-base text-center">
 THE DEADLINE HAS PASSED
 </div>
 </div>
 <div className="text-slate-900 dark:text-slate-200 text-sm">
 Predictions are no longer available.
 {deadlineTime && (
 <div className="text-xs opacity-80">
 The deadline was {deadlineTime.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at {deadlineTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.
 </div>
 )}
 <div className="text-xs opacity-80">
 Make sure you submit before the next deadline.
 </div>
 </div>
 </div>
 </div>
 )}
 {/* Score indicator at the top - full width with progress bar */}
 {(() => {
 // Check if any games have started (live or finished)
 const hasAnyLiveOrFinished = fixtures.length > 0 && fixtures.some(f => {
 const liveScore = liveScores[f.fixture_index];
 return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED');
 });
 
 // Check if any games are currently live (IN_PLAY or PAUSED)
 const hasLiveGames = fixtures.length > 0 && fixtures.some(f => {
 const liveScore = liveScores[f.fixture_index];
 return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
 });
 
 // Check if all fixtures are finished
 const allFinished = fixtures.length > 0 && fixtures.every(f => {
 const liveScore = liveScores[f.fixture_index];
 return liveScore && liveScore.status === 'FINISHED';
 });
 
 // Check if fixtures are starting soon (have kickoff time in future, no live score yet)
 const now = new Date();
 const hasStartingSoon = fixtures.length > 0 && fixtures.some(f => {
 if (!f.kickoff_time) return false;
 const kickoffTime = new Date(f.kickoff_time);
 const liveScore = liveScores[f.fixture_index];
 const hasNotStarted = !liveScore || (liveScore.status !== 'IN_PLAY' && liveScore.status !== 'PAUSED' && liveScore.status !== 'FINISHED');
 return hasNotStarted && kickoffTime > now;
 });
 
 // Determine state using centralized game state system (PR.md rule 10)
 // GW is LIVE when: first kickoff happened AND last game hasn't finished (FT)
 let state: 'starting-soon' | 'live' | 'finished' = 'finished';
 
 // Primary: use centralized game state system
 if (!gameStateLoading && gameState !== null) {
 if (gameState === 'LIVE') {
 state = 'live';
 } else if (gameState === 'RESULTS_PRE_GW') {
 state = 'finished';
 } else if (gameState === 'DEADLINE_PASSED') {
 // Deadline passed but games haven't started - show as finished (no predictions allowed)
 state = 'finished';
 } else if (gameState === 'GW_OPEN' || gameState === 'GW_PREDICTED') {
 // Before deadline - check if starting soon
 if (hasStartingSoon && !hasAnyLiveOrFinished) {
 state = 'starting-soon';
 } else {
 state = 'finished'; // Default for pre-kickoff
 }
 }
 } else {
 // Fallback while loading: use local checks
 if (hasLiveGames) {
 state = 'live';
 } else if (hasStartingSoon && !hasAnyLiveOrFinished) {
 state = 'starting-soon';
 } else if (allFinished) {
 state = 'finished';
 }
 }
 
 // Calculate current score
 let currentScore = 0;
 if (hasAnyLiveOrFinished) {
 fixtures.forEach(f => {
 const liveScore = liveScores[f.fixture_index];
 const pickObj = picks.get(f.fixture_index);
 
 if (liveScore && pickObj) {
 // Check if pick is currently correct (for both live and finished games)
 let isCorrect = false;
 if (pickObj.pick === 'H' && liveScore.homeScore > liveScore.awayScore) isCorrect = true;
 else if (pickObj.pick === 'A' && liveScore.awayScore > liveScore.homeScore) isCorrect = true;
 else if (pickObj.pick === 'D' && liveScore.homeScore === liveScore.awayScore) isCorrect = true;
 
 // Count correct picks for both live and finished games
 if (isCorrect) currentScore++;
 }
 });
 } else if (submitted) {
 // Calculate score from results if available
 fixtures.forEach(f => {
 const r = results.get(f.fixture_index);
 const p = picks.get(f.fixture_index);
 if (r && p && r === p.pick) {
 currentScore++;
 }
 });
 }
 
// Show score indicator:
// - Pre-deadline: show (even with 0 picks) so users can see it update as they make picks.
// - Post-deadline: only show if the user actually has picks/submitted (otherwise it's just "0/10" noise).
const hasPicks = picks.size > 0;
if (fixtures.length > 0 && (!deadlinePassed || hasPicks || isUserSubmitted)) {
  
  // Calculate score: prefer results Map (from app_gw_results) over live scores
  // This matches HomePage behavior - use final results when available
  let displayScore = 0;
  
  if (hasPicks) {
    if (results.size > 0) {
      // Use results Map (from app_gw_results) - most accurate
      displayScore = myScore;
    } else if (hasAnyLiveOrFinished) {
      // Fall back to live scores if results not loaded yet
      displayScore = currentScore;
    } else if (submitted) {
      // If submitted but no results yet, try to use myScore anyway (might be calculated from cache)
      displayScore = myScore;
    }
  }
  
  return (
    <ScoreIndicator
      score={displayScore}
      total={fixtures.length}
      topPercent={topPercent}
      state={state}
      gameweek={currentGw}
      gameStateLoading={gameStateLoading}
    />
  );
}

return null;
 })()}
 
 <div className="space-y-6 [&>div:first-child]:mt-0">
 {(() => {
 // Use ref for GW check since state updates are async - ref updates synchronously
 const gwToRender = currentGw || fixturesGwRef.current;
 // CRITICAL: Don't render fixtures until we have a valid GW and fixtures match it
 // This prevents flash of old data from previous renders
 if (!gwToRender || fixtures.length === 0) {
   return null;
 }
 
 // CRITICAL: Filter fixtures to only include those matching current GW BEFORE grouping
 // This prevents flash of old data from previous renders
 const filteredFixtures = fixtures.filter(f => f.gw === gwToRender);
 
 // If no fixtures match the current GW, don't render anything (prevents flash)
 if (filteredFixtures.length === 0) {
   return null;
 }
 
 const grouped: Array<{ label: string; items: typeof fixtures }>=[];
 let currentDate=''; let currentGroup: typeof fixtures = [];
 filteredFixtures.forEach((fixture)=>{
 const fixtureDate = fixture.kickoff_time ? new Date(fixture.kickoff_time).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}) : 'No date';
 if (fixtureDate!==currentDate){ if(currentGroup.length>0){ grouped.push({label:currentDate,items:currentGroup}); } currentDate=fixtureDate; currentGroup=[fixture]; } else { currentGroup.push(fixture); }
 });
 if(currentGroup.length>0){ grouped.push({label:currentDate,items:currentGroup}); }
 return grouped.map((group,groupIdx)=>{
 return (
 <div key={groupIdx} className={groupIdx > 0 ? "mt-6" : ""}>
 <DateHeader date={group.label} />
 <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 overflow-hidden border-0">
 <ul>
 {group.items.map((fixture, index)=>{
   const pick = picks.get(fixture.fixture_index);
   const liveScore = liveScores[fixture.fixture_index];

 // CRITICAL: Only render fixtures that match the current GW to prevent flash of old data
 if (fixture.gw !== currentGw) {
   return null;
 }

 // Convert fixture to FixtureCard format
 const fixtureCardFixture: FixtureCardFixture = {
 id: fixture.id,
 gw: fixture.gw,
 fixture_index: fixture.fixture_index,
 home_code: fixture.home_code,
 away_code: fixture.away_code,
 home_team: fixture.home_team,
 away_team: fixture.away_team,
 home_name: fixture.home_name,
 away_name: fixture.away_name,
 kickoff_time: fixture.kickoff_time,
 api_match_id: fixture.api_match_id,
 };

 // Convert liveScore to FixtureCard format
 const fixtureCardLiveScore: FixtureCardLiveScore | null = liveScore ? {
 status: liveScore.status,
 minute: liveScore.minute ?? null,
 homeScore: liveScore.homeScore,
 awayScore: liveScore.awayScore,
 home_team: liveScore.home_team,
 away_team: liveScore.away_team,
 goals: liveScore.goals ?? undefined,
 red_cards: liveScore.red_cards ?? undefined,
 } : null;

 // Only show pick buttons before deadline (GW_OPEN or GW_PREDICTED)
 const canMakePicks = !gameStateLoading && gameState !== null && 
   (gameState === 'GW_OPEN' || gameState === 'GW_PREDICTED');
 
 const percentagesForFixture = pickPercentages.get(fixture.fixture_index) || null;
 return (
 <li
 key={fixture.id}
 className={index > 0 ? "border-t border-slate-200 dark:border-slate-700" : ""}
 >
 <FixtureCard
 fixture={fixtureCardFixture}
 pick={pick?.pick}
 liveScore={fixtureCardLiveScore}
 isTestApi={false}
 showPickButtons={canMakePicks}
 pickPercentages={percentagesForFixture}
 />
 </li>
 );
 })}
 </ul>
 </div>
 </div>
 );
 });
 })()}
 </div>
 </div>
 </div>
 </div>
 );
 }

 // NEVER show swipe view if submitted - this is critical!
 // Use both state, ref, and sessionStorage for maximum safety
 // Only trust the ref/sessionStorage if they match the actual submission check
 const sessionStorageSubmittedReview = getHasEverBeenSubmitted();
 // Only trust state - if state says not submitted, clear sessionStorage and proceed
 if (!submitted && sessionStorageSubmittedReview && submissionChecked) {
 // sessionStorage says submitted but state says no - clear it and proceed
 setHasEverBeenSubmitted(false);
 hasEverBeenSubmittedRef.current = false;
 }

// Review Mode (when picks exist but not submitted)
if (currentIndex >= fixtures.length) {
return (
<div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
 {showConfetti && windowSize.width > 0 && windowSize.height > 0 && (
 <Confetti
 width={windowSize.width}
 height={windowSize.height}
 recycle={false}
 numberOfPieces={500}
 gravity={0.3}
 />
 )}
 {confirmCelebration && (
 <ConfirmationModal
 success={confirmCelebration.success}
 message={confirmCelebration.message}
 onClose={() => setConfirmCelebration(null)}
 />
 )}
 <div className="p-4">
 <div className="max-w-2xl mx-auto">
 <div className="relative flex items-center justify-center">
 {!isUserSubmitted && (
 <button 
 onClick={() => navigate("/")} 
 className="absolute left-0 text-slate-600 dark:text-slate-400 text-3xl font-bold w-10 h-10 flex items-center justify-center"
 >
 ✕
 </button>
 )}
 <span className="text-lg font-extrabold text-slate-700 dark:text-slate-200">Review Mode</span>
 {allPicksMade && !submitted ? (
 <button
 onClick={handleConfirmClick}
 className="absolute right-0 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white shadow"
 >
 Confirm
 </button>
) : submitted ? (
<span className="absolute right-0 text-sm text-emerald-600 dark:text-emerald-400 font-semibold">✓ Submitted</span>
 ) : picks.size > 0 ? (
 <button
 onClick={handleConfirmClick}
 className="absolute right-0 inline-flex items-center gap-2 rounded-full bg-slate-200 dark:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 shadow-inner"
 >
 Confirm
 </button>
 ) : (
 <button
 onClick={() => setCurrentIndex(0)}
 className="absolute right-0 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-md"
 >
 Swipe View
 </button>
 )}
 </div>
 <div className="mt-4 flex items-center justify-center">
 <div className="relative rounded-3xl border border-emerald-100 dark:border-emerald-900 bg-white dark:bg-slate-800 px-5 py-3 shadow-sm max-w-md w-full flex items-center gap-3 text-left">
 <div className="flex h-8 w-8 items-center justify-center text-emerald-700 dark:text-emerald-400">
 <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
 <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 </div>
 <div className="text-sm text-slate-600 dark:text-slate-300">
 {submitted 
 ? "Your predictions are locked in. This is a TEST game and does not affect the main game."
 : "Need to tweak something? Tap a prediction to adjust it. Everything locks in once you hit confirm."}
 </div>
 </div>
 </div>
 </div>
 </div>
 <div className="flex-1 overflow-y-auto p-4 pb-4 bg-slate-50 dark:bg-slate-900">
 <div className="max-w-2xl mx-auto space-y-6">
 {(() => {
 const grouped: Array<{ label: string; items: typeof fixtures }>=[];
 let currentDate=''; let currentGroup: typeof fixtures = [];
 fixtures.forEach((fixture)=>{
 const fixtureDate = fixture.kickoff_time ? new Date(fixture.kickoff_time).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}) : 'No date';
 if (fixtureDate!==currentDate){ if(currentGroup.length>0){ grouped.push({label:currentDate,items:currentGroup}); } currentDate=fixtureDate; currentGroup=[fixture]; } else { currentGroup.push(fixture); }
 });
 if(currentGroup.length>0){ grouped.push({label:currentDate,items:currentGroup}); }
 return grouped.map((group,groupIdx)=>(
 <div key={groupIdx}>
 <div className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">{group.label}</div>
 <div className="space-y-4">
 {group.items.map((fixture)=>{
   const pick = picks.get(fixture.fixture_index);
   const result = results.get(fixture.fixture_index);
   return (
 <div key={fixture.id} className="bg-white dark:bg-slate-800 rounded-xl p-6">
 <div className="flex items-center justify-between gap-2 mb-4">
 <div className="flex-1 min-w-0 text-right"><span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate inline-block">{fixture.home_team || fixture.home_name}</span></div>
 <div className="flex items-center gap-2 flex-shrink-0">
 <TeamBadge code={fixture.home_code} crest={fixture.home_crest} size={28} />
 <div className="text-slate-400 dark:text-slate-500 font-medium text-sm">{fixture.kickoff_time ? new Date(fixture.kickoff_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''}</div>
 <TeamBadge code={fixture.away_code} crest={fixture.away_crest} size={28} />
 </div>
 <div className="flex-1 min-w-0 text-left"><span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate inline-block">{fixture.away_team || fixture.away_name}</span></div>
 </div>
 <div className="grid grid-cols-3 gap-3 mt-4">
<button 
onClick={()=>{
if (submitted) return;
const np=new Map(picks);
np.set(fixture.fixture_index,{fixture_index:fixture.fixture_index,pick:"H",matchday:currentGw || fixture.gw});
setPicks(np);
}}
 disabled={submitted}
 className={`h-16 rounded-xl text-sm font-medium flex items-center justify-center border-0 ${
 pick?.pick==="H"
 ? result && result === "H" && pick.pick === result
 ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl"
 : result && (result === "D" || result === "A")
 ? "bg-red-500 text-white"
 : "bg-purple-600 text-white"
 : result === "H"
 ? "bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200"
 : submitted
 ? "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
 : "bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
 }`}
 >
 Home Win
 </button>
<button 
onClick={()=>{
if (submitted) return;
const np=new Map(picks);
np.set(fixture.fixture_index,{fixture_index:fixture.fixture_index,pick:"D",matchday:currentGw || fixture.gw});
setPicks(np);
}}
 disabled={submitted}
 className={`h-16 rounded-xl text-sm font-medium flex items-center justify-center border-0 ${
 pick?.pick==="D"
 ? result && result === "D" && pick.pick === result
 ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl"
 : result && (result === "H" || result === "A")
 ? "bg-red-500 text-white"
 : "bg-purple-600 text-white"
 : result === "D"
 ? "bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200"
 : submitted
 ? "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
 : "bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
 }`}
 >
 Draw
 </button>
<button 
onClick={()=>{
if (submitted) return;
const np=new Map(picks);
np.set(fixture.fixture_index,{fixture_index:fixture.fixture_index,pick:"A",matchday:currentGw || fixture.gw});
setPicks(np);
}}
 disabled={submitted}
 className={`h-16 rounded-xl text-sm font-medium flex items-center justify-center border-0 ${
 pick?.pick==="A"
 ? result && result === "A" && pick.pick === result
 ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl"
 : result && (result === "H" || result === "D")
 ? "bg-red-500 text-white"
 : "bg-purple-600 text-white"
 : result === "A"
 ? "bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200"
 : submitted
 ? "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
 : "bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
 }`}
 >
 Away Win
 </button>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 ));
 })()}
 </div>
 </div>
 <div className="p-6 bg-white dark:bg-slate-800 shadow-lg">
 <div className="max-w-2xl mx-auto space-y-4">
 {submitted ? (
 <div className="text-center py-6">
 <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Predictions Submitted (TEST)</div>
 <div className="text-sm text-slate-600 dark:text-slate-400">
 Your test predictions for Test GW {currentGw} have been confirmed.
 </div>
 {myScore > 0 && (
 <div className="mt-4 text-2xl font-bold text-purple-700">{myScore}/{fixtures.length}</div>
 )}
 </div>
 ) : (
 <>
 {!allPicksMade && (<div className="text-center text-sm text-amber-600 dark:text-amber-400 mb-2">You haven't made all your predictions yet</div>)}
 <div className="grid gap-3">
 <button 
 onClick={handleConfirmClick} 
 disabled={!allPicksMade}
 className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {allPicksMade ? "SUBMIT YOUR PREDICTIONS" : "Complete All Predictions First"}
 </button>
 {!allPicksMade && (
 <button onClick={()=>navigate("/")} className="w-full py-3 text-slate-600 dark:text-slate-400 font-medium">Cancel</button>
 )}
 </div>
 </>
 )}
 </div>
 </div>
 </div>
 );
 }

 // Never show swipe view if submitted - check state, ref, and sessionStorage
 const sessionStorageSubmitted = getHasEverBeenSubmitted();
 // Check all sessionStorage keys for this user (in case currentGw isn't set yet)
 const checkAllSessionStorage = (): boolean => {
 if (typeof window === 'undefined' || !user?.id) return false;
 try {
 for (let i = 0; i < sessionStorage.length; i++) {
 const key = sessionStorage.key(i);
    if (key && key.startsWith(`gw_submitted_`) && key.endsWith(`_${user.id}`)) {
 const value = sessionStorage.getItem(key);
 if (value === 'true') return true;
 }
 }
 } catch (e) {
 // Ignore
 }
 return false;
 };
 const anySessionStorageSubmitted = checkAllSessionStorage();
 
 // Check submission status synchronously on every render
 // to catch submission even if state hasn't updated yet
 const checkSubmittedBeforeSwipe = submitted || 
 (sessionStorageSubmitted && hasEverBeenSubmittedRef.current) ||
 anySessionStorageSubmitted;
 
 // CRITICAL: Don't show swipe predictions if:
 // 1. User has submitted (checkSubmittedBeforeSwipe)
 // 2. Deadline has passed (DEADLINE_PASSED) - deadline passed but games haven't started
 // 3. Gameweek is finished (RESULTS_PRE_GW) - deadline passed and games finished
 // 4. Gameweek is live (LIVE) - games have started
 // 5. Game state is null (not loaded yet) - default to blocking
 // Only show swipe predictions if gameState is GW_OPEN or GW_PREDICTED
 // isDeadlinePassed is already defined above to avoid TypeScript narrowing issues
 const shouldBlockSwipePredictions = checkSubmittedBeforeSwipe || 
 isFinishedOrLive ||
 isDeadlinePassed ||
 gameState === null ||
 !canShowSwipePredictions;
 
 // CRITICAL: If submitted or GW finished/live, force viewMode to "list" and never show cards
 // Use a computed value instead of state to avoid render-time state updates
 // This MUST be computed synchronously before any conditional rendering
 const effectiveViewMode = shouldBlockSwipePredictions ? "list" : viewMode;
 
 // CRITICAL: Early return to prevent ANY cards rendering if submitted or GW finished/live
 // This must happen BEFORE any cards-related rendering
 // If submitted is detected (via any method) OR GW is finished/live, NEVER show cards
 // But if deadline has passed, force list view and continue rendering (don't block)
 if (shouldBlockSwipePredictions) {
 // If deadline has passed, force list view and continue (don't block)
 if (deadlinePassed) {
 // Force list view if still in cards mode
 if (viewMode === "cards") {
 setViewMode("list");
 setCurrentIndex(0);
 }
 // Continue to render list view below - don't block
 } else if (viewMode === "cards") {
 // Only block if deadline hasn't passed and we're in cards mode
 return (
 <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C8376]"></div>
 </div>
 );
 }
 // If viewMode is already "list", continue to render list view below
 }
 
 
 // Safety check: ensure currentIndex is valid
 if (!currentFixture && fixtures.length > 0) {
 setCurrentIndex(0);
 return (
 <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C8376]"></div>
 </div>
 );
 }
 
 // If no fixtures, show empty state
 if (fixtures.length === 0) {
 return (
 <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
 <div className="text-center px-4 max-w-md">
 <div className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">No fixtures available</div>
 <div className="text-sm text-slate-500 dark:text-slate-400">Check back later for GW {currentGw} fixtures.</div>
 </div>
 </div>
 );
 }
 
 return (
 <>
 <style>{`
 @media (max-height: 700px) {
 .swipe-cards-container {
 padding-top: 0 !important;
 }
 }
 @media (min-height: 701px) {
 .swipe-cards-container {
 padding-top: 1.5rem;
 }
 }
 `}</style>
 <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col overflow-hidden">
 {/* CRITICAL: Only render cards if NOT submitted AND GW is open/predicted - use ref for immediate check */}
 {/* Also add inline style to hide immediately if submitted or GW finished/live (CSS failsafe) */}
 {shouldShowCardsRef.current && !shouldBlockSwipePredictions && !submitted && effectiveViewMode === "cards" && viewMode === "cards" && canShowSwipePredictions && (
 <div 
 className="sticky top-0 z-40 px-4 pt-4 pb-2 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
 style={{ display: shouldBlockSwipePredictions ? 'none' : 'block' }}
 >
 <div className="max-w-md mx-auto">
 <div className="relative flex items-center justify-between mb-4">
 <button 
 onClick={() => navigate("/")} 
 className="text-slate-600 dark:text-slate-400 text-3xl font-bold w-10 h-10 flex items-center justify-center"
 >
 ✕
 </button>
 <span className="absolute left-1/2 -translate-x-1/2 text-lg font-extrabold text-slate-700 dark:text-slate-200">Gameweek {currentGw}</span>
 {!shouldBlockSwipePredictions && effectiveViewMode === "cards" && canShowSwipePredictions && (
 <button
 onClick={() => setCurrentIndex(fixtures.length)}
   className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-md"
   >
 <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
 <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
 </svg>
 List View
 </button>
 )}
 </div>
 {!shouldBlockSwipePredictions && effectiveViewMode === "cards" && canShowSwipePredictions && (
 <div className="mt-4 flex justify-center mb-0">
 <div className="inline-flex items-center gap-2 rounded-full bg-[#e6f3f0] px-3 py-2">
 {fixtures.map((fixture, idx) => {
 const isComplete = idx < currentIndex;
 const isCurrent = idx === currentIndex;
 const hasPick = picks.has(fixture.fixture_index);
 const showCheckmark = hasPick && !isCurrent;
 // If fixture has a pick but isn't complete yet, use green background
 const bgColor = isCurrent 
 ? "bg-[#178f72]" 
 : hasPick 
 ? "bg-[#116f59]" 
 : isComplete 
 ? "bg-[#116f59]" 
 : "bg-white dark:bg-slate-700";
 return (
 <div
 key={idx}
 className={`flex items-center justify-center ${isCurrent ? "h-2 w-6 rounded-full" : "h-3 w-3 rounded-full"} ${bgColor}`}
 >
 {showCheckmark && (
 <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
 </svg>
 )}
 </div>
 );
 })}
 </div>
 </div>
 )}
 {/* First Visit Info Banner - How to Swipe */}
 <div className="px-4 pb-4">
 <FirstVisitInfoBanner
 storageKey="predictionsSwipeFirstVisit"
 message="Swipe cards left for Home Win, right for Away Win, or down for Draw. You can also use the buttons at the bottom."
 imageSrc="/assets/Volley/volley-swipe.png"
 />
 </div>
 </div>
 </div>
 )}
 {/* CRITICAL: If submitted or GW finished/live, ONLY render list view - cards section is completely separate and never evaluated */}
 {/* But if deadline has passed, we show the submitted view instead (handled above) */}
 {(shouldBlockSwipePredictions || effectiveViewMode === "list") && !deadlinePassed && (
 <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
 <div className="max-w-2xl mx-auto px-4 py-4">
 <div className="relative flex items-center justify-center mb-4">
 {!isUserSubmitted && (
 <button 
 onClick={() => navigate("/")} 
 className="absolute left-0 text-slate-600 dark:text-slate-400 text-3xl font-bold w-10 h-10 flex items-center justify-center"
 >
 ✕
 </button>
 )}
 <div className="text-center"><h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 mt-0 mb-2">Predictions</h1><div className="mt-0 mb-4 text-base text-slate-500 dark:text-slate-400">Call every game, lock in your results.</div></div>
 </div>
 {!shouldBlockSwipePredictions && canShowSwipePredictions && (
 <div className="flex justify-center mt-4">
 <button 
 onClick={() => {
 setViewMode("cards");
 setCurrentIndex(0);
 }}
 className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-md"
 >
 <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
 <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
 </svg>
 Back to Swipe View
 </button>
 </div>
 )}
 </div>
 </div>
 )}
 {/* CRITICAL: Cards section - ONLY render if NOT submitted, GW is open/predicted, and viewMode is cards */}
 {/* Use ref check first for immediate synchronous evaluation */}
 {shouldShowCardsRef.current && !shouldBlockSwipePredictions && !submitted && effectiveViewMode === "cards" && viewMode === "cards" && canShowSwipePredictions && (
 <div className="flex flex-col min-h-0 overflow-hidden flex-1" style={{ height: '100%', paddingBottom: '0' }}>
 <div className="swipe-cards-container flex items-start justify-center px-4 relative overflow-hidden flex-1" style={{ minHeight: 0, width: '100%' }}>
 <div className={`absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-50 ${showFeedback === "home" ? "opacity-100" : "opacity-0"}`}><div className="text-6xl font-bold text-slate-700">←</div><div className="text-lg font-bold text-slate-700 bg-white px-4 py-2 rounded-full shadow-lg whitespace-nowrap">Home Win</div></div>
 <div className={`absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-50 ${showFeedback === "away" ? "opacity-100" : "opacity-0"}`}><div className="text-6xl font-bold text-slate-700">→</div><div className="text-lg font-bold text-slate-700 bg-white px-4 py-2 rounded-full shadow-lg whitespace-nowrap">Away Win</div></div>
 <div className={`absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-50 ${showFeedback === "draw" ? "opacity-100" : "opacity-0"}`}><div className="text-6xl font-bold text-slate-700">↓</div><div className="text-lg font-bold text-slate-700 bg-white px-4 py-2 rounded-full shadow-lg">Draw</div></div>
 <div 
 className="max-w-md w-full relative" 
 style={{ 
 aspectRatio: '0.75',
 display: shouldBlockSwipePredictions ? 'none' : 'block' // CRITICAL: CSS failsafe to hide immediately
 }}
 >
 {currentIndex < fixtures.length - 1 && (() => {
 const nextFixture = fixtures[currentIndex + 1];
 return (
 <div key={currentIndex + 1} className="absolute inset-0 pointer-events-none" style={{ transform: `scale(1)`, opacity: (isDragging || isAnimating) ? 0.5 : 0, zIndex: 1, transition: 'opacity 0.15s ease-out' }}>
 <SwipeCard
 fixture={nextFixture}
 homeColor={getTeamColor(nextFixture.home_code, nextFixture.home_name)}
 awayColor={getTeamColor(nextFixture.away_code, nextFixture.away_name)}
 showSwipeHint={false}
 homeForm={teamForms.get((nextFixture.home_code || '').toUpperCase().trim()) || null}
 awayForm={teamForms.get((nextFixture.away_code || '').toUpperCase().trim()) || null}
 />
 </div>
 );
 })()}
 {/* Card content - NO touch handlers here */}
 <div
 className="absolute inset-0 z-10"
 style={{ 
 transform: `translate(${cardState.x}px, ${cardState.y}px) rotate(${cardState.rotation}deg) scale(${cardState.scale})`, 
 opacity: cardState.opacity, 
 transition: (isDragging || isResettingRef.current) ? "none" : "all 0.3s ease-out",
 pointerEvents: 'none',
 display: shouldBlockSwipePredictions ? 'none' : 'block' // CRITICAL: CSS failsafe
 }}
 >
 <SwipeCard
 fixture={currentFixture}
 homeColor={getTeamColor(currentFixture.home_code, currentFixture.home_name)}
 awayColor={getTeamColor(currentFixture.away_code, currentFixture.away_name)}
 showSwipeHint={true}
 homeForm={teamForms.get((currentFixture.home_code || '').toUpperCase().trim()) || null}
 awayForm={teamForms.get((currentFixture.away_code || '').toUpperCase().trim()) || null}
 />
 </div>
 {/* SEPARATE touch handler layer - sits on top of everything, covers 100% */}
 <div
 ref={cardRef}
 className="absolute inset-0 z-50 cursor-grab active:cursor-grabbing"
 style={{ 
 touchAction: "none",
 WebkitTouchCallout: "none",
 userSelect: "none",
 WebkitUserSelect: "none",
 pointerEvents: "auto",
 backgroundColor: "transparent",
 top: 0,
 left: 0,
 right: 0,
 bottom: 0,
 width: "100%",
 height: "100%",
 margin: 0,
 padding: 0
 }}
 onMouseDown={(e)=>{ e.preventDefault(); !submitted && handleStart(e.clientX,e.clientY); }} 
 onMouseMove={(e)=>{ e.preventDefault(); !submitted && handleMove(e.clientX,e.clientY); }} 
 onMouseUp={(e)=>{ e.preventDefault(); handleEnd(); }} 
 onMouseLeave={(e)=>{ e.preventDefault(); handleEnd(); }}
 onTouchStart={handleTouchStart} 
 onTouchMove={handleTouchMove} 
 onTouchEnd={handleTouchEnd}
 onTouchCancel={handleTouchEnd}
 />
 </div>
 </div>
<div className="fixed bottom-0 left-0 right-0 px-4 bg-[#eef4f3] dark:bg-slate-800 z-[10000] safe-area-inset-bottom" style={{ paddingBottom: `calc(2rem + env(safe-area-inset-bottom, 0px))`, paddingTop: '1.5rem' }}>
<div className="max-w-md mx-auto">
<div className="flex items-stretch justify-center gap-3">
<button
onClick={()=>handleButtonClick("H")}
disabled={isAnimating || submitted}
className="flex-1 py-4 rounded-2xl font-semibold flex items-center justify-center bg-[#d7e6e3] dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-70"
style={{ backgroundColor: cardState.x < -30 ? `rgba(34, 197, 94, ${Math.min(0.8, Math.abs(cardState.x) / 150)})` : undefined, color: cardState.x < -30 ? '#fff' : undefined }}
>
Home Win
</button>
<button
onClick={()=>handleButtonClick("D")}
disabled={isAnimating || submitted}
className="flex-1 py-4 rounded-2xl font-semibold flex items-center justify-center bg-[#d7e6e3] dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-70"
style={{ backgroundColor: cardState.y > 30 ? `rgba(59, 130, 246, ${Math.min(0.8, cardState.y / 150)})` : undefined, color: cardState.y > 30 ? '#fff' : undefined }}
>
Draw
</button>
<button
onClick={()=>handleButtonClick("A")}
disabled={isAnimating || submitted}
className="flex-1 py-4 rounded-2xl font-semibold flex items-center justify-center bg-[#d7e6e3] dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-70"
style={{ backgroundColor: cardState.x > 30 ? `rgba(34, 197, 94, ${Math.min(0.8, cardState.x / 150)})` : undefined, color: cardState.x > 30 ? '#fff' : undefined }}
>
Away Win
</button>
</div>
</div>
</div>
 </div>
 )}
 </div>
 </>
 );
}

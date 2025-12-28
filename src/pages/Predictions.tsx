import { useEffect, useMemo, useRef, useState } from "react";
import type { TouchEventHandler } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import TeamBadge from "../components/TeamBadge";
import { useNavigate } from "react-router-dom";
import { invalidateUserCache, getCached, setCached, CACHE_TTL } from "../lib/cache";
import SwipeCard from "../components/predictions/SwipeCard";
import ScoreIndicator from "../components/predictions/ScoreIndicator";
import ConfirmationModal from "../components/predictions/ConfirmationModal";
import DateHeader from "../components/DateHeader";
import { useLiveScores } from "../hooks/useLiveScores";
import { useGameweekState } from "../hooks/useGameweekState";
import { FixtureCard, type Fixture as FixtureCardFixture, type LiveScore as FixtureCardLiveScore } from "../components/FixtureCard";
import Confetti from "react-confetti";

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

  const [currentTestGw, setCurrentTestGw] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Initialize state from cache synchronously to prevent loading flash
  const loadInitialStateFromCache = () => {
    if (typeof window === 'undefined' || !user?.id) {
      return {
        fixtures: [],
        picks: new Map<number, { fixture_index: number; pick: "H" | "D" | "A"; matchday: number }>(),
        submitted: false,
        results: new Map<number, "H" | "D" | "A">(),
        loading: true,
        picksChecked: false,
        submissionChecked: false,
      };
    }
    
    try {
      // Try to get current GW from app_meta cache or use a default
      // We'll update this when we fetch the real GW, but for now use a reasonable default
      const metaCache = getCached<{ current_gw: number }>('app_meta');
      const currentGw = metaCache?.current_gw || 14;
      
      const cacheKey = `predictions:${user.id}:${currentGw}`;
      const cached = getCached<{
        fixtures: Fixture[];
        picks: Array<{ fixture_index: number; pick: "H" | "D" | "A"; matchday: number }>;
        submitted: boolean;
        results: Array<{ fixture_index: number; result: "H" | "D" | "A" }>;
      }>(cacheKey);
      
      if (cached && cached.fixtures && Array.isArray(cached.fixtures) && cached.fixtures.length > 0) {
        // Restore picks from cache
        const picksMap = new Map<number, { fixture_index: number; pick: "H" | "D" | "A"; matchday: number }>();
        if (cached.picks && Array.isArray(cached.picks)) {
          cached.picks.forEach(p => {
            picksMap.set(p.fixture_index, p);
          });
        }
        
        // Restore results from cache
        const resultsMap = new Map<number, "H" | "D" | "A">();
        if (cached.results && Array.isArray(cached.results)) {
          cached.results.forEach(r => {
            resultsMap.set(r.fixture_index, r.result);
          });
        }
        
        return {
          fixtures: cached.fixtures,
          picks: picksMap,
          submitted: cached.submitted || false,
          results: resultsMap,
          loading: false, // Data available, no loading needed
          picksChecked: true,
          submissionChecked: true,
        };
      }
    } catch (error) {
      // Error loading from cache (non-critical)
    }
    
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
  
  // Use centralized game state system (PR.md rule 10)
  // LIVE state means: first kickoff happened AND last game hasn't finished (FT)
  const { state: gameState, loading: gameStateLoading } = useGameweekState(currentTestGw);
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
        console.warn('[Predictions] Error fetching team forms:', error);
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
      console.warn('[Predictions] Error fetching team forms:', error);
      setTeamForms(new Map()); // Clear on error
    }
  };

  // Fetch team forms when currentTestGw changes
  useEffect(() => {
    if (currentTestGw) {
      fetchTeamForms(currentTestGw);
    } else {
      setTeamForms(new Map()); // Clear forms if no GW
    }
  }, [currentTestGw]);

  
  // Initialize viewMode - check sessionStorage synchronously to prevent flash
  const getInitialViewMode = (): "cards" | "list" => {
    if (typeof window === 'undefined') return "cards";
    try {
      // Check all sessionStorage keys for test_api_submitted pattern
      // This prevents the flash even if we don't know the exact GW or user ID yet
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(`test_api_submitted_`)) {
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
  
  // Helper function to check sessionStorage for submission (defined early to avoid hoisting issues)
  const getHasEverBeenSubmitted = () => {
    if (typeof window === 'undefined' || !currentTestGw || !user?.id) return false;
    const key = `test_api_submitted_${currentTestGw}_${user.id}`;
    return sessionStorage.getItem(key) === 'true';
  };
  const setHasEverBeenSubmitted = (value: boolean) => {
    if (typeof window === 'undefined' || !currentTestGw || !user?.id) return;
    const key = `test_api_submitted_${currentTestGw}_${user?.id}`;
    if (value) {
      sessionStorage.setItem(key, 'true');
    } else {
      sessionStorage.removeItem(key);
    }
  };
  // Define ref before it's used in state initializers
  const hasEverBeenSubmittedRef = useRef<boolean>(getHasEverBeenSubmitted());
  
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
        if (key && key.startsWith(`test_api_submitted_`) && key.endsWith(`_${user.id}`)) {
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
  
  // Check sessionStorage immediately when currentTestGw and user are available
  // to prevent swipe cards from showing even briefly
  useEffect(() => {
    if (currentTestGw && user?.id && typeof window !== 'undefined') {
      try {
        const key = `test_api_submitted_${currentTestGw}_${user.id}`;
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
  }, [currentTestGw, user?.id]);
  
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
  
  const [topPercent, setTopPercent] = useState<number | null>(null);
  const [allMembersSubmitted, setAllMembersSubmitted] = useState(false);
  const [leagueMembers, setLeagueMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [submittedMemberIds, setSubmittedMemberIds] = useState<Set<string>>(new Set());
  const [apiTestLeagueId, setApiTestLeagueId] = useState<string | null>(null);
  const [apiMatchIds, setApiMatchIds] = useState<number[]>([]);
  
  // Subscribe to real-time live scores using the hook
  const { liveScores: liveScoresMap } = useLiveScores(currentTestGw || undefined, apiMatchIds.length > 0 ? apiMatchIds : undefined);
  
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
        if (key && key.startsWith(`test_api_submitted_`)) {
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
    // Only lock scrolling when in card swipe mode, not on review page, and not submitted
    const isReviewPage = currentIndex >= fixtures.length;
    const shouldLockScroll = viewMode === "cards" && !isReviewPage && fixtures.length > 0 && !submitted;
    
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
  }, [viewMode, currentIndex, fixtures.length, submitted]);

  const allPicksMade = useMemo(() => {
    if (fixtures.length === 0) return false;
    return fixtures.every(f => picks.has(f.fixture_index));
  }, [fixtures, picks]);

  const cardRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const isResettingRef = useRef(false);

  // Load fixtures and picks from database
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Get current GW from app_meta first (needed for cache key)
        let currentGw: number | null = null;
        
        const { data: meta } = await supabase
          .from("app_meta")
          .select("current_gw")
          .eq("id", 1)
          .maybeSingle();
        
        currentGw = meta?.current_gw ?? 14;
        
        if (!currentGw) {
          if (alive) {
            setFixtures([]);
            setLoading(false);
          }
          return;
        }
        
        setCurrentTestGw(currentGw);
        
        // 1. Load from cache immediately (if available)
        const cacheKey = `predictions:${user?.id}:${currentGw}`;
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
            setFixtures(cached.fixtures);
            setLoading(false);
            
            // Restore picks from cache
            if (cached.picks && Array.isArray(cached.picks)) {
              const picksMap = new Map<number, { fixture_index: number; pick: "H" | "D" | "A"; matchday: number }>();
              cached.picks.forEach(p => {
                picksMap.set(p.fixture_index, p);
              });
              setPicks(picksMap);
            }
            
            // Restore submission status
            if (cached.submitted !== undefined) {
              setSubmitted(cached.submitted);
              hasEverBeenSubmittedRef.current = cached.submitted;
              setHasEverBeenSubmitted(cached.submitted);
              setSubmissionChecked(true);
            }
            
            // Restore results
            if (cached.results && Array.isArray(cached.results)) {
              const resultsMap = new Map<number, "H" | "D" | "A">();
              cached.results.forEach(r => {
                resultsMap.set(r.fixture_index, r.result);
              });
              setResults(resultsMap);
            }
            
            setPicksChecked(true);
            loadedFromCache = true;
          }
        } catch (error) {
          // If cache is corrupted, just continue with fresh fetch
          // Error loading from cache (non-critical)
        }
        
        // Only set loading if we didn't load from cache
        if (!loadedFromCache) {
          if (fixtures.length === 0) {
            setLoading(true);
          }
          setPicksChecked(false); // Reset picks checked state
          setSubmissionChecked(false); // Reset submission checked state
        }

        // Fetch fixtures from app_fixtures table
        const { data: savedFixtures, error: fixturesError } = await supabase
          .from("app_fixtures")
          .select("*")
          .eq("gw", currentGw)
          .order("fixture_index", { ascending: true });

        if (fixturesError) {
          throw new Error(`Failed to load test fixtures: ${fixturesError.message}`);
        }

        if (!savedFixtures || savedFixtures.length === 0) {
          if (alive) {
            setFixtures([]);
            setLoading(false);
          }
          return;
        }

        // Convert saved fixtures to our format
        const fixturesData: Fixture[] = savedFixtures.map((f: any) => ({
          id: f.id || String(f.api_match_id || f.fixture_index),
          gw: currentGw!,
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
        
        if (alive) {
          setFixtures(fixturesData);
          // Set loading to false as soon as fixtures are loaded - show page immediately
          setLoading(false);
          
          // Initialize empty results map
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
            .eq("gw", currentGw!)
            .eq("user_id", user.id)
            .maybeSingle();
          
          if (alive && submission?.submitted_at) {
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

        // Fetch user's picks from TEST API table
        let hasPicks = false;
        if (user?.id && fixturesData.length > 0 && !isSubmitted) {
          // Only fetch picks if not submitted (optimization)
          const { data: pk, error: pkErr } = await supabase
            .from("app_picks")
            .select("gw,fixture_index,pick")
            .eq("gw", currentGw!)
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
                picksMap.set(p.fixture_index, {
                  fixture_index: p.fixture_index,
                  pick: p.pick,
                  matchday: p.gw || currentGw! // Use gw instead of matchday
                });
              });
              
              if (alive) {
                setPicks(picksMap);
                hasPicks = true;
              }
            } else {
              // Picks don't match current fixtures - clear them
              if (alive && pk.length > 0) {
                // Clear invalid picks from database
                await supabase
                  .from("app_picks")
                  .delete()
                  .eq("gw", currentGw!)
                  .eq("user_id", user.id);
                setPicks(new Map());
                hasPicks = false;
              }
            }
          }
        } else if (isSubmitted && user?.id && fixturesData.length > 0) {
          // User has submitted - fetch picks for display purposes
          const { data: pk, error: pkErr } = await supabase
            .from("app_picks")
            .select("gw,fixture_index,pick")
            .eq("gw", currentGw!)
            .eq("user_id", user.id);

          if (!pkErr && pk && pk.length > 0) {
            const currentFixtureIndices = new Set(fixturesData.map(f => f.fixture_index));
            const picksForCurrentFixtures = pk.filter((p: any) => currentFixtureIndices.has(p.fixture_index));
            
            if (picksForCurrentFixtures.length === fixturesData.length) {
              const picksMap = new Map<number, Pick>();
              picksForCurrentFixtures.forEach((p: any) => {
                picksMap.set(p.fixture_index, {
                  fixture_index: p.fixture_index,
                  pick: p.pick,
                  matchday: p.gw || currentGw! // Use gw instead of matchday
                });
              });
              
              if (alive) {
                setPicks(picksMap);
                hasPicks = true;
              }
            }
          }
          
          // Validate submission is still valid (picks match)
          if (alive && !hasPicks) {
              // Submission exists but picks don't match - clear the submission
              setSubmitted(false);
              await supabase
                .from("app_gw_submissions")
                .delete()
                .eq("gw", currentGw!)
                .eq("user_id", user.id);
            }
        }
        
        // Check if all members have submitted (for API Test league)
        if (alive && fixturesData.length > 0 && user?.id) {
          // Get API Test league members
          const { data: apiTestLeague } = await supabase
            .from("leagues")
            .select("id")
            .eq("name", "API Test")
            .maybeSingle();
          
          if (apiTestLeague) {
            if (alive) {
              setApiTestLeagueId(apiTestLeague.id);
            }
            // Get all members of API Test league
            const { data: membersData } = await supabase
              .from("league_members")
              .select("user_id, profiles!inner(id, name)")
              .eq("league_id", apiTestLeague.id);
            
            if (membersData) {
              const members = membersData.map((m: any) => ({
                id: m.user_id,
                name: m.profiles?.name || "Unknown"
              }));
              
              if (alive) {
                setLeagueMembers(members);
              }
              
              const memberIds = members.map((m: any) => m.id);
              
              // Fetch all submissions for API Test league members
              const { data: allSubmissions } = await supabase
                .from("app_gw_submissions")
                .select("user_id, submitted_at")
                .eq("gw", currentGw!)
                .in("user_id", memberIds)
                .not("submitted_at", "is", null);
              
              // Fetch all picks for validation
              const { data: allPicks } = await supabase
                .from("app_picks")
                .select("user_id, fixture_index")
                .eq("gw", currentGw!)
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
        
        // Mark that we've checked for picks
        if (alive) {
          setPicksChecked(true);
          // Ensure submissionChecked is set (in case it wasn't set above)
          if (!submissionChecked) {
            setSubmissionChecked(true);
          }
        }
        
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
        if (alive && fixturesData.length > 0 && user?.id && currentGw) {
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
        console.error('[Predictions] Error loading data:', error);
        if (alive) {
          setPicksChecked(true); // Mark as checked even on error
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  // Live scores are now handled by useLiveScores hook via Supabase real-time

  // Update results map based on live scores
  useEffect(() => {
    const newResults = new Map<number, "H" | "D" | "A">();
    
    // Check live scores for first 3 fixtures
    const fixturesToCheck = fixtures;
    fixturesToCheck.forEach((f) => {
      const liveScore = liveScores[f.fixture_index];
      if (liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED')) {
        // Determine outcome from live score
        if (liveScore.homeScore > liveScore.awayScore) {
          newResults.set(f.fixture_index, 'H');
        } else if (liveScore.awayScore > liveScore.homeScore) {
          newResults.set(f.fixture_index, 'A');
        } else {
          newResults.set(f.fixture_index, 'D');
        }
      }
    });
    
    setResults(newResults);
  }, [liveScores, fixtures]);

  // Calculate top percentage when we have results and picks
  useEffect(() => {
    if (!currentTestGw || !user?.id || results.size === 0 || fixtures.length === 0) {
      setTopPercent(null);
      return;
    }

    // Calculate current user's score
    let myScore = 0;
    fixtures.forEach(f => {
      const r = results.get(f.fixture_index);
      const p = picks.get(f.fixture_index);
      if (r && p && r === p.pick) {
        myScore++;
      }
    });

    // Only calculate if user has a score
    if (myScore === 0) {
      setTopPercent(null);
      return;
    }

    // Calculate top percentage
    (async () => {
      try {
        // Get all users' picks for this GW
        const { data: allPicks } = await supabase
          .from("app_picks")
          .select("user_id, fixture_index, pick")
          .eq("gw", currentTestGw);
        
        if (allPicks) {
          // Group picks by user and calculate each user's score
          const userScores = new Map<string, number>();
          allPicks.forEach((p) => {
            const result = results.get(p.fixture_index);
            const userScore = userScores.get(p.user_id) || 0;
            if (result && result === p.pick) {
              userScores.set(p.user_id, userScore + 1);
            } else {
              userScores.set(p.user_id, userScore);
            }
          });
          
          // Convert to array and sort descending
          const scores = Array.from(userScores.values()).sort((a, b) => b - a);
          
          // Calculate what percentage of users scored the same or less
          const betterOrEqual = scores.filter(s => s >= myScore).length;
          const totalUsers = scores.length;
          const percent = totalUsers > 0 ? Math.round((betterOrEqual / totalUsers) * 100) : null;
          
          setTopPercent(percent);
        }
      } catch (error) {
        console.error('[Predictions] Error calculating top percent:', error);
        setTopPercent(null);
      }
    })();
  }, [results, picks, fixtures, currentTestGw, user?.id]);


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
    setShowFeedback(null);
  };
  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || isAnimating || submitted) return;
    const deltaX = clientX - startPosRef.current.x;
    const deltaY = clientY - startPosRef.current.y;
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
    const { x, y } = cardState;
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
    if (!currentFixture || !currentTestGw) return;
    
    // Only update local state - don't save to database until confirmed
    const newPicks = new Map(picks);
    newPicks.set(currentFixture.fixture_index, { 
      fixture_index: currentFixture.fixture_index, 
      pick, 
      matchday: currentTestGw // Keep matchday for Pick type compatibility
    });
    setPicks(newPicks);
  };
  
  const handleConfirmClick = async () => {
    if (!allPicksMade) {
      setConfirmCelebration({ success: false, message: "You still have fixtures to call!" });
      setTimeout(() => setConfirmCelebration(null), 2200);
      return;
    }
    
    if (!user?.id || !currentTestGw) return;

    try {
      // CRITICAL: Ensure we're not already submitted (safety check)
      const { data: existingSubmission } = await supabase
        .from('app_gw_submissions')
        .select('submitted_at')
        .eq('user_id', user.id)
        .eq('gw', currentTestGw)
        .maybeSingle();
      
      if (existingSubmission?.submitted_at) {
        console.warn('[Predictions] Already submitted - this should not happen');
        setSubmitted(true);
        return;
      }
      
      // Save all picks - CRITICAL: Only save picks that match current fixtures
      const picksArray = Array.from(picks.values())
        .filter(pick => pick.matchday === currentTestGw) // Safety: only current GW
        .map(pick => ({
        user_id: user.id,
        gw: currentTestGw,
        fixture_index: pick.fixture_index,
        pick: pick.pick
      }));

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
        console.error('[Predictions] Error saving picks:', picksError);
        throw picksError;
      }

      // Save submission - CRITICAL: Only create submission after picks are saved successfully
      // This ensures picks and submission are in sync
      const { error: submissionError } = await supabase
        .from('app_gw_submissions')
        .upsert({
          user_id: user.id,
          gw: currentTestGw,
          submitted_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,gw'
        });

      if (submissionError) {
        console.error('[Predictions] Error saving submission:', submissionError);
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
      if (apiTestLeagueId && currentTestGw) {
        fetch('/.netlify/functions/notifyFinalSubmission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leagueId: apiTestLeagueId,
            matchday: currentTestGw,
            isTestApi: true,
          }),
                          }).catch(err => {
                            console.error('[Predictions] Failed to check final submission:', err);
                          });
      }
    } catch (error) {
      console.error('[Predictions] Error confirming picks:', error);
      setConfirmCelebration({ success: false, message: "Failed to confirm predictions. Please try again." });
      setTimeout(() => setConfirmCelebration(null), 2200);
    }
  };

  // Never show swipe view until we know for sure the user hasn't submitted
  // Don't render until we know submission status and have fixtures
  // This prevents blank screens and swipe card flashes
  const needsMoreData = loading || fixtures.length === 0 || !submissionChecked || !picksChecked;
  
  if (needsMoreData) {
    // Show loading spinner - don't render any content until ready
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C8376]"></div>
      </div>
    );
  }
  
  // Additional loading check
  if (loading && fixtures.length === 0) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col overflow-hidden">
        <div className="sticky top-0 z-40 px-4 pt-4 pb-2 bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-center mb-4">
              <span className="text-lg font-extrabold text-slate-700">
                {currentTestGw ? `Gameweek ${currentTestGw}` : 'Loading...'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1C8376]"></div>
        </div>
      </div>
    );
  }
  // Don't render until submission status is confirmed
  // Prevents blank screens and swipe card flashes
  if ((!picksChecked || !submissionChecked) && fixtures.length > 0) {
    // Still checking submission status - show loading spinner
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C8376]"></div>
      </div>
    );
  }

  if (fixtures.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center px-4 max-w-md">
          <div className="text-red-600 font-semibold mb-2">No Test Fixtures Found</div>
          <div className="text-sm text-slate-600 mb-4">
            Please create a test gameweek in the Test API Admin page first.
          </div>
          <button
            onClick={() => navigate("/test-admin-api")}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Go to Test API Admin
          </button>
        </div>
      </div>
    );
  }

  // Confirmed Predictions View (after submission)
  // Check both state and sessionStorage for maximum safety
  const sessionStorageCheck = getHasEverBeenSubmitted();
  const isUserSubmitted = submitted || (!submissionChecked && sessionStorageCheck);
  if (isUserSubmitted) {
    // If not all members have submitted, show "Who's submitted" view (similar to League page)
    if (!allMembersSubmitted && leagueMembers.length > 0) {
      const remaining = leagueMembers.filter(m => !submittedMemberIds.has(m.id)).length;
      
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
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
              <div className="flex items-center justify-center">
                <span className="text-lg font-extrabold text-slate-700">
                  Gameweek {currentTestGw}
                </span>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-2xl mx-auto">
              <div className="rounded-2xl border bg-white p-4 mb-4">
                <div className="text-sm font-semibold text-slate-700 mb-3">
                  Waiting for <span className="font-bold">{remaining}</span> of {leagueMembers.length} to submit...
                </div>
                <div className="text-xs text-slate-500 mb-4">
                  Your predictions have been confirmed. Once all members have submitted, you'll be able to see everyone's picks.
                </div>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-3 w-2/3 font-semibold text-slate-600">Player</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leagueMembers
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((member) => {
                          const isSubmitted = submittedMemberIds.has(member.id);
                          return (
                            <tr key={member.id} className="border-t border-slate-200">
                              <td className="px-4 py-3 font-bold text-slate-900 truncate whitespace-nowrap" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</td>
                              <td className="px-4 py-3">
                                {isSubmitted ? (
                                  <span className="inline-flex items-center justify-center rounded-full bg-[#1C8376]/10 text-[#1C8376]/90 text-xs px-2 py-1 border border-emerald-300 font-bold shadow-sm whitespace-nowrap w-24">
                                    Submitted
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center rounded-full bg-amber-50 text-amber-700 text-xs px-2 py-1 border border-amber-200 font-semibold whitespace-nowrap w-24">
                                    Not yet
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
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
            <div className="flex items-center justify-center">
              <span className="text-lg font-extrabold text-slate-700">
                Gameweek {currentTestGw}
              </span>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-4">
          <div className="max-w-2xl mx-auto">
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
              if (!gameStateLoading) {
                if (gameState === 'LIVE') {
                  state = 'live';
                } else if (gameState === 'RESULTS_PRE_GW') {
                  state = 'finished';
                } else if (gameState === 'GW_OPEN' || gameState === 'GW_PREDICTED') {
                  // Before first kickoff - check if starting soon
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
              
              // Show score indicator if games have started/finished or user has submitted
              if (hasAnyLiveOrFinished || (submitted && fixtures.length > 0) || hasStartingSoon) {
                const displayScore = hasAnyLiveOrFinished ? currentScore : (submitted ? myScore : 0);
                
                return (
                  <ScoreIndicator
                    score={displayScore}
                    total={fixtures.length}
                    topPercent={topPercent}
                    state={state}
                    gameweek={currentTestGw}
                    gameStateLoading={gameStateLoading}
                  />
                );
              }
              
              return null;
            })()}
            
            <div className="space-y-6 [&>div:first-child]:mt-0">
              {(() => {
                const grouped: Array<{ label: string; items: typeof fixtures }>=[];
                let currentDate=''; let currentGroup: typeof fixtures = [];
                fixtures.forEach((fixture)=>{
                  const fixtureDate = fixture.kickoff_time ? new Date(fixture.kickoff_time).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}) : 'No date';
                  if (fixtureDate!==currentDate){ if(currentGroup.length>0){ grouped.push({label:currentDate,items:currentGroup}); } currentDate=fixtureDate; currentGroup=[fixture]; } else { currentGroup.push(fixture); }
                });
                if(currentGroup.length>0){ grouped.push({label:currentDate,items:currentGroup}); }
                return grouped.map((group,groupIdx)=>{
                  return (
                  <div key={groupIdx} className={groupIdx > 0 ? "mt-6" : ""}>
                    <DateHeader date={group.label} />
                  <div className="rounded-2xl border bg-slate-50 overflow-hidden">
                    <ul>
                    {group.items.map((fixture, index)=>{
                      const pick = picks.get(fixture.fixture_index);
                      const liveScore = liveScores[fixture.fixture_index];

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

                      return (
                        <li key={fixture.id} className={index > 0 ? "border-t" : ""}>
                          <FixtureCard
                            fixture={fixtureCardFixture}
                            pick={pick?.pick}
                            liveScore={fixtureCardLiveScore}
                            isTestApi={true}
                            showPickButtons={true}
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
        <div className="min-h-screen bg-slate-50 flex flex-col">
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
              <span className="text-lg font-extrabold text-slate-700">Review Mode</span>
              {allPicksMade && !submitted ? (
                <button
                  onClick={handleConfirmClick}
                  className="absolute right-0 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-emerald-600"
                >
                  Confirm
                </button>
              ) : submitted ? (
                <span className="absolute right-0 text-sm text-green-600 font-semibold">✓ Submitted</span>
              ) : picks.size > 0 ? (
                <button
                  onClick={handleConfirmClick}
                  className="absolute right-0 inline-flex items-center gap-2 rounded-full bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-inner"
                >
                  Confirm
                </button>
              ) : (
                <button
                  onClick={() => setCurrentIndex(0)}
                  className="absolute right-0 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:shadow-lg hover:from-emerald-600 hover:via-emerald-700 hover:to-emerald-800"
                >
                  Swipe View
                </button>
              )}
            </div>
            <div className="mt-4 flex items-center justify-center">
              <div className="relative rounded-3xl border border-emerald-100 bg-white px-5 py-3 shadow-sm max-w-md w-full flex items-center gap-3 text-left">
                <div className="flex h-8 w-8 items-center justify-center text-emerald-700">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-sm text-slate-600">
                  {submitted 
                    ? "Your predictions are locked in. This is a TEST game and does not affect the main game."
                    : "Need to tweak something? Tap a prediction to adjust it. Everything locks in once you hit confirm."}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-4">
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
                  <div className="text-lg font-semibold text-slate-800 mb-4">{group.label}</div>
                  <div className="space-y-4">
                    {group.items.map((fixture)=>{
                      const pick = picks.get(fixture.fixture_index);
                      const result = results.get(fixture.fixture_index);
                      return (
                        <div key={fixture.id} className="bg-white rounded-xl shadow-sm p-6">
                          <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex-1 min-w-0 text-right"><span className="text-sm font-semibold text-slate-800 truncate inline-block">{fixture.home_team || fixture.home_name}</span></div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <TeamBadge code={fixture.home_code} crest={fixture.home_crest} size={28} />
                              <div className="text-slate-400 font-medium text-sm">{fixture.kickoff_time ? new Date(fixture.kickoff_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''}</div>
                              <TeamBadge code={fixture.away_code} crest={fixture.away_crest} size={28} />
                            </div>
                            <div className="flex-1 min-w-0 text-left"><span className="text-sm font-semibold text-slate-800 truncate inline-block">{fixture.away_team || fixture.away_name}</span></div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 mt-4">
                            <button 
                              onClick={()=>{
                                if (submitted) return;
                                const np=new Map(picks);
                                np.set(fixture.fixture_index,{fixture_index:fixture.fixture_index,pick:"H",matchday:currentTestGw!});
                                setPicks(np);
                              }} 
                              disabled={submitted}
                              className={`h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center ${
                                pick?.pick==="H"
                                  ? result && result === "H" && pick.pick === result
                                    ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white border-yellow-300 shadow-xl"
                                    : result && (result === "D" || result === "A")
                                    ? "bg-red-500 text-white border-red-400"
                                    : "bg-purple-600 text-white border-purple-600"
                                  : result === "H"
                                  ? "bg-gray-300 text-slate-700 border-gray-400"
                                  : submitted
                                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              Home Win
                            </button>
                            <button 
                              onClick={()=>{
                                if (submitted) return;
                                const np=new Map(picks);
                                np.set(fixture.fixture_index,{fixture_index:fixture.fixture_index,pick:"D",matchday:currentTestGw!});
                                setPicks(np);
                              }} 
                              disabled={submitted}
                              className={`h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center ${
                                pick?.pick==="D"
                                  ? result && result === "D" && pick.pick === result
                                    ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white border-yellow-300 shadow-xl"
                                    : result && (result === "H" || result === "A")
                                    ? "bg-red-500 text-white border-red-400"
                                    : "bg-purple-600 text-white border-purple-600"
                                  : result === "D"
                                  ? "bg-gray-300 text-slate-700 border-gray-400"
                                  : submitted
                                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              Draw
                            </button>
                            <button 
                              onClick={()=>{
                                if (submitted) return;
                                const np=new Map(picks);
                                np.set(fixture.fixture_index,{fixture_index:fixture.fixture_index,pick:"A",matchday:currentTestGw!});
                                setPicks(np);
                              }} 
                              disabled={submitted}
                              className={`h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center ${
                                pick?.pick==="A"
                                  ? result && result === "A" && pick.pick === result
                                    ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white border-yellow-300 shadow-xl"
                                    : result && (result === "H" || result === "D")
                                    ? "bg-red-500 text-white border-red-400"
                                    : "bg-purple-600 text-white border-purple-600"
                                  : result === "A"
                                  ? "bg-gray-300 text-slate-700 border-gray-400"
                                  : submitted
                                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
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
        <div className="p-6 bg-white shadow-lg">
          <div className="max-w-2xl mx-auto space-y-4">
            {submitted ? (
              <div className="text-center py-6">
                <div className="text-lg font-bold text-slate-800 mb-2">Predictions Submitted (TEST)</div>
                <div className="text-sm text-slate-600">
                  Your test predictions for Test GW {currentTestGw} have been confirmed.
                </div>
                {myScore > 0 && (
                  <div className="mt-4 text-2xl font-bold text-purple-700">{myScore}/{fixtures.length}</div>
                )}
              </div>
            ) : (
              <>
                {!allPicksMade && (<div className="text-center text-sm text-amber-600 mb-2">You haven't made all your predictions yet</div>)}
                <div className="grid gap-3">
                  <button 
                    onClick={handleConfirmClick} 
                    disabled={!allPicksMade}
                    className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {allPicksMade ? "SUBMIT YOUR PREDICTIONS" : "Complete All Predictions First"}
                  </button>
                  {!allPicksMade && (
                    <button onClick={()=>navigate("/")} className="w-full py-3 text-slate-600 hover:text-slate-800 font-medium">Cancel</button>
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
  // Check all sessionStorage keys for this user (in case currentTestGw isn't set yet)
  const checkAllSessionStorage = (): boolean => {
    if (typeof window === 'undefined' || !user?.id) return false;
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(`test_api_submitted_`) && key.endsWith(`_${user.id}`)) {
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
  
  // CRITICAL: If submitted, force viewMode to "list" and never show cards
  // Use a computed value instead of state to avoid render-time state updates
  // This MUST be computed synchronously before any conditional rendering
  const effectiveViewMode = checkSubmittedBeforeSwipe ? "list" : viewMode;
  
  // CRITICAL: Early return to prevent ANY cards rendering if submitted
  // This must happen BEFORE any cards-related rendering
  // If submitted is detected (via any method), NEVER show cards
  if (checkSubmittedBeforeSwipe) {
    // If viewMode is still "cards", show loading until it updates
    if (viewMode === "cards") {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C8376]"></div>
      </div>
    );
  }
  
  // If no fixtures, show empty state
  if (fixtures.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center px-4 max-w-md">
          <div className="text-lg font-semibold text-slate-700 mb-2">No fixtures available</div>
          <div className="text-sm text-slate-500">Check back later for Test GW {currentTestGw} fixtures.</div>
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
    <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col overflow-hidden">
      {/* CRITICAL: Only render cards if NOT submitted - use ref for immediate check */}
      {/* Also add inline style to hide immediately if submitted (CSS failsafe) */}
      {shouldShowCardsRef.current && !checkSubmittedBeforeSwipe && !submitted && effectiveViewMode === "cards" && viewMode === "cards" && (
        <div 
          className="sticky top-0 z-40 px-4 pt-4 pb-2 bg-gradient-to-br from-slate-50 to-slate-100"
          style={{ display: checkSubmittedBeforeSwipe ? 'none' : 'block' }}
        >
          <div className="max-w-md mx-auto">
            <div className="relative flex items-center justify-center mb-4">
              <span className="text-lg font-extrabold text-slate-700">Gameweek {currentTestGw}</span>
              {!checkSubmittedBeforeSwipe && effectiveViewMode === "cards" && (
                <button
                  onClick={() => setCurrentIndex(fixtures.length)}
                  className="absolute right-0 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:shadow-lg hover:from-emerald-600 hover:via-emerald-700 hover:to-emerald-800"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  List View
                </button>
              )}
            </div>
            {!checkSubmittedBeforeSwipe && effectiveViewMode === "cards" && (
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
                          : "bg-white";
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-center transition-all ${isCurrent ? "h-2 w-6 rounded-full" : "h-3 w-3 rounded-full"} ${bgColor}`}
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
          </div>
        </div>
      )}
      {/* CRITICAL: If submitted, ONLY render list view - cards section is completely separate and never evaluated */}
      {(checkSubmittedBeforeSwipe || effectiveViewMode === "list") && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="flex items-center justify-center">
              <div className="text-center"><h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mt-0 mb-2">🎯 TEST DEPLOY - Predictions</h1><div className="mt-0 mb-4 text-base text-slate-500">Call every game, lock in your results.<br />DEPLOY TEST - If you see this, deployment is working!</div></div>
            </div>
            <div className="mt-2 mb-4"><div className="rounded-xl border bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 px-6 py-4"><div className="flex items-center justify-between"><div><div className="text-purple-900 font-semibold text-lg">Test GW {currentTestGw} Complete</div><div className="text-purple-900 text-sm font-bold mt-1">Your Score</div></div><div className="text-purple-900 text-5xl font-extrabold">{myScore}</div></div></div></div>
            {!checkSubmittedBeforeSwipe && (
              <div className="flex justify-center mt-4">
                <button 
                  onClick={() => {
                    setViewMode("cards");
                    setCurrentIndex(0);
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg"
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
      {/* CRITICAL: Cards section - ONLY render if NOT submitted and viewMode is cards */}
      {/* Use ref check first for immediate synchronous evaluation */}
      {shouldShowCardsRef.current && !checkSubmittedBeforeSwipe && !submitted && effectiveViewMode === "cards" && viewMode === "cards" && (
        <div className="flex flex-col min-h-0 overflow-hidden flex-1" style={{ height: '100%', paddingBottom: '0' }}>
          <div className="swipe-cards-container flex items-start justify-center px-4 relative overflow-hidden flex-1" style={{ minHeight: 0, width: '100%' }}>
            <div className={`absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 transition-opacity z-50 ${showFeedback === "home" ? "opacity-100" : "opacity-0"}`}><div className="text-6xl font-bold text-slate-700">←</div><div className="text-lg font-bold text-slate-700 bg-white px-4 py-2 rounded-full shadow-lg whitespace-nowrap">Home Win</div></div>
            <div className={`absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 transition-opacity z-50 ${showFeedback === "away" ? "opacity-100" : "opacity-0"}`}><div className="text-6xl font-bold text-slate-700">→</div><div className="text-lg font-bold text-slate-700 bg-white px-4 py-2 rounded-full shadow-lg whitespace-nowrap">Away Win</div></div>
            <div className={`absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-opacity z-50 ${showFeedback === "draw" ? "opacity-100" : "opacity-0"}`}><div className="text-6xl font-bold text-slate-700">↓</div><div className="text-lg font-bold text-slate-700 bg-white px-4 py-2 rounded-full shadow-lg">Draw</div></div>
            <div 
              className="max-w-md w-full relative" 
              style={{ 
                aspectRatio: '0.75',
                display: checkSubmittedBeforeSwipe ? 'none' : 'block' // CRITICAL: CSS failsafe to hide immediately
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
                  display: checkSubmittedBeforeSwipe ? 'none' : 'block' // CRITICAL: CSS failsafe
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
          <div className="fixed bottom-0 left-0 right-0 px-4 bg-[#eef4f3] z-[10000] safe-area-inset-bottom" style={{ paddingBottom: `calc(2rem + env(safe-area-inset-bottom, 0px))`, paddingTop: '1.5rem' }}>
            <div className="max-w-md mx-auto">
              <div className="flex items-stretch justify-center gap-3">
                <button
                  onClick={()=>handleButtonClick("H")}
                  disabled={isAnimating || submitted}
                  className="flex-1 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center bg-[#d7e6e3] text-slate-700 disabled:opacity-70"
                  style={{ backgroundColor: cardState.x < -30 ? `rgba(34, 197, 94, ${Math.min(0.8, Math.abs(cardState.x) / 150)})` : undefined, color: cardState.x < -30 ? '#fff' : undefined }}
                >
                  Home Win
                </button>
                <button
                  onClick={()=>handleButtonClick("D")}
                  disabled={isAnimating || submitted}
                  className="flex-1 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center bg-[#d7e6e3] text-slate-700 disabled:opacity-70"
                  style={{ backgroundColor: cardState.y > 30 ? `rgba(59, 130, 246, ${Math.min(0.8, cardState.y / 150)})` : undefined, color: cardState.y > 30 ? '#fff' : undefined }}
                >
                  Draw
                </button>
                <button
                  onClick={()=>handleButtonClick("A")}
                  disabled={isAnimating || submitted}
                  className="flex-1 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center bg-[#d7e6e3] text-slate-700 disabled:opacity-70"
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

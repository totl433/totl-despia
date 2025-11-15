import { useEffect, useMemo, useRef, useState } from "react";
import type { TouchEventHandler } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import ClubBadge from "../components/ClubBadge";
import { useNavigate } from "react-router-dom";

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

// Component that displays team badge/crest - uses API crest URL if available, falls back to ClubBadge
function TeamBadge({ 
  code, 
  crest, 
  size = 22, 
  className = "" 
}: { 
  code?: string | null; 
  crest?: string | null; 
  size?: number; 
  className?: string;
}) {
  const [imageError, setImageError] = useState(false);
  
  // If we have a crest URL and haven't errored, use it
  if (crest && !imageError) {
    return (
      <img
        src={crest}
        alt={`${code || 'Team'} badge`}
        width={size}
        height={size}
        className={`rounded object-contain inline-block align-middle select-none ${className}`}
        loading="lazy"
        onError={() => {
          // Fall back to ClubBadge if crest URL fails
          setImageError(true);
        }}
      />
    );
  }
  
  // Fall back to ClubBadge if we have a code
  if (code) {
    return <ClubBadge code={code} size={size} className={className} />;
  }
  
  // Fallback placeholder
  return (
    <div 
      className={`rounded bg-slate-200 ${className}`}
      style={{ width: size, height: size }}
    />
  );
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

export default function TestApiPredictions() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [currentTestGw, setCurrentTestGw] = useState<number | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [picks, setPicks] = useState<Map<number, Pick>>(new Map());
  const [results, setResults] = useState<Map<number, "H" | "D" | "A">>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards" as const);
  const [cardState, setCardState] = useState<CardState>({ x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showFeedback, setShowFeedback] = useState<"home" | "draw" | "away" | null>(null);
  const [returnToReview, setReturnToReview] = useState(false);
  const [confirmCelebration, setConfirmCelebration] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [isPastDeadline, setIsPastDeadline] = useState(false);
  // Live scores for test API fixtures
  const [liveScores, setLiveScores] = useState<Record<number, { homeScore: number; awayScore: number; status: string; minute?: number | null }>>({});

  useEffect(() => {
    // Only lock scrolling when in card swipe mode, not on review page
    const isReviewPage = currentIndex >= fixtures.length;
    const shouldLockScroll = viewMode === "cards" && !isReviewPage;
    
    if (!shouldLockScroll) {
      // Restore scrolling if we're on review page or list mode
      const html = document.documentElement;
      const body = document.body;
      const root = document.getElementById('root');
      
      html.style.removeProperty('overflow');
      body.style.removeProperty('overflow');
      body.style.removeProperty('position');
      body.style.removeProperty('width');
      body.style.removeProperty('height');
      if (root) {
        root.style.removeProperty('overflow');
      }
      return;
    }
    
    window.scrollTo({ top: 0, behavior: "auto" });
    // Prevent body scrolling - override global CSS !important rules
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    
    // Store original values
    const originalHtmlOverflow = html.style.overflow;
    const originalBodyOverflow = body.style.overflow;
    const originalBodyPosition = body.style.position;
    const originalRootOverflow = root?.style.overflow;
    
    // Set overflow hidden with !important via style attribute
    html.style.setProperty('overflow', 'hidden', 'important');
    body.style.setProperty('overflow', 'hidden', 'important');
    body.style.setProperty('position', 'fixed', 'important');
    body.style.setProperty('width', '100%', 'important');
    body.style.setProperty('height', '100%', 'important');
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
      // Restore original values
      html.style.overflow = originalHtmlOverflow;
      body.style.overflow = originalBodyOverflow;
      body.style.position = originalBodyPosition;
      body.style.width = '';
      body.style.height = '';
      if (root) {
        root.style.overflow = originalRootOverflow || '';
      }
      
      window.removeEventListener('wheel', preventWheel);
      document.removeEventListener('touchmove', preventScroll);
    };
  }, [viewMode, currentIndex, fixtures.length]);

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
        setLoading(true);

        // Get test GW from meta
        const { data: meta } = await supabase
          .from("test_api_meta")
          .select("current_test_gw")
          .eq("id", 1)
          .maybeSingle();
        
        const testGw = meta?.current_test_gw ?? 1;
        setCurrentTestGw(testGw);

        // Fetch fixtures from test_api_fixtures table
        const { data: savedFixtures, error: fixturesError } = await supabase
          .from("test_api_fixtures")
          .select("*")
          .eq("test_gw", testGw)
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
          id: String(f.api_match_id),
          gw: testGw,
          fixture_index: f.fixture_index,
          home_team: f.home_team,
          away_team: f.away_team,
          home_code: f.home_code,
          away_code: f.away_code,
          home_name: f.home_name,
          away_name: f.away_name,
          home_crest: f.home_crest || null,
          away_crest: f.away_crest || null,
          kickoff_time: f.kickoff_time,
          api_match_id: f.api_match_id || null,
        }));
        
        if (alive) {
          setFixtures(fixturesData);
          
          // Check if we're past the deadline
          if (fixturesData.length > 0 && fixturesData[0].kickoff_time) {
            const earliestKickoff = fixturesData.reduce((earliest, fixture) => {
              if (!fixture.kickoff_time) return earliest;
              const fixtureTime = new Date(fixture.kickoff_time);
              return !earliest || fixtureTime < earliest ? fixtureTime : earliest;
            }, null as Date | null);
            
            if (earliestKickoff) {
              const deadlineTime = new Date(earliestKickoff.getTime() - (75 * 60 * 1000));
              const now = new Date();
              setIsPastDeadline(now.getTime() > deadlineTime.getTime());
            }
          }

          // Initialize empty results map
          setResults(new Map());
        }

        // Fetch user's picks from TEST API table
        let hasPicks = false;
        if (user?.id) {
          const { data: pk, error: pkErr } = await supabase
            .from("test_api_picks")
            .select("matchday,fixture_index,pick")
            .eq("matchday", testGw)
            .eq("user_id", user.id);

          if (!pkErr && pk) {
            const picksMap = new Map<number, Pick>();
            (pk as any[]).forEach((p) => {
              picksMap.set(p.fixture_index, {
                fixture_index: p.fixture_index,
                pick: p.pick,
                matchday: p.matchday
              });
            });
            
            if (alive) {
              setPicks(picksMap);
              hasPicks = picksMap.size > 0;
            }
          }
        }
        
        // Check if user has submitted
        let isSubmitted = false;
        if (user?.id) {
          const { data: submission } = await supabase
            .from("test_api_submissions")
            .select("submitted_at")
            .eq("matchday", testGw)
            .eq("user_id", user.id)
            .maybeSingle();
          
          if (alive) {
            isSubmitted = Boolean(submission?.submitted_at);
            setSubmitted(isSubmitted);
          }
        }
        
        // If user has picks but not submitted, show review mode
        // If submitted, we'll show confirmed predictions view (separate from review)
        if (alive && fixturesData.length > 0 && hasPicks && !isSubmitted) {
          setCurrentIndex(fixturesData.length);
        }
      } catch (error) {
        console.error('Error loading test API data:', error);
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

  // Fetch live scores from Football Data API
  const fetchLiveScore = async (apiMatchId: number) => {
    try {
      // Try Netlify function first (works in production and with netlify dev)
      let response: Response;
      let match: any;
      
      try {
        response = await fetch(`/.netlify/functions/fetchFootballData?matchId=${apiMatchId}`, {
          method: 'GET',
        });
        
        if (response.ok) {
          const result = await response.json();
          // Netlify function returns { success: true, data: {...} }
          match = result.data || result;
        } else if (response.status === 404 || response.status === 0) {
          // Netlify function not available (local dev without netlify dev)
          console.warn('[TestApiPredictions] Netlify function not available, trying direct API call');
          throw new Error('Netlify function not available');
        } else {
          // Other error from Netlify function
          if (response.status === 429) {
            console.warn('[TestApiPredictions] Rate limited, will retry on next poll');
            return null;
          }
          console.error('[TestApiPredictions] Error from Netlify function:', response.status, response.statusText);
          return null;
        }
      } catch (fetchError: any) {
        // Netlify function failed, try direct API call as fallback (for local dev)
        if (fetchError.message === 'Netlify function not available' || fetchError.message.includes('Failed to fetch')) {
          console.log('[TestApiPredictions] Falling back to direct API call for local development');
          const FOOTBALL_DATA_API_KEY = 'ed3153d132b847db836289243894706e';
          response = await fetch(`https://api.football-data.org/v4/matches/${apiMatchId}`, {
            headers: {
              'X-Auth-Token': FOOTBALL_DATA_API_KEY,
            },
          });
          
          if (!response.ok) {
            if (response.status === 429) {
              console.warn('[TestApiPredictions] Rate limited, will retry on next poll');
              return null;
            }
            console.error('[TestApiPredictions] Error fetching live score:', response.status, response.statusText);
            return null;
          }
          
          match = await response.json();
        } else {
          throw fetchError;
        }
      }
      
      if (!match || !match.score) {
        console.warn('[TestApiPredictions] No score data in API response:', match);
        return null;
      }
      
      const homeScore = match.score.fullTime?.home ?? match.score.halfTime?.home ?? 0;
      const awayScore = match.score.fullTime?.away ?? match.score.halfTime?.away ?? 0;
      const status = match.status || 'SCHEDULED';
      const minute = match.minute ?? null;
      
      return { homeScore, awayScore, status, minute };
    } catch (error) {
      console.error('[TestApiPredictions] Error fetching live score:', error);
      return null;
    }
  };

  // Poll for live scores
  useEffect(() => {
    if (!fixtures.length) return;
    
    // Only poll first 3 fixtures
    const fixturesToPoll = fixtures.slice(0, 3).filter(f => f.api_match_id && f.kickoff_time);
    if (fixturesToPoll.length === 0) return;
    
    const intervals = new Map<number, ReturnType<typeof setInterval>>();
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    
    fixturesToPoll.forEach((fixture) => {
      if (!fixture.api_match_id || !fixture.kickoff_time) return;
      
      const kickoffTime = new Date(fixture.kickoff_time);
      const now = new Date();
      const fixtureIndex = fixture.fixture_index;
      
      // Helper function to start polling for a fixture
      const startPolling = () => {
        // Check if game is already finished
        const currentScore = liveScores[fixtureIndex];
        if (currentScore && currentScore.status === 'FINISHED') {
          // Already finished, don't poll
          return;
        }
        
        // Track HT state to resume polling after 15 minutes
        const htResumeTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
        
        const poll = async () => {
          const scoreData = await fetchLiveScore(fixture.api_match_id!);
          if (scoreData) {
            const isLive = scoreData.status === 'IN_PLAY' || scoreData.status === 'PAUSED';
            const isHalfTime = scoreData.status === 'HALF_TIME' || scoreData.status === 'HT';
            const isFinished = scoreData.status === 'FINISHED';
            
            console.log('[TestApiPredictions] Poll result for fixture', fixtureIndex, ':', {
              status: scoreData.status,
              isLive,
              isHalfTime,
              isFinished,
              homeScore: scoreData.homeScore,
              awayScore: scoreData.awayScore,
              minute: scoreData.minute
            });
            
            setLiveScores(prev => ({
              ...prev,
              [fixtureIndex]: {
                homeScore: scoreData.homeScore,
                awayScore: scoreData.awayScore,
                status: scoreData.status,
                minute: scoreData.minute ?? null
              }
            }));
            
            // Handle different game states
            if (isFinished) {
              // Game finished - stop polling
              console.log('[TestApiPredictions] Game', fixtureIndex, 'finished, stopping polling');
              const pollInterval = intervals.get(fixtureIndex);
              if (pollInterval) {
                clearInterval(pollInterval);
                intervals.delete(fixtureIndex);
              }
              // Clear any HT resume timeout
              const htTimeout = htResumeTimeouts.get(fixtureIndex);
              if (htTimeout) {
                clearTimeout(htTimeout);
                htResumeTimeouts.delete(fixtureIndex);
              }
            } else if (isHalfTime) {
              // Half-time - stop polling, resume in 15 minutes
              console.log('[TestApiPredictions] Game', fixtureIndex, 'at half-time, stopping polling, will resume in 15 minutes');
              const pollInterval = intervals.get(fixtureIndex);
              if (pollInterval) {
                clearInterval(pollInterval);
                intervals.delete(fixtureIndex);
              }
              
              // Clear any existing HT resume timeout
              const existingTimeout = htResumeTimeouts.get(fixtureIndex);
              if (existingTimeout) {
                clearTimeout(existingTimeout);
              }
              
              // Set timeout to resume polling in 15 minutes
              const htResumeTimeout = setTimeout(() => {
                console.log('[TestApiPredictions] Resuming polling for fixture', fixtureIndex, 'after half-time');
                // Resume polling every minute until game starts or finishes
                const resumePoll = async () => {
                  const resumeScoreData = await fetchLiveScore(fixture.api_match_id!);
                  if (resumeScoreData) {
                    const resumeIsFinished = resumeScoreData.status === 'FINISHED';
                    const resumeIsLive = resumeScoreData.status === 'IN_PLAY' || resumeScoreData.status === 'PAUSED';
                    const resumeIsHalfTime = resumeScoreData.status === 'HALF_TIME' || resumeScoreData.status === 'HT';
                    
                    setLiveScores(prev => ({
                      ...prev,
                      [fixtureIndex]: {
                        homeScore: resumeScoreData.homeScore,
                        awayScore: resumeScoreData.awayScore,
                        status: resumeScoreData.status,
                        minute: resumeScoreData.minute ?? null
                      }
                    }));
                    
                    if (resumeIsFinished) {
                      console.log('[TestApiPredictions] Game', fixtureIndex, 'finished, stopping polling');
                      const resumeInterval = intervals.get(fixtureIndex);
                      if (resumeInterval) {
                        clearInterval(resumeInterval);
                        intervals.delete(fixtureIndex);
                      }
                      htResumeTimeouts.delete(fixtureIndex);
                    } else if (resumeIsLive) {
                      // Second half has started - continue polling every minute until FT
                      console.log('[TestApiPredictions] Game', fixtureIndex, 'second half started - status:', resumeScoreData.status, 'minute:', resumeScoreData.minute);
                    } else if (resumeIsHalfTime) {
                      // Still at half-time, keep polling every minute until second half starts
                      console.log('[TestApiPredictions] Game', fixtureIndex, 'still at half-time, continuing to poll...');
                    }
                  }
                };
                
                resumePoll(); // Poll immediately
                const resumeInterval = setInterval(resumePoll, 60 * 1000); // Every 1 minute
                intervals.set(fixtureIndex, resumeInterval);
                htResumeTimeouts.delete(fixtureIndex);
              }, 15 * 60 * 1000); // 15 minutes
              
              htResumeTimeouts.set(fixtureIndex, htResumeTimeout);
            } else if (isLive) {
              console.log('[TestApiPredictions] Game', fixtureIndex, 'is LIVE - status:', scoreData.status, 'minute:', scoreData.minute);
            }
          }
        };
        
        poll(); // Poll immediately
        const pollInterval = setInterval(poll, 60 * 1000); // Every 1 minute
        intervals.set(fixtureIndex, pollInterval);
      };
      
      if (kickoffTime > now) {
        const delay = kickoffTime.getTime() - now.getTime();
        const timeout = setTimeout(startPolling, delay);
        timeouts.push(timeout);
      } else {
        // Kickoff already happened, start polling immediately
        startPolling();
      }
    });
    
    return () => {
      console.log('[TestApiPredictions] Cleaning up polling intervals and timeouts');
      intervals.forEach(clearInterval);
      timeouts.forEach(clearTimeout);
    };
  }, [fixtures.map(f => f.api_match_id).join(',')]);

  // Update results map based on live scores
  useEffect(() => {
    const newResults = new Map<number, "H" | "D" | "A">();
    
    // Check live scores for first 3 fixtures
    const fixturesToCheck = fixtures.slice(0, 3);
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

  // Keep cards view - don't auto-switch to list view
  // useEffect(() => {
  //   if (fixtures.length > 0 && user?.id) {
  //     const allMade = fixtures.every(f => picks.has(f.fixture_index));
  //     setViewMode(allMade ? "list" : "cards");
  //   } else {
  //     setViewMode("cards");
  //   }
  // }, [fixtures, picks, user?.id]);

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
    if (isAnimating || isPastDeadline || submitted) return;
    setIsDragging(true);
    startPosRef.current = { x: clientX, y: clientY };
    setShowFeedback(null);
  };
  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || isAnimating || isPastDeadline || submitted) return;
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
    if (!isDragging || isAnimating || isPastDeadline || submitted) return;
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
    if (!isAnimating && !isPastDeadline && !submitted) animateCardOut(pick); 
  };
  
  const savePick = async (pick: "H" | "D" | "A") => {
    if (!currentFixture || !user?.id || !currentTestGw) return;
    
    // Update local state
    const newPicks = new Map(picks);
    newPicks.set(currentFixture.fixture_index, { 
      fixture_index: currentFixture.fixture_index, 
      pick, 
      matchday: currentTestGw 
    });
    setPicks(newPicks);

    // Save to database
    try {
      const { error } = await supabase
        .from('test_api_picks')
        .upsert({
          user_id: user.id,
          matchday: currentTestGw,
          fixture_index: currentFixture.fixture_index,
          pick: pick
        }, { 
          onConflict: 'user_id,matchday,fixture_index',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('Error saving test pick:', error);
      }
    } catch (error) {
      console.error('Error saving test pick:', error);
    }
  };
  
  const handleStartOver = async () => {
    if (!user?.id || !currentTestGw) return;
    
    // Reset picks in state
    setPicks(new Map());
    setCurrentIndex(0);
    setSubmitted(false);
    
    // Delete picks from database
    try {
      await supabase
        .from('test_api_picks')
        .delete()
        .eq('user_id', user.id)
        .eq('matchday', currentTestGw);
      
      // Delete submission if exists
      await supabase
        .from('test_api_submissions')
        .delete()
        .eq('user_id', user.id)
        .eq('matchday', currentTestGw);
    } catch (error) {
      console.error('Error resetting picks:', error);
    }
  };

  const handleConfirmClick = async () => {
    if (!allPicksMade) {
      setConfirmCelebration({ success: false, message: "You still have fixtures to call!" });
      setTimeout(() => setConfirmCelebration(null), 2200);
      return;
    }
    
    if (!user?.id || !currentTestGw) return;

    try {
      // Save all picks
      const picksArray = Array.from(picks.values()).map(pick => ({
        user_id: user.id,
        matchday: pick.matchday,
        fixture_index: pick.fixture_index,
        pick: pick.pick
      }));

      const { error: picksError } = await supabase
        .from('test_api_picks')
        .upsert(picksArray, { 
          onConflict: 'user_id,matchday,fixture_index',
          ignoreDuplicates: false 
        });

      if (picksError) throw picksError;

      // Save submission
      const { error: submissionError } = await supabase
        .from('test_api_submissions')
        .upsert({
          user_id: user.id,
          matchday: currentTestGw,
          submitted_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,matchday'
        });

      if (submissionError) throw submissionError;

      setSubmitted(true);
      setConfirmCelebration({ success: true, message: "Your test predictions are locked in. Good luck!" });
      setTimeout(() => {
        setConfirmCelebration(null);
      }, 2500);
    } catch (error) {
      console.error('Error confirming test picks:', error);
      setConfirmCelebration({ success: false, message: "Failed to confirm predictions. Please try again." });
      setTimeout(() => setConfirmCelebration(null), 2200);
    }
  };

  if (loading || !currentTestGw) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading test fixtures...</div>
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

  // Confirmed Predictions View (after submission) - separate from review mode
  if (submitted) {
    // Calculate live score (includes both live and finished games)
    let liveScoreCount = 0;
    let liveFixturesCount = 0;
    const fixturesToCheck = fixtures.slice(0, 3);
    fixturesToCheck.forEach(f => {
      const liveScore = liveScores[f.fixture_index];
      const isLive = liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
      const isFinished = liveScore && liveScore.status === 'FINISHED';
      
      if (isLive) {
        liveFixturesCount++;
      }
      
      if (liveScore && (isLive || isFinished)) {
        const pick = picks.get(f.fixture_index);
        if (pick) {
          let isCorrect = false;
          if (pick.pick === 'H' && liveScore.homeScore > liveScore.awayScore) isCorrect = true;
          else if (pick.pick === 'A' && liveScore.awayScore > liveScore.homeScore) isCorrect = true;
          else if (pick.pick === 'D' && liveScore.homeScore === liveScore.awayScore) isCorrect = true;
          if (isCorrect) liveScoreCount++;
        }
      }
    });

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
        <div className="p-4">
          <div className="max-w-2xl mx-auto">
            <div className="relative flex items-center justify-between">
              <button
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <span className="absolute left-1/2 -translate-x-1/2 text-lg font-extrabold text-slate-700">
                Confirmed Predictions
              </span>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-4">
          <div className="max-w-2xl mx-auto space-y-6 [&>div:first-child]:mt-0">
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
                <div key={groupIdx} className={groupIdx === 0 ? '-mt-2' : ''}>
                  <div className="text-lg font-semibold text-slate-800 mb-4 flex items-center justify-between">
                    <span>{group.label}</span>
                    {groupIdx === 0 && fixturesToCheck.length > 0 && fixturesToCheck.some(f => {
                      const liveScore = liveScores[f.fixture_index];
                      return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED');
                    }) && (() => {
                      // Check if all fixtures are finished
                      const checkAllFinished = fixturesToCheck.every(f => {
                        const liveScore = liveScores[f.fixture_index];
                        return liveScore && liveScore.status === 'FINISHED';
                      });
                      return (
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white shadow-lg ${checkAllFinished ? 'bg-slate-600 shadow-slate-500/30' : 'bg-red-600 shadow-red-500/30'}`}>
                          {!checkAllFinished && liveFixturesCount > 0 && (
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                          )}
                          {checkAllFinished && (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                          )}
                          <span className="text-xs sm:text-sm font-medium opacity-90">{checkAllFinished ? 'Score' : 'Live'}</span>
                        <span className="flex items-baseline gap-0.5">
                          <span className="text-lg sm:text-xl font-extrabold">{liveScoreCount}</span>
                          <span className="text-sm sm:text-base font-medium opacity-90">/</span>
                          <span className="text-base sm:text-lg font-semibold opacity-80">{fixturesToCheck.length}</span>
                        </span>
                      </div>
                      );
                    })()}
                  </div>
                  <div className="flex flex-col rounded-xl border bg-white overflow-hidden shadow-sm">
                    {group.items.map((fixture, index)=>{
                      const pick = picks.get(fixture.fixture_index);
                      const liveScore = liveScores[fixture.fixture_index];
                      const isLive = liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
                      
                      // Get team names
                      const homeName = fixture.home_name || fixture.home_team || "";
                      const awayName = fixture.away_name || fixture.away_team || "";
                      
                      const kickoff = fixture.kickoff_time
                        ? (() => {
                            const d = new Date(fixture.kickoff_time);
                            const hh = String(d.getUTCHours()).padStart(2, '0');
                            const mm = String(d.getUTCMinutes()).padStart(2, '0');
                            return `${hh}:${mm}`;
                          })()
                        : "—";
                      
                      // Determine button states (use live score if available)
                      const isFinished = liveScore && liveScore.status === 'FINISHED';
                      const getButtonState = (side: "H" | "D" | "A") => {
                        const isPicked = pick?.pick === side;
                        let isCorrectResult = false;
                        if (liveScore) {
                          if (side === 'H' && liveScore.homeScore > liveScore.awayScore) isCorrectResult = true;
                          else if (side === 'A' && liveScore.awayScore > liveScore.homeScore) isCorrectResult = true;
                          else if (side === 'D' && liveScore.homeScore === liveScore.awayScore) isCorrectResult = true;
                        }
                        const isCorrect = isPicked && isCorrectResult;
                        // Wrong if picked but not correct result (for both live and finished games)
                        const isWrong = isPicked && (isLive || isFinished) && !isCorrectResult;
                        return { isPicked, isCorrectResult, isCorrect, isWrong };
                      };

                      const homeState = getButtonState("H");
                      const drawState = getButtonState("D");
                      const awayState = getButtonState("A");

                      // Button styling helper (matching Home Page)
                      const getButtonClass = (state: { isPicked: boolean; isCorrectResult: boolean; isCorrect: boolean; isWrong: boolean }) => {
                        const base = "h-16 rounded-xl border text-sm font-medium transition-all flex items-center justify-center select-none";
                        const isLiveAndCorrect = isLive && state.isCorrectResult;
                        // Shiny gradient ONLY when game is FINISHED and pick is correct
                        if (state.isCorrect && isFinished) {
                          return `${base} bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white !border-0 !border-none shadow-2xl shadow-yellow-400/40 transform scale-110 rotate-1 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]`;
                        } else if (state.isCorrect && isLive) {
                          // Live and correct - pulse in emerald green
                          return `${base} bg-emerald-600 text-white border-emerald-600 animate-pulse shadow-lg shadow-emerald-500/50`;
                        } else if (state.isCorrectResult) {
                          return `${base} bg-emerald-600 text-white border-emerald-600 ${isLiveAndCorrect ? 'animate-pulse shadow-lg shadow-emerald-500/50' : ''}`;
                        } else if (state.isWrong && isFinished) {
                          // Wrong pick in finished game - grey background with flashing red border and strikethrough
                          return `${base} bg-slate-50 text-slate-600 border-4 animate-[flash-border_1s_ease-in-out_infinite]`;
                        } else if (state.isWrong && isLive) {
                          // Wrong pick in live game - grey background with flashing red border, no strikethrough until FT
                          return `${base} bg-slate-50 text-slate-600 border-4 animate-[flash-border_1s_ease-in-out_infinite]`;
                        } else if (state.isPicked) {
                          return `${base} bg-[#1C8376] text-white border-[#1C8376]`;
                        } else {
                          return `${base} bg-slate-50 text-slate-600 border-slate-200`;
                        }
                      };
                      
                      return (
                        <div key={fixture.id} className={index < group.items.length - 1 ? 'relative' : ''}>
                          {index < group.items.length - 1 && (
                            <div className="absolute bottom-0 left-4 right-4 h-px bg-slate-200 z-10" />
                          )}
                          <div className="p-4 !bg-white relative z-0">
                            {/* LIVE indicator - red dot top left */}
                            {isLive && (
                              <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pb-6">
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-xs font-bold text-red-600">{liveScore.minute ?? 'LIVE'}'</span>
                              </div>
                            )}
                            
                            {/* header: Home  score/kickoff  Away */}
                            <div className={`flex flex-col px-2 pb-3 ${isLive ? 'pt-4' : 'pt-1'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 flex-1 justify-end">
                                  <div className="font-medium break-words">{homeName}</div>
                                  <img 
                                    src={`/assets/badges/${(fixture.home_code || homeName).toUpperCase()}.png`} 
                                    alt={homeName}
                                    className="w-5 h-5"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                </div>
                                <div className="px-4 flex items-center">
                                  {liveScore && (isLive || isFinished) ? (
                                    <span className="font-bold text-base text-slate-900">
                                      {liveScore.homeScore} - {liveScore.awayScore}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 text-sm">{kickoff}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 flex-1 justify-start">
                                  <img 
                                    src={`/assets/badges/${(fixture.away_code || awayName).toUpperCase()}.png`} 
                                    alt={awayName}
                                    className="w-5 h-5"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                  <div className="font-medium break-words">{awayName}</div>
                                </div>
                              </div>
                              {liveScore && (isLive || isFinished) && (
                                <div className="flex justify-center mt-1">
                                  <span className={`text-[10px] font-semibold ${isLive ? 'text-red-600' : 'text-slate-500'}`}>
                                    {isFinished ? 'FT' : (liveScore.minute ? `${liveScore.minute}'` : 'LIVE')}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* buttons: Home Win, Draw, Away Win */}
                            <div className="grid grid-cols-3 gap-3 relative">
                              <div className={`${getButtonClass(homeState)} flex items-center justify-center`}>
                                <span className={`${homeState.isCorrect ? "font-bold" : ""} ${homeState.isWrong && isFinished ? "line-through decoration-2 decoration-red-200" : ""}`}>Home Win</span>
                              </div>
                              <div className={`${getButtonClass(drawState)} flex items-center justify-center`}>
                                <span className={`${drawState.isCorrect ? "font-bold" : ""} ${drawState.isWrong && isFinished ? "line-through decoration-2 decoration-red-200" : ""}`}>Draw</span>
                              </div>
                              <div className={`${getButtonClass(awayState)} flex items-center justify-center`}>
                                <span className={`${awayState.isCorrect ? "font-bold" : ""} ${awayState.isWrong && isFinished ? "line-through decoration-2 decoration-red-200" : ""}`}>Away Win</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              });
            })()}
          </div>
        </div>
        <div className="p-6 bg-white shadow-lg">
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-lg font-bold text-green-600 mb-2">✅ Predictions Submitted! (TEST)</div>
            <div className="text-sm text-slate-600 mb-4">
              Your test predictions for Test GW {currentTestGw} have been confirmed.
            </div>
            {myScore > 0 && (
              <div className="mt-4 text-3xl font-bold text-purple-700">{myScore}/{fixtures.length}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Review Mode (when picks exist but not submitted)
  if (currentIndex >= fixtures.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
        {confirmCelebration && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative overflow-hidden rounded-3xl bg-white px-10 py-8 text-center shadow-2xl max-w-sm mx-4">
              <div className="absolute -top-16 -left-10 h-32 w-32 rounded-full bg-emerald-200/40 blur-2xl" />
              <div className="absolute -bottom-14 -right-12 h-32 w-32 rounded-full bg-cyan-200/40 blur-2xl" />
              <div className="relative z-10 space-y-4">
                <div className="text-5xl">{confirmCelebration.success ? "🎉" : "📝"}</div>
                <div className={`text-2xl font-extrabold ${confirmCelebration.success ? "text-emerald-700" : "text-amber-600"}`}>
                  {confirmCelebration.success ? "Good Luck!" : "Not Quite Yet!"}
                </div>
                <p className="text-sm text-slate-600">{confirmCelebration.message}</p>
              </div>
            </div>
          </div>
        )}
        <div className="p-4">
          <div className="max-w-2xl mx-auto">
            <div className="relative flex items-center justify-between">
              <button
                onClick={() => setCurrentIndex(0)}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <span className="absolute left-1/2 -translate-x-1/2 text-lg font-extrabold text-slate-700">Review Mode</span>
              {allPicksMade && !submitted ? (
                <button
                  onClick={handleConfirmClick}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-emerald-600"
                >
                  Confirm
                </button>
              ) : submitted ? (
                <span className="text-sm text-green-600 font-semibold">✓ Submitted</span>
              ) : picks.size > 0 ? (
                <button
                  onClick={handleConfirmClick}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-inner"
                >
                  Confirm
                </button>
              ) : (
                <button
                  onClick={() => setCurrentIndex(0)}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:shadow-lg hover:from-emerald-600 hover:via-emerald-700 hover:to-emerald-800"
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
                            <div className="flex-1 min-w-0 text-right"><span className="text-sm font-semibold text-slate-800 truncate inline-block">{fixture.home_name || fixture.home_team}</span></div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <TeamBadge code={fixture.home_code} crest={fixture.home_crest} size={28} />
                              <div className="text-slate-400 font-medium text-sm">{fixture.kickoff_time ? new Date(fixture.kickoff_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''}</div>
                              <TeamBadge code={fixture.away_code} crest={fixture.away_crest} size={28} />
                            </div>
                            <div className="flex-1 min-w-0 text-left"><span className="text-sm font-semibold text-slate-800 truncate inline-block">{fixture.away_name || fixture.away_team}</span></div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <button 
                              onClick={()=>{
                                if (isPastDeadline || submitted) return;
                                const np=new Map(picks);
                                np.set(fixture.fixture_index,{fixture_index:fixture.fixture_index,pick:"H",matchday:currentTestGw!});
                                setPicks(np);
                                savePick("H");
                              }} 
                              disabled={isPastDeadline || submitted}
                              className={`h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center ${
                                pick?.pick==="H"
                                  ? result && result === "H" && pick.pick === result
                                    ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white border-yellow-300 shadow-xl"
                                    : result && (result === "D" || result === "A")
                                    ? "bg-red-500 text-white border-red-400"
                                    : "bg-purple-600 text-white border-purple-600"
                                  : result === "H"
                                  ? "bg-gray-300 text-slate-700 border-gray-400"
                                  : isPastDeadline || submitted
                                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              Home Win
                            </button>
                            <button 
                              onClick={()=>{
                                if (isPastDeadline || submitted) return;
                                const np=new Map(picks);
                                np.set(fixture.fixture_index,{fixture_index:fixture.fixture_index,pick:"D",matchday:currentTestGw!});
                                setPicks(np);
                                savePick("D");
                              }} 
                              disabled={isPastDeadline || submitted}
                              className={`h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center ${
                                pick?.pick==="D"
                                  ? result && result === "D" && pick.pick === result
                                    ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white border-yellow-300 shadow-xl"
                                    : result && (result === "H" || result === "A")
                                    ? "bg-red-500 text-white border-red-400"
                                    : "bg-purple-600 text-white border-purple-600"
                                  : result === "D"
                                  ? "bg-gray-300 text-slate-700 border-gray-400"
                                  : isPastDeadline || submitted
                                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              Draw
                            </button>
                            <button 
                              onClick={()=>{
                                if (isPastDeadline || submitted) return;
                                const np=new Map(picks);
                                np.set(fixture.fixture_index,{fixture_index:fixture.fixture_index,pick:"A",matchday:currentTestGw!});
                                setPicks(np);
                                savePick("A");
                              }} 
                              disabled={isPastDeadline || submitted}
                              className={`h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center ${
                                pick?.pick==="A"
                                  ? result && result === "A" && pick.pick === result
                                    ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white border-yellow-300 shadow-xl"
                                    : result && (result === "H" || result === "D")
                                    ? "bg-red-500 text-white border-red-400"
                                    : "bg-purple-600 text-white border-purple-600"
                                  : result === "A"
                                  ? "bg-gray-300 text-slate-700 border-gray-400"
                                  : isPastDeadline || submitted
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
            {fixtures.length>0 && fixtures[0].kickoff_time && (
              <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-700">
                  <span className="text-lg">⏱️</span>
                  <span className="text-sm font-semibold">Deadline</span>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-emerald-900">
                    {new Date(new Date(fixtures[0].kickoff_time).getTime() - (75*60*1000)).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                  <div className="text-[11px] font-medium text-emerald-600">75 mins before first kickoff</div>
                </div>
              </div>
            )}
            {submitted ? (
              <div className="text-center py-6">
                <div className="text-lg font-bold text-green-600 mb-2">✅ Predictions Submitted! (TEST)</div>
                <div className="text-sm text-slate-600">
                  Your test predictions for Test GW {currentTestGw} have been confirmed.
                </div>
                {myScore > 0 && (
                  <div className="mt-4 text-2xl font-bold text-purple-700">{myScore}/{fixtures.length}</div>
                )}
              </div>
            ) : isPastDeadline ? (
              <div className="text-center py-6">
                <div className="text-lg font-bold text-red-600 mb-2">⚠️ Deadline Passed</div>
                <div className="text-sm text-slate-600">
                  Predictions are now closed.
                </div>
              </div>
            ) : (
              <>
                {!allPicksMade && (<div className="text-center text-sm text-amber-600 mb-2">⚠️ You haven't made all your predictions yet</div>)}
                <div className="grid gap-3">
                  <button 
                    onClick={handleStartOver}
                    disabled={submitted || isPastDeadline}
                    className="w-full py-3 bg-slate-200 text-slate-700 rounded-2xl font-semibold hover:bg-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start Over
                  </button>
                  <button 
                    onClick={handleConfirmClick} 
                    disabled={!allPicksMade}
                    className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {allPicksMade?"Confirm Predictions (TEST)":"Complete All Predictions First"}
                  </button>
                  <button onClick={()=>navigate("/")} className="w-full py-3 text-slate-600 hover:text-slate-800 font-medium">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col overflow-hidden">
      {viewMode === "cards" && (
        <div className="sticky top-0 z-40 px-4 pt-4 pb-2 bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="max-w-md mx-auto">
            <div className="relative flex items-center justify-between mb-4">
              <button onClick={()=>navigate("/")} className="text-slate-600 hover:text-slate-800 text-3xl font-bold w-10 h-10 flex items-center justify-center">✕</button>
              <span className="absolute left-1/2 -translate-x-1/2 text-lg font-extrabold text-slate-700">Test GW {currentTestGw}</span>
              {viewMode === "cards" && (
                <button
                  onClick={() => setCurrentIndex(fixtures.length)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:shadow-lg hover:from-emerald-600 hover:via-emerald-700 hover:to-emerald-800"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  List View
                </button>
              )}
            </div>
            {viewMode === "cards" && (
              <div className="mt-4 flex justify-center mb-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#e6f3f0] px-3 py-2">
                  {fixtures.map((_, idx) => {
                    const isComplete = idx < currentIndex;
                    const isCurrent = idx === currentIndex;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-center transition-all ${isCurrent ? "h-2 w-6 rounded-full bg-[#178f72]" : "h-3 w-3 rounded-full"} ${isComplete && !isCurrent ? "bg-[#116f59]" : !isCurrent ? "bg-white" : ""}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {viewMode === "list" ? (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="relative flex items-center justify-center">
              <button onClick={()=>navigate('/')} className="absolute left-0 top-0 w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-800 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              <div className="text-center"><h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mt-0 mb-2">Test API Predictions</h1><div className="mt-0 mb-4 text-base text-slate-500">Call every game, lock in your results.<br />This is a TEST game.</div></div>
            </div>
            <div className="mt-2 mb-4"><div className="rounded-xl border bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 px-6 py-4"><div className="flex items-center justify-between"><div><div className="text-purple-900 font-semibold text-lg">Test GW {currentTestGw} Complete</div><div className="text-purple-900 text-sm font-bold mt-1">Your Score</div></div><div className="text-purple-900 text-5xl font-extrabold">{myScore}</div></div></div></div>
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
          </div>
        </div>
      ) : (
        <div className="flex flex-col min-h-0 overflow-hidden flex-1 pb-[90px]" style={{ height: '100%' }}>
          <div className="flex items-center justify-center px-4 relative overflow-hidden pt-2" style={{ minHeight: 0 }}>
            <div className={`absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 transition-opacity z-50 ${showFeedback === "home" ? "opacity-100" : "opacity-0"}`}><div className="text-6xl font-bold text-slate-700">←</div><div className="text-lg font-bold text-slate-700 bg-white px-4 py-2 rounded-full shadow-lg whitespace-nowrap">Home Win</div></div>
            <div className={`absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 transition-opacity z-50 ${showFeedback === "away" ? "opacity-100" : "opacity-0"}`}><div className="text-6xl font-bold text-slate-700">→</div><div className="text-lg font-bold text-slate-700 bg-white px-4 py-2 rounded-full shadow-lg whitespace-nowrap">Away Win</div></div>
            <div className={`absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-opacity z-50 ${showFeedback === "draw" ? "opacity-100" : "opacity-0"}`}><div className="text-6xl font-bold text-slate-700">↓</div><div className="text-lg font-bold text-slate-700 bg-white px-4 py-2 rounded-full shadow-lg">Draw</div></div>
            <div className="max-w-md w-full relative" style={{ aspectRatio: '0.75' }}>
              {currentIndex < fixtures.length - 1 && (() => {
                const nextFixture = fixtures[currentIndex + 1];
                return (
                  <div key={currentIndex + 1} className="absolute inset-0 pointer-events-none" style={{ transform: `scale(1)`, opacity: (isDragging || isAnimating) ? 0.5 : 0, zIndex: 1, transition: 'opacity 0.15s ease-out' }}>
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden select-none">
                      <div className="pt-2 px-8 pb-8">
                        {nextFixture.kickoff_time && (<div className="text-center mb-1"><div className="text-sm text-slate-500 font-medium">{new Date(nextFixture.kickoff_time).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</div></div>)}
                        <div className="flex items-center justify-center gap-4 mb-4">
                          <div className="flex flex-col items-center"><TeamBadge code={nextFixture.home_code} crest={nextFixture.home_crest} size={120} /><div className="text-sm font-bold text-slate-700 mt-4 text-center max-w-[120px]">{nextFixture.home_name || nextFixture.home_team}</div></div>
                          <div className="flex flex-col items-center mb-8">{nextFixture.kickoff_time && (<div className="text-sm text-slate-700">{new Date(nextFixture.kickoff_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>)}</div>
                          <div className="flex flex-col items-center"><TeamBadge code={nextFixture.away_code} crest={nextFixture.away_crest} size={120} /><div className="text-sm font-bold text-slate-700 mt-4 text-center max-w-[120px]">{nextFixture.away_name || nextFixture.away_team}</div></div>
                        </div>
                      </div>
                      <div className="h-48 relative overflow-hidden">
                        <div style={{ position: 'absolute', inset: 0, background: getTeamColor(nextFixture.home_code, nextFixture.home_name), clipPath: 'polygon(0 0, 0 100%, 100% 100%)' }} />
                        <div style={{ position: 'absolute', inset: 0, background: getTeamColor(nextFixture.away_code, nextFixture.away_name), clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} />
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div
                ref={cardRef}
                className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
                style={{ transform: `translate(${cardState.x}px, ${cardState.y}px) rotate(${cardState.rotation}deg) scale(${cardState.scale})`, opacity: cardState.opacity, transition: (isDragging || isResettingRef.current) ? "none" : "all 0.3s ease-out", touchAction: "none" }}
                onMouseDown={(e)=>!isPastDeadline && !submitted && handleStart(e.clientX,e.clientY)} 
                onMouseMove={(e)=>!isPastDeadline && !submitted && handleMove(e.clientX,e.clientY)} 
                onMouseUp={handleEnd} 
                onMouseLeave={handleEnd}
                onTouchStart={handleTouchStart} 
                onTouchMove={handleTouchMove} 
                onTouchEnd={handleTouchEnd}
              >
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden select-none">
                  <div className="pt-2 px-8 pb-8 relative pointer-events-none">
                    <div className="absolute top-2 right-4 flex items-center gap-2 text-slate-400 text-xs font-semibold">
                      <img
                        src="https://cdn-icons-png.flaticon.com/512/4603/4603384.png"
                        alt="Swipe gesture icon"
                        className="w-6 h-6 opacity-80"
                      />
                    </div>
                    {currentFixture.kickoff_time && (<div className="text-center mb-1"><div className="text-sm text-slate-500 font-medium">{new Date(currentFixture.kickoff_time).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</div></div>)}
                    <div className="flex items-center justify-center gap-4 mb-4">
                      <div className="flex flex-col items-center"><TeamBadge code={currentFixture.home_code} crest={currentFixture.home_crest} size={120} /><div className="text-sm font-bold text-slate-700 mt-4 text-center max-w-[120px]">{currentFixture.home_name || currentFixture.home_team}</div></div>
                      <div className="flex flex-col items-center mb-8">{currentFixture.kickoff_time && (<div className="text-sm text-slate-700">{new Date(currentFixture.kickoff_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>)}</div>
                      <div className="flex flex-col items-center"><TeamBadge code={currentFixture.away_code} crest={currentFixture.away_crest} size={120} /><div className="text-sm font-bold text-slate-700 mt-4 text-center max-w-[120px]">{currentFixture.away_name || currentFixture.away_team}</div></div>
                    </div>
                    {(() => {
                      const fixtureResult = results.get(currentFixture.fixture_index);
                      const userPick = picks.get(currentFixture.fixture_index);
                      if (fixtureResult && userPick) {
                        const isCorrect = userPick.pick === fixtureResult;
                        return (
                          <div className="text-center mb-4 space-y-2">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-semibold"><span>🎯</span><span>Result: {fixtureResult === "H" ? "Home Win" : fixtureResult === "A" ? "Away Win" : "Draw"}</span></div>
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${isCorrect?"bg-green-50 text-green-700":"bg-red-50 text-red-700"}`}><span>{isCorrect?"✓":"✗"}</span><span>{isCorrect?"Correct!":"Incorrect"}</span></div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="h-48 relative overflow-hidden">
                    <div className="absolute inset-0" style={{ background: getTeamColor(currentFixture.home_code, currentFixture.home_name), clipPath: 'polygon(0 0, 0 100%, 100% 100%)' }} />
                    <div className="absolute inset-0" style={{ background: getTeamColor(currentFixture.away_code, currentFixture.away_name), clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="fixed bottom-0 left-0 right-0 pt-2 px-4 bg-[#eef4f3] z-50" style={{ paddingBottom: `calc(1.5625rem + env(safe-area-inset-bottom, 0px))` }}>
            <div className="max-w-md mx-auto">
              <div className="flex items-stretch justify-center gap-3">
                <button
                  onClick={()=>handleButtonClick("H")}
                  disabled={isAnimating || isPastDeadline || submitted}
                  className="flex-1 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center bg-[#d7e6e3] text-slate-700 disabled:opacity-70"
                  style={{ backgroundColor: cardState.x < -30 ? `rgba(34, 197, 94, ${Math.min(0.8, Math.abs(cardState.x) / 150)})` : undefined, color: cardState.x < -30 ? '#fff' : undefined }}
                >
                  Home Win
                </button>
                <button
                  onClick={()=>handleButtonClick("D")}
                  disabled={isAnimating || isPastDeadline || submitted}
                  className="flex-1 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center bg-[#d7e6e3] text-slate-700 disabled:opacity-70"
                  style={{ backgroundColor: cardState.y > 30 ? `rgba(59, 130, 246, ${Math.min(0.8, cardState.y / 150)})` : undefined, color: cardState.y > 30 ? '#fff' : undefined }}
                >
                  Draw
                </button>
                <button
                  onClick={()=>handleButtonClick("A")}
                  disabled={isAnimating || isPastDeadline || submitted}
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
  );
}

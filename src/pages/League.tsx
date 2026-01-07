import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { resolveLeagueStartGw as getLeagueStartGw, shouldIncludeGwForLeague } from "../lib/leagueStart";
import imageCompression from "browser-image-compression";
import { getLeagueAvatarUrl, getDefaultMlAvatar } from "../lib/leagueAvatars";
import { useLiveScores } from "../hooks/useLiveScores";
import { useGameweekState } from "../hooks/useGameweekState";
import { useCurrentGameweek } from "../hooks/useCurrentGameweek";
import { getGameweekState } from "../lib/gameweekState";
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { invalidateLeagueCache } from "../api/leagues";
import { getCached, setCached, CACHE_TTL } from "../lib/cache";
import MiniLeagueChatBeta from "../components/MiniLeagueChatBeta";
import InfoSheet from "../components/InfoSheet";
import WinnerBanner from "../components/league/WinnerBanner";
import GwSelector from "../components/league/GwSelector";
import PointsFormToggle from "../components/league/PointsFormToggle";
import MiniLeagueTable from "../components/league/MiniLeagueTable";
import ResultsTable from "../components/league/ResultsTable";
import SubmissionStatusTable from "../components/league/SubmissionStatusTable";
import LeagueFixtureSection from "../components/league/LeagueFixtureSection";
import { VOLLEY_USER_ID, VOLLEY_NAME } from "../lib/volley";
import { fetchUserLeagues } from "../services/userLeagues";

const MAX_MEMBERS = 8;

/* =========================
   Types
   ========================= */
type League = { id: string; name: string; code: string; created_at?: string; created_by?: string; avatar?: string | null };
type Member = { id: string; name: string };

type Fixture = {
  api_match_id?: number | null;
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
};

type PickRow = { user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" };
type SubmissionRow = { user_id: string; gw: number; submitted_at: string | null };

type ResultRowRaw = {
  gw: number;
  fixture_index: number;
  result?: "H" | "D" | "A" | null;
  home_goals?: number | null;
  away_goals?: number | null;
};

type MltRow = {
  user_id: string;
  name: string;
  mltPts: number;
  ocp: number;
  unicorns: number;
  wins: number;
  draws: number;
  form: ("W" | "D" | "L")[];
};

/* Chat - types removed, MiniLeagueChatBeta uses its own types */

/* =========================
   Helpers
   ========================= */

function rowToOutcome(r: ResultRowRaw): "H" | "D" | "A" | null {
  if (r.result === "H" || r.result === "D" || r.result === "A") return r.result;
  if (typeof r.home_goals === "number" && typeof r.away_goals === "number") {
    if (r.home_goals > r.away_goals) return "H";
    if (r.home_goals < r.away_goals) return "A";
    return "D";
  }
  return null;
}

// Chip component moved to src/components/league/PickChip.tsx

/* =========================
   ChatTab removed - using MiniLeagueChatBeta instead
   ========================= */

/* =========================
   Page
   ========================= */
export default function LeaguePage() {
  // Track hook call count for debugging - must be first hook
  const hookCallCountRef = useRef(0);
  hookCallCountRef.current = 0;
  
  const { code = "" } = useParams();
  hookCallCountRef.current++;
  const [searchParams, setSearchParams] = useSearchParams();
  hookCallCountRef.current++;
  const { user } = useAuth();
  hookCallCountRef.current++;
  const { currentGw: hookCurrentGw } = useCurrentGameweek();
  hookCallCountRef.current++;
  
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'League.tsx:after-all-hooks',message:'All hooks called',data:{code,hasCode:!!code,hasUser:!!user,hookCurrentGw,hookCallCount:hookCallCountRef.current,timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
  }, [code, user, hookCurrentGw]);
  // #endregion
  const [oldSchoolMode] = useState(() => {
    const saved = localStorage.getItem('oldSchoolMode');
    return saved ? JSON.parse(saved) : false;
  });
  hookCallCountRef.current++;

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('oldSchoolMode', JSON.stringify(oldSchoolMode));
  }, [oldSchoolMode]);
  hookCallCountRef.current++;

  // Prevent body/html scrolling and keep header fixed
  useEffect(() => {
    // Prevent body and html from scrolling
    document.body.classList.add('league-page-active');
    document.documentElement.classList.add('league-page-active');
    
    // Ensure header stays fixed - check periodically and on scroll
    const preventHeaderScroll = () => {
      const header = document.querySelector('.league-header-fixed') as HTMLElement;
      if (header) {
        const currentTop = header.style.top || window.getComputedStyle(header).top;
        if (currentTop !== '0px' && currentTop !== '0') {
          header.style.top = '0';
          header.style.transform = 'translate3d(0, 0, 0)';
        }
      }
    };
    
    // Monitor window scroll and reset header if it moves
    const handleWindowScroll = () => {
      preventHeaderScroll();
      // Reset window scroll to 0 if it somehow scrolled
      if (window.scrollY !== 0 || window.pageYOffset !== 0) {
        window.scrollTo(0, 0);
      }
    };
    
    // Prevent touchmove outside content wrapper that could cause body scroll
    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      // Only prevent if touching outside scrollable areas
      const isInScrollableArea = target.closest('.league-content-wrapper') || 
                                  target.closest('.league-header-fixed') ||
                                  target.closest('.chat-tab-wrapper');
      if (!isInScrollableArea) {
        e.preventDefault();
      }
    };
    
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    // Check periodically to ensure header stays fixed
    const checkInterval = setInterval(preventHeaderScroll, 100);
    
    preventHeaderScroll();
    
    return () => {
      document.body.classList.remove('league-page-active');
      document.documentElement.classList.remove('league-page-active');
      window.removeEventListener('scroll', handleWindowScroll);
      document.removeEventListener('touchmove', handleTouchMove);
      clearInterval(checkInterval);
    };
  }, []);

  // Keep header fixed when keyboard appears
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Prevent page scroll when keyboard appears
        setTimeout(() => {
          window.scrollTo(0, 0);
          const header = document.querySelector('.league-header-fixed');
          if (header) {
            (header as HTMLElement).style.top = '0';
          }
        }, 100);
      }
    };

    const handleResize = () => {
      // Ensure header stays at top on resize (keyboard show/hide)
      const header = document.querySelector('.league-header-fixed');
      if (header) {
        (header as HTMLElement).style.top = '0';
      }
      // Only scroll to top on resize if it's a keyboard-related resize (significant height change)
      // Don't scroll on tab changes or minor layout shifts
    };

    document.addEventListener('focusin', handleFocusIn);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    let raf: number | null = null;

    const applyTransform = () => {
      const headerEl = headerRef.current;
      if (!headerEl) return;
      const offset = visualViewport.offsetTop ?? 0;
      headerEl.style.setProperty(
        "transform",
        `translate3d(0, ${offset}px, 0)`,
        "important"
      );
    };

    const scheduleUpdate = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(applyTransform);
    };

    scheduleUpdate();
    visualViewport.addEventListener("resize", scheduleUpdate);
    visualViewport.addEventListener("scroll", scheduleUpdate);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      visualViewport.removeEventListener("resize", scheduleUpdate);
      visualViewport.removeEventListener("scroll", scheduleUpdate);
      if (headerRef.current) {
        headerRef.current.style.removeProperty("transform");
      }
    };
  }, []);

  // Try to get league from cache first (pre-loaded during initial data load)
  const getInitialLeague = (): League | null => {
    if (!code) return null;
    // Check if we have leagues cached - find the one matching this code
    try {
      const cachedLeagues = getCached<Array<{ id: string; name: string; code: string; avatar?: string | null; created_at?: string | null }>>(`leagues:${user?.id || ''}`);
      if (cachedLeagues) {
        const found = cachedLeagues.find(l => l.code.toUpperCase() === code.toUpperCase());
        if (found) {
          return found as League;
        }
      }
    } catch (e) {
      // Cache miss - that's ok
    }
    return null;
  };

  const [league, setLeague] = useState<League | null>(() => {
    return getInitialLeague();
  });
  hookCallCountRef.current++;
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  hookCallCountRef.current++;
  
  // Initialize members from cache synchronously
  const getInitialMembers = (): Member[] => {
    const initialLeague = getInitialLeague();
    if (!initialLeague?.id) return [];
    try {
      const cachedMembers = getCached<Array<[string, string]>>(`league:members:${initialLeague.id}`);
      if (cachedMembers && cachedMembers.length > 0) {
        return cachedMembers.map(([id, name]) => ({
          id,
          name: name || "(no name)",
        }));
      }
    } catch {
      // Cache miss
    }
    return [];
  };
  
  const [members, setMembers] = useState<Member[]>(getInitialMembers);
  hookCallCountRef.current++;
  // Start with false if we have cached league, true otherwise
  const [loading, setLoading] = useState(() => {
    const initialLeague = getInitialLeague();
    return !initialLeague;
  });
  hookCallCountRef.current++;

  // tabs: Chat / Mini League Table / GW Picks / GW Results
  // CHAT is always the default tab (never auto-switch to GW Table during live)
  // Only exception: tab=chat in URL from notification deep links (handled by useEffect below)
  const initialTab: "chat" | "mlt" | "gw" | "gwr" = 'chat'; // Always default to chat
  const [tab, setTab] = useState<"chat" | "mlt" | "gw" | "gwr">(initialTab);
  hookCallCountRef.current++;
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);
  hookCallCountRef.current++;
  const tabRef = useRef(tab);
  hookCallCountRef.current++;
  
  // Keep ref in sync with state
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);
  hookCallCountRef.current++;
  // Use ref to track manual tab selection immediately (synchronously) to prevent race conditions
  const manualTabSelectedRef = useRef(false);
  hookCallCountRef.current++;
  const manualGwSelectedRef = useRef(false);
  hookCallCountRef.current++;
  
  // Handle deep link from notifications - open chat tab when tab=chat is in URL
  // This runs on mount and when URL changes (e.g., from notification click on iOS)
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    const urlLeagueCode = searchParams.get('leagueCode');
    
    // Clear any previous errors
    setDeepLinkError(null);
    
    // Check if we have a deep link
    if (urlTab === 'chat' || urlTab === 'gw' || urlLeagueCode) {
      // Verify we're on the correct league page
      if (urlLeagueCode && code !== urlLeagueCode) {
        setDeepLinkError(`Deep link mismatch: URL has leagueCode=${urlLeagueCode} but we're on league ${code}. Current URL: ${window.location.href}`);
        return;
      }
      
      // Check if tab should be chat
      if (urlTab === 'chat') {
        if (tab !== 'chat') {
          // FIX: Use functional update to ensure state change
          setTab(prevTab => {
            if (prevTab !== 'chat') {
              return 'chat';
            }
            return prevTab;
          });
          // Verify tab actually changed after a short delay
          setTimeout(() => {
            if (tabRef.current !== 'chat') {
              setDeepLinkError(`Failed to open chat tab. Current tab: ${tabRef.current}, Expected: chat. URL: ${window.location.href}`);
            }
          }, 300);
        }
        
        // Clear the parameter after a brief delay
        const timer = setTimeout(() => {
          setSearchParams({}, { replace: true });
        }, 200);
        return () => clearTimeout(timer);
      }
      
      // Check if tab should be predictions (gw)
      if (urlTab === 'gw') {
        if (tab !== 'gw') {
          // FIX: Use functional update to ensure state change
          setTab(prevTab => {
            if (prevTab !== 'gw') {
              return 'gw';
            }
            return prevTab;
          });
          // Verify tab actually changed after a short delay
          setTimeout(() => {
            if (tabRef.current !== 'gw') {
              setDeepLinkError(`Failed to open predictions tab. Current tab: ${tabRef.current}, Expected: gw. URL: ${window.location.href}`);
            }
          }, 300);
        }
        
        // Clear the parameter after a brief delay
        const timer = setTimeout(() => {
          setSearchParams({}, { replace: true });
        }, 200);
        return () => clearTimeout(timer);
      }
    }
    
  }, [searchParams, setSearchParams, tab, code]);
  const headerRef = useRef<HTMLDivElement | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Initialize currentGw from cache immediately (pre-loaded during initial data load)
  const getInitialCurrentGw = (): number | null => {
    try {
      const cached = getCached<{ current_gw: number }>('app_meta:current_gw');
      return cached?.current_gw ?? null;
    } catch {
      return null;
    }
  };

  const [currentGw, setCurrentGw] = useState<number | null>(getInitialCurrentGw);
  const [latestResultsGw, setLatestResultsGw] = useState<number | null>(null);
  // Initialize selectedGw from currentGw immediately
  const [selectedGw, setSelectedGw] = useState<number | null>(getInitialCurrentGw);
  // Initialize availableGws from cache immediately (pre-loaded during initial data load)
  const getInitialAvailableGws = (): number[] => {
    try {
      const cached = getCached<number[]>('app:available_gws');
      return cached ?? [];
    } catch {
      return [];
    }
  };
  
  const [availableGws, setAvailableGws] = useState<number[]>(() => {
    return getInitialAvailableGws();
  });

  // Ref to track current liveScores without causing re-renders
  const liveScoresRef = useRef<Record<number, { homeScore: number; awayScore: number; status: string; minute?: number | null }>>({});
  const liveScoresPrevRef = useRef<Record<number, { homeScore: number; awayScore: number; status: string; minute?: number | null }>>({});
  // Track previous positions for animation (using ref to persist across renders)
  const prevPositionsRef = useRef<Map<string, number>>(new Map());
  const [positionChangeKeys, setPositionChangeKeys] = useState<Set<string>>(new Set());
  const [showGwDropdown, setShowGwDropdown] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  // Track gw_results changes to trigger mini league table recalculation
  const [gwResultsVersion, setGwResultsVersion] = useState(0);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [showBadgeUpload, setShowBadgeUpload] = useState(false);
  const [uploadingBadge, setUploadingBadge] = useState(false);
  const [badgeUploadError, setBadgeUploadError] = useState<string | null>(null);
  const [badgeUploadSuccess, setBadgeUploadSuccess] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  hookCallCountRef.current++;
  const [showLeagueLockedError, setShowLeagueLockedError] = useState(false);
  hookCallCountRef.current++;
  const [showJoinConfirm, setShowJoinConfirm] = useState(false);
  hookCallCountRef.current++;
  const [joining, setJoining] = useState(false);
  hookCallCountRef.current++;
  
  // Log final hook count after all hooks are declared
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'League.tsx:final-hook-count',message:'Final hook count logged',data:{finalHookCount:hookCallCountRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
  }, []);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showEndLeagueConfirm, setShowEndLeagueConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [ending, setEnding] = useState(false);
  const [firstMember, setFirstMember] = useState<Member | null>(null);

  /* ----- Chat state (no longer used - MiniLeagueChatBeta handles its own state) ----- */
  const isMember = useMemo(
    () => !!user?.id && members.some((m) => m.id === user.id),
    [user?.id, members]
  );
  const isAdmin = useMemo(
    () => !!user?.id && !!firstMember && firstMember.id === user.id,
    [user?.id, firstMember]
  );
  const adminName = useMemo(() => firstMember?.name ?? "League admin", [firstMember]);
  const memberNameById = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((x) => m.set(x.id, x.name));
    m.set(VOLLEY_USER_ID, VOLLEY_NAME); // Add Volley
    return m;
  }, [members]);

  const shareLeague = useCallback(() => {
    if (!league?.code) return;
    if (typeof window === "undefined" || typeof navigator === "undefined") return;

    const shareText = `Join my mini league "${league.name}" on TotL!`;
    const shareUrl = `${window.location.origin}/league/${league.code}`;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (typeof nav.share === "function") {
      nav
        .share({ title: `Join ${league.name}`, text: shareText, url: shareUrl })
        .catch(() => {
          // Share cancelled (non-critical)
        });
      return;
    }

    const fallbackText = `${shareText}
${shareUrl}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(fallbackText)
        .then(() => window.alert?.("League link copied to clipboard!"))
        .catch(() => {
          window.prompt?.("Share this league code:", league.code);
        });
    } else {
      window.prompt?.("Share this league code:", league.code);
    }
  }, [league]);

  const leaveLeague = useCallback(async () => {
    if (!league?.id || !user?.id) return;
    setLeaving(true);
    try {
      const { error } = await supabase
        .from("league_members")
        .delete()
        .eq("league_id", league.id)
        .eq("user_id", user.id);
      if (error) throw error;
      if (typeof window !== "undefined") {
        window.location.href = "/leagues";
      }
    } catch (error: any) {
      if (typeof window !== "undefined") {
        window.alert?.(error?.message ?? "Failed to leave league. Please try again.");
      }
    } finally {
      setLeaving(false);
      setShowLeaveConfirm(false);
    }
  }, [league?.id, user?.id]);

  const joinLeague = useCallback(async () => {
    if (!league?.id || !user?.id) return;
    setJoining(true);
    try {
      // Check if user is already in 20 mini-leagues (max limit)
      const userLeagues = await fetchUserLeagues(user.id);
      if (userLeagues.length >= 20) {
        if (typeof window !== "undefined") {
          window.alert?.("You're already in 20 mini-leagues, which is the maximum. Leave a league before joining another.");
        }
        setShowJoinConfirm(false);
        setJoining(false);
        return;
      }

      // Check if league has been running for more than 4 gameweeks
      const currentGw = hookCurrentGw;
      if (currentGw !== null) {
        // Calculate league start GW
        const leagueStartGw = await getLeagueStartGw(
          { id: league.id, name: league.name, created_at: league.created_at },
          currentGw
        );

        // Check if league has been running for 4+ gameweeks
        // If current_gw - league_start_gw >= 4, the league is locked
        if (currentGw - leagueStartGw >= 4) {
          if (typeof window !== "undefined") {
            window.alert?.("This league has been running for more than 4 gameweeks. New members can only be added during the first 4 gameweeks.");
          }
          setShowJoinConfirm(false);
          setJoining(false);
          return;
        }
      }

      if (members.length >= MAX_MEMBERS) {
        if (typeof window !== "undefined") {
          window.alert?.("League is full (max 8 members).");
        }
        setShowJoinConfirm(false);
        return;
      }
      const { error } = await supabase
        .from("league_members")
        .insert({ league_id: league.id, user_id: user.id });
      if (error) throw error;
      
      // Send notification to other members
      const userName = user.user_metadata?.display_name || user.email || 'Someone';
      try {
        const response = await fetch('/.netlify/functions/notifyLeagueMemberJoin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leagueId: league.id,
            userId: user.id,
            userName: userName,
          }),
        });
        
        // Check if response has content before trying to parse JSON
        const text = await response.text();
        try {
          // Parse JSON to validate response (result not used, just validating)
          text ? JSON.parse(text) : { error: 'Empty response body' };
        } catch (parseError) {
          // Invalid JSON response (non-critical)
        }
        
        if (!response.ok) {
          // Notification function returned error (non-critical)
        }
      } catch (notifError) {
        // Non-critical - error sending join notification
      }
      
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (error: any) {
      if (typeof window !== "undefined") {
        window.alert?.(error?.message ?? "Failed to join league.");
      }
    } finally {
      setJoining(false);
    }
  }, [league?.id, league?.name, league?.created_at, user?.id, members.length, hookCurrentGw]);

  const removeMember = useCallback(async () => {
    if (!memberToRemove || !league?.id || !user?.id) return;
    setRemoving(true);
    try {
      const { error } = await supabase
        .from("league_members")
        .delete()
        .eq("league_id", league.id)
        .eq("user_id", memberToRemove.id);
      if (error) throw error;
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (error: any) {
      if (typeof window !== "undefined") {
        window.alert?.(error?.message ?? "Failed to remove member.");
      }
    } finally {
      setRemoving(false);
      setShowRemoveConfirm(false);
      setMemberToRemove(null);
    }
  }, [league?.id, memberToRemove, user?.id]);

  const endLeague = useCallback(async () => {
    if (!league?.id || !user?.id) return;
    setEnding(true);
    try {
      const { error: membersError } = await supabase
        .from("league_members")
        .delete()
        .eq("league_id", league.id);
      if (membersError) throw membersError;

      const { error: leagueError } = await supabase
        .from("leagues")
        .delete()
        .eq("id", league.id);
      if (leagueError) throw leagueError;

      if (typeof window !== "undefined") {
        window.location.href = "/leagues";
      }
    } catch (error: any) {
      if (typeof window !== "undefined") {
        window.alert?.(error?.message ?? "Failed to end league.");
      }
    } finally {
      setEnding(false);
      setShowEndLeagueConfirm(false);
    }
  }, [league?.id, user?.id]);

  const createImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });
  };

  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('No 2d context');

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg', 0.9);
    });
  };

  const handleFileSelect = useCallback((file: File) => {
    if (!league?.id || !isMember) {
      setBadgeUploadError("You must be a member of the league to upload badges.");
      return;
    }

    const allowedTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      setBadgeUploadError("Please upload a PNG, JPG, or WebP image.");
      return;
    }

    // Allow larger files - we'll compress them client-side
    // Set a reasonable upper limit (e.g., 20MB) to prevent abuse
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_FILE_SIZE) {
      setBadgeUploadError("Please choose an image smaller than 20MB.");
      return;
    }


    setBadgeUploadError(null);
    setBadgeUploadSuccess(false);
    
    // For very large files, pre-compress before showing crop UI for better performance
    if (file.size > 5 * 1024 * 1024) {
      // Pre-compress large images before cropping for better performance
      imageCompression(file, {
        maxSizeMB: 2, // Compress to max 2MB for crop UI
        maxWidthOrHeight: 1024, // Limit dimensions for crop UI
        useWebWorker: true,
        initialQuality: 0.7,
      }).then((compressed) => {
        const reader = new FileReader();
        reader.onload = () => {
          setCropImage(reader.result as string);
        };
        reader.readAsDataURL(compressed);
      }).catch(() => {
        setBadgeUploadError("Failed to process image. Please try a smaller file.");
      });
    } else {
      // For smaller files, use directly
      const reader = new FileReader();
      reader.onload = () => {
        setCropImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [isMember, league?.id]);

  const onCropComplete = useCallback(async (_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
    
    // Create preview image
    if (cropImage) {
      try {
        const croppedBlob = await getCroppedImg(cropImage, croppedAreaPixels);
        const preview = URL.createObjectURL(croppedBlob);
        setPreviewUrl(preview);
      } catch (error) {
        // Error creating preview (non-critical)
      }
    }
  }, [cropImage]);

  const handleCropAndUpload = useCallback(async () => {
    if (!cropImage || !croppedAreaPixels || !league?.id || !isMember) {
      return;
    }

    setBadgeUploadError(null);
    setBadgeUploadSuccess(false);
    setUploadingBadge(true);

    try {
      // Get cropped image as blob
      const croppedBlob = await getCroppedImg(cropImage, croppedAreaPixels);
      
      // Convert blob to file
      const croppedFile = new File([croppedBlob], 'badge.jpg', { type: 'image/jpeg' });

      // Compress the cropped image
      const compressed = await imageCompression(croppedFile, {
        maxSizeMB: 0.02,
        maxWidthOrHeight: 256,
        useWebWorker: true,
        initialQuality: 0.8,
      });

      if (compressed.size > 20 * 1024) {
        throw new Error("Compressed image is still larger than 20KB. Try a smaller image.");
      }

      const fileName = `${league.id}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("league-avatars")
        .upload(fileName, compressed, {
          cacheControl: "3600",
          upsert: true,
          contentType: compressed.type,
        });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("league-avatars")
        .getPublicUrl(fileName);
      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) {
        throw new Error("Unable to get public URL for badge.");
      }

      const { error: updateError } = await supabase
        .from("leagues")
        .update({ avatar: publicUrl })
        .eq("id", league.id);
      if (updateError) throw updateError;

      setLeague((prev) => (prev ? { ...prev, avatar: publicUrl } : prev));
      setBadgeUploadSuccess(true);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setCropImage(null);
      setPreviewUrl(null);
      setShowBadgeUpload(false);
      
      // Invalidate league cache so home page shows updated badge immediately
      if (user?.id) {
        invalidateLeagueCache(user.id);
        // Dispatch event to trigger refresh on home page if it's open
        window.dispatchEvent(new CustomEvent('leagueBadgeUpdated', { detail: { leagueId: league.id, avatar: publicUrl } }));
      }
    } catch (error: any) {
      setBadgeUploadError(error?.message ?? "Failed to upload badge. Please try again.");
    } finally {
      setUploadingBadge(false);
    }
  }, [cropImage, croppedAreaPixels, isMember, league?.id, user?.id]);

  const handleRemoveBadge = useCallback(async () => {
    if (!league?.id || !isMember) return;
    setBadgeUploadError(null);
    setBadgeUploadSuccess(false);
    setUploadingBadge(true);
    try {
      const { error } = await supabase.from("leagues").update({ avatar: null }).eq("id", league.id);
      if (error) throw error;
      setLeague((prev) => (prev ? { ...prev, avatar: null } : prev));
      setBadgeUploadSuccess(true);
      
      // Invalidate league cache so home page shows updated badge immediately
      if (user?.id) {
        invalidateLeagueCache(user.id);
        // Dispatch event to trigger refresh on home page if it's open
        window.dispatchEvent(new CustomEvent('leagueBadgeUpdated', { detail: { leagueId: league.id, avatar: null } }));
      }
    } catch (error: any) {
      setBadgeUploadError(error?.message ?? "Failed to remove badge. Please try again.");
    } finally {
      setUploadingBadge(false);
    }
  }, [isMember, league?.id]);

  // Store GW deadlines for synchronous access
  const [gwDeadlines, setGwDeadlines] = useState<Map<number, Date>>(new Map());
  
  // Calculate GW deadlines once when component loads
  useEffect(() => {
    (async () => {
      const deadlines = new Map<number, Date>();
      
      // Get all GWs that have fixtures (not just those with results)
      const { data: allGwData } = await supabase
        .from("app_fixtures")
        .select("gw, kickoff_time")
        .order("gw", { ascending: true });
      
      // Also get test fixtures for GW 1 (now in app_fixtures)
      const { data: testGwData } = await supabase
        .from("app_fixtures")
        .select("gw, kickoff_time")
        .eq("gw", 1)
        .order("fixture_index", { ascending: true });
      
      // Group by GW to find first kickoff for each GW
      const gwFirstKickoffs = new Map<number, string>();
      
      // Process regular fixtures
      if (allGwData) {
        allGwData.forEach((f: any) => {
          if (!gwFirstKickoffs.has(f.gw) || (f.kickoff_time && new Date(f.kickoff_time) < new Date(gwFirstKickoffs.get(f.gw)!))) {
            if (f.kickoff_time) {
              gwFirstKickoffs.set(f.gw, f.kickoff_time);
            }
          }
        });
      }
      
      // Process test fixtures for GW 1 (override regular GW 1 if test fixtures exist)
      if (testGwData && testGwData.length > 0) {
        const firstTestKickoff = testGwData.find(f => f.kickoff_time)?.kickoff_time;
        if (firstTestKickoff) {
          // Use test fixture kickoff for GW 1 if it's earlier than regular GW 1, or if regular GW 1 doesn't exist
          const existingGw1 = gwFirstKickoffs.get(1);
          if (!existingGw1 || new Date(firstTestKickoff) < new Date(existingGw1)) {
            gwFirstKickoffs.set(1, firstTestKickoff);
          }
        }
      }
      
      // Calculate deadline for each GW (75 minutes before first kickoff)
      gwFirstKickoffs.forEach((kickoffTime, gw) => {
        const firstKickoff = new Date(kickoffTime);
        const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000)); // 75 minutes before
        deadlines.set(gw, deadlineTime);
      });
      
      setGwDeadlines(deadlines);
    })();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showGwDropdown && !target.closest(".gw-dropdown-container")) {
        setShowGwDropdown(false);
      }
    };
    if (showGwDropdown) document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showGwDropdown]);

  /* ---------- load current GW and latest results GW ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: meta } = await supabase
        .from("app_meta")
        .select("current_gw")
        .eq("id", 1)
        .maybeSingle();
      if (!alive) return;
      setCurrentGw((meta as any)?.current_gw ?? null);

      const { data: rs } = await supabase
        .from("app_gw_results")
        .select("gw")
        .order("gw", { ascending: false })
        .limit(1);
      if (!alive) return;
      setLatestResultsGw((rs && rs.length ? (rs[0] as any).gw : null));

      const { data: allGws } = await supabase
        .from("app_gw_results")
        .select("gw")
        .order("gw", { ascending: false });
      if (!alive) return;
      const gwList = allGws ? [...new Set(allGws.map((r: any) => r.gw))].sort((a, b) => b - a) : [];
      
      // Include currentGw in availableGws if it's not already there (for live GWs without results yet)
      const currentGwValue = (meta as any)?.current_gw;
      if (currentGwValue && !gwList.includes(currentGwValue)) {
        gwList.unshift(currentGwValue); // Add to beginning (highest GW)
      }
      
      setAvailableGws(gwList);
      // Only set selectedGw if it's not already set (from initial state)
      if (gwList.length > 0 && !selectedGw) {
        setSelectedGw(gwList[0]);
      } else if (gwList.length > 0 && selectedGw && !gwList.includes(selectedGw)) {
        // If selectedGw is not in available list, use first available
        setSelectedGw(gwList[0]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [gwResultsVersion]); // Re-run when app_gw_results changes

  // data for GW tabs
  // Memoize memberIds - create stable reference that only changes when member IDs actually change
  const memberIdsKey = useMemo(() => members.map((m) => m.id).sort().join(','), [members]);
  const memberIds = useMemo(() => members.map((m) => m.id), [memberIdsKey]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  hookCallCountRef.current++;
  const [picks, setPicks] = useState<PickRow[]>([]);
  hookCallCountRef.current++;
  const [subs, setSubs] = useState<SubmissionRow[]>([]);
  hookCallCountRef.current++;
  const [results, setResults] = useState<ResultRowRaw[]>([]);
  hookCallCountRef.current++;
  
  // Scroll to top when tab changes - MUST be before any conditional returns
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [tab]);
  hookCallCountRef.current++;
  
  // Check game state of current GW to determine which GW to show in GW Table tab
  // MUST be before conditional returns to follow Rules of Hooks
  const { state: currentGwState } = useGameweekState(currentGw);
  hookCallCountRef.current++;
  
  // Declare currentTestGw before useMemo that uses it (to avoid temporal dead zone error)
  const isApiTestLeague = useMemo(() => league?.name === 'API Test', [league?.name]);
  const [currentTestGw, setCurrentTestGw] = useState<number | null>(null);
  hookCallCountRef.current++;
  
  // Calculate which GW is shown in the GW Table tab (same logic as GwResultsTab)
  // MUST be before conditional returns to follow Rules of Hooks
  const gwTableGw = useMemo(() => {
    if (!league) return currentGw || selectedGw || null;
    if (league.name === 'API Test') {
      return currentTestGw ?? 1;
    }
    
    // For "gwr" tab (GW table): show previous GW until deadline passes, then show current GW
    // If user manually selected a GW, use that
    if (manualGwSelectedRef.current && selectedGw) {
      return selectedGw;
    }
    
    // If no currentGw, fallback to selectedGw
    if (!currentGw) {
      return selectedGw;
    }
    
    // Determine if deadline has passed
    // If state is LIVE or RESULTS_PRE_GW, deadline has passed - show current GW
    // Otherwise (GW_OPEN, GW_PREDICTED, or null/unknown), show previous GW
    const deadlinePassed = currentGwState === 'LIVE' || currentGwState === 'RESULTS_PRE_GW';
    
    if (deadlinePassed) {
      // Deadline passed - show current GW
      return currentGw;
    } else {
      // Deadline hasn't passed - show previous GW
      // Use latestResultsGw if available and valid, otherwise use currentGw - 1
      if (latestResultsGw && latestResultsGw < currentGw) {
        return latestResultsGw;
      }
      // Fallback to currentGw - 1 (or currentGw if it's GW 1)
      return currentGw > 1 ? currentGw - 1 : currentGw;
    }
  }, [league?.name, currentTestGw, selectedGw, currentGw, currentGwState, latestResultsGw]);
  hookCallCountRef.current++;
  
  // Check if the GW shown in GW Table tab is live
  // MUST be before conditional returns to follow Rules of Hooks
  // Handle null gwTableGw (can happen when league is not loaded yet)
  const { state: gwTableState } = useGameweekState(gwTableGw ?? null);
  hookCallCountRef.current++;

  // Get api_match_ids from fixtures for real-time subscription
  // Memoize with stable reference - only change when IDs actually change
  // Use a ref to track previous value and only update if IDs actually changed
  const apiMatchIdsPrevRef = useRef<string>('');
  const fixturesLengthRef = useRef<number>(0);
  const apiMatchIdsKey = useMemo(() => {
    // Quick check: if fixtures length hasn't changed and we have a previous key, check if IDs are same
    const currentLength = fixtures?.length || 0;
    if (currentLength === fixturesLengthRef.current && apiMatchIdsPrevRef.current) {
      // Length is same, check if IDs are actually the same
      const currentIds = fixtures
        ?.map(f => f.api_match_id)
        .filter((id): id is number => id !== null && id !== undefined)
        .sort()
        .join(',') || '';
      if (currentIds === apiMatchIdsPrevRef.current) {
        return apiMatchIdsPrevRef.current; // Same IDs, return previous key
      }
    }
    
    // IDs changed or first time - update
    fixturesLengthRef.current = currentLength;
    if (!fixtures || fixtures.length === 0) {
      apiMatchIdsPrevRef.current = '';
      return '';
    }
    const ids = fixtures
      .map(f => f.api_match_id)
      .filter((id): id is number => id !== null && id !== undefined)
      .sort()
      .join(',');
    apiMatchIdsPrevRef.current = ids;
    return ids;
  }, [fixtures]);
  // apiMatchIds computed but not used directly - apiMatchIdsForHook is used instead

  // Subscribe to real-time live scores updates (replaces polling)
  // Note: isApiTestLeague and currentTestGw are now declared earlier (before gwTableGw useMemo)
  
  // Fetch current test GW for API Test league
  // Use current_test_gw from meta as primary source (supports GW T2, T3, etc.)
  useEffect(() => {
    if (!isApiTestLeague) {
      setCurrentTestGw(null);
      return;
    }
    
    let alive = true;
    (async () => {
      // Get current_test_gw from meta first
      const { data: testMetaData } = await supabase
        .from("test_api_meta")
        .select("current_test_gw")
        .eq("id", 1)
        .maybeSingle();
      
      let testGw = testMetaData?.current_test_gw ?? 1;
      
      // Verify that fixtures exist for this test_gw, otherwise fall back to GW T1
      if (testGw && testGw !== 1) {
        const { data: fixturesCheck } = await supabase
          .from("app_fixtures")
          .select("gw")
          .eq("gw", testGw)
          .limit(1)
          .maybeSingle();
        
        // If no fixtures for current_test_gw, fall back to GW T1
        if (!fixturesCheck) {
          const { data: t1Data } = await supabase
            .from("app_fixtures")
            .select("gw")
            .eq("gw", 1)
            .limit(1)
            .maybeSingle();
          
          if (t1Data) {
            testGw = 1; // Fallback to GW T1
          }
        }
      }
      
      if (alive) {
        setCurrentTestGw(testGw);
      }
    })();
    
    return () => {
      alive = false;
    };
  }, [isApiTestLeague]);
  
  const gwForSubscription = useMemo(() => {
    if (isApiTestLeague && currentTestGw !== null) return currentTestGw;
    // Prioritize currentGw for live scores subscription (it's the active/live GW)
    return currentGw || selectedGw || undefined;
  }, [isApiTestLeague, currentTestGw, currentGw, selectedGw]);
  
  // Memoize the apiMatchIds array passed to useLiveScores to prevent re-subscriptions
  // Use a ref to track previous key and array, only update if key actually changed
  const apiMatchIdsForHookRef = useRef<{ key: string; array: number[] | undefined }>({ 
    key: '', 
    array: undefined 
  });
  const apiMatchIdsForHook = useMemo(() => {
    const currentKey = apiMatchIdsKey || '';
    
    // If key hasn't changed, return the previous array reference
    if (apiMatchIdsForHookRef.current.key === currentKey) {
      return apiMatchIdsForHookRef.current.array;
    }
    
    // Key changed, update ref and return new array
    const newArray = currentKey 
      ? currentKey.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id))
      : undefined;
    
    apiMatchIdsForHookRef.current = {
      key: currentKey,
      array: newArray
    };
    
    return newArray;
  }, [apiMatchIdsKey]);
  
  const { liveScores: liveScoresMap } = useLiveScores(
    gwForSubscription,
    apiMatchIdsForHook
  );

  // Convert Map to Record format for backward compatibility with existing code
  // Only update if content actually changed to prevent infinite loops
  const liveScores = useMemo(() => {
    const result: Record<number, { homeScore: number; awayScore: number; status: string; minute?: number | null }> = {};
    if (!fixtures || fixtures.length === 0) {
      // Check if previous was also empty
      const prevKeys = Object.keys(liveScoresPrevRef.current);
      if (prevKeys.length === 0) return liveScoresPrevRef.current;
      liveScoresPrevRef.current = result;
      return result;
    }
    fixtures.forEach(fixture => {
      const apiMatchId = fixture.api_match_id;
      if (apiMatchId) {
        const liveScore = liveScoresMap.get(apiMatchId);
        if (liveScore) {
          result[fixture.fixture_index] = {
            homeScore: liveScore.home_score ?? 0,
            awayScore: liveScore.away_score ?? 0,
            status: liveScore.status || 'SCHEDULED',
            minute: liveScore.minute ?? null
          };
        }
      }
    });
    // Compare with previous - only return new object if content changed
    const prev = liveScoresPrevRef.current;
    const resultKeys = Object.keys(result).map(Number);
    const prevKeys = Object.keys(prev).map(Number);
    if (resultKeys.length !== prevKeys.length) {
      liveScoresPrevRef.current = result;
      return result;
    }
    // Check if any values changed
    let hasChanges = false;
    for (const key of resultKeys) {
      const r = result[key];
      const p = prev[key];
      if (!p || r.homeScore !== p.homeScore || r.awayScore !== p.awayScore || r.status !== p.status || r.minute !== p.minute) {
        hasChanges = true;
        break;
      }
    }
    if (hasChanges) {
      liveScoresPrevRef.current = result;
      return result;
    }
    // No changes - return previous reference
    return prev;
  }, [liveScoresMap, fixtures]);

  // Initialize mltRows from cache synchronously (like league, currentGw, etc.)
  // This MUST run synchronously during component initialization - no async operations
  const getInitialMltRows = (): MltRow[] => {
    try {
      console.log('[League] getInitialMltRows called', { code, userId: user?.id });
      
      // Strategy 1: Try with code + user.id to find league ID from cached leagues
      if (code && user?.id) {
        const cachedLeagues = getCached<Array<{ id: string; code: string }>>(`leagues:${user.id}`);
        console.log('[League] getInitialMltRows - cachedLeagues', { hasCached: !!cachedLeagues, length: cachedLeagues?.length });
        if (cachedLeagues && Array.isArray(cachedLeagues)) {
          const found = cachedLeagues.find(l => l.code.toUpperCase() === code.toUpperCase());
          console.log('[League] getInitialMltRows - found league', { found: !!found, leagueId: found?.id });
          if (found?.id) {
            const cacheKey = `league:mltRows:${found.id}`;
            const cached = getCached<MltRow[]>(cacheKey);
            console.log('[League] getInitialMltRows - cached mltRows', { 
              hasCached: !!cached, 
              length: cached?.length, 
              cacheKey,
              cachedType: typeof cached,
              isArray: Array.isArray(cached),
              rawCache: cached
            });
            if (cached && Array.isArray(cached) && cached.length > 0) {
              console.log('[League] ✅ getInitialMltRows returning cached rows', cached.length);
              return cached;
            } else {
              console.log('[League] ❌ Cache check failed', { 
                cached: !!cached, 
                isArray: Array.isArray(cached), 
                length: cached?.length,
                cacheKey 
              });
            }
          }
        }
      }
      
      // Strategy 2: Try with initialLeague if available
      const initialLeague = getInitialLeague();
      console.log('[League] getInitialMltRows - initialLeague', { hasLeague: !!initialLeague, leagueId: initialLeague?.id });
      if (initialLeague?.id) {
        const cached = getCached<MltRow[]>(`league:mltRows:${initialLeague.id}`);
        console.log('[League] getInitialMltRows - cached from initialLeague', { hasCached: !!cached, length: cached?.length });
        if (cached && Array.isArray(cached) && cached.length > 0) {
          console.log('[League] ✅ getInitialMltRows returning cached rows from initialLeague', cached.length);
          return cached;
        }
      }
      
      // Strategy 3: Try all cached leagues and find one matching the code
      // This is a fallback in case the leagues cache structure is different
      if (code && user?.id) {
        const allCachedLeagues = getCached<Array<{ id: string; code: string; name?: string }>>(`leagues:${user.id}`);
        if (allCachedLeagues && Array.isArray(allCachedLeagues)) {
          for (const l of allCachedLeagues) {
            if (l.code?.toUpperCase() === code.toUpperCase() && l.id) {
              const cached = getCached<MltRow[]>(`league:mltRows:${l.id}`);
              if (cached && Array.isArray(cached) && cached.length > 0) {
                console.log('[League] ✅ getInitialMltRows returning cached rows from strategy 3', cached.length);
                return cached;
              }
            }
          }
        }
      }
      
      console.log('[League] ⚠️ getInitialMltRows returning empty array - cache miss');
    } catch (error) {
      console.error('[League] ❌ getInitialMltRows error', error);
      // Silent fail - cache miss is OK, will be populated by useEffect
    }
    return [];
  };
  
  const [mltRows, setMltRows] = useState<MltRow[]>(getInitialMltRows);
  
  // Log tab changes (after mltRows is declared)
  useEffect(() => {
    console.log('[League] Tab changed to:', tab, 'mltRows.length:', mltRows.length);
  }, [tab, mltRows.length]);
  
  // Update mltRows from cache immediately when league.id becomes available
  // This ensures state is ready BEFORE component renders
  // Also retry if cache wasn't ready initially (initialDataLoader might still be running)
  useEffect(() => {
    if (league?.id) {
      const cacheKey = `league:mltRows:${league.id}`;
      const cached = getCached<MltRow[]>(cacheKey);
      console.log('[League] useEffect loading mltRows from cache', { 
        leagueId: league.id, 
        cacheKey, 
        hasCached: !!cached, 
        cachedLength: cached?.length,
        currentMltRowsLength: mltRows.length 
      });
      if (cached && cached.length > 0) {
        if (mltRows.length === 0) {
          console.log('[League] ✅ Setting mltRows from cache', cached.length);
          setMltRows(cached);
        } else {
          console.log('[League] mltRows already populated, skipping');
        }
      } else {
        console.log('[League] ⚠️ No cached mltRows found - will retry multiple times');
        // Retry multiple times with increasing delays in case initialDataLoader is still running
        let retryCount = 0;
        const maxRetries = 10;
        const retryDelays = [50, 100, 150, 200, 250, 300, 400, 500, 600, 800];
        
        const tryRetry = () => {
          if (retryCount >= maxRetries) {
            console.log('[League] ❌ Max retries reached, giving up on cache');
            return;
          }
          const timeout = setTimeout(() => {
            retryCount++;
            const retryCached = getCached<MltRow[]>(cacheKey);
            if (retryCached && retryCached.length > 0 && mltRows.length === 0) {
              console.log(`[League] ✅ Retry ${retryCount} successful - Setting mltRows from cache`, retryCached.length);
              setMltRows(retryCached);
            } else if (retryCount < maxRetries) {
              tryRetry();
            }
          }, retryDelays[retryCount] || 800);
          return () => clearTimeout(timeout);
        };
        
        const cleanup = tryRetry();
        return cleanup;
      }
    } else {
      console.log('[League] ⚠️ No league.id available yet');
    }
  }, [league?.id, mltRows.length]); // Run immediately when league.id is available

  /* ---------- load league + members ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      // If we already have league from cache, use it immediately
      const cachedLeague = league;
      let lg = cachedLeague;

      if (!lg) {
        // Fetch league if not in cache
        const { data } = await supabase
        .from("leagues")
        .select("id,name,code,created_at,avatar")
        .eq("code", code)
        .maybeSingle();

      if (!alive) return;
        if (!data) {
        setLeague(null);
        setMembers([]);
        setLoading(false);
        return;
      }
        lg = data as League;
        setLeague(lg);
      }

      // Check cache FIRST (pre-loaded during initial data load)
      // If we have cache, set loading to false immediately so chat can render
      const cachedMembers = getCached<Array<[string, string]>>(`league:members:${lg.id}`);
      let mem: Member[] = [];
      
      if (cachedMembers && cachedMembers.length > 0) {
        // Use cached member names immediately - set loading to false right away!
        mem = cachedMembers.map(([id, name]) => ({
          id,
          name: name || "(no name)",
        }));
        setLoading(false); // Clear loading immediately when we have cache
      } else {
        // No cache - need to fetch
      const { data: mm } = await supabase
        .from("league_members")
        .select("users(id,name),created_at")
          .eq("league_id", lg.id)
        .order("created_at", { ascending: true });

        mem =
        (mm as any[])?.map((r) => ({
          id: r.users.id,
          name: r.users.name ?? "(no name)",
        })) ?? [];
        setLoading(false); // Clear loading after fetch
      }

      const memSorted = [...mem].sort((a, b) => a.name.localeCompare(b.name));
      setMembers(memSorted);

      const first = mem[0];
      setFirstMember(first);

      if (user?.id && !mem.some((m) => m.id === user.id)) {
        setShowJoinConfirm(true);
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [code]);

  /* ---------- Redirect to valid tab if current tab shouldn't be visible for this league ---------- */
  useEffect(() => {
    if (!league) return;
    
    // For now, we'll let users access all tabs and handle visibility within each tab component
    // The individual tab components will show appropriate messages if the GW shouldn't be visible
  }, [league, tab]);

  /* ---------- mark-as-read when viewing Chat or Chat Beta ---------- */
  useEffect(() => {
    if (tab !== "chat" || !league?.id || !user?.id) return;
    const mark = async () => {
      // Update last_read_at in database
      await supabase
        .from("league_message_reads")
        .upsert(
          { league_id: league.id, user_id: user.id, last_read_at: new Date().toISOString() },
          { onConflict: "league_id,user_id" }
        );
      
      // Invalidate unread cache so badges clear immediately
      invalidateLeagueCache(user.id);
      
      // Dispatch event to trigger immediate unread count refresh on pages using useLeagues
      window.dispatchEvent(new CustomEvent('leagueMessagesRead', { 
        detail: { leagueId: league.id, userId: user.id } 
      }));
    };
    mark();
  }, [tab, league?.id, user?.id]);

  // Chat loading removed - MiniLeagueChatBeta handles its own state via useMiniLeagueChat hook

  /* ---------- send chat ---------- */
  // sendChat removed - MiniLeagueChatBeta handles sending messages and notifications internally

  /* ---------- load fixtures + picks + submissions + results for selected GW ---------- */
  useEffect(() => {
    let alive = true;

    (async () => {
      // Special handling for API Test league - use test_api_fixtures for current test GW
      // CRITICAL: Only use test API tables if league name is EXACTLY 'API Test'
      // All other leagues MUST use main database tables (fixtures, picks, gw_submissions)
      const isApiTestLeague = league?.name === 'API Test';
      
      // Fetch current test GW from meta table for API Test league
      // Use current_test_gw from meta as primary source (supports GW T2, T3, etc.)
      let testGwForData = currentTestGw ?? 1; // Use state if available, otherwise default to 1
      if (isApiTestLeague) {
        // Get current_test_gw from meta
        const { data: testMetaData } = await supabase
          .from("test_api_meta")
          .select("current_test_gw")
          .eq("id", 1)
          .maybeSingle();
        
        testGwForData = testMetaData?.current_test_gw ?? 1;
        
        // Verify that fixtures exist for this test_gw, otherwise fall back to GW T1
        if (testGwForData && testGwForData !== 1) {
          const { data: fixturesCheck } = await supabase
            .from("app_fixtures")
            .select("gw")
            .eq("gw", testGwForData)
            .limit(1)
            .maybeSingle();
          
          // If no fixtures for current_test_gw, fall back to GW T1
          if (!fixturesCheck) {
            const { data: t1Data } = await supabase
              .from("app_fixtures")
              .select("gw")
              .eq("gw", 1)
              .limit(1)
              .maybeSingle();
            
            if (t1Data) {
              testGwForData = 1; // Fallback to GW T1
            }
          }
        }
      }
      
      // For API Test league, only allow "gw" tab if all members have submitted
      // Check if all submitted for current test GW (we'll check this properly after loading submissions)
      const useTestFixtures = isApiTestLeague && (tab === "gw" || tab === "gwr");
      
      // For API Test league in predictions/results tabs, use current test GW
      // For "gwr" (Live Table/Results) tab, use same logic as resGwMemo:
      // - If deadline hasn't passed, show previous GW (latestResultsGw or currentGw - 1)
      // - If deadline has passed, show current GW
      // - If user manually selected, use selectedGw
      // For "gw" (Predictions) tab, always use currentGw
      let gwForData: number | null = null;
      if (tab === "gwr") {
        if (manualGwSelectedRef.current && selectedGw) {
          gwForData = selectedGw;
        } else if (currentGw) {
          // Check game state to determine if deadline has passed (same logic as resGwMemo)
          // If state is LIVE or RESULTS_PRE_GW, deadline has passed - load fixtures for current GW
          // Otherwise (GW_OPEN, GW_PREDICTED, or null/unknown), load fixtures for previous GW
          try {
            const currentGwState = await getGameweekState(currentGw);
            const deadlinePassed = currentGwState === 'LIVE' || currentGwState === 'RESULTS_PRE_GW';
            
            if (deadlinePassed) {
              // Deadline passed - load fixtures for current GW
              gwForData = currentGw;
            } else {
              // Deadline hasn't passed - load fixtures for previous GW
              // Use latestResultsGw if available and valid, otherwise use currentGw - 1
              if (latestResultsGw && latestResultsGw < currentGw) {
                gwForData = latestResultsGw;
              } else {
                // Fallback to currentGw - 1 (or currentGw if it's GW 1)
                gwForData = currentGw > 1 ? currentGw - 1 : currentGw;
              }
            }
          } catch (error) {
            // If game state check fails, fall back to previous logic
            console.error('[League] Error checking game state for fixtures loading:', error);
            if (latestResultsGw && latestResultsGw < currentGw) {
              gwForData = latestResultsGw;
            } else {
              gwForData = currentGw > 1 ? currentGw - 1 : currentGw;
            }
          }
        } else {
          gwForData = selectedGw;
        }
      } else if (tab === "gw") {
        gwForData = currentGw;
      } else {
        gwForData = currentGw;
      }
      if (isApiTestLeague && (tab === "gw" || tab === "gwr")) {
        gwForData = testGwForData; // Use current test GW for API Test league
      }
      
      // For predictions tab with regular leagues, try to detect the GW from submissions
      // This ensures we show picks even if currentGw hasn't been updated yet or if members submitted for a different GW
      if (tab === "gw" && !isApiTestLeague && memberIds.length > 0) {
        // Get the most recent GW that members have submitted for
        const { data: submissionsCheck } = await supabase
          .from("app_gw_submissions")
          .select("gw")
          .in("user_id", memberIds)
          .not("submitted_at", "is", null)
          .order("gw", { ascending: false })
          .limit(10); // Check last 10 GWs
        
        // Try to find a GW that has both submissions AND fixtures
        if (submissionsCheck && submissionsCheck.length > 0) {
          const submittedGws = [...new Set(submissionsCheck.map(s => s.gw))].sort((a, b) => (b || 0) - (a || 0));
          
          for (const submittedGw of submittedGws) {
            if (submittedGw) {
              // Check if fixtures exist for this GW
              const { data: fixtureCheck } = await supabase
                .from("app_fixtures")
                .select("gw")
                .eq("gw", submittedGw)
                .limit(1);
              
              if (fixtureCheck && fixtureCheck.length > 0) {
                gwForData = submittedGw;
                break; // Use the most recent GW with fixtures
              }
            }
          }
        }
        
        // If we still don't have a valid gwForData, use currentGw if it exists
        if (!gwForData && currentGw) {
          gwForData = currentGw;
        }
      }
      
      
      if (!gwForData && !useTestFixtures) {
        setFixtures([]);
        setPicks([]);
        setSubs([]);
        setResults([]);
        return;
      }
      
      let fx;
      if (useTestFixtures) {
        // Fetch from test_api_fixtures for API Test league current test GW
        const { data: testFx } = await supabase
          .from("app_fixtures")
          .select(
            "id,test_gw,fixture_index,home_team,away_team,home_code,away_code,home_name,away_name,home_crest,away_crest,kickoff_time,api_match_id"
          )
          .eq("test_gw", testGwForData)
          .order("fixture_index", { ascending: true });
        // Map test_gw to gw for consistency
        fx = testFx?.map(f => ({ ...f, gw: f.test_gw })) || null;
      } else {
        // Regular fixtures - ALWAYS use main database table for non-API Test leagues
        // CRITICAL: Never use test_api_fixtures for regular leagues
        // Regular fixtures - ALWAYS use main database table for non-API Test leagues
        // CRITICAL: Never use test_api_fixtures for regular leagues
        // NOTE: fixtures table does NOT have api_match_id column (only test_api_fixtures has it)
        const { data: regularFx } = await supabase
          .from("app_fixtures")
          .select(
            "id,gw,fixture_index,home_team,away_team,home_code,away_code,home_name,away_name,kickoff_time,api_match_id"
          )
          .eq("gw", gwForData)
          .order("fixture_index", { ascending: true });
        
        fx = regularFx || null;
      }

      if (!alive) return;
      // Only update if fixtures actually changed to prevent flashing
      setFixtures((prev) => {
        const newFx = (fx as Fixture[]) ?? [];
        if (prev.length !== newFx.length) return newFx;
        if (prev.length === 0 && newFx.length === 0) return prev;
        // Check if any fixture changed
        const hasChanged = prev.some((f, i) => 
          !newFx[i] || f.id !== newFx[i].id || f.fixture_index !== newFx[i].fixture_index
        ) || newFx.some((f, i) => !prev[i] || f.id !== prev[i].id || f.fixture_index !== prev[i].fixture_index);
        return hasChanged ? newFx : prev;
      });

      if (!memberIds.length) {
        setPicks([]);
        setSubs([]);
        setResults([]);
        return;
      }

      // For API Test league, use test_api_picks and test_api_submissions
      let pk: PickRow[] | null = null;
      let submissions;
      
      if (useTestFixtures) {
        // Fetch from test_api_picks for API Test league current test GW
        const { data: testPicks } = await supabase
          .from("app_picks")
          .select("user_id,matchday,fixture_index,pick")
          .eq("matchday", testGwForData)
          .in("user_id", memberIds);
        // Map matchday to gw for consistency
        pk = testPicks?.map(p => ({ ...p, gw: p.matchday })) || null;
        
        // Fetch from test_api_submissions for API Test league current test GW
        // IMPORTANT: Only get submissions that have a non-null submitted_at (actually submitted)
        const { data: testSubs, error: testSubsError } = await supabase
          .from("app_gw_submissions")
          .select("user_id,matchday,submitted_at")
          .eq("matchday", testGwForData)
          .not("submitted_at", "is", null)  // CRITICAL: Only count submissions with non-null submitted_at
          .in("user_id", memberIds);
        if (testSubsError) {
          // Error fetching test_api_submissions (non-critical)
        }
        
        // CRITICAL: Only count submissions if the user has picks for the CURRENT fixtures
        // This filters out old submissions from previous test runs (like Brazil picks)
        // Get the current fixtures with their teams to verify picks match actual teams, not just indices
        const { data: currentTestFixtures } = await supabase
          .from("app_fixtures")
          .select("fixture_index,home_team,away_team,home_code,away_code,kickoff_time")
          .eq("test_gw", testGwForData)
          .order("fixture_index", { ascending: true });
        
        const currentFixtureIndicesSet = new Set((currentTestFixtures || []).map(f => f.fixture_index));
        
        // Filter submissions: only count if user has picks for ALL current fixtures AND those picks match the actual teams
        // This ensures we don't count old submissions (like Brazil picks) even if they have matching fixture indices
        const validSubmissions: typeof testSubs = [];
        if (testSubs && pk && currentTestFixtures) {
          const requiredFixtureCount = currentFixtureIndicesSet.size;
          
          // Get the picks that were fetched - we need to match them against current fixtures
          // Note: We can't directly match teams from picks table, but we can verify:
          // 1. User has picks for ALL current fixture indices
          // 2. The submission timestamp is recent (after current fixtures were created)
          // For now, we'll require ALL picks match current fixture indices
          
          // Use a cutoff date: submissions must be after Nov 18, 2025 (when new fixtures were likely loaded)
          // We use Nov 18 as the cutoff because that's when the new Premier League fixtures were loaded
          // Old submissions from Nov 15 (Brazil picks) will be filtered out
          // Recent submissions from Nov 19+ (Carl, ThomasJamesBird) will be counted
          const cutoffDate = new Date('2025-11-18T00:00:00Z'); // Nov 18, 2025 - when new fixtures were loaded
          
          testSubs.forEach((sub) => {
            // Check if this user has picks for ALL current fixtures
            const userPicks = (pk || []).filter((p: PickRow) => p.user_id === sub.user_id && (p as any).matchday === testGwForData);
            const picksForCurrentFixtures = userPicks.filter((p: PickRow) => currentFixtureIndicesSet.has(p.fixture_index));
            const hasAllRequiredPicks = picksForCurrentFixtures.length === requiredFixtureCount && requiredFixtureCount > 0;
            
            // Additional check: verify the picks are for the right number of fixtures
            // If user has more picks than current fixtures, they might be old picks mixed with new ones
            const uniqueFixtureIndices = new Set(picksForCurrentFixtures.map((p: PickRow) => p.fixture_index));
            const hasExactMatch = uniqueFixtureIndices.size === requiredFixtureCount;
            
            // CRITICAL: Check if submission timestamp is recent (after cutoff date)
            // Old submissions from previous test runs (like Brazil picks) will be filtered out
            const submissionDate = sub.submitted_at ? new Date(sub.submitted_at) : null;
            const isRecentSubmission = submissionDate && submissionDate >= cutoffDate;
            
            if (hasAllRequiredPicks && hasExactMatch && isRecentSubmission) {
              validSubmissions.push(sub);
            }
          });
        }
        
        // Map matchday to gw for consistency
        submissions = validSubmissions.map(s => ({ ...s, gw: s.matchday })) || null;
      } else {
        // Regular picks and submissions - ALWAYS use main database tables for non-API Test leagues
        // CRITICAL: Never use test_api_picks or test_api_submissions for regular leagues
        const { data: regularPicks } = await supabase
          .from("app_picks")
          .select("user_id,gw,fixture_index,pick")
          .eq("gw", gwForData)
          .in("user_id", memberIds);
        pk = regularPicks;
        
        const { data: regularSubs } = await supabase
          .from("app_gw_submissions")
          .select("user_id,gw,submitted_at")
          .eq("gw", gwForData)
          .in("user_id", memberIds);
        submissions = regularSubs;
      }
      
      if (!alive) return;
      // Only update if picks actually changed
      setPicks((prev) => {
        const newPicks = (pk as PickRow[]) ?? [];
        if (prev.length !== newPicks.length) return newPicks;
        if (prev.length === 0 && newPicks.length === 0) return prev;
        const prevStr = JSON.stringify(prev.sort((a, b) => a.fixture_index - b.fixture_index));
        const newStr = JSON.stringify(newPicks.sort((a, b) => a.fixture_index - b.fixture_index));
        return prevStr === newStr ? prev : newPicks;
      });
      // Only update if subs actually changed
      setSubs((prev) => {
        const newSubs = (submissions as SubmissionRow[]) ?? [];
        if (prev.length !== newSubs.length) return newSubs;
        if (prev.length === 0 && newSubs.length === 0) return prev;
        const prevStr = JSON.stringify(prev);
        const newStr = JSON.stringify(newSubs);
        return prevStr === newStr ? prev : newSubs;
      });

      // For API Test league GW 1, results are stored with gw=1 (same as regular results)
      // We'll need to check if results exist for test fixtures specifically
      const { data: rs } = await supabase
        .from("app_gw_results")
        .select("gw,fixture_index,result")
        .eq("gw", useTestFixtures ? 1 : (gwForData || 0));
      if (!alive) return;
      // Only update if results actually changed
      setResults((prev) => {
        const newResults = (rs as ResultRowRaw[]) ?? [];
        if (prev.length !== newResults.length) return newResults;
        if (prev.length === 0 && newResults.length === 0) return prev;
        const prevStr = JSON.stringify(prev.sort((a, b) => a.fixture_index - b.fixture_index));
        const newStr = JSON.stringify(newResults.sort((a, b) => a.fixture_index - b.fixture_index));
        return prevStr === newStr ? prev : newResults;
      });
    })();

    return () => {
      alive = false;
    };
  }, [tab, currentGw, latestResultsGw, selectedGw, memberIds]);

  // Sync ref with liveScores state whenever it changes
  useEffect(() => {
    liveScoresRef.current = liveScores;
  }, [liveScores]);

  // Real-time live scores are now handled by useLiveScores hook above
  // No polling needed - scores update instantly when Netlify writes to live_scores table

  const submittedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    subs.forEach((s) => {
      // Only count as submitted if submitted_at is not null
      if (s.submitted_at) {
        const key = `${s.user_id}:${s.gw}`;
        m.set(key, true);
      }
    });
    return m;
  }, [subs]);

  // Helper to create empty MLT rows (reusable)
  const createEmptyMltRows = useCallback((memberList: Member[]): MltRow[] => {
    return memberList.map((m) => ({
      user_id: m.id,
      name: m.name,
      mltPts: 0,
      ocp: 0,
      unicorns: 0,
      wins: 0,
      draws: 0,
      form: [],
    }));
  }, []);

  /* ---------- Subscribe to gw_results changes for real-time table updates ---------- */
  useEffect(() => {
    // Subscribe to changes in app_gw_results table to trigger table recalculation and update available GWs
    const channel = supabase
      .channel('app-gw-results-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'app_gw_results',
        },
        () => {
          // Increment version to trigger recalculation and update available GWs
          setGwResultsVersion(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Removed - now handled by useMemo + useEffect above for immediate synchronous loading

  /* ---------- Compute Mini League Table (season) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      // If gwResultsVersion changed (results were updated), force recalculation
      // Otherwise, if we already have rows loaded (from cache), skip calculation
      const shouldRecalculate = gwResultsVersion > 0;
      
      // Check if cached data is stale (all wins/draws are 0 when there should be data)
      // This handles the case where cache was created before wins/draws were properly calculated
      const hasStaleCache = mltRows.length > 0 && mltRows.every(row => row.wins === 0 && row.draws === 0);
      const shouldForceRecalc = shouldRecalculate || hasStaleCache;
      
      if (!shouldForceRecalc && mltRows.length > 0) {
        return;
      }
      
      // If forcing recalculation due to results change or stale cache, skip cache checks
      if (!shouldForceRecalc) {
        // Check cache one more time before doing anything
        if (league?.id) {
          const cached = getCached<MltRow[]>(`league:mltRows:${league.id}`);
          if (cached && cached.length > 0) {
            setMltRows(cached);
            return;
          }
        }
      }
      
      if (!members.length) {
        // If we have cached data, keep it; otherwise clear
        if (!getCached<MltRow[]>(`league:mltRows:${league?.id || ''}`)) {
        setMltRows([]);
        }
        return;
      }
      
      // Special handling for "API Test" league - it uses test API data, not regular game data
      if (league?.name === 'API Test') {
        // Show empty table with zero points for all members (test league starts fresh)
        setMltRows(createEmptyMltRows(members));
        return;
      }
      
      // If forcing recalculation, skip cache check
      if (!shouldForceRecalc) {
        // Check cache one more time before calculating
        const hasCachedData = league?.id && getCached<MltRow[]>(`league:mltRows:${league.id}`);
        if (hasCachedData && hasCachedData.length > 0) {
          setMltRows(hasCachedData);
          return;
        }
      }
      
      // Don't calculate until we have currentGw loaded
      if (currentGw === null) {
        return;
      }

      // Use app results for mini-league calculations (app data source)
      const { data: rs } = await supabase.from("app_gw_results").select("gw,fixture_index,result");
      const resultList = (rs as ResultRowRaw[]) ?? [];

      const outcomeByGwIdx = new Map<string, "H" | "D" | "A">();
      resultList.forEach((r) => {
        const out = rowToOutcome(r);
        if (!out) return;
        outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
      });

      if (outcomeByGwIdx.size === 0) {
        setMltRows(createEmptyMltRows(members));
        return;
      }

      const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort(
        (a, b) => a - b
      );

      // Filter gameweeks to only include those from the league's start_gw onwards
      // Special leagues that should include all historical data (start from GW0)
      // Note: "API Test" is excluded - it uses test API data, not regular game data
      const specialLeagues = ['Prem Predictions', 'FC Football', 'Easy League'];
      const gw7StartLeagues = ['The Bird league'];
      
      const leagueStartGw = await getLeagueStartGw(league, currentGw);
      let relevantGws = gwsWithResults.filter(gw => gw >= leagueStartGw);
      
      // CRITICAL: Exclude currentGw only if it's still live (not all fixtures have results)
      // A gameweek is complete when all fixtures have results in app_gw_results
      // Check if currentGw is complete by comparing fixture count to result count
      if (currentGw !== null && relevantGws.includes(currentGw)) {
        // Fetch fixtures for currentGw to check if it's complete
        const { data: fixturesForCurrentGw } = await supabase
          .from("app_fixtures")
          .select("fixture_index")
          .eq("gw", currentGw);
        
        const fixtureCount = fixturesForCurrentGw?.length ?? 0;
        const resultCountForCurrentGw = Array.from(outcomeByGwIdx.keys())
          .filter(k => parseInt(k.split(":")[0], 10) === currentGw)
          .length;
        
        // If currentGw doesn't have results for all fixtures, exclude it (still live)
        // Otherwise, include it (complete)
        if (fixtureCount > 0 && resultCountForCurrentGw < fixtureCount) {
          relevantGws = relevantGws.filter(gw => gw < currentGw);
        }
        // If currentGw is complete (all fixtures have results), keep it in relevantGws
      } else if (currentGw !== null) {
        // currentGw is not in gwsWithResults, so exclude it
        relevantGws = relevantGws.filter(gw => gw < currentGw);
      }

      // For late-starting leagues, if there are no results for the start gameweek or later, show empty table
      if (!specialLeagues.includes(league?.name || '') && !gw7StartLeagues.includes(league?.name || '') && relevantGws.length === 0) {
        setMltRows(createEmptyMltRows(members));
        return;
      }
      
      const { data: pk } = await supabase
        .from("app_picks")
        .select("user_id,gw,fixture_index,pick")
        .in("user_id", members.map((m) => m.id))
        .in("gw", relevantGws);
      const picksAll = (pk as PickRow[]) ?? [];

      type GwScore = { user_id: string; score: number; unicorns: number };
      const perGw = new Map<number, Map<string, GwScore>>();
      relevantGws.forEach((g) => {
        const map = new Map<string, GwScore>();
        members.forEach((m) => map.set(m.id, { user_id: m.id, score: 0, unicorns: 0 }));
        perGw.set(g, map);
      });

      relevantGws.forEach((g) => {
        const idxInGw = Array.from(outcomeByGwIdx.entries())
          .filter(([k]) => parseInt(k.split(":")[0], 10) === g)
          .map(([k, v]) => ({ idx: parseInt(k.split(":")[1], 10), out: v }));

        idxInGw.forEach(({ idx, out }) => {
          const thesePicks = picksAll.filter((p) => p.gw === g && p.fixture_index === idx);
          const correctUsers = thesePicks.filter((p) => p.pick === out).map((p) => p.user_id);

          const map = perGw.get(g)!;
          thesePicks.forEach((p) => {
            if (p.pick === out) {
              const row = map.get(p.user_id)!;
              row.score += 1;
            }
          });

          if (correctUsers.length === 1 && members.length >= 3) {
            const uid = correctUsers[0];
            const row = map.get(uid)!;
            row.unicorns += 1;
          }
        });
      });

      const mltPts = new Map<string, number>();
      const ocp = new Map<string, number>();
      const unis = new Map<string, number>();
      const wins = new Map<string, number>();
      const draws = new Map<string, number>();
      const form = new Map<string, ("W" | "D" | "L")[]>();
      members.forEach((m) => {
        mltPts.set(m.id, 0);
        ocp.set(m.id, 0);
        unis.set(m.id, 0);
        wins.set(m.id, 0);
        draws.set(m.id, 0);
        form.set(m.id, []);
      });

      relevantGws.forEach((g) => {
        const rows = Array.from(perGw.get(g)!.values());
        rows.forEach((r) => {
          ocp.set(r.user_id, (ocp.get(r.user_id) ?? 0) + r.score);
          unis.set(r.user_id, (unis.get(r.user_id) ?? 0) + r.unicorns);
        });

        rows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);
        if (!rows.length) return;

        const top = rows[0];
        const coTop = rows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);

        if (coTop.length === 1) {
          mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
          wins.set(top.user_id, (wins.get(top.user_id) ?? 0) + 1);
          form.get(top.user_id)!.push("W");
          rows.slice(1).forEach((r) => form.get(r.user_id)!.push("L"));
        } else {
          coTop.forEach((r) => {
            mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
            draws.set(r.user_id, (draws.get(r.user_id) ?? 0) + 1);
            form.get(r.user_id)!.push("D");
          });
          rows
            .filter((r) => !coTop.find((t) => t.user_id === r.user_id))
            .forEach((r) => form.get(r.user_id)!.push("L"));
        }
      });

      const rows: MltRow[] = members.map((m) => ({
        user_id: m.id,
        name: m.name,
        mltPts: mltPts.get(m.id) ?? 0,
        ocp: ocp.get(m.id) ?? 0,
        unicorns: unis.get(m.id) ?? 0,
        wins: wins.get(m.id) ?? 0,
        draws: draws.get(m.id) ?? 0,
        form: form.get(m.id) ?? [],
      }));

      rows.sort((a, b) => b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name));

      if (!alive) return;
      setMltRows(rows);
      // Cache the calculated rows for instant loading next time
      if (league?.id) {
        setCached(`league:mltRows:${league.id}`, rows, CACHE_TTL.LEAGUES);
      }
    })();

    return () => {
      alive = false;
    };
  }, [members, league, currentGw, createEmptyMltRows, gwResultsVersion]);

  /* =========================
     Renderers
     ========================= */

  const handleShareLeagueCode = useCallback(async () => {
    if (!league || !hookCurrentGw) {
      setShowInvite(true);
      return;
    }

    try {
      // Check if league has been running for more than 4 gameweeks
      const leagueStartGw = await getLeagueStartGw(
        { id: league.id, name: league.name, created_at: league.created_at },
        hookCurrentGw
      );

      // Check if league has been running for 4+ gameweeks
      // If current_gw - league_start_gw >= 4, the league is locked
      if (hookCurrentGw - leagueStartGw >= 4) {
        setShowLeagueLockedError(true);
        return;
      }

      // League is not locked, show the share modal
      setShowInvite(true);
    } catch (error) {
      // If there's an error checking, allow sharing (fail open)
      console.error('[League] Error checking league lock status:', error);
      setShowInvite(true);
    }
  }, [league, hookCurrentGw]);

  function InviteMessage() {
    return (
      <div className="text-center p-8 bg-white rounded-xl border border-slate-200 shadow-sm">
        <img 
          src="/assets/Volley/volley-with-ball.png" 
          alt="Volley" 
          className="w-24 h-24 mx-auto mb-4 object-contain"
        />
        <p className="text-slate-600 mb-4 font-bold">
          Share your league code with friends to kick things off.
        </p>
        <button
          onClick={handleShareLeagueCode}
          className="px-4 py-2 bg-[#1C8376] text-white font-semibold rounded-lg"
        >
          Share League Code
        </button>
      </div>
    );
  }

  function LeagueLockedErrorModal() {
    const backdropRef = useRef<HTMLDivElement>(null);

    // Close on escape key
    useEffect(() => {
      if (!showLeagueLockedError) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowLeagueLockedError(false);
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [showLeagueLockedError]);

    // Prevent body scroll when open
    useEffect(() => {
      if (showLeagueLockedError) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => {
        document.body.style.overflow = '';
      };
    }, [showLeagueLockedError]);

    if (!showLeagueLockedError) return null;

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        setShowLeagueLockedError(false);
      }
    };

    return createPortal(
      <>
        {/* Backdrop */}
        <div
          ref={backdropRef}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleBackdropClick}
          aria-hidden="true"
          style={{
            animation: 'fadeIn 200ms ease-out',
            zIndex: 999999,
          }}
        />

        {/* Modal */}
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="league-locked-error-title"
          onClick={handleBackdropClick}
          style={{
            zIndex: 1000000,
          }}
        >
          <div className="relative overflow-hidden rounded-3xl bg-white px-8 py-8 text-center shadow-2xl max-w-sm w-full">
            {/* Decorative background blurs */}
            <div className="absolute -top-16 -left-10 h-32 w-32 rounded-full bg-red-200/40 blur-2xl" />
            <div className="absolute -bottom-14 -right-12 h-32 w-32 rounded-full bg-amber-200/40 blur-2xl" />
            
            <div className="relative z-10 space-y-4">
              {/* Icon */}
              <svg
                className="w-16 h-16 mx-auto text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>

              {/* Title */}
              <h2
                id="league-locked-error-title"
                className="text-2xl font-extrabold text-amber-600"
              >
                League Locked
              </h2>

              {/* Message */}
              <p className="text-sm text-slate-600 leading-relaxed">
                This league has been running for more than 4 gameweeks. New members can only be added during the first 4 gameweeks.
              </p>

              {/* Close Button */}
              <button
                onClick={() => setShowLeagueLockedError(false)}
                className="mt-4 px-6 py-2.5 bg-[#1C8376] text-white rounded-lg font-semibold hover:bg-[#156d63] transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  }

  function ShareLeagueCodeTray() {
    const [toast, setToast] = useState("");
    const backdropRef = useRef<HTMLDivElement>(null);
    const sheetRef = useRef<HTMLDivElement>(null);

    // Close on escape key
    useEffect(() => {
      if (!showInvite) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowInvite(false);
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [showInvite]);

    // Handle backdrop clicks using React's synthetic events (avoids passive listener warnings)
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
      // Only close if clicking directly on backdrop, not on sheet or its children
      if (e.target === e.currentTarget) {
        setShowInvite(false);
      }
    };

    // Prevent body scroll when open
    useEffect(() => {
      if (showInvite) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => {
        document.body.style.overflow = '';
      };
    }, [showInvite]);

    if (!showInvite || !league) return null;

    const showToast = (msg: string) => {
      setToast(msg);
      window.clearTimeout((showToast as any)._t);
      (showToast as any)._t = window.setTimeout(() => setToast(""), 1600);
    };

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(league.code);
        showToast("Code copied");
      } catch (err) {
        // Fallback for older browsers
        try {
          const textArea = document.createElement('textarea');
          textArea.value = league.code;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          showToast("Code copied");
        } catch (fallbackErr) {
          showToast("Couldn't copy");
        }
      }
    };

    const handleShare = async () => {
      if (!league?.code) return;
      if (typeof window === "undefined" || typeof navigator === "undefined") return;

      const shareText = `Join my mini league "${league.name}" on TotL!`;
      const shareUrl = `${window.location.origin}/league/${league.code}`;
      const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
      
      if (typeof nav.share === "function") {
        try {
          await nav.share({ title: `Join ${league.name}`, text: shareText, url: shareUrl });
          // Share sheet opened successfully (user can cancel/share from there)
          return;
        } catch (err) {
          // Share cancelled or failed (non-critical) - don't show error
          return;
        }
      }

      // Fallback: copy share text to clipboard (for browsers without Web Share API)
      const fallbackText = `${shareText}\n${shareUrl}`;
      try {
        await navigator.clipboard.writeText(fallbackText);
        showToast("Share text copied");
      } catch (err) {
        showToast("Couldn't share");
      }
    };

    const content = (
      <>
        {/* Backdrop */}
        <div
          ref={backdropRef}
          className="fixed inset-0 bg-black/50"
          onClick={handleBackdropClick}
          aria-hidden="true"
          style={{
            animation: 'fadeIn 200ms ease-out',
            zIndex: 999999,
            touchAction: 'manipulation',
          }}
        />

        {/* Sheet */}
        <div
          ref={sheetRef}
          className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-league-code-tray-title"
          onClick={(e) => e.stopPropagation()}
          style={{
            animation: 'slideUp 300ms ease-out',
            zIndex: 1000000,
            touchAction: 'manipulation',
          }}
        >
          {/* Top handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-slate-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pb-4">
            <h2
              id="share-league-code-tray-title"
              className="text-lg font-medium text-slate-900 uppercase tracking-wide"
              style={{ fontFamily: '"Gramatika", sans-serif', fontWeight: 700 }}
            >
              Share League Code
            </h2>
            <button
              onClick={() => setShowInvite(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 pb-8 max-h-[70vh] overflow-y-auto">
            <div className="space-y-6">
              <div>
                <p className="text-slate-600 text-sm mb-3">
                  Share this code (up to {MAX_MEMBERS} members):
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <code className="flex-1 font-mono text-2xl font-bold text-center py-3 px-4 bg-slate-50 rounded-lg border border-slate-200">
                    {league.code}
                  </code>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex-1 px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Copy
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex-1 px-4 py-3 rounded-lg bg-[#1C8376] text-white font-semibold hover:bg-[#156b60] transition-colors"
                  >
                    Share
                  </button>
                </div>
                {/* Toast message */}
                <div
                  className={`mt-3 text-xs rounded bg-slate-900 text-white px-3 py-2 text-center transition-opacity ${
                    toast ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                >
                  {toast || "…"}
                </div>
                <div className="mt-4 text-xs text-slate-500 text-center">
                  {members.length}/{MAX_MEMBERS} members
                </div>
              </div>
            </div>
          </div>

          {/* Bottom handle */}
          <div className="flex justify-center pb-3">
            <div className="w-12 h-1 bg-slate-300 rounded-full" />
          </div>
        </div>
      </>
    );

    // Render to document.body using portal to ensure it's above everything
    if (typeof document !== 'undefined' && document.body) {
      return createPortal(content, document.body);
    }

    return content;
  }

  function MltTab() {
    const renderStart = performance.now();
    console.log('[MltTab] ⚡ RENDERING START', { 
      mltRowsLength: mltRows.length, 
      membersLength: members.length, 
      leagueId: league?.id,
      timestamp: renderStart
    });
    
    // CRITICAL: Call hooks FIRST (React rules) - same order as other tab components
    const hookStart = performance.now();
    const _dummyGw = useMemo(() => currentGw ?? null, [currentGw]);
    const _dummyState = useGameweekState(_dummyGw);
    void _dummyState; // Suppress unused variable warning
    const hookEnd = performance.now();
    console.log('[MltTab] ⚡ Hooks complete', { duration: hookEnd - hookStart });

    // SIMPLE: Just use mltRows state directly - it's already populated from cache synchronously
    // No need to read cache again - state is the source of truth
    const rowsStart = performance.now();
    const rows = mltRows.length > 0 
      ? mltRows
      : members.length > 0
        ? members.map((m) => ({
          user_id: m.id,
          name: m.name,
          mltPts: 0,
          ocp: 0,
          unicorns: 0,
          wins: 0,
          draws: 0,
          form: [] as ("W" | "D" | "L")[],
          }))
        : [];
    const rowsEnd = performance.now();
    console.log('[MltTab] ⚡ Rows calculated', { 
      rowsLength: rows.length, 
      mltRowsLength: mltRows.length,
      duration: rowsEnd - rowsStart
    });

    // Check if this is a late-starting league (not one of the special leagues that start from GW0)
    // Note: "API Test" is excluded - it uses test API data, not regular game data
    const specialLeagues = ['Prem Predictions', 'FC Football', 'Easy League'];
    const gw7StartLeagues = ['The Bird league'];
    const gw8StartLeagues = ['gregVjofVcarl', 'Let Down'];
    const isLateStartingLeague = !!(league && !specialLeagues.includes(league.name) && !gw7StartLeagues.includes(league.name) && !gw8StartLeagues.includes(league.name));

    if (members.length === 1) {
      return <InviteMessage />;
    }

    return (
      <div className="pt-4">
        <MiniLeagueTable
          rows={rows}
          members={members}
          showForm={showForm}
          currentUserId={user?.id}
          loading={false}
          isLateStartingLeague={isLateStartingLeague}
        />

        <div className="mt-6 flex justify-between items-center">
          <div className="flex items-center justify-between w-full">
            <PointsFormToggle showForm={showForm} onToggle={setShowForm} />
            <button
              onClick={() => setShowTableModal(true)}
              className="flex items-center justify-center gap-1.5 bg-white border-2 border-slate-300 rounded-full text-slate-600 cursor-help flex-shrink-0 px-3 py-2"
            >
              <img 
                src="/assets/Icons/School--Streamline-Outlined-Material-Pr0_White.png" 
                alt="Rules" 
                className="w-4 h-4"
                style={{ filter: 'invert(40%) sepia(8%) saturate(750%) hue-rotate(180deg) brightness(95%) contrast(88%)' }}
              />
              <span className="text-sm font-medium">Rules</span>
            </button>
          </div>
        </div>

        {league?.name === 'API Test' && (
          <div className="mt-4" style={{ marginLeft: '-1rem', marginRight: '-1rem', width: 'calc(100% + 2rem)', paddingLeft: 0, paddingRight: 0 }}>
            <video 
              src="/assets/Animation/Unicorn_Small.mov" 
              autoPlay 
              loop 
              muted 
              playsInline
              style={{ width: '100%', height: 'auto', display: 'block', padding: 0, margin: 0 }}
            />
          </div>
        )}
      </div>
    );
  }

  function GwPicksTab() {
    // Memoize picksGw to prevent unnecessary re-renders and hook re-runs
    // CRITICAL: Always return a number or null, never undefined, to ensure consistent hook calls
    const picksGw = useMemo(() => {
      if (league?.name === 'API Test') {
        return currentTestGw ?? 1;
      }
      return currentGw ?? null;
    }, [league?.name, currentTestGw, currentGw]);
    
    // Use centralized game state system for deadline checks
    // Always pass a number or null (never undefined) to ensure consistent hook calls
    const { state: picksGwState } = useGameweekState(picksGw);
    
    if (members.length === 1) {
      return <InviteMessage />;
    }
    
    if (!picksGw) {
      return <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-600">No current gameweek available.</div>;
    }

    // Check if this specific GW should be shown for this league
    if (!shouldIncludeGwForLeague(league, picksGw, gwDeadlines)) {
      return (
        <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-600">
          <div className="text-center">
            <div className="text-lg font-semibold mb-2">No Predictions Available</div>
            <div className="text-sm">This league started from a later gameweek.</div>
            <div className="text-sm">GW{picksGw} predictions are not included in this league.</div>
          </div>
        </div>
      );
    }

    const outcomes = new Map<number, "H" | "D" | "A">();
    
    // First, populate from database results
    results.forEach((r) => {
      if (r.gw !== picksGw) return;
      const out = rowToOutcome(r);
      if (!out) return;
      outcomes.set(r.fixture_index, out);
    });
    
    // Then, update with live scores for fixtures that are live or finished
    // This ensures correct picks are shown even when results aren't in the database yet
    fixtures.forEach((f) => {
      if (f.gw !== picksGw) return;
      const liveScore = liveScores[f.fixture_index];
      if (liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED')) {
        // Determine outcome from live score
        if (liveScore.homeScore > liveScore.awayScore) {
          outcomes.set(f.fixture_index, 'H');
        } else if (liveScore.awayScore > liveScore.homeScore) {
          outcomes.set(f.fixture_index, 'A');
        } else {
          outcomes.set(f.fixture_index, 'D');
        }
      }
    });

    const sections = useMemo(() => {
      const fmt = (iso?: string | null) => {
        if (!iso) return "Fixtures";
        const d = new Date(iso);
        if (isNaN(d.getTime())) return "Fixtures";
        return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      };
      const buckets = new Map<string, { label: string; key: number; items: Fixture[] }>();
      fixtures
        .filter((f) => f.gw === picksGw)
        .forEach((f) => {
          const label = fmt(f.kickoff_time);
          const key = f.kickoff_time ? new Date(f.kickoff_time).getTime() : Number.MAX_SAFE_INTEGER;
          if (!buckets.has(label)) buckets.set(label, { label, key, items: [] });
          buckets.get(label)!.items.push(f);
        });
      const out = Array.from(buckets.values());
      out.forEach((b) => b.items.sort((a, b) => a.fixture_index - b.fixture_index));
      out.sort((a, b) => a.key - b.key);
      return out;
    }, [fixtures, picksGw]);

    // Get current fixture indices to filter out old picks (e.g., old Brazil picks)
    // For API Test league, we need to be extra careful - only include picks that match EXACTLY
    const currentFixtureIndices = new Set(fixtures.filter(f => f.gw === picksGw).map(f => f.fixture_index));
    
    // Check if this is API Test league (used throughout this function)
    const isApiTestLeague = league?.name === 'API Test';
    
    // Calculate allSubmitted FIRST - we need this before processing picks
    const allSubmitted = members.length > 0 && members.every((m) => submittedMap.get(`${m.id}:${picksGw}`));
    
    
    const picksByFixture = new Map<number, PickRow[]>();
    
    // For API Test league, if not all submitted, don't process ANY picks - they shouldn't be shown
    if (!isApiTestLeague || allSubmitted) {
      picks.forEach((p) => {
        if (p.gw !== picksGw) return;
        
        // CRITICAL: Only include picks from users who have submitted (confirmed) their predictions
        // This applies to ALL leagues - if someone didn't submit, don't show their picks
        const hasSubmitted = submittedMap.get(`${p.user_id}:${picksGw}`);
        if (!hasSubmitted) {
          return;
        }
        
        // CRITICAL: Only include picks for current fixtures (filter out old picks like Brazil)
        // This ensures we don't show picks from previous test runs
        if (!currentFixtureIndices.has(p.fixture_index)) {
          return;
        }
        
        const arr = picksByFixture.get(p.fixture_index) ?? [];
        arr.push(p);
        picksByFixture.set(p.fixture_index, arr);
      });
    }
    const resultsPublished = latestResultsGw !== null && latestResultsGw >= picksGw;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'League.tsx:2750',message:'resultsPublished calculated',data:{picksGw,latestResultsGw,resultsPublished},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    const remaining = members.filter((m) => !submittedMap.get(`${m.id}:${picksGw}`)).length;
    const whoDidntSubmit = members.filter((m) => !submittedMap.get(`${m.id}:${picksGw}`)).map(m => m.name);
    
    // Check if deadline has passed using centralized game state
    // SAFE: Only show picks if we're CERTAIN deadline has passed (state is not null)
    const deadlinePassed = picksGwState !== null && 
      (picksGwState === 'DEADLINE_PASSED' || picksGwState === 'LIVE' || picksGwState === 'RESULTS_PRE_GW');
    

    // For API Test league, show submission status only if not all submitted
    // Also show it if user is on "gw" tab but not all submitted (they should see "Who's submitted" instead of predictions)
    const showSubmissionStatus = isApiTestLeague 
      ? !allSubmitted  // Always show "Who's submitted" if not all submitted, regardless of tab
      : (!allSubmitted && !deadlinePassed);

    // For ALL leagues, if not all submitted (and deadline hasn't passed for regular leagues), ONLY show "Who's submitted" view, nothing else
    // This is CRITICAL - no predictions/fixtures should show if not all submitted
    const shouldShowWhoSubmitted = isApiTestLeague ? !allSubmitted : (!allSubmitted && !deadlinePassed);
    
    if (shouldShowWhoSubmitted) {
      return (
        <SubmissionStatusTable
          members={members}
          submittedMap={submittedMap}
          picksGw={picksGw}
          allSubmitted={allSubmitted}
          remaining={remaining}
          fixtures={fixtures.filter(f => f.gw === picksGw)}
          variant="compact"
        />
      );
    }

    return (
      <div className="mt-2 pt-2">

        {showSubmissionStatus ? (
          <SubmissionStatusTable
            members={members}
            submittedMap={submittedMap}
            picksGw={picksGw}
            allSubmitted={allSubmitted}
            remaining={remaining}
            fixtures={fixtures.filter(f => f.gw === picksGw)}
            variant="full"
          />
        ) : null}

        {/* API Test league "who picked who" view when all submitted - ONLY show if all submitted */}
        {league?.name === 'API Test' && allSubmitted && sections.length > 0 && !showSubmissionStatus && (() => {
          // Check if any games are live or finished - match Home page logic exactly
          const fixturesToCheck = sections.flatMap(sec => sec.items);
          // Create a Set of fixture_indices for quick lookup
          const currentFixtureIndices = new Set(fixturesToCheck.map(f => f.fixture_index));
          
          // Filter liveScores to only include scores for fixtures in current GW
          const filteredLiveScores: Record<number, { homeScore: number; awayScore: number; status: string; minute?: number | null }> = {};
          Object.keys(liveScores).forEach(key => {
            const fixtureIndex = parseInt(key, 10);
            if (currentFixtureIndices.has(fixtureIndex)) {
              filteredLiveScores[fixtureIndex] = liveScores[fixtureIndex];
            }
          });
          
          const hasLiveGames = fixturesToCheck.some(f => {
            const score = filteredLiveScores[f.fixture_index];
            return score && (score.status === 'IN_PLAY' || score.status === 'PAUSED');
          });
          const allGamesFinished = fixturesToCheck.length > 0 && fixturesToCheck.every(f => {
            const score = filteredLiveScores[f.fixture_index];
            return score && score.status === 'FINISHED';
          });
          const hasStarted = hasLiveGames || allGamesFinished || fixturesToCheck.some(f => filteredLiveScores[f.fixture_index]);
          
          // Count live fixtures where user has correct predictions (matches Home page logic)
          let liveFixturesCount = 0;
          if (user?.id) {
            fixturesToCheck.forEach(f => {
              const liveScore = filteredLiveScores[f.fixture_index];
              const isLive = liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
              const isFinished = liveScore && liveScore.status === 'FINISHED';
              
              if (liveScore && (isLive || isFinished)) {
                const userPicks = picksByFixture.get(f.fixture_index) ?? [];
                const userPick = userPicks.find(p => p.user_id === user.id);
                
                if (userPick) {
                  let isCorrect = false;
                  if (userPick.pick === 'H' && liveScore.homeScore > liveScore.awayScore) isCorrect = true;
                  else if (userPick.pick === 'A' && liveScore.awayScore > liveScore.homeScore) isCorrect = true;
                  else if (userPick.pick === 'D' && liveScore.homeScore === liveScore.awayScore) isCorrect = true;
                  
                  if (isCorrect) {
                    liveFixturesCount++;
                  }
                }
              }
            });
          }
          
          return (
            <div className="mt-3 space-y-6">
              {sections.map((sec, si) => (
                <LeagueFixtureSection
                  key={si}
                  label={sec.label}
                  fixtures={sec.items}
                  picksByFixture={picksByFixture}
                  members={members}
                  outcomes={outcomes}
                  liveScores={filteredLiveScores}
                  submittedMap={submittedMap}
                  picksGw={picksGw}
                  isApiTestLeague={true}
                  isFirstSection={si === 0}
                  hasLiveGames={hasLiveGames}
                  allGamesFinished={allGamesFinished}
                  hasStarted={hasStarted}
                  liveFixturesCount={liveFixturesCount}
                />
              ))}
            </div>
          );
        })()}

        {/* Regular league predictions view - NEVER show for API Test league (it has its own view above) */}
        {sections.length > 0 && league?.name !== 'API Test' && (() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'League.tsx:2877',message:'Calculating allGamesFinished',data:{picksGw,resultsLength:results.length,resultsGwValues:results.map(r=>({gw:r.gw,fixture_index:r.fixture_index})),sectionsLength:sections.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          
          // Check if all games have finished for regular leagues
          // Create a Set of fixture indices that have database results (definitely finished)
          const filteredResults = results.filter(r => r.gw === picksGw);
          const fixturesWithResults = new Set(
            filteredResults.map(r => r.fixture_index)
          );
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'League.tsx:2883',message:'fixturesWithResults calculated',data:{picksGw,filteredResultsLength:filteredResults.length,fixturesWithResultsArray:Array.from(fixturesWithResults)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          
          const fixturesToCheck = sections.flatMap(sec => sec.items);
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'League.tsx:2888',message:'fixturesToCheck prepared',data:{picksGw,fixturesToCheckLength:fixturesToCheck.length,fixtureIndices:fixturesToCheck.map(f=>f.fixture_index)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
          // #endregion
          
          const fixtureStatusChecks = fixturesToCheck.map(f => {
            const hasDbResult = fixturesWithResults.has(f.fixture_index);
            const liveScore = liveScores[f.fixture_index];
            const liveScoreStatus = liveScore?.status;
            const isFinished = hasDbResult || (liveScore && liveScore.status === 'FINISHED');
            return {
              fixture_index: f.fixture_index,
              hasDbResult,
              liveScoreStatus,
              isFinished
            };
          });
          
          const allGamesFinished = fixturesToCheck.length > 0 && fixturesToCheck.every(f => {
            // If fixture has database results, it's definitely finished
            if (fixturesWithResults.has(f.fixture_index)) {
              return true;
            }
            
            // Otherwise, check live score status - must be FINISHED
            const liveScore = liveScores[f.fixture_index];
            return liveScore && liveScore.status === 'FINISHED';
          });
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'League.tsx:2910',message:'allGamesFinished calculated',data:{picksGw,allGamesFinished,fixturesToCheckLength:fixturesToCheck.length,fixtureStatusChecks,resultsPublished,allSubmitted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          
          return (
            <div className="mt-3 space-y-6">
              {sections.map((sec, si) => (
                <LeagueFixtureSection
                  key={si}
                  label={sec.label}
                  fixtures={sec.items}
                  picksByFixture={picksByFixture}
                  members={members}
                  outcomes={outcomes}
                  liveScores={liveScores}
                  submittedMap={submittedMap}
                  picksGw={picksGw}
                  isApiTestLeague={false}
                  isFirstSection={si === 0}
                  allSubmitted={allSubmitted}
                  resultsPublished={resultsPublished}
                  allGamesFinished={allGamesFinished}
                  deadlinePassed={deadlinePassed}
                  whoDidntSubmit={whoDidntSubmit}
                />
              ))}
            </div>
          );
        })()}

        {!sections.length && !showSubmissionStatus && (
          <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-500">No fixtures for GW {picksGw}.</div>
        )}

      </div>
    );
  }

  function GwResultsTab() {
    // CRITICAL: Call hooks in same order as other tab components to prevent hook ordering errors
    // Add matching hook calls to ensure consistent hook count across all tab components
    
    // Check game state of current GW to determine which GW to show
    const { state: currentGwState } = useGameweekState(currentGw);
    
    const resGwMemo = useMemo(() => {
      if (league?.name === 'API Test') {
        return currentTestGw ?? 1;
      }
      
      // For "gwr" tab (GW table): show previous GW until deadline passes, then show current GW
      if (tab === "gwr") {
        // If user manually selected a GW, use that
        if (manualGwSelectedRef.current && selectedGw) {
          return selectedGw;
        }
        
        // If no currentGw, fallback to selectedGw
        if (!currentGw) {
          return selectedGw;
        }
        
        // Determine if deadline has passed
        // If state is LIVE or RESULTS_PRE_GW, deadline has passed - show current GW
        // Otherwise (GW_OPEN, GW_PREDICTED, or null/unknown), show previous GW
        const deadlinePassed = currentGwState === 'LIVE' || currentGwState === 'RESULTS_PRE_GW';
        
        if (deadlinePassed) {
          // Deadline passed - show current GW
          return currentGw;
        } else {
          // Deadline hasn't passed - show previous GW
          // Use latestResultsGw if available and valid, otherwise use currentGw - 1
          if (latestResultsGw && latestResultsGw < currentGw) {
            return latestResultsGw;
          }
          // Fallback to currentGw - 1 (or currentGw if it's GW 1)
          return currentGw > 1 ? currentGw - 1 : currentGw;
        }
      }
      
      // For other tabs, use selectedGw
      return selectedGw;
    }, [league?.name, currentTestGw, tab, selectedGw, currentGw, currentGwState, latestResultsGw]);
    
    const _dummyState = useGameweekState(resGwMemo);
    void _dummyState; // Suppress unused variable warning
    
    // For Live Table tab, prioritize currentGw (the active/live GW) over selectedGw
    // UNLESS the user has manually selected a GW, in which case use selectedGw
    // For other tabs, use selectedGw
    const resGw = resGwMemo;
    
    if (members.length === 1) {
      return <InviteMessage />;
    }
    
    if (!resGw || (availableGws.length === 0 && league?.name !== 'API Test')) {
      return <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-600">No gameweek selected.</div>;
    }

    // Check if this specific GW should be shown for this league
    if (!shouldIncludeGwForLeague(league, resGw, gwDeadlines)) {
      return (
        <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-600">
          <div className="text-center">
            <div className="text-lg font-semibold mb-2">No Results Available</div>
            <div className="text-sm">This league started from a later gameweek.</div>
            <div className="text-sm">GW{resGw} results are not included in this league.</div>
          </div>
        </div>
      );
    }

    const outcomes = new Map<number, "H" | "D" | "A">();
    const isApiTestLeague = league?.name === 'API Test';
    
    // Filter fixtures to only those for the selected GW
    const fixturesForGw = fixtures.filter((f: any) => f.gw === resGw);
    
    // Check if this GW is live (has live or finished games) - only check fixtures for this GW
    const hasLiveScores = fixturesForGw.some((f: any) => {
      const liveScore = liveScores[f.fixture_index];
      return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED');
    });
    
    // For API Test league, ONLY use live scores (ignore database results)
    // For regular leagues, use live scores if GW is live, otherwise use results
    if (isApiTestLeague && resGw === (currentTestGw ?? 1)) {
      // Check live scores for fixtures in this GW - count both live and finished fixtures
      fixturesForGw.forEach((f: any) => {
        const liveScore = liveScores[f.fixture_index];
        if (liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED')) {
          // Determine outcome from live score
          if (liveScore.homeScore > liveScore.awayScore) {
            outcomes.set(f.fixture_index, 'H');
          } else if (liveScore.awayScore > liveScore.homeScore) {
            outcomes.set(f.fixture_index, 'A');
          } else {
            outcomes.set(f.fixture_index, 'D');
          }
        }
      });
      // DO NOT fill in from results - only count live/finished fixtures
    } else if (hasLiveScores && resGw === currentGw) {
      // Regular league with live GW - use live scores
      fixturesForGw.forEach((f: any) => {
        const liveScore = liveScores[f.fixture_index];
        if (liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED')) {
          // Determine outcome from live score
          if (liveScore.homeScore > liveScore.awayScore) {
            outcomes.set(f.fixture_index, 'H');
          } else if (liveScore.awayScore > liveScore.homeScore) {
            outcomes.set(f.fixture_index, 'A');
          } else {
            outcomes.set(f.fixture_index, 'D');
          }
        }
      });
    } else {
      // Regular league - use results (for past GWs)
      results.forEach((r) => {
        if (r.gw !== resGw) return;
        const out = rowToOutcome(r);
        if (!out) return;
        outcomes.set(r.fixture_index, out);
      });
    }

    type Row = { user_id: string; name: string; score: number; unicorns: number };
    // Include ALL members (not just those who submitted) - show all members in GW table
    const rows: Row[] = members
      .map((m) => ({ user_id: m.id, name: m.name, score: 0, unicorns: 0 }));

    const picksByFixture = new Map<number, PickRow[]>();
    picks.forEach((p) => {
      if (p.gw !== resGw) return;
      // Include all picks (not filtered by submission status)
      const arr = picksByFixture.get(p.fixture_index) ?? [];
      arr.push(p);
      picksByFixture.set(p.fixture_index, arr);
    });

    Array.from(outcomes.entries()).forEach(([idx, out]) => {
      const these = picksByFixture.get(idx) ?? [];
      const correctIds = these.filter((p) => p.pick === out).map((p) => p.user_id);

      correctIds.forEach((uid) => {
        const r = rows.find((x) => x.user_id === uid)!;
        r.score += 1;
      });

      if (correctIds.length === 1 && members.length >= 3) {
        const r = rows.find((x) => x.user_id === correctIds[0])!;
        r.unicorns += 1;
      }
    });

    rows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns || a.name.localeCompare(b.name));

    // Detect position changes and trigger animations (using useEffect to handle state updates)
    useEffect(() => {
      if (rows.length === 0) return;
      
      const currentPositions = new Map<string, number>();
      rows.forEach((r, index) => {
        currentPositions.set(r.user_id, index);
      });
      
      const changedKeys = new Set<string>();
      currentPositions.forEach((newPos, userId) => {
        const oldPos = prevPositionsRef.current.get(userId);
        if (oldPos !== undefined && oldPos !== newPos) {
          changedKeys.add(userId);
        }
      });
      
      // Update previous positions in ref
      prevPositionsRef.current = currentPositions;
      
      // Trigger animation for changed positions
      if (changedKeys.size > 0) {
        setPositionChangeKeys(changedKeys);
        // Clear animation after it completes
        const timeout = setTimeout(() => {
          setPositionChangeKeys(new Set());
        }, 2000);
        return () => clearTimeout(timeout);
      }
    }, [rows.map(r => `${r.user_id}-${r.score}-${r.unicorns}`).join(',')]);

    // Check if all fixtures have finished
    let allFixturesFinished = false;
    let hasLiveFixtures = false;
    let hasStartingSoonFixtures = false;
    let hasStartedFixtures = false; // Track if at least one game has started
    if (isApiTestLeague && resGw === (currentTestGw ?? 1)) {
      // For API Test league, check if all fixtures (first 3) have finished
      const fixturesToCheck = fixtures;
      if (fixturesToCheck.length > 0) {
        allFixturesFinished = fixturesToCheck.every((f: any) => {
          const liveScore = liveScores[f.fixture_index];
          // Check if fixture has finished status
          return liveScore && liveScore.status === 'FINISHED';
        });
        // Check if any fixtures are live
        const firstLiveFixture = fixturesToCheck.find((f: any) => {
          const liveScore = liveScores[f.fixture_index];
          return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
        });
        hasLiveFixtures = !!firstLiveFixture;
        // Check if at least one fixture has started (live or finished)
        hasStartedFixtures = fixturesToCheck.some((f: any) => {
          const liveScore = liveScores[f.fixture_index];
          return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED');
        });
        // Check if any fixtures are starting soon (within 24 hours of kickoff but not started)
        // Only show if not all fixtures are finished
        if (!allFixturesFinished) {
          const now = new Date();
          hasStartingSoonFixtures = fixturesToCheck.some((f: any) => {
            if (!f.kickoff_time) return false;
            const kickoffTime = new Date(f.kickoff_time);
            const timeUntilKickoff = kickoffTime.getTime() - now.getTime();
            // Starting soon if kickoff is in the future and within 24 hours
            // Also check that there's no live score (meaning it hasn't started)
            const liveScore = liveScores[f.fixture_index];
            const hasNotStarted = !liveScore || (liveScore.status !== 'IN_PLAY' && liveScore.status !== 'PAUSED' && liveScore.status !== 'FINISHED');
            return hasNotStarted && timeUntilKickoff > 0 && timeUntilKickoff <= 24 * 60 * 60 * 1000;
          });
        }
      }
    } else {
      // For regular leagues, check if all fixtures have results
      const fixturesForGw = fixtures.filter(f => f.gw === resGw);
      if (fixturesForGw.length > 0) {
        // Check if all fixtures have results in outcomes map
        const allHaveResults = fixturesForGw.every(f => outcomes.has(f.fixture_index));
        
        // Check if there are any active games (IN_PLAY or PAUSED)
        const hasActiveGames = fixturesForGw.some((f: any) => {
          const liveScore = liveScores[f.fixture_index];
          return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
        });
        
        // GW is finished if:
        // 1. All fixtures have results (outcomes map has all fixture indices)
        // 2. No active games (no IN_PLAY or PAUSED status)
        // If results are published, we trust that the GW has finished
        allFixturesFinished = allHaveResults && !hasActiveGames;
      }
    }

    return (
      <div>
        <style>{`
          @keyframes flash {
            0%, 100% {
              background-color: rgb(209, 250, 229);
            }
            25% {
              background-color: rgb(167, 243, 208);
            }
            50% {
              background-color: rgb(209, 250, 229);
            }
            75% {
              background-color: rgb(167, 243, 208);
            }
          }
          @keyframes pulse-score {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.7;
            }
          }
          @keyframes position-change {
            0% {
              background-color: rgb(254, 243, 199);
            }
            50% {
              background-color: rgb(253, 230, 138);
            }
            100% {
              background-color: transparent;
            }
          }
          .flash-user-row {
            animation: flash 1.5s ease-in-out 3;
          }
          .pulse-live-score {
            animation: pulse-score 2s ease-in-out infinite;
          }
          .position-changed {
            animation: position-change 1.5s ease-out;
          }
          .full-width-header-border::after {
            content: '';
            position: absolute;
            left: -1rem;
            right: -1rem;
            bottom: 0;
            height: 1px;
            background-color: #cbd5e1;
            z-index: 1;
          }
        `}</style>
        
        {/* SP Wins Banner - only show when all fixtures have finished AND GW is not still live */}
        {rows.length > 0 && allFixturesFinished && (
          <WinnerBanner 
            winnerName={rows[0].name} 
            isDraw={rows[0].score === rows[1]?.score && rows[0].unicorns === rows[1]?.unicorns}
          />
        )}

        {/* Table */}
        <ResultsTable
          rows={rows}
          members={members}
          currentUserId={user?.id}
          positionChangeKeys={positionChangeKeys}
          isApiTestLeague={isApiTestLeague}
          hasLiveFixtures={hasLiveFixtures}
          hasStartingSoonFixtures={hasStartingSoonFixtures}
          hasStartedFixtures={hasStartedFixtures}
          allFixturesFinished={allFixturesFinished}
          resGw={resGw}
        />

        {/* GW Selector and Rules Button */}
        {availableGws.length > 1 && (
          <div className="mt-6 mb-4 flex flex-col items-center gap-3 px-4">
            <div className="flex items-center justify-center gap-3 w-full max-w-sm">
              <GwSelector 
                availableGws={availableGws}
                selectedGw={resGw}
                onChange={(newGw) => {
                  manualGwSelectedRef.current = true; // Mark as manually selected
                  setSelectedGw(newGw);
                  // If changing away from currentGw on Live Table, update selectedGw
                  // This allows users to view past GWs even when current GW is live
                }}
              />
              <button
                onClick={() => setShowScoringModal(true)}
                className="flex items-center justify-center gap-1.5 bg-white border-2 border-slate-300 rounded-full text-slate-600 cursor-help flex-shrink-0 px-3 py-2"
              >
                <img 
                  src="/assets/Icons/School--Streamline-Outlined-Material-Pr0_White.png" 
                  alt="Rules" 
                  className="w-4 h-4"
                  style={{ filter: 'invert(40%) sepia(8%) saturate(750%) hue-rotate(180deg) brightness(95%) contrast(88%)' }}
                />
                <span className="text-sm font-medium">Rules</span>
              </button>
            </div>
          </div>
        )}


        {/* Scoring Modal */}
        <InfoSheet
          isOpen={showScoringModal}
          onClose={() => setShowScoringModal(false)}
          title="Weekly Winner"
          description={`🏆 How to Win the Week

The player with the most correct predictions wins.

🦄 Unicorns

In Mini-Leagues with 3 or more players, if you're the only person to correctly predict a fixture, that's a Unicorn. In ties, the player with most Unicorns wins!`}
        />

    </div>
  );
  }

  /* ---------- page chrome ---------- */
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-slate-500">Loading…</div>
      </div>
    );
  }

  if (!league && !loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded border bg-white p-6">
          <div className="font-semibold mb-2">League not found</div>
          <Link to="/leagues" className="text-slate-600 underline">
            Back to Mini Leagues
          </Link>
        </div>
      </div>
    );
  }

  if (!league) {
    return null; // Still loading
  }
  // #endregion

  return (
    <div className={`${oldSchoolMode ? 'oldschool-theme' : 'bg-slate-50'}`} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      height: '100vh',
      maxHeight: '100vh',
      overflow: 'hidden',
      touchAction: 'none',
    }}>
      <style>{`
        /* Prevent body/html scrolling that could affect fixed header */
        body.league-page-active {
          overflow: hidden !important;
          position: fixed !important;
          width: 100% !important;
          height: 100% !important;
        }
        html.league-page-active {
          overflow: hidden !important;
        }
        .league-header-fixed {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 50 !important;
          transform: translate3d(0, 0, 0) !important;
          -webkit-transform: translate3d(0, 0, 0) !important;
          will-change: transform !important;
          contain: layout style paint !important;
          touch-action: none !important;
          user-select: none !important;
          -webkit-user-select: none !important;
          pointer-events: auto !important;
          -webkit-overflow-scrolling: auto !important;
          overflow: visible !important;
        }
        .league-header-fixed a,
        .league-header-fixed button {
          touch-action: manipulation !important;
          user-select: none !important;
          -webkit-user-select: none !important;
        }
        .league-header-fixed .relative {
          position: relative !important;
          z-index: 100 !important;
        }
        @supports (height: 100dvh) {
          .league-header-fixed {
            top: env(safe-area-inset-top, 0px) !important;
          }
        }
        .league-content-wrapper {
          position: fixed;
          top: calc(3.5rem + 3rem + env(safe-area-inset-top, 0px) + 0.5rem);
          left: 0;
          right: 0;
          bottom: 0;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: none;
          overscroll-behavior-y: none;
          overscroll-behavior-x: none;
          touch-action: pan-y;
          padding-bottom: 2rem;
          padding-left: 1rem;
          padding-right: 1rem;
          transition: top 0.3s ease-in-out;
        }
        .league-content-wrapper.has-banner {
          top: calc(3.5rem + 3rem + 3.5rem + env(safe-area-inset-top, 0px) + 0.5rem);
        }
        .league-content-wrapper.menu-open {
          top: calc(3.5rem + 3rem + 12rem + env(safe-area-inset-top, 0px) + 0.5rem);
        }
        .league-content-wrapper.menu-open.has-banner {
          top: calc(3.5rem + 3rem + 3.5rem + 12rem + env(safe-area-inset-top, 0px) + 0.5rem);
        }
        @media (max-width: 768px) {
          .league-content-wrapper {
            top: calc(3.5rem + 3rem + env(safe-area-inset-top, 0px) + 0.5rem);
            padding-bottom: 2rem;
            padding-left: 1rem;
            padding-right: 1rem;
          }
          .league-content-wrapper.has-banner {
            top: calc(3.5rem + 3rem + 3.5rem + env(safe-area-inset-top, 0px) + 0.5rem);
          }
          .league-content-wrapper.menu-open {
            top: calc(3.5rem + 3rem + 12rem + env(safe-area-inset-top, 0px) + 0.5rem);
          }
          .league-content-wrapper.menu-open.has-banner {
            top: calc(3.5rem + 3rem + 3.5rem + 12rem + env(safe-area-inset-top, 0px) + 0.5rem);
          }
        }
        /* Chat tab - full height layout */
        .chat-tab-wrapper {
          position: fixed;
          top: calc(3.5rem + 3rem + env(safe-area-inset-top, 0px));
          left: 0;
          right: 0;
          bottom: 0;
          height: calc(100vh - 3.5rem - 3rem - env(safe-area-inset-top, 0px));
          max-height: calc(100vh - 3.5rem - 3rem - env(safe-area-inset-top, 0px));
          z-index: 10;
          overflow: visible;
          overflow-x: hidden;
          pointer-events: none;
          width: 100%;
          max-width: 100%;
        }
        .chat-tab-wrapper::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url(/assets/Volley/volley-chat-backgroud.png);
          background-repeat: repeat;
          background-size: 110%;
          background-position: top left;
          background-attachment: local;
          opacity: 0.1;
          pointer-events: none;
          z-index: 0;
        }
        .chat-tab-wrapper.has-banner {
          top: calc(3.5rem + 3rem + 3.5rem + env(safe-area-inset-top, 0px));
          height: calc(100vh - 3.5rem - 3rem - 3.5rem - env(safe-area-inset-top, 0px));
          max-height: calc(100vh - 3.5rem - 3rem - 3.5rem - env(safe-area-inset-top, 0px));
        }
        .chat-tab-wrapper > * {
          pointer-events: auto;
        }
        @supports (height: 100dvh) {
          .chat-tab-wrapper {
            height: calc(100dvh - 3.5rem - 3rem - env(safe-area-inset-top, 0px));
            max-height: calc(100dvh - 3.5rem - 3rem - env(safe-area-inset-top, 0px));
          }
          .chat-tab-wrapper.has-banner {
            height: calc(100dvh - 3.5rem - 3rem - 3.5rem - env(safe-area-inset-top, 0px));
            max-height: calc(100dvh - 3.5rem - 3rem - 3.5rem - env(safe-area-inset-top, 0px));
          }
        }
      `}</style>
      {/* Sticky iOS-style header */}
      <div ref={headerRef} className="league-header-fixed bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          {/* Compact header bar */}
          <div className="flex items-center justify-between h-16">
            {/* Back button */}
            <Link 
              to="/leagues" 
              className="flex items-center text-slate-600 -ml-2 px-2 py-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>

            {/* Title with badge */}
            <div className="flex items-center gap-3 flex-1 min-w-0 px-2">
              <button
                type="button"
                onClick={() => {
                  setShowBadgeModal(true);
                }}
                className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 relative cursor-pointer"
              >
                {league ? (
                  <img
                    src={getLeagueAvatarUrl(league)}
                    alt="League badge"
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="eager"
                    decoding="async"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      // Fallback to default ML avatar
                      const defaultAvatar = getDefaultMlAvatar(league.id);
                      const fallbackSrc = `/assets/league-avatars/${defaultAvatar}`;
                      if (target.src !== fallbackSrc) {
                        target.src = fallbackSrc;
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-200" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-slate-900 truncate">
                  {league.name}
                </h1>
                {selectedGw && (
                  <p className="text-sm text-slate-500 truncate">
                    Gameweek {selectedGw}
                  </p>
                )}
              </div>
            </div>
            
            {/* Menu button */}
            <div className="relative" style={{ zIndex: 100 }}>
              <button
                onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                className="flex items-center justify-center w-8 h-8 rounded-full -mr-2"
                aria-label="Menu"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
                    </button>
            </div>
          </div>

          {/* Slide-down menu panel */}
          <div 
            className={`bg-white border-b border-slate-200 transition-all duration-300 ease-in-out overflow-hidden ${
              showHeaderMenu ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="px-4 py-3">
              {isAdmin && (
                <>
                  <div className="mb-3 pb-3 border-b border-slate-200 px-0">
                    <div className="text-xs text-slate-500 mb-1">Admin</div>
                    <div className="text-sm font-semibold text-slate-800">{adminName}</div>
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setShowAdminMenu(true);
                        setShowHeaderMenu(false);
                      }}
                      className="w-full text-left px-0 py-2.5 text-base font-semibold text-slate-700 active:bg-slate-100 rounded-lg flex items-center gap-2 touch-manipulation"
                    >
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Manage</span>
                    </button>
                  </div>
                  <div className="my-3 border-b border-slate-200"></div>
                </>
              )}
              <div className="space-y-1">
                {isMember && (
                  <button
                    onClick={() => {
                      setShowBadgeUpload(true);
                      setShowHeaderMenu(false);
                    }}
                    className="w-full text-left px-0 py-2.5 text-base font-semibold text-slate-700 active:bg-slate-100 rounded-lg flex items-center gap-2 touch-manipulation"
                  >
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Edit League Badge</span>
                  </button>
                )}
                <button
                  onClick={async () => {
                    setShowHeaderMenu(false);
                    await handleShareLeagueCode();
                  }}
                  className="w-full text-left px-0 py-2.5 text-base font-semibold text-slate-700 active:bg-slate-100 rounded-lg flex items-center gap-2 touch-manipulation"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Invite players</span>
                </button>
                <button
                  onClick={() => {
                    shareLeague();
                    setShowHeaderMenu(false);
                  }}
                  className="w-full text-left px-0 py-2.5 text-base font-semibold text-slate-700 active:bg-slate-100 rounded-lg flex items-center gap-2 touch-manipulation"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>Share league code</span>
                </button>
                <button
                  onClick={() => {
                    setShowLeaveConfirm(true);
                    setShowHeaderMenu(false);
                  }}
                  className="w-full text-left px-0 py-2.5 text-base font-semibold text-red-600 active:bg-red-100 rounded-lg flex items-center gap-2 touch-manipulation"
                >
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Leave</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className={`flex border-b border-slate-200 bg-white gap-2 transition-all duration-300 ease-in-out ${
            showHeaderMenu ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-20 opacity-100'
          }`}>
            <button
              onClick={() => {
                manualTabSelectedRef.current = true; // Mark as manually selected (synchronous)
                        setTab("chat");
              }}
              className={
                "flex-1 min-w-0 px-2 sm:px-4 py-3 text-xs font-semibold relative leading-tight " +
                (tab === "chat" ? "text-[#1C8376]" : "text-slate-400")
              }
            >
              <span className="hidden sm:inline">Chat</span>
              <span className="sm:hidden whitespace-pre-line text-center">
                Chat
              </span>
              {tab === "chat" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C8376]" />
              )}
            </button>
            {/* Show GW Results tab if there are any results available (or if it's API Test league) */}
            {(availableGws.length > 0 || league?.name === 'API Test') && (
              <button
                onClick={() => {
                  manualTabSelectedRef.current = true; // Mark as manually selected (synchronous)
                            setTab("gwr");
                }}
                className={
                  "flex-1 min-w-0 px-2 sm:px-4 py-3 text-xs font-semibold relative leading-tight flex items-center justify-center gap-1.5 " +
                  (tab === "gwr" ? "text-[#1C8376]" : "text-slate-400")
                }
              >
                {(() => {
                  // Use centralized game state to check if GW Table tab's GW is live
                  // Only show live indicator if we have a valid GW and state, and state is LIVE
                  const isGwLive = gwTableGw !== null && gwTableGw !== undefined && gwTableState === 'LIVE';
                  
                  return (
                    <>
                      {isGwLive && (
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0"></div>
                      )}
                      <span className="whitespace-nowrap">
                        GW Table
                      </span>
                    </>
                  );
                })()}
                {tab === "gwr" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C8376]" />
                )}
              </button>
            )}
            {/* Show GW Predictions tab if there's a current GW (or if it's API Test league) */}
            {/* Tab is always visible, but content will show "Who's submitted" if not all submitted */}
            {(currentGw || league?.name === 'API Test') && (
              <button
                onClick={() => {
                  manualTabSelectedRef.current = true; // Mark as manually selected (synchronous)
                            setTab("gw");
                }}
                className={
                  "flex-1 min-w-0 px-2 sm:px-4 py-3 text-xs font-semibold relative leading-tight " +
                  (tab === "gw" ? "text-[#1C8376]" : "text-slate-400")
                }
              >
                <span className="hidden sm:inline">Predictions</span>
                <span className="sm:hidden whitespace-pre-line">Predictions</span>
                {tab === "gw" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C8376]" />
                )}
              </button>
            )}
            <button
              onClick={() => {
                console.log('[League] GW Table tab clicked, setting tab to mlt');
                manualTabSelectedRef.current = true; // Mark as manually selected (synchronous)
                        setTab("mlt");
                console.log('[League] Tab set to mlt, mltRows.length:', mltRows.length);
              }}
              className={
                "flex-1 min-w-0 px-2 sm:px-4 py-3 text-xs font-semibold relative leading-tight " +
                (tab === "mlt" ? "text-[#1C8376]" : "text-slate-400")
              }
            >
              Season
              {tab === "mlt" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C8376]" />
              )}
            </button>
          </div>
      </div>
      </div>

      {tab === "chat" ? (
        <div className="chat-tab-wrapper">
          <MiniLeagueChatBeta
            miniLeagueId={league?.id ?? null}
            memberNames={memberNameById}
            deepLinkError={deepLinkError}
          />
        </div>
      ) : (
        <div className={`league-content-wrapper ${showHeaderMenu ? 'menu-open' : ''}`}>
          <div className="px-1 sm:px-2">
            {tab === "mlt" && (() => {
              const startTime = performance.now();
              console.log('[League] Rendering MltTab, tab is mlt', { tab, mltRowsLength: mltRows.length, leagueId: league?.id, timestamp: startTime });
              const result = <MltTab />;
              const endTime = performance.now();
              console.log('[League] MltTab JSX created', { duration: endTime - startTime });
              return result;
            })()}
            {tab === "gw" && <GwPicksTab />}
            {tab === "gwr" && <GwResultsTab />}
          </div>

      </div>
      )}

      {/* Admin Menu Modal */}
      {isAdmin && showAdminMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAdminMenu(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 relative" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setShowAdminMenu(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal content */}
            <div className="p-6 pt-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-6">League Management</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm text-slate-600 mb-3 font-semibold">Remove Members:</h3>
                  <div className="space-y-2">
                    {members
                      .filter((m) => m.id !== user?.id)
                      .map((member) => (
                        <div key={member.id} className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg">
                          <span className="text-sm font-medium text-slate-800">{member.name}</span>
                          <button
                            onClick={() => {
                              setMemberToRemove(member);
                              setShowRemoveConfirm(true);
                              setShowAdminMenu(false);
                            }}
                            className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-md font-semibold"
                          >
                            Remove
                          </button>
                        </div>
                      ))}

                    {members.filter((m) => m.id !== user?.id).length === 0 && (
                      <div className="text-sm text-slate-500 italic py-4 text-center">No other members to remove</div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <button
                    onClick={() => {
                      setShowEndLeagueConfirm(true);
                      setShowAdminMenu(false);
                    }}
                    className="w-full px-4 py-3 text-sm bg-red-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
                  >
                    🗑️ End League
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* League Badge Upload Modal */}
      {isMember && showBadgeUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
          setShowBadgeUpload(false);
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }
          setCropImage(null);
          setBadgeUploadError(null);
          setBadgeUploadSuccess(false);
          setPreviewUrl(null);
        }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 relative" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => {
                setShowBadgeUpload(false);
                if (previewUrl) {
                  URL.revokeObjectURL(previewUrl);
                }
                setCropImage(null);
                setBadgeUploadError(null);
                setBadgeUploadSuccess(false);
                setPreviewUrl(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal content */}
            <div className="p-4 pt-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-1">League Badge</h2>
              <p className="text-xs text-slate-600 mb-4">Upload and customize your mini-league badge</p>
              
              {!cropImage ? (
                <>
                  {/* Current badge preview */}
                  <div className="mb-4">
                    <div className="text-xs text-slate-600 mb-2 font-medium">Current Badge:</div>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border-2 border-slate-200">
                        <img
                          src={league ? getLeagueAvatarUrl(league) : '/assets/league-avatars/ML-avatar-1.png'}
                          alt="League badge"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/assets/league-avatars/ML-avatar-1.png';
                          }}
                        />
                      </div>
                      {league?.avatar && (
                        <button
                          onClick={handleRemoveBadge}
                          disabled={uploadingBadge}
                          className="px-4 py-2 text-xs bg-red-100 text-red-700 active:bg-red-200 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[36px]"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Upload section */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        Choose Image
                      </label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileSelect(file);
                          }
                        }}
                        disabled={uploadingBadge}
                        className="hidden"
                        id="badge-upload-input"
                      />
                      <label
                        htmlFor="badge-upload-input"
                        className="block w-full border-2 border-dashed border-slate-300 rounded-lg p-6 text-center active:bg-slate-50 active:border-[#1C8376] touch-manipulation"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <div className="text-sm">
                            <span className="text-[#1C8376] font-semibold">Tap to choose image</span>
                          </div>
                          <p className="text-xs text-slate-500">
                            PNG, JPG, or WebP (up to 20MB - will be optimized automatically)
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Upload progress */}
                    {uploadingBadge && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#1C8376]"></div>
                        <span>Processing and uploading...</span>
                      </div>
                    )}

                    {/* Success message */}
                    {badgeUploadSuccess && (
                      <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                        ✓ Badge uploaded successfully!
                      </div>
                    )}

                    {/* Error message */}
                    {badgeUploadError && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                        {badgeUploadError}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Crop view */}
                  <div className="space-y-3">
                    <div className="text-xs text-slate-600">
                      <p className="font-medium">Position your image</p>
                      <p className="text-xs text-slate-500">Drag to position, use slider to zoom</p>
                    </div>
                    
                    <div className="relative w-full" style={{ height: '280px' }}>
                      <Cropper
                        image={cropImage}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        cropShape="round"
                        showGrid={false}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                        style={{
                          containerStyle: {
                            width: '100%',
                            height: '100%',
                            position: 'relative',
                          },
                        }}
                      />
                    </div>

                    {/* Zoom control and Preview in one row */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-1">
                        <label className="block text-xs font-medium text-slate-700">
                          Zoom: {Math.round(zoom * 100)}%
                        </label>
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.1}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1C8376] touch-manipulation"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-medium text-slate-700">Preview:</div>
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-300 flex items-center justify-center flex-shrink-0">
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-200" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Error message */}
                    {badgeUploadError && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                        {badgeUploadError}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          if (previewUrl) {
                            URL.revokeObjectURL(previewUrl);
                          }
                          setCropImage(null);
                          setCrop({ x: 0, y: 0 });
                          setZoom(1);
                          setCroppedAreaPixels(null);
                          setPreviewUrl(null);
                        }}
                        disabled={uploadingBadge}
                        className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg active:bg-slate-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCropAndUpload}
                        disabled={uploadingBadge || !croppedAreaPixels}
                        className="flex-1 px-4 py-3 bg-[#1C8376] text-white rounded-lg active:bg-emerald-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
                      >
                        {uploadingBadge ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            Uploading...
                          </span>
                        ) : (
                          'Upload Badge'
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table Modal */}
      <InfoSheet
        isOpen={showTableModal}
        onClose={() => setShowTableModal(false)}
        title="League Points"
        description={`Win the week – 3 points
Draw – 1 point
Lose – 0 points

🤝 Ties

If two or more players are tied on Points in the table, the player with the most overall Unicorns in the mini league is ranked higher.${league && (['The Bird league'].includes(league.name) || ['gregVjofVcarl', 'Let Down'].includes(league.name)) ? '\n\nNote: This mini league started after GW1, so the "CP" column shows correct predictions since this mini league began.' : ''}`}
      />

      {/* Share League Code Tray */}
      <ShareLeagueCodeTray />

      {/* League Locked Error Modal */}
      <LeagueLockedErrorModal />

      {/* Leave League Confirmation */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Leave League</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to leave "{league?.name}"? You'll need the league code to rejoin later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md"
                disabled={leaving}
              >
                Cancel
              </button>
              <button
                onClick={leaveLeague}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md disabled:opacity-50"
                disabled={leaving}
              >
                {leaving ? "Leaving..." : "Leave League"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Confirmation */}
      {showJoinConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Join Mini League</h3>
            <p className="text-slate-600 mb-6">
              You are about to join <strong>"{league?.name}"</strong>. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowJoinConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md"
                disabled={joining}
              >
                Cancel
              </button>
              <button
                onClick={joinLeague}
                className="flex-1 px-4 py-2 bg-[#1C8376] text-white rounded-md disabled:opacity-50"
                disabled={joining}
              >
                {joining ? "Joining..." : "Join League"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Remove Member</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to remove <strong>"{memberToRemove?.name}"</strong> from the league? They will need the league code to rejoin.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md"
                disabled={removing}
              >
                Cancel
              </button>
              <button
                onClick={removeMember}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md disabled:opacity-50"
                disabled={removing}
              >
                {removing ? "Removing..." : "Remove Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End League Confirmation */}
      {showEndLeagueConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-red-600 mb-2">⚠️ End League</h3>
            <p className="text-slate-600 mb-4">
              Are you absolutely sure you want to <strong>permanently end</strong> the league <strong>"{league?.name}"</strong>?
            </p>
            <p className="text-sm text-red-600 mb-6">
              This will remove all members and delete the league forever. This action cannot be undone!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndLeagueConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md"
                disabled={ending}
              >
                Cancel
              </button>
              <button
                onClick={endLeague}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md disabled:opacity-50"
                disabled={ending}
              >
                {ending ? "Ending..." : "Yes, End League"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Test League Notice - at bottom of page */}
      {league?.name === 'API Test' && (
        <div className="mt-6 mb-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-yellow-800">
            <strong>⚠️ Test League:</strong> This league uses test API data and starts from Test GW 1 with zero points. It does not affect your main game scores.
          </div>
        </div>
      )}

      {/* Full-screen league badge modal */}
      {showBadgeModal && league && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center"
          onClick={() => setShowBadgeModal(false)}
        >
          <div 
            className="flex flex-col items-center gap-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-80 h-80 rounded-full overflow-hidden bg-white shadow-2xl relative">
              <img
                src={getLeagueAvatarUrl(league)}
                alt="League badge"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const defaultAvatar = getDefaultMlAvatar(league.id);
                  const fallbackSrc = `/assets/league-avatars/${defaultAvatar}`;
                  if (target.src !== fallbackSrc) {
                    target.src = fallbackSrc;
                  }
                }}
              />
            </div>
            {isMember && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBadgeModal(false);
                  setShowBadgeUpload(true);
                }}
                className="absolute bottom-[272px] right-1/2 translate-x-[144px] w-16 h-16 rounded-full bg-white shadow-2xl flex items-center justify-center z-20 border-4 border-slate-400"
                title="Edit League Badge"
              >
                <svg className="w-8 h-8 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            <div className="text-white text-xl font-medium">
              {league.name}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
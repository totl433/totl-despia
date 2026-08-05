import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import { useLeagueTabs } from "../hooks/useLeagueTabs";
import { useLeaguePageLayoutLock } from "../hooks/useLeaguePageLayoutLock";
import { useLeagueMeta } from "../hooks/useLeagueMeta";
import { computeGwTableRows } from "../lib/leagueScoring";
import { filterHiddenLeaderboardRows } from "../lib/leaderboardVisibility";
import { useSeasonStack } from "../hooks/useSeasonStack";
import { ensureActiveSeasonCtx, getActiveSeasonCtx } from "../lib/activeSeasonCtx";
import {
  getSeasonTables,
  withSeasonId,
  isNewSeasonFresh,
  type SeasonCtx,
} from "../lib/seasonStack";
import { formatKickoffDateUk } from "../lib/kickoffDisplay";

const MAX_MEMBERS = 8;

/** Resolve season tables for this user (Pile B → app_season_*). */
async function resolveLeagueSeason(userId: string | undefined): Promise<{
  ctx: SeasonCtx;
  tables: ReturnType<typeof getSeasonTables>;
  fresh: boolean;
}> {
  const ctx = userId
    ? await ensureActiveSeasonCtx(supabase as any, userId)
    : getActiveSeasonCtx() ?? {
        useSeasonStack: false,
        seasonId: null,
        seasonLabel: null,
        currentGw: 1,
        viewingGw: null,
      };
  return {
    ctx,
    tables: getSeasonTables(ctx),
    fresh: isNewSeasonFresh(ctx),
  };
}

function mltCacheKey(leagueId: string, seasonCtx: SeasonCtx | null | undefined): string {
  if (seasonCtx?.useSeasonStack) {
    return `league:mltRows:v2:${seasonCtx.seasonId ?? 'stack'}:${leagueId}`;
  }
  return `league:mltRows:${leagueId}`;
}

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
  const { user } = useAuth();
  hookCallCountRef.current++;
  const { currentGw: hookCurrentGw } = useCurrentGameweek();
  hookCallCountRef.current++;
  const seasonStack = useSeasonStack();
  hookCallCountRef.current++;
  
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

  const { headerRef } = useLeaguePageLayoutLock();

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

  const { league, members, firstMember, isMember, isAdmin, loading, setLeague } =
    useLeagueMeta({ code, userId: user?.id });
  hookCallCountRef.current++;
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  hookCallCountRef.current++;
  
  const { tab, setTab, deepLinkError } = useLeagueTabs({ code });
  // tabs: Chat / Mini League Table / GW Picks / GW Results
  // CHAT is always the default tab (never auto-switch to GW Table during live)
  
  // Track tab changes to debug component remounting
  const prevTabRef = useRef<"chat" | "mlt" | "gw" | "gwr" | null>(null);
  useEffect(() => {
    if (prevTabRef.current !== null && prevTabRef.current !== tab) {
      try {
        const existingLogs = localStorage.getItem('message_subscription_logs');
        const logs = existingLogs ? JSON.parse(existingLogs) : [];
        logs.push({
          timestamp: Date.now(),
          leagueId: league?.id,
          status: 'TAB_CHANGED',
          channel: `league-messages:${league?.id}`,
          from: prevTabRef.current,
          to: tab,
          reason: `Tab changed from "${prevTabRef.current}" to "${tab}"`,
        });
        const recentLogs = logs.slice(-50);
        localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
      } catch (e) {
        console.error('[LeaguePage] Failed to log tab change:', e);
      }
    }
    prevTabRef.current = tab;
  }, [tab, league?.id]);
  
  // Track league.id changes
  const prevLeagueIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevLeagueIdRef.current !== null && prevLeagueIdRef.current !== league?.id) {
      try {
        const existingLogs = localStorage.getItem('message_subscription_logs');
        const logs = existingLogs ? JSON.parse(existingLogs) : [];
        logs.push({
          timestamp: Date.now(),
          leagueId: league?.id,
          status: 'LEAGUE_ID_CHANGED',
          channel: `league-messages:${league?.id}`,
          from: prevLeagueIdRef.current,
          to: league?.id,
          reason: `League ID changed from "${prevLeagueIdRef.current}" to "${league?.id}"`,
        });
        const recentLogs = logs.slice(-50);
        localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
      } catch (e) {
        console.error('[LeaguePage] Failed to log league ID change:', e);
      }
    }
    prevLeagueIdRef.current = league?.id ?? null;
  }, [league?.id]);
  
  // Track LeaguePage mount/unmount
  useEffect(() => {
    const pageId = Date.now();
    try {
      const existingLogs = localStorage.getItem('message_subscription_logs');
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      const mountLog = {
        timestamp: Date.now(),
        leagueId: league?.id,
        status: 'LEAGUE_PAGE_MOUNT',
        channel: `league-messages:${league?.id}`,
        pageId,
        tab,
        reason: 'LeaguePage component mounted',
      };
      logs.push(mountLog);
      const recentLogs = logs.slice(-50);
      localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
    } catch (e) {
      console.error('[LeaguePage] Failed to log mount:', e);
    }
    
    return () => {
      try {
        const existingLogs = localStorage.getItem('message_subscription_logs');
        const logs = existingLogs ? JSON.parse(existingLogs) : [];
        const unmountLog = {
          timestamp: Date.now(),
          leagueId: league?.id,
          status: 'LEAGUE_PAGE_UNMOUNT',
          channel: `league-messages:${league?.id}`,
          pageId,
          tab,
          reason: 'LeaguePage component unmounting',
        };
        logs.push(unmountLog);
        const recentLogs = logs.slice(-50);
        localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
      } catch (e) {
        console.error('[LeaguePage] Failed to log unmount:', e);
      }
    };
  }, []); // Only on mount/unmount
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
  // Cooldown map to prevent rapid-fire position-change animations on live churn
  const lastPositionAnimAtRef = useRef<Map<string, number>>(new Map());
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
  
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showEndLeagueConfirm, setShowEndLeagueConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [ending, setEnding] = useState(false);

  /* ----- Chat state (no longer used - MiniLeagueChatBeta handles its own state) ----- */
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
  
  // Calculate GW deadlines once when component loads (season-aware for Pile B)
  useEffect(() => {
    (async () => {
      const { ctx, tables } = await resolveLeagueSeason(user?.id);
      const deadlines = new Map<number, Date>();

      let fxQ = (supabase as any)
        .from(tables.fixtures)
        .select("gw, kickoff_time")
        .order("gw", { ascending: true });
      fxQ = withSeasonId(fxQ, ctx);
      const { data: allGwData } = await fxQ;

      const gwFirstKickoffs = new Map<number, string>();
      if (allGwData) {
        allGwData.forEach((f: any) => {
          if (!f.kickoff_time) return;
          if (
            !gwFirstKickoffs.has(f.gw) ||
            new Date(f.kickoff_time) < new Date(gwFirstKickoffs.get(f.gw)!)
          ) {
            gwFirstKickoffs.set(f.gw, f.kickoff_time);
          }
        });
      }

      gwFirstKickoffs.forEach((kickoffTime, gw) => {
        const firstKickoff = new Date(kickoffTime);
        const deadlineTime = new Date(firstKickoff.getTime() - 75 * 60 * 1000);
        deadlines.set(gw, deadlineTime);
      });

      setGwDeadlines(deadlines);
    })();
  }, [user?.id, seasonStack.useSeasonStack, seasonStack.seasonId]);

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

  /* ---------- load current GW and latest results GW (season-aware) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const { ctx, tables, fresh } = await resolveLeagueSeason(user?.id);
      if (!alive) return;

      // Pile B: published GW from season stack (never app_meta alone — can be mid-25/26)
      // Legacy: app_meta
      let currentGwValue: number;
      if (ctx.useSeasonStack) {
        currentGwValue = ctx.currentGw;
      } else {
        const { data: meta } = await supabase
          .from("app_meta")
          .select("current_gw")
          .eq("id", 1)
          .maybeSingle();
        if (!alive) return;
        currentGwValue = (meta as any)?.current_gw ?? 1;
      }
      setCurrentGw(currentGwValue);

      // Fresh 26/27: no last-season results in the picker
      if (fresh) {
        setLatestResultsGw(null);
        setAvailableGws([currentGwValue]);
        if (!manualGwSelectedRef.current) {
          setSelectedGw(currentGwValue);
        }
        return;
      }

      let resultsQ = (supabase as any)
        .from(tables.results)
        .select("gw")
        .order("gw", { ascending: false });
      resultsQ = withSeasonId(resultsQ, ctx);
      const { data: allGws } = await resultsQ;
      if (!alive) return;

      const gwList: number[] = allGws
        ? Array.from(new Set<number>(allGws.map((r: any) => Number(r.gw)))).sort(
            (a, b) => b - a
          )
        : [];

      setLatestResultsGw(gwList.length ? gwList[0] : null);

      if (currentGwValue && !gwList.includes(currentGwValue)) {
        gwList.unshift(currentGwValue);
      }

      setAvailableGws(gwList);

      // Default selector: stack → published GW; legacy → max completed result GW
      if (!manualGwSelectedRef.current) {
        if (ctx.useSeasonStack) {
          setSelectedGw(currentGwValue);
        } else if (gwList.length > 0) {
          if (!selectedGw || !gwList.includes(selectedGw)) {
            setSelectedGw(gwList[0]);
          }
        }
      } else if (gwList.length > 0 && selectedGw && !gwList.includes(selectedGw)) {
        setSelectedGw(ctx.useSeasonStack ? currentGwValue : gwList[0]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [gwResultsVersion, user?.id, seasonStack.useSeasonStack, seasonStack.seasonId, seasonStack.currentGw]);

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
      // Season-stack testers: never hydrate 25/26 season points from unscoped cache
      const seasonSnap =
        (user?.id
          ? getCached<{ useSeasonStack?: boolean; seasonId?: string | null; seasonLabel?: string | null }>(
              `season:ctx:${user.id}`
            )
          : null) ?? null;
      if (seasonSnap?.useSeasonStack) {
        if (isNewSeasonFresh({ useSeasonStack: true, seasonLabel: seasonSnap.seasonLabel ?? null })) {
          return [];
        }
        // Only accept season-scoped key below
      }

      const seasonCtxForKey: SeasonCtx | null = seasonSnap?.useSeasonStack
        ? {
            useSeasonStack: true,
            seasonId: seasonSnap.seasonId ?? null,
            seasonLabel: seasonSnap.seasonLabel ?? null,
            currentGw: 1,
            viewingGw: null,
          }
        : null;

      const readMlt = (leagueId: string): MltRow[] | null => {
        const key = mltCacheKey(leagueId, seasonCtxForKey);
        const cached = getCached<MltRow[]>(key);
        if (cached && Array.isArray(cached) && cached.length > 0) return cached;
        return null;
      };

      if (code && user?.id) {
        const cachedLeagues = getCached<Array<{ id: string; code: string }>>(`leagues:${user.id}`);
        if (cachedLeagues && Array.isArray(cachedLeagues)) {
          const found = cachedLeagues.find((l) => l.code.toUpperCase() === code.toUpperCase());
          if (found?.id) {
            const cached = readMlt(found.id);
            if (cached) return cached;
          }
        }
      }

      const initialLeague = getInitialLeague();
      if (initialLeague?.id) {
        const cached = readMlt(initialLeague.id);
        if (cached) return cached;
      }
    } catch {
      // cache miss ok
    }
    return [];
  };
  
  const [mltRows, setMltRows] = useState<MltRow[]>(() => filterHiddenLeaderboardRows(getInitialMltRows()));
  
  // Log tab changes (after mltRows is declared)
  useEffect(() => {
    console.log('[League] Tab changed to:', tab, 'mltRows.length:', mltRows.length);
  }, [tab, mltRows.length]);
  
  // Update mltRows from cache when league.id becomes available (season-scoped keys for Pile B)
  useEffect(() => {
    if (!league?.id) return;
    // Do not hydrate 25/26 mlt points for fresh 26/27 stack
    if (seasonStack.useSeasonStack && seasonStack.isNewSeasonFresh) {
      return;
    }
    const seasonCtxSnap: SeasonCtx | null = seasonStack.useSeasonStack
      ? {
          useSeasonStack: true,
          seasonId: seasonStack.seasonId,
          seasonLabel: seasonStack.seasonLabel,
          currentGw: seasonStack.currentGw,
          viewingGw: seasonStack.viewingGw,
        }
      : null;
    const cacheKey = mltCacheKey(league.id, seasonCtxSnap);
    const cached = getCached<MltRow[]>(cacheKey);
    const filteredCached = cached ? filterHiddenLeaderboardRows(cached) : [];
    if (filteredCached.length > 0 && mltRows.length === 0) {
      setMltRows(filteredCached);
    }
  }, [league?.id, seasonStack.useSeasonStack, seasonStack.seasonId, seasonStack.isNewSeasonFresh, mltRows.length]);

  /* ---------- Redirect to valid tab if current tab shouldn't be visible for this league ---------- */
  useEffect(() => {
    if (!league) return;
    
    // For now, we'll let users access all tabs and handle visibility within each tab component
    // The individual tab components will show appropriate messages if the GW shouldn't be visible
  }, [league, tab]);

  /* ---------- mark-as-read handled by useMarkMessagesRead hook in MiniLeagueChatBeta ---------- */

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
      // Pile B: never walk legacy app_gw_submissions (25/26) for detecting GW
      if (tab === "gw" && !isApiTestLeague && memberIds.length > 0) {
        const { ctx: stackCtx, tables: stackTables, fresh } = await resolveLeagueSeason(user?.id);
        if (!fresh) {
          let subCheckQ = (supabase as any)
            .from(stackTables.submissions)
            .select("gw")
            .in("user_id", memberIds)
            .not("submitted_at", "is", null)
            .order("gw", { ascending: false })
            .limit(10);
          subCheckQ = withSeasonId(subCheckQ, stackCtx);
          const { data: submissionsCheck } = await subCheckQ;

          if (submissionsCheck && submissionsCheck.length > 0) {
            const submittedGws = Array.from(
              new Set<number>(
                submissionsCheck.map((s: any) => Number(s.gw)).filter((g: number) => !!g)
              )
            ).sort((a, b) => b - a);

            for (const submittedGw of submittedGws) {
              if (submittedGw) {
                let fxCheckQ = (supabase as any)
                  .from(stackTables.fixtures)
                  .select("gw")
                  .eq("gw", submittedGw)
                  .limit(1);
                fxCheckQ = withSeasonId(fxCheckQ, stackCtx);
                const { data: fixtureCheck } = await fxCheckQ;

                if (fixtureCheck && fixtureCheck.length > 0) {
                  gwForData = submittedGw as number;
                  break;
                }
              }
            }
          }
        }

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
        // Regular fixtures — season stack uses app_season_fixtures for 26/27 testers
        const { ctx, tables } = await resolveLeagueSeason(user?.id);
        let fxQ = (supabase as any)
          .from(tables.fixtures)
          .select(
            "id,gw,fixture_index,home_team,away_team,home_code,away_code,home_name,away_name,kickoff_time,api_match_id"
          )
          .eq("gw", gwForData)
          .order("fixture_index", { ascending: true });
        fxQ = withSeasonId(fxQ, ctx);
        const { data: regularFx } = await fxQ;

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
        // Regular picks and submissions — season-scoped for Pile B
        const { ctx, tables } = await resolveLeagueSeason(user?.id);
        let picksQ = (supabase as any)
          .from(tables.picks)
          .select("user_id,gw,fixture_index,pick")
          .eq("gw", gwForData)
          .in("user_id", memberIds);
        picksQ = withSeasonId(picksQ, ctx);
        const { data: regularPicks } = await picksQ;
        pk = regularPicks;

        let subsQ = (supabase as any)
          .from(tables.submissions)
          .select("user_id,gw,submitted_at")
          .eq("gw", gwForData)
          .in("user_id", memberIds);
        subsQ = withSeasonId(subsQ, ctx);
        const { data: regularSubs } = await subsQ;
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

      // Results for GW (season-aware)
      {
        const { ctx, tables, fresh } = await resolveLeagueSeason(user?.id);
        if (fresh && !useTestFixtures) {
          if (!alive) return;
          setResults([]);
        } else {
          let rsQ = (supabase as any)
            .from(tables.results)
            .select("gw,fixture_index,result")
            .eq("gw", useTestFixtures ? 1 : (gwForData || 0));
          rsQ = withSeasonId(rsQ, ctx);
          const { data: rs } = await rsQ;
          if (!alive) return;
          setResults((prev) => {
            const newResults = (rs as ResultRowRaw[]) ?? [];
            if (prev.length !== newResults.length) return newResults;
            if (prev.length === 0 && newResults.length === 0) return prev;
            const prevStr = JSON.stringify(prev.sort((a, b) => a.fixture_index - b.fixture_index));
            const newStr = JSON.stringify(newResults.sort((a, b) => a.fixture_index - b.fixture_index));
            return prevStr === newStr ? prev : newResults;
          });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [tab, currentGw, latestResultsGw, selectedGw, memberIds, user?.id, seasonStack.useSeasonStack, seasonStack.seasonId]);

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

  /* ---------- Subscribe to results changes for real-time table updates ---------- */
  useEffect(() => {
    const resultTable = seasonStack.useSeasonStack ? 'app_season_results' : 'app_gw_results';
    const channel = supabase
      .channel(`results-changes-${resultTable}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: resultTable,
        },
        () => {
          setGwResultsVersion((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [seasonStack.useSeasonStack]);

  // Removed - now handled by useMemo + useEffect above for immediate synchronous loading

  /* ---------- Compute Mini League Table (season) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!members.length) {
        setMltRows([]);
        return;
      }

      if (league?.name === 'API Test') {
        setMltRows(createEmptyMltRows(members));
        return;
      }

      if (currentGw === null) {
        return;
      }

      const { ctx, tables, fresh } = await resolveLeagueSeason(user?.id);
      if (!alive) return;

      // Fresh 2026/27: zero season table — never sum app_gw_results from 25/26
      if (fresh) {
        const empty = createEmptyMltRows(members);
        setMltRows(empty);
        if (league?.id) {
          setCached(mltCacheKey(league.id, ctx), empty, CACHE_TTL.LEAGUES);
        }
        return;
      }

      const cacheKey = league?.id ? mltCacheKey(league.id, ctx) : '';
      const shouldRecalculate = gwResultsVersion > 0;
      const hasNonZero =
        mltRows.length > 0 && mltRows.some((row) => row.mltPts > 0 || row.wins > 0 || row.ocp > 0);
      // On stack, ignore unscoped legacy rows painted from old cache
      if (
        !shouldRecalculate &&
        mltRows.length > 0 &&
        hasNonZero &&
        !ctx.useSeasonStack
      ) {
        return;
      }

      if (!shouldRecalculate && cacheKey) {
        const cached = getCached<MltRow[]>(cacheKey);
        if (cached && cached.length > 0) {
          setMltRows(filterHiddenLeaderboardRows(cached));
          return;
        }
      }

      let resultsQ = (supabase as any)
        .from(tables.results)
        .select('gw,fixture_index,result');
      resultsQ = withSeasonId(resultsQ, ctx);
      const { data: rs } = await resultsQ;
      if (!alive) return;
      const resultList = (rs as ResultRowRaw[]) ?? [];

      const outcomeByGwIdx = new Map<string, 'H' | 'D' | 'A'>();
      resultList.forEach((r) => {
        const out = rowToOutcome(r);
        if (!out) return;
        outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
      });

      if (outcomeByGwIdx.size === 0) {
        const empty = createEmptyMltRows(members);
        setMltRows(empty);
        if (league?.id) setCached(mltCacheKey(league.id, ctx), empty, CACHE_TTL.LEAGUES);
        return;
      }

      const gwsWithResults = [
        ...new Set(
          Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(':')[0], 10))
        ),
      ].sort((a, b) => a - b);

      // On a new season folder, treat all GWs as valid (start at 1); legacy keeps league start filters
      let relevantGws: number[];
      if (ctx.useSeasonStack) {
        relevantGws = gwsWithResults.slice();
      } else {
        const specialLeagues = ['Prem Predictions', 'FC Football', 'Easy League'];
        const gw7StartLeagues = ['The Bird league'];
        const leagueStartGw = await getLeagueStartGw(league, currentGw);
        relevantGws = gwsWithResults.filter((gw) => gw >= leagueStartGw);
        if (
          !specialLeagues.includes(league?.name || '') &&
          !gw7StartLeagues.includes(league?.name || '') &&
          relevantGws.length === 0
        ) {
          setMltRows(createEmptyMltRows(members));
          return;
        }
      }

      if (currentGw !== null && relevantGws.includes(currentGw)) {
        let fxQ = (supabase as any)
          .from(tables.fixtures)
          .select('fixture_index')
          .eq('gw', currentGw);
        fxQ = withSeasonId(fxQ, ctx);
        const { data: fixturesForCurrentGw } = await fxQ;
        const fixtureCount = fixturesForCurrentGw?.length ?? 0;
        const resultCountForCurrentGw = Array.from(outcomeByGwIdx.keys()).filter(
          (k) => parseInt(k.split(':')[0], 10) === currentGw
        ).length;
        if (fixtureCount > 0 && resultCountForCurrentGw < fixtureCount) {
          relevantGws = relevantGws.filter((gw) => gw < currentGw);
        }
      } else if (currentGw !== null) {
        relevantGws = relevantGws.filter((gw) => gw < currentGw);
      }

      if (relevantGws.length === 0) {
        const empty = createEmptyMltRows(members);
        setMltRows(empty);
        if (league?.id) setCached(mltCacheKey(league.id, ctx), empty, CACHE_TTL.LEAGUES);
        return;
      }

      const picksAll: PickRow[] = [];
      const PICK_PAGE_SIZE = 1000;
      let pickFrom = 0;
      while (true) {
        let picksQ = (supabase as any)
          .from(tables.picks)
          .select('user_id,gw,fixture_index,pick')
          .in(
            'user_id',
            members.map((m) => m.id)
          )
          .in('gw', relevantGws)
          .order('gw', { ascending: true })
          .order('fixture_index', { ascending: true })
          .order('user_id', { ascending: true })
          .range(pickFrom, pickFrom + PICK_PAGE_SIZE - 1);
        picksQ = withSeasonId(picksQ, ctx);
        const { data: pkPage, error: pkErr } = await picksQ;
        if (pkErr) throw pkErr;
        const page = (pkPage as PickRow[]) ?? [];
        picksAll.push(...page);
        if (page.length < PICK_PAGE_SIZE) break;
        pickFrom += PICK_PAGE_SIZE;
      }

      type GwScore = { user_id: string; score: number; unicorns: number };
      const perGw = new Map<number, Map<string, GwScore>>();
      relevantGws.forEach((g) => {
        const map = new Map<string, GwScore>();
        members.forEach((m) => map.set(m.id, { user_id: m.id, score: 0, unicorns: 0 }));
        perGw.set(g, map);
      });

      relevantGws.forEach((g) => {
        const idxInGw = Array.from(outcomeByGwIdx.entries())
          .filter(([k]) => parseInt(k.split(':')[0], 10) === g)
          .map(([k, v]) => ({ idx: parseInt(k.split(':')[1], 10), out: v }));

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
      const form = new Map<string, ('W' | 'D' | 'L')[]>();
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
          form.get(top.user_id)!.push('W');
          rows.slice(1).forEach((r) => form.get(r.user_id)!.push('L'));
        } else {
          coTop.forEach((r) => {
            mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
            draws.set(r.user_id, (draws.get(r.user_id) ?? 0) + 1);
            form.get(r.user_id)!.push('D');
          });
          rows
            .filter((r) => !coTop.find((t) => t.user_id === r.user_id))
            .forEach((r) => form.get(r.user_id)!.push('L'));
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

      rows.sort(
        (a, b) =>
          b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name)
      );

      if (!alive) return;
      setMltRows(rows);
      if (league?.id) {
        setCached(mltCacheKey(league.id, ctx), rows, CACHE_TTL.LEAGUES);
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    members,
    league,
    currentGw,
    createEmptyMltRows,
    gwResultsVersion,
    user?.id,
    seasonStack.useSeasonStack,
    seasonStack.seasonId,
    seasonStack.isNewSeasonFresh,
  ]);

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
      <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <img 
          src="/assets/Volley/volley-with-ball.png" 
          alt="Volley" 
          className="w-24 h-24 mx-auto mb-4 object-contain"
        />
        <p className="text-slate-600 dark:text-slate-300 mb-4 font-bold">
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
          <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800 px-8 py-8 text-center shadow-2xl max-w-sm w-full">
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
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
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
          className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl"
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
            <div className="w-12 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pb-4">
            <h2
              id="share-league-code-tray-title"
              className="text-lg font-medium text-slate-900 dark:text-slate-100 uppercase tracking-wide"
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
                className="w-5 h-5 text-slate-600 dark:text-slate-400"
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
                <p className="text-slate-600 dark:text-slate-300 text-sm mb-3">
                  Share this code (up to {MAX_MEMBERS} members):
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <code className="flex-1 font-mono text-2xl font-bold text-center py-3 px-4 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                    {league.code}
                  </code>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex-1 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
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
                <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                  {members.length}/{MAX_MEMBERS} members
                </div>
              </div>
            </div>
          </div>

          {/* Bottom handle */}
          <div className="flex justify-center pb-3">
            <div className="w-12 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
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
    // CRITICAL: Call hooks FIRST (React rules) - same order as other tab components
    const _dummyGw = useMemo(() => currentGw ?? null, [currentGw]);
    const _dummyState = useGameweekState(_dummyGw);
    void _dummyState; // Suppress unused variable warning

    // SIMPLE: Just use mltRows state directly - it's already populated from cache synchronously
    // No need to read cache again - state is the source of truth
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
              className="flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-full text-slate-600 dark:text-slate-300 cursor-help flex-shrink-0 px-3 py-2"
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
      return <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-4 text-slate-600 dark:text-slate-400">No current gameweek available.</div>;
    }

    // Check if this specific GW should be shown for this league
    if (!shouldIncludeGwForLeague(league, picksGw, gwDeadlines)) {
      return (
        <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-4 text-slate-600 dark:text-slate-400">
          <div className="text-center">
            <div className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-100">No Predictions Available</div>
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
        const label = formatKickoffDateUk(iso);
        return label || "Fixtures";
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
          // Check if all games have finished for regular leagues
          // Create a Set of fixture indices that have database results (definitely finished)
          const filteredResults = results.filter(r => r.gw === picksGw);
          const fixturesWithResults = new Set(
            filteredResults.map(r => r.fixture_index)
          );
          
          const fixturesToCheck = sections.flatMap(sec => sec.items);
          
          const allGamesFinished = fixturesToCheck.length > 0 && fixturesToCheck.every(f => {
            // If fixture has database results, it's definitely finished
            if (fixturesWithResults.has(f.fixture_index)) {
              return true;
            }
            
            // Otherwise, check live score status - must be FINISHED
            const liveScore = liveScores[f.fixture_index];
            return liveScore && liveScore.status === 'FINISHED';
          });
          
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
          <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-4 text-slate-500 dark:text-slate-400">No fixtures for GW {picksGw}.</div>
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
      return <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-4 text-slate-600 dark:text-slate-400">No gameweek selected.</div>;
    }

    // Check if this specific GW should be shown for this league
    if (!shouldIncludeGwForLeague(league, resGw, gwDeadlines)) {
      return (
        <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-4 text-slate-600 dark:text-slate-400">
          <div className="text-center">
            <div className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-100">No Results Available</div>
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

    const rows = computeGwTableRows({
      members,
      picks,
      results,
      liveScores,
      resGw,
      currentGw,
      isApiTestLeague,
      currentTestGw,
    });

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
        // Apply a per-user cooldown so live churn doesn't create rapid flashing.
        const now = Date.now();
        const COOLDOWN_MS = 6000;
        const cooled = new Set<string>();
        changedKeys.forEach((userId) => {
          const last = lastPositionAnimAtRef.current.get(userId) ?? 0;
          if (now - last >= COOLDOWN_MS) {
            cooled.add(userId);
            lastPositionAnimAtRef.current.set(userId, now);
          }
        });

        if (cooled.size === 0) return;

        setPositionChangeKeys(cooled);
        // Clear animation after it completes
        const timeout = setTimeout(() => {
          setPositionChangeKeys(new Set());
        }, 2000);
        return () => clearTimeout(timeout);
      }
    }, [rows.map((r) => r.user_id).join(',')]);

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
                className="flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-full text-slate-600 dark:text-slate-300 cursor-help flex-shrink-0 px-3 py-2"
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
        <div className="text-slate-500 dark:text-slate-400">Loading…</div>
      </div>
    );
  }

  if (!league && !loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <div className="font-semibold mb-2 text-slate-900 dark:text-slate-100">League not found</div>
          <Link to="/leagues" className="text-slate-600 dark:text-slate-400 underline">
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
    <div
      className={`${oldSchoolMode ? 'oldschool-theme' : 'bg-slate-50 dark:bg-slate-900'}`}
      style={{
        position: 'fixed',
        top: 'var(--league-page-top, 0px)',
        left: 0,
        right: 0,
        bottom: 0,
        height: 'calc(100vh - var(--league-page-top, 0px))',
        maxHeight: 'calc(100vh - var(--league-page-top, 0px))',
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
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
          --league-page-top: 0px;
        }
        /* DesktopNav is sticky top-0 with h-20 (5rem). Offset League UI below it on desktop only. */
        @media (min-width: 1024px) {
          html.league-page-active {
            --league-page-top: 5rem;
          }
        }
        .league-header-fixed {
          position: fixed !important;
          top: var(--league-page-top, 0px) !important;
          left: 0 !important;
          right: 0 !important;
          /* Keep below DesktopNav (z-50) but above League content */
          z-index: 40 !important;
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
            top: calc(var(--league-page-top, 0px) + var(--safe-area-top, env(safe-area-inset-top, 0px))) !important;
          }
        }
        .league-content-wrapper {
          position: fixed;
          top: calc(var(--league-page-top, 0px) + 3.5rem + 3rem + var(--safe-area-top, env(safe-area-inset-top, 0px)) + 0.5rem);
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
          top: calc(var(--league-page-top, 0px) + 3.5rem + 3rem + 3.5rem + var(--safe-area-top, env(safe-area-inset-top, 0px)) + 0.5rem);
        }
        .league-content-wrapper.menu-open {
          top: calc(var(--league-page-top, 0px) + 3.5rem + 3rem + 12rem + var(--safe-area-top, env(safe-area-inset-top, 0px)) + 0.5rem);
        }
        .league-content-wrapper.menu-open.has-banner {
          top: calc(var(--league-page-top, 0px) + 3.5rem + 3rem + 3.5rem + 12rem + var(--safe-area-top, env(safe-area-inset-top, 0px)) + 0.5rem);
        }
        @media (max-width: 768px) {
          .league-content-wrapper {
            top: calc(var(--league-page-top, 0px) + 3.5rem + 3rem + var(--safe-area-top, env(safe-area-inset-top, 0px)) + 0.5rem);
            padding-bottom: 2rem;
            padding-left: 1rem;
            padding-right: 1rem;
          }
          .league-content-wrapper.has-banner {
            top: calc(var(--league-page-top, 0px) + 3.5rem + 3rem + 3.5rem + var(--safe-area-top, env(safe-area-inset-top, 0px)) + 0.5rem);
          }
          .league-content-wrapper.menu-open {
            top: calc(var(--league-page-top, 0px) + 3.5rem + 3rem + 12rem + var(--safe-area-top, env(safe-area-inset-top, 0px)) + 0.5rem);
          }
          .league-content-wrapper.menu-open.has-banner {
            top: calc(var(--league-page-top, 0px) + 3.5rem + 3rem + 3.5rem + 12rem + var(--safe-area-top, env(safe-area-inset-top, 0px)) + 0.5rem);
          }
        }
        /* Chat tab - full height layout */
        .chat-tab-wrapper {
          position: fixed;
          top: calc(var(--league-page-top, 0px) + 3.5rem + 3rem + var(--safe-area-top, env(safe-area-inset-top, 0px)));
          left: 0;
          right: 0;
          bottom: 0;
          height: calc(100vh - var(--league-page-top, 0px) - 3.5rem - 3rem - var(--safe-area-top, env(safe-area-inset-top, 0px)));
          max-height: calc(100vh - var(--league-page-top, 0px) - 3.5rem - 3rem - var(--safe-area-top, env(safe-area-inset-top, 0px)));
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
          top: calc(var(--league-page-top, 0px) + 3.5rem + 3rem + 3.5rem + var(--safe-area-top, env(safe-area-inset-top, 0px)));
          height: calc(100vh - var(--league-page-top, 0px) - 3.5rem - 3rem - 3.5rem - var(--safe-area-top, env(safe-area-inset-top, 0px)));
          max-height: calc(100vh - var(--league-page-top, 0px) - 3.5rem - 3rem - 3.5rem - var(--safe-area-top, env(safe-area-inset-top, 0px)));
        }
        .chat-tab-wrapper > * {
          pointer-events: auto;
        }
        @supports (height: 100dvh) {
          .chat-tab-wrapper {
            height: calc(100dvh - var(--league-page-top, 0px) - 3.5rem - 3rem - var(--safe-area-top, env(safe-area-inset-top, 0px)));
            max-height: calc(100dvh - var(--league-page-top, 0px) - 3.5rem - 3rem - var(--safe-area-top, env(safe-area-inset-top, 0px)));
          }
          .chat-tab-wrapper.has-banner {
            height: calc(100dvh - var(--league-page-top, 0px) - 3.5rem - 3rem - 3.5rem - var(--safe-area-top, env(safe-area-inset-top, 0px)));
            max-height: calc(100dvh - var(--league-page-top, 0px) - 3.5rem - 3rem - 3.5rem - var(--safe-area-top, env(safe-area-inset-top, 0px)));
          }
        }
      `}</style>
      {/* Sticky iOS-style header */}
      <div ref={headerRef} className="league-header-fixed bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-[1024px] mx-auto px-4 lg:px-6">
          {/* Compact header bar */}
          <div className="flex items-center justify-between h-16">
            {/* Back button */}
            <Link 
              to="/leagues" 
              className="flex items-center text-slate-600 dark:text-slate-400 -ml-2 px-2 py-1"
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
                className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex-shrink-0 relative cursor-pointer"
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
                <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {league.name}
                </h1>
                {selectedGw && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
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
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
                    </button>
            </div>
          </div>

          {/* Slide-down menu panel */}
          <div 
            className={`bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 transition-all duration-300 ease-in-out overflow-hidden ${
              showHeaderMenu ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="px-4 py-3">
              {isAdmin && (
                <>
                  <div className="mb-3 pb-3 border-b border-slate-200 dark:border-slate-700 px-0">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Admin</div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-white">{adminName}</div>
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setShowAdminMenu(true);
                        setShowHeaderMenu(false);
                      }}
                      className="w-full text-left px-0 py-2.5 text-base font-semibold text-slate-700 dark:text-white active:bg-slate-100 dark:active:bg-slate-700 rounded-lg flex items-center gap-2 touch-manipulation"
                    >
                      <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Manage</span>
                    </button>
                  </div>
                  <div className="my-3 border-b border-slate-200 dark:border-slate-700"></div>
                </>
              )}
              <div className="space-y-1">
                {isMember && (
                  <button
                    onClick={() => {
                      setShowBadgeUpload(true);
                      setShowHeaderMenu(false);
                    }}
                    className="w-full text-left px-0 py-2.5 text-base font-semibold text-slate-700 dark:text-white active:bg-slate-100 dark:active:bg-slate-700 rounded-lg flex items-center gap-2 touch-manipulation"
                  >
                    <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="w-full text-left px-0 py-2.5 text-base font-semibold text-slate-700 dark:text-white active:bg-slate-100 dark:active:bg-slate-700 rounded-lg flex items-center gap-2 touch-manipulation"
                >
                  <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Invite players</span>
                </button>
                <button
                  onClick={() => {
                    shareLeague();
                    setShowHeaderMenu(false);
                  }}
                  className="w-full text-left px-0 py-2.5 text-base font-semibold text-slate-700 dark:text-white active:bg-slate-100 dark:active:bg-slate-700 rounded-lg flex items-center gap-2 touch-manipulation"
                >
                  <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>Share league code</span>
                </button>
                <button
                  onClick={() => {
                    setShowLeaveConfirm(true);
                    setShowHeaderMenu(false);
                  }}
                  className="w-full text-left px-0 py-2.5 text-base font-semibold text-red-600 dark:text-red-400 active:bg-red-100 dark:active:bg-red-900/30 rounded-lg flex items-center gap-2 touch-manipulation"
                >
                  <svg className="w-5 h-5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Leave</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className={`flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 gap-2 transition-all duration-300 ease-in-out ${
            showHeaderMenu ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-20 opacity-100'
          }`}>
            <button
              onClick={() => {
                manualTabSelectedRef.current = true; // Mark as manually selected (synchronous)
                        setTab("chat");
              }}
              className={
                "flex-1 min-w-0 px-2 sm:px-4 py-3 text-xs font-semibold relative leading-tight " +
                (tab === "chat" ? "text-[#1C8376]" : "text-slate-400 dark:text-slate-500")
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
                manualTabSelectedRef.current = true; // Mark as manually selected (synchronous)
                        setTab("mlt");
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

      {(() => {
        if (tab === "chat") {
          return (
            <div className="chat-tab-wrapper">
              <div className="h-full w-full max-w-[1024px] mx-auto px-0 lg:px-6">
                <MiniLeagueChatBeta
                  miniLeagueId={league?.id ?? null}
                  memberNames={memberNameById}
                  deepLinkError={deepLinkError}
                  isChatActive={tab === 'chat'}
                />
              </div>
            </div>
          );
        }
        return (
          <div className={`league-content-wrapper ${showHeaderMenu ? 'menu-open' : ''}`}>
            <div className="max-w-[1024px] mx-auto px-1 sm:px-2 lg:px-6">
              {tab === "mlt" && <MltTab />}
              {tab === "gw" && <GwPicksTab />}
              {tab === "gwr" && <GwResultsTab />}
            </div>
          </div>
        );
      })()}

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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { resolveLeagueStartGw as getLeagueStartGw, shouldIncludeGwForLeague } from "../lib/leagueStart";
import imageCompression from "browser-image-compression";
import { getLeagueAvatarUrl } from "../lib/leagueAvatars";

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

// Helper function to format minute display
function formatMinuteDisplay(status: string, minute: number | null | undefined): string {
  if (status === 'FINISHED') {
    return 'FT';
  }
  if (status === 'PAUSED') {
    return 'HT';
  }
  if (status === 'IN_PLAY') {
    if (minute === null || minute === undefined) {
      return 'LIVE';
    }
    // First half: 1-45 minutes
    if (minute >= 1 && minute <= 45) {
      return 'First Half';
    }
    // Stoppage time in first half: > 45 but before halftime (typically 45-50)
    // Show "45+" until status becomes PAUSED (halftime)
    if (minute > 45 && minute <= 50) {
      return '45+';
    }
    // Second half: after halftime, typically minute > 50
    if (minute > 50) {
      return 'Second Half';
    }
  }
  // Fallback
  return 'LIVE';
}

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

/* Chat */
type ChatMsg = {
  id: string;
  league_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

/* =========================
   Helpers
   ========================= */

function initials(name: string) {
  const parts = (name || "?").trim().split(/\s+/);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function rowToOutcome(r: ResultRowRaw): "H" | "D" | "A" | null {
  if (r.result === "H" || r.result === "D" || r.result === "A") return r.result;
  if (typeof r.home_goals === "number" && typeof r.away_goals === "number") {
    if (r.home_goals > r.away_goals) return "H";
    if (r.home_goals < r.away_goals) return "A";
    return "D";
  }
  return null;
}

/* Small chip used in GW Picks grid */
function Chip({
  letter,
  correct,
  unicorn,
  hasSubmitted,
  isLive,
  isOngoing,
  isFinished,
}: {
  letter: string;
  correct: boolean | null;
  unicorn: boolean;
  hasSubmitted?: boolean;
  isLive?: boolean;
  isOngoing?: boolean;
  isFinished?: boolean;
}) {
  // Logic matches Home Page:
  // - Pulsing green when correct during live/ongoing games
  // - Shiny gradient when correct in finished games
  // - Green when submitted (even if no result or incorrect)
  // - Grey when member hasn't submitted
  let tone: string;
  if (correct === true) {
    // PRIORITY: Check live/ongoing FIRST - never show shiny during live games
    if (isLive || isOngoing) {
      // Live and correct - pulse in emerald green
      tone = "bg-emerald-600 text-white border-emerald-600 animate-pulse shadow-lg shadow-emerald-500/50";
    } else if (isFinished) {
      // Shiny gradient for correct picks in finished games (no border/ring)
      tone = "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl shadow-yellow-400/40 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]";
    } else {
      // Correct but game hasn't started - show emerald green (no pulse, no shiny)
      tone = "bg-emerald-600 text-white border-emerald-600";
    }
  } else if (hasSubmitted) {
    // Green when submitted (even if no result or incorrect)
    tone = "bg-emerald-600 text-white border-emerald-600";
  } else {
    // Grey when not submitted
    tone = "bg-slate-100 text-slate-600 border-slate-200";
  }

  return (
    <span
      className={[
        "inline-flex items-center justify-center h-5 min-w-[18px] px-1.5",
        "rounded-full border text-[11px] font-semibold mb-0.5",
        "align-middle",
        tone,
      ].join(" ")}
      title={unicorn ? "Unicorn!" : undefined}
    >
      {letter}
      {unicorn ? <span className="ml-1">🦄</span> : null}
    </span>
  );
}

/* =========================
   ChatTab (external to avoid remount on typing)
   ========================= */
type ChatTabProps = {
  chat: ChatMsg[];
  userId?: string;
  nameById: Map<string, string>;
  isMember: boolean;
  newMsg: string;
  setNewMsg: (v: string) => void;
  onSend: () => void;
  leagueCode?: string;
  memberCount?: number;
  maxMembers?: number;
};

function ChatTab({ chat, userId, nameById, isMember, newMsg, setNewMsg, onSend, leagueCode: _leagueCode, memberCount: _memberCount, maxMembers: _maxMembers, notificationStatus }: ChatTabProps & { notificationStatus?: { message: string; type: 'success' | 'warning' | 'error' | null } | null }) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputAreaRef = useRef<HTMLDivElement | null>(null);
  const [inputBottom, setInputBottom] = useState<number>(0);

  // Simple scroll to bottom
  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };

  // Helper to scroll with multiple attempts for reliability
  const scrollToBottomWithRetries = useCallback((delays: number[] = [0, 100, 300, 500, 700]) => {
    requestAnimationFrame(() => {
      delays.forEach((delay) => {
        setTimeout(() => scrollToBottom(), delay);
      });
    });
  }, []);

  // Scroll when messages change
  useEffect(() => {
    if (chat.length > 0) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [chat.length]);

  // Reset textarea height when message is cleared (after send)
  useEffect(() => {
    if (!newMsg && inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = '42px';
    }
  }, [newMsg]);

  // Reliable keyboard detection - fix input above keyboard
  useEffect(() => {
    const visualViewport = (window as any).visualViewport;
    if (!visualViewport) return;

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastKeyboardHeight = 0;

    const updateLayout = () => {
      // Clear any pending updates
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
        resizeTimeout = null;
      }

      // Debounce updates to avoid flickering
      resizeTimeout = setTimeout(() => {
        const windowHeight = window.innerHeight;
        const viewportHeight = visualViewport.height;
        const viewportBottom = visualViewport.offsetTop + viewportHeight;
        const keyboardHeight = windowHeight - viewportBottom;
        
        // Only update if keyboard height changed significantly (avoid jitter)
        if (Math.abs(keyboardHeight - lastKeyboardHeight) < 10 && keyboardHeight > 0) {
          return;
        }
        lastKeyboardHeight = keyboardHeight;
        
        if (keyboardHeight > 100) {
          // Keyboard is visible - position input above it
          setInputBottom(keyboardHeight);
          
          // Calculate input area height dynamically - wait a bit for it to render
          setTimeout(() => {
            const inputAreaHeight = inputAreaRef.current?.offsetHeight || 100;
            // Use keyboard height + input area height to ensure ALL messages are visible
            // The padding needs to account for the full space from bottom of viewport to top of input
            const paddingNeeded = keyboardHeight + inputAreaHeight + 20; // Full keyboard space + input + buffer
            
            // Add padding to messages so bottom messages are visible above input
            if (listRef.current) {
              listRef.current.style.paddingBottom = `${paddingNeeded}px`;
              // Force reflow to ensure padding is applied
              void listRef.current.offsetHeight;
              
              // Scroll after padding is definitely applied - multiple attempts
              scrollToBottomWithRetries([0, 100, 300, 500, 700]);
            }
          }, 100);
        } else {
          // No keyboard - remove padding and ensure we scroll to show bottom message
          setInputBottom(0);
          if (listRef.current) {
            listRef.current.style.paddingBottom = '';
            // Force reflow after removing padding
            void listRef.current.offsetHeight;
            // Scroll to bottom after padding is removed to ensure last message is visible
            scrollToBottomWithRetries([0, 50, 150, 300]);
          }
        }
      }, 50); // Small debounce delay
    };

    visualViewport.addEventListener('resize', updateLayout);
    visualViewport.addEventListener('scroll', updateLayout);
    
    // Also listen to input focus for immediate response
    const handleFocus = () => {
      setTimeout(updateLayout, 100);
      setTimeout(updateLayout, 300);
    };
    
    // Set up focus listener after a delay to ensure input is rendered
    const focusTimeout = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.addEventListener('focus', handleFocus);
      }
    }, 100);
    
    updateLayout();

    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      clearTimeout(focusTimeout);
      visualViewport.removeEventListener('resize', updateLayout);
      visualViewport.removeEventListener('scroll', updateLayout);
      if (inputRef.current) {
        inputRef.current.removeEventListener('focus', handleFocus);
      }
    };
  }, []);

  // Scroll on input focus and trigger layout update
  const handleInputFocus = () => {
    // Trigger layout update to detect keyboard
    const visualViewport = (window as any).visualViewport;
    if (visualViewport) {
      setTimeout(() => {
        const windowHeight = window.innerHeight;
        const viewportHeight = visualViewport.height;
        const viewportBottom = visualViewport.offsetTop + viewportHeight;
        const keyboardHeight = windowHeight - viewportBottom;
        
        if (keyboardHeight > 100) {
          setInputBottom(keyboardHeight);
          setTimeout(() => {
            const inputAreaHeight = inputAreaRef.current?.offsetHeight || 100;
            // Use keyboard height + input area for full visibility
            const paddingNeeded = keyboardHeight + inputAreaHeight + 20;
            if (listRef.current) {
              listRef.current.style.paddingBottom = `${paddingNeeded}px`;
              void listRef.current.offsetHeight;
              scrollToBottomWithRetries([0, 200, 400, 600, 800]);
            }
          }, 100);
        }
      }, 100);
    }
    
    // Multiple scroll attempts for reliability
    scrollToBottomWithRetries([200, 400, 600]);
  };

  // Dismiss keyboard when tapping messages area (WhatsApp-like behavior)
  const handleMessagesClick = (e: React.MouseEvent) => {
    // Don't blur if clicking on interactive elements (links, buttons, etc.)
    const target = e.target as HTMLElement;
    const isInteractive = target.tagName === 'A' || target.tagName === 'BUTTON' || target.closest('a, button');
    
    // Blur input to dismiss keyboard when tapping messages area
    if (!isInteractive && inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.blur();
    }
  };

  return (
    <div className="flex flex-col chat-container" style={{ height: '100%' }}>
      {/* Messages list */}
      <div 
        ref={listRef} 
        className="flex-1 overflow-y-auto px-3 pt-3 pb-4 min-h-0 messages-container" 
        onClick={handleMessagesClick}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          marginBottom: inputBottom > 0 ? '0' : 'auto',
          cursor: 'pointer',
        }}
      >
        {chat.map((m) => {
          const mine = m.user_id === userId;
          const name = nameById.get(m.user_id) ?? "Unknown";
          const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={m.id} className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-[#1C8376] text-white" : "bg-slate-100 text-slate-900"}`}>
                {!mine && <div className="font-semibold text-xs text-slate-600 mb-1">{name}</div>}
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                <div className={`mt-1 text-[10px] ${mine ? "text-emerald-100" : "text-slate-500"}`}>{time}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} style={{ height: '1px', width: '100%' }} />
      </div>

      {/* Input area - fixed above keyboard when visible */}
      <div 
        ref={inputAreaRef}
        className="flex-shrink-0 bg-white border-t border-slate-200 px-4 py-3" 
        style={{
          paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))`,
          position: inputBottom > 0 ? 'fixed' : 'relative',
          bottom: inputBottom > 0 ? `${inputBottom}px` : 'auto',
          left: inputBottom > 0 ? '0' : 'auto',
          right: inputBottom > 0 ? '0' : 'auto',
          width: inputBottom > 0 ? '100%' : 'auto',
          zIndex: inputBottom > 0 ? 1000 : 'auto',
        }}
      >
        {isMember ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
            className="flex items-center gap-2"
          >
            <textarea
              ref={inputRef}
              value={newMsg}
              onChange={(e) => {
                setNewMsg(e.target.value);
                // Auto-resize textarea
                if (inputRef.current) {
                  inputRef.current.style.height = 'auto';
                  inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
                }
              }}
              onFocus={handleInputFocus}
              onKeyDown={(e) => {
                // Submit on Enter (but allow Shift+Enter for new line)
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (newMsg.trim()) {
                    onSend();
                  }
                }
              }}
              placeholder="Start typing..."
              maxLength={2000}
              rows={1}
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C8376] focus:border-transparent resize-none overflow-hidden"
              style={{
                minHeight: '42px',
                maxHeight: '120px',
                lineHeight: '1.5',
              }}
            />
            <button
              type="submit"
              className="flex-shrink-0 w-10 h-10 rounded-full bg-[#1C8376] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!newMsg.trim()}
              style={{
                backgroundColor: !newMsg.trim() ? '#94a3b8' : '#1C8376',
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 p-3 text-sm">
            Join this league to chat with other members.
          </div>
        )}
        {/* Notification status banner */}
        {notificationStatus && (
          <div className={`w-full rounded px-2 py-1 text-xs mt-2 ${
            notificationStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
            notificationStatus.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
            'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {notificationStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   Page
   ========================= */
export default function LeaguePage() {
  const { code = "" } = useParams();
  const { user } = useAuth();
  const [oldSchoolMode] = useState(() => {
    const saved = localStorage.getItem('oldSchoolMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('oldSchoolMode', JSON.stringify(oldSchoolMode));
  }, [oldSchoolMode]);

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

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // tabs: Chat / Mini League Table / GW Picks / GW Results
  // Default to "gwr" (GW Results) if gameweek is live or finished within 12 hours
  const [tab, setTab] = useState<"chat" | "mlt" | "gw" | "gwr">("chat");
  const [initialTabSet, setInitialTabSet] = useState(false);
  // Use ref to track manual tab selection immediately (synchronously) to prevent race conditions
  const manualTabSelectedRef = useRef(false);

  const [showForm, setShowForm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [currentGw, setCurrentGw] = useState<number | null>(null);
  const [latestResultsGw, setLatestResultsGw] = useState<number | null>(null);
  const [selectedGw, setSelectedGw] = useState<number | null>(null);
  const [availableGws, setAvailableGws] = useState<number[]>([]);
  // Live scores for test API fixtures
  const [liveScores, setLiveScores] = useState<Record<number, { homeScore: number; awayScore: number; status: string; minute?: number | null }>>({});
  // Ref to track current liveScores without causing re-renders
  const liveScoresRef = useRef<Record<number, { homeScore: number; awayScore: number; status: string; minute?: number | null }>>({});
  // Track previous positions for animation (using ref to persist across renders)
  const prevPositionsRef = useRef<Map<string, number>>(new Map());
  const [positionChangeKeys, setPositionChangeKeys] = useState<Set<string>>(new Set());
  const [showGwDropdown, setShowGwDropdown] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [avatarUploadSuccess, setAvatarUploadSuccess] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [showJoinConfirm, setShowJoinConfirm] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showEndLeagueConfirm, setShowEndLeagueConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [ending, setEnding] = useState(false);
  const [firstMember, setFirstMember] = useState<Member | null>(null);

  /* ----- Chat state ----- */
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [notificationStatus, setNotificationStatus] = useState<{ message: string; type: 'success' | 'warning' | 'error' | null } | null>(null);
  const isMember = useMemo(
    () => !!user?.id && members.some((m) => m.id === user.id),
    [user?.id, members]
  );
  const memberNameById = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((x) => m.set(x.id, x.name));
    return m;
  }, [members]);

  // Store GW deadlines for synchronous access
  const [gwDeadlines, setGwDeadlines] = useState<Map<number, Date>>(new Map());
  
  // Calculate GW deadlines once when component loads
  useEffect(() => {
    (async () => {
      const deadlines = new Map<number, Date>();
      
      // Get all GWs that have fixtures (not just those with results)
      const { data: allGwData } = await supabase
        .from("fixtures")
        .select("gw, kickoff_time")
        .order("gw", { ascending: true });
      
      // Also get test fixtures for GW 1
      const { data: testGwData } = await supabase
        .from("test_api_fixtures")
        .select("test_gw, kickoff_time")
        .eq("test_gw", 1)
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
        .from("meta")
        .select("current_gw")
        .eq("id", 1)
        .maybeSingle();
      if (!alive) return;
      setCurrentGw((meta as any)?.current_gw ?? null);

      const { data: rs } = await supabase
        .from("gw_results")
        .select("gw")
        .order("gw", { ascending: false })
        .limit(1);
      if (!alive) return;
      setLatestResultsGw((rs && rs.length ? (rs[0] as any).gw : null));

      const { data: allGws } = await supabase
        .from("gw_results")
        .select("gw")
        .order("gw", { ascending: false });
      if (!alive) return;
      const gwList = allGws ? [...new Set(allGws.map((r: any) => r.gw))].sort((a, b) => b - a) : [];
      setAvailableGws(gwList);
      if (gwList.length > 0) setSelectedGw(gwList[0]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // data for GW tabs
  const memberIds = useMemo(() => members.map((m) => m.id), [members]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [subs, setSubs] = useState<SubmissionRow[]>([]);
  const [results, setResults] = useState<ResultRowRaw[]>([]);

  // MLT rows
  const [mltRows, setMltRows] = useState<MltRow[]>([]);
  const [mltLoading, setMltLoading] = useState(false);

  /* ---------- load league + members ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);

      const { data: lg } = await supabase
        .from("leagues")
        .select("id,name,code,created_at")
        .eq("code", code)
        .maybeSingle();

      if (!alive) return;
      if (!lg) {
        setLeague(null);
        setMembers([]);
        setLoading(false);
        return;
      }
      setLeague(lg as League);

      const { data: mm } = await supabase
        .from("league_members")
        .select("users(id,name),created_at")
        .eq("league_id", (lg as League).id)
        .order("created_at", { ascending: true });

      const mem: Member[] =
        (mm as any[])?.map((r) => ({
          id: r.users.id,
          name: r.users.name ?? "(no name)",
        })) ?? [];

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

  // Helper function to load and merge messages (reusable)
  const loadAndMergeMessages = useCallback(async (leagueId: string, isInitialLoad = false) => {
    const { data, error } = await supabase
      .from("league_messages")
      .select("id, league_id, user_id, content, created_at")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: false })
      .limit(500);
    
    if (!error && data) {
      const fetchedMessages = (data as ChatMsg[]) ?? [];
      const sortedMessages = fetchedMessages.reverse();
      if (isInitialLoad) {
        console.log('[Chat] Loaded messages:', sortedMessages.length, 'from database (most recent)');
      }
      
      setChat((prev) => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMessages = sortedMessages.filter(m => !existingIds.has(m.id));
        
        if (prev.length === 0) {
          if (isInitialLoad) {
            console.log('[Chat] Initial load, setting', sortedMessages.length, 'messages');
          }
          return sortedMessages;
        }
        
        const combined = [...prev, ...newMessages];
        const sorted = combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const limited = sorted.length > 500 ? sorted.slice(-500) : sorted;
        
        if (isInitialLoad) {
          console.log('[Chat] Merged messages. Previous:', prev.length, 'New from DB:', newMessages.length, 'Total:', sorted.length, 'After limit:', limited.length);
        }
        return limited;
      });
    } else if (error) {
      console.error('[Chat] Error loading messages:', error);
    }
  }, []);

  /* ---------- realtime chat: load + subscribe ---------- */
  useEffect(() => {
    if (!league?.id) return;
    let alive = true;

    const loadMessages = async () => {
      if (!alive) return;
      await loadAndMergeMessages(league.id, true);
    };

    // Initial load
    loadMessages();

    const channel = supabase
      .channel(`league-messages:${league.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "league_messages",
          filter: `league_id=eq.${league.id}`,
        },
        (payload) => {
          const msg = payload.new as ChatMsg;
          console.log('[Chat] Realtime message received:', msg.id, msg.content.substring(0, 50));
          setChat((prev) => {
            if (prev.some((m) => m.id === msg.id)) {
              console.log('[Chat] Message already exists, skipping');
              return prev;
            }
            const updated = [...prev, msg];
            console.log('[Chat] Added realtime message. Total messages:', updated.length);
            return updated;
          });
        }
      )
      .subscribe();

    // Refetch messages when app comes to foreground (e.g., user taps push notification)
    // This ensures messages sent while app was in background are loaded
    const handleVisibilityChange = () => {
      if (!document.hidden && league?.id && alive) {
        console.log('[Chat] App became visible, refetching messages...');
        loadMessages();
      }
    };

    // Also refetch when window gains focus (similar to Home.tsx)
    const handleFocus = () => {
      if (league?.id && alive) {
        console.log('[Chat] Window gained focus, refetching messages...');
        loadMessages();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      alive = false;
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [league?.id]);

  /* ---------- mark-as-read when viewing Chat + refetch messages when tab becomes active ---------- */
  useEffect(() => {
    if (tab !== "chat" || !league?.id || !user?.id) return;
    
    // Refetch messages when chat tab becomes active (in case user was on another tab when notification arrived)
    loadAndMergeMessages(league.id, false);
    
    const mark = async () => {
      await supabase
        .from("league_message_reads")
        .upsert(
          { league_id: league.id, user_id: user.id, last_read_at: new Date().toISOString() },
          { onConflict: "league_id,user_id" }
        );
    };
    mark();
  }, [tab, league?.id, user?.id]);

  /* ---------- Avatar Upload ---------- */
  const handleAvatarUpload = async (file: File) => {
    if (!league || !user?.id || !isAdmin) {
      setAvatarUploadError("Only admins can upload avatars");
      return;
    }

    setUploadingAvatar(true);
    setAvatarUploadError(null);
    setAvatarUploadSuccess(false);

    try {
      // Verify user is authenticated with Supabase
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('[Avatar Upload] No Supabase session:', sessionError);
        throw new Error('You must be logged in to upload avatars. Please refresh the page and try again.');
      }
      
      // Log project info for debugging
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      console.log('[Avatar Upload] Supabase project:', {
        url: supabaseUrl,
        projectRef: projectRef,
        userId: session.user.id,
      });
      // Validate file type
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload PNG, JPG, or WebP images.');
      }

      // Validate file size (max 2MB before compression)
      const maxSizeBeforeCompression = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSizeBeforeCompression) {
        throw new Error('File size too large. Please upload an image smaller than 2MB.');
      }

      // Compress and resize image for optimal web performance
      // Target: 50-75KB for good quality while maintaining fast load times
      // Avatars are small (48-56px displayed), so we can be more aggressive with compression
      let compressedFile: File = file;
      const targetSizeKB = 60; // 60KB target - good balance between quality and performance
      const maxAllowedSize = 80 * 1024; // 80KB max (33% buffer for complex images)
      
      console.log(`[Avatar Upload] Starting compression. Original size: ${(file.size / 1024).toFixed(1)}KB`);
      
      // Check if browser supports WebP (better compression than JPEG)
      const supportsWebP = document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0;
      const preferredFormat = supportsWebP ? 'image/webp' : 'image/jpeg';
      
      // Compression configs: Start with good quality, get more aggressive if needed
      const compressionConfigs = [
        { maxWidthOrHeight: 256, initialQuality: 0.85, format: preferredFormat }, // High quality first
        { maxWidthOrHeight: 256, initialQuality: 0.75, format: preferredFormat },
        { maxWidthOrHeight: 256, initialQuality: 0.65, format: 'image/jpeg' }, // Fallback to JPEG
        { maxWidthOrHeight: 200, initialQuality: 0.6, format: 'image/jpeg' },
        { maxWidthOrHeight: 200, initialQuality: 0.5, format: 'image/jpeg' },
      ];
      
      let compressionSuccess = false;
      
      for (let i = 0; i < compressionConfigs.length; i++) {
        const config = compressionConfigs[i];
        try {
          const options: any = {
            maxSizeMB: targetSizeKB / 1024, // 60KB target
            maxWidthOrHeight: config.maxWidthOrHeight,
            useWebWorker: true,
            fileType: config.format,
            initialQuality: config.initialQuality,
          };

          compressedFile = await imageCompression(file, options);
          const actualSizeKB = compressedFile.size / 1024;
          
          console.log(`[Avatar Upload] Attempt ${i + 1}: ${actualSizeKB.toFixed(1)}KB (target: ${targetSizeKB}KB, format: ${config.format})`);
          
          // If we got under the max allowed size, we're done
          if (compressedFile.size <= maxAllowedSize) {
            compressionSuccess = true;
            console.log(`[Avatar Upload] Compression successful: ${actualSizeKB.toFixed(1)}KB`);
            break;
          }
        } catch (compressionError: any) {
          console.warn(`[Avatar Upload] Compression attempt ${i + 1} failed:`, compressionError.message);
          // Continue to next attempt
        }
      }

      // Final validation - be more lenient for complex images
      if (!compressionSuccess || compressedFile.size > maxAllowedSize) {
        const actualSizeKB = (compressedFile.size / 1024).toFixed(1);
        // If it's close (within 100KB), allow it but warn
        if (compressedFile.size <= 100 * 1024) {
          console.warn(`[Avatar Upload] Image slightly over target (${actualSizeKB}KB) but acceptable`);
          compressionSuccess = true;
        } else {
          throw new Error(
            `Image is too large (${actualSizeKB}KB). Please use a smaller or simpler image. ` +
            `Recommended: images under 2MB before upload, with less detail or fewer colors.`
          );
        }
      }

      // Generate unique filename with correct extension based on compressed format
      let fileExt = 'jpg';
      if (compressedFile.type.includes('webp')) {
        fileExt = 'webp';
      } else if (compressedFile.type.includes('png')) {
        fileExt = 'png';
      }
      const fileName = `${league.id}.${fileExt}`;

      // Try to verify bucket exists (may fail due to permissions, but that's OK)
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      if (listError) {
        console.warn('[Avatar Upload] Could not list buckets (this is OK if you lack list permissions):', listError);
      } else {
        const bucketExists = buckets?.some(b => {
          const idMatch = b.id === 'league-avatars';
          const nameMatch = b.name === 'league-avatars';
          if (idMatch || nameMatch) {
            console.log('[Avatar Upload] Found bucket:', { id: b.id, name: b.name });
          }
          return idMatch || nameMatch;
        });
        console.log('[Avatar Upload] Available buckets:', buckets?.map(b => ({ id: b.id, name: b.name })));
        if (buckets && buckets.length > 0 && !bucketExists) {
          console.warn(`[Avatar Upload] Bucket 'league-avatars' not in list. Available: ${buckets.map(b => b.id || b.name).join(', ')}`);
        }
      }
      
      console.log('[Avatar Upload] Attempting upload to bucket: league-avatars');

      // Upload to Supabase Storage (attempt even if listing failed)
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('league-avatars')
        .upload(fileName, compressedFile, {
          upsert: true, // Replace existing file if it exists
          contentType: compressedFile.type,
        });

      if (uploadError) {
        console.error('[Avatar Upload] Upload error details:', {
          message: uploadError.message,
          error: uploadError,
        });
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
      
      console.log('[Avatar Upload] Upload successful:', uploadData);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('league-avatars')
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL for uploaded avatar');
      }

      // Update league avatar in database
      const { error: updateError } = await supabase
        .from('leagues')
        .update({ avatar: urlData.publicUrl })
        .eq('id', league.id);

      if (updateError) {
        throw new Error(`Failed to update league: ${updateError.message}`);
      }

      // Refresh league data
      const { data: updatedLeague } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', league.id)
        .single();

      if (updatedLeague) {
        setLeague(updatedLeague as League);
      }

      setAvatarUploadSuccess(true);
      setTimeout(() => {
        setShowAvatarUpload(false);
        setAvatarUploadSuccess(false);
      }, 2000);
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      setAvatarUploadError(error.message || 'Failed to upload avatar. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!league || !user?.id || !isAdmin) return;

    setUploadingAvatar(true);
    setAvatarUploadError(null);

    try {
      // Remove avatar from database (set to null)
      const { error: updateError } = await supabase
        .from('leagues')
        .update({ avatar: null })
        .eq('id', league.id);

      if (updateError) {
        throw new Error(`Failed to remove avatar: ${updateError.message}`);
      }

      // Refresh league data
      const { data: updatedLeague } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', league.id)
        .single();

      if (updatedLeague) {
        setLeague(updatedLeague as League);
      }

      setShowAvatarUpload(false);
    } catch (error: any) {
      console.error('Remove avatar error:', error);
      setAvatarUploadError(error.message || 'Failed to remove avatar. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  /* ---------- leave/join/admin ---------- */
  async function leaveLeague() {
    if (!league || !user?.id) return;
    setLeaving(true);
    try {
      const { error } = await supabase
        .from("league_members")
        .delete()
        .eq("league_id", league.id)
        .eq("user_id", user.id);
      if (error) throw error;
      window.location.href = "/leagues";
    } catch (error) {
      console.error("Error leaving league:", error);
      alert("Failed to leave league. Please try again.");
    } finally {
      setLeaving(false);
      setShowLeaveConfirm(false);
    }
  }

  async function joinLeague() {
    if (!league || !user?.id) return;
    setJoining(true);
    try {
      if (members.length >= MAX_MEMBERS) {
        alert("League is full (max 8 members).");
        setShowJoinConfirm(false);
        return;
      }
      const { error } = await supabase
        .from("league_members")
        .insert({ league_id: league.id, user_id: user.id });
      if (error) throw error;
      window.location.reload();
    } catch (e: any) {
      alert(e?.message ?? "Failed to join league.");
    } finally {
      setJoining(false);
    }
  }

  const isAdmin = useMemo(() => {
    return league?.created_by === user?.id || (firstMember && firstMember.id === user?.id && !league?.created_by);
  }, [league?.created_by, user?.id, firstMember]);

  const adminName = useMemo(() => {
    return league?.created_by
      ? members.find((m) => m.id === league.created_by)?.name || "Unknown"
      : firstMember
      ? firstMember.name
      : "Unknown";
  }, [league?.created_by, members, firstMember]);

  async function removeMember() {
    if (!memberToRemove || !league || !user?.id) return;
    setRemoving(true);
    try {
      const { error } = await supabase
        .from("league_members")
        .delete()
        .eq("league_id", league.id)
        .eq("user_id", memberToRemove.id);
      if (error) throw error;
      window.location.reload();
    } catch (e: any) {
      alert(e?.message ?? "Failed to remove member.");
    } finally {
      setRemoving(false);
      setShowRemoveConfirm(false);
      setMemberToRemove(null);
    }
  }

  async function endLeague() {
    if (!league || !user?.id) return;
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

      window.location.href = "/leagues";
    } catch (e: any) {
      alert(e?.message ?? "Failed to end league.");
    } finally {
      setEnding(false);
      setShowEndLeagueConfirm(false);
    }
  }

  function shareLeague() {
    if (!league) return;
    const shareText = `Join my mini league "${league.name}" on TotL!`;
    const shareUrl = `${window.location.origin}/league/${league.code}`;
    if (navigator.share) {
      navigator
        .share({
          title: `Join ${league.name}`,
          text: shareText,
          url: shareUrl,
        })
        .catch(console.error);
    } else {
      navigator.clipboard
        .writeText(`${shareText}\n\n${shareUrl}`)
        .then(() => {
          alert("League link copied to clipboard!");
        })
        .catch(() => {
          prompt("Share this league code:", league.code);
        });
    }
  }

  /* ---------- send chat ---------- */
  const sendChat = useCallback(async () => {
    if (!league || !user?.id) return;
    const text = newMsg.trim();
    if (!text) return;
    setNewMsg("");
    const { data: inserted, error } = await supabase
      .from("league_messages")
      .insert({
        league_id: league.id,
        user_id: user.id,
        content: text,
      })
      .select("id, league_id, user_id, content, created_at")
      .single();
    if (error) {
      console.error(error);
      alert("Failed to send message.");
    } else if (inserted) {
      // Optimistic add so the message appears immediately; realtime will also append
      setChat((prev) => [...prev, inserted as ChatMsg]);
    }
    // Request push notifications to league members (exclude sender)
    // Skip in local development (Netlify Functions not available)
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalDev) {
      setTimeout(async () => {
        try {
          const senderName = user.user_metadata?.display_name || user.email || 'User';
          const response = await fetch('/.netlify/functions/notifyLeagueMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leagueId: league.id, senderId: user.id, senderName, content: text })
          });
          
          const result = await response.json().catch(() => ({}));
          
          // Set notification status based on response
          if (result.ok === true) {
            if (result.sent && result.sent > 0) {
              setNotificationStatus({
                message: `✓ Message sent to ${result.sent} device${result.sent === 1 ? '' : 's'}`,
                type: 'success'
              });
            } else if (result.message === 'No subscribed devices') {
              setNotificationStatus({
                message: `⚠️ No subscribed devices (${result.eligibleRecipients || 0} eligible recipient${result.eligibleRecipients === 1 ? '' : 's'})`,
                type: 'warning'
              });
            } else if (result.message === 'No devices') {
              setNotificationStatus({
                message: `⚠️ No devices registered (${result.eligibleRecipients || 0} eligible recipient${result.eligibleRecipients === 1 ? '' : 's'})`,
                type: 'warning'
              });
            } else if (result.message === 'No eligible recipients') {
              setNotificationStatus({
                message: '✓ All members are currently active',
                type: 'success'
              });
            } else {
              setNotificationStatus({
                message: `✓ ${result.message || 'Notification sent'}`,
                type: 'success'
              });
            }
          } else if (result.ok === false || result.error) {
            setNotificationStatus({
              message: `✗ Failed to send notification: ${result.error || 'Unknown error'}`,
              type: 'error'
            });
          } else if (!response.ok) {
            setNotificationStatus({
              message: `✗ Notification error (HTTP ${response.status})`,
              type: 'error'
            });
          }
          
          // Clear status after 5 seconds
          setTimeout(() => setNotificationStatus(null), 5000);
        } catch (err) {
          console.error('[Chat] Notification exception:', err);
          setNotificationStatus({
            message: '✗ Failed to send notification',
            type: 'error'
          });
          setTimeout(() => setNotificationStatus(null), 5000);
        }
      }, 100);
    }
  }, [league, user, newMsg, setNewMsg, setChat, setNotificationStatus]);

  /* ---------- load fixtures + picks + submissions + results for selected GW ---------- */
  useEffect(() => {
    let alive = true;

    (async () => {
      // Special handling for API Test league - use test_api_fixtures for GW 1
      // CRITICAL: Only use test API tables if league name is EXACTLY 'API Test'
      // All other leagues MUST use main database tables (fixtures, picks, gw_submissions)
      const isApiTestLeague = league?.name === 'API Test';
      // For API Test league, only allow "gw" tab if all members have submitted
      // Check if all submitted for GW 1 (we'll check this properly after loading submissions)
      const useTestFixtures = isApiTestLeague && (tab === "gw" || tab === "gwr");
      console.log('[League] Data fetch:', { 
        isApiTestLeague, 
        tab, 
        useTestFixtures, 
        leagueName: league?.name,
        willUseTestTables: useTestFixtures,
        willUseMainTables: !useTestFixtures
      });
      
      // For API Test league in predictions/results tabs, always use GW 1
      let gwForData = tab === "gwr" ? selectedGw : tab === "gw" ? currentGw : currentGw;
      if (isApiTestLeague && (tab === "gw" || tab === "gwr")) {
        gwForData = 1; // Force GW 1 for API Test league
      }
      
      // For predictions tab with regular leagues, try to detect the GW from submissions
      // This ensures we show picks even if currentGw hasn't been updated yet or if members submitted for a different GW
      if (tab === "gw" && !isApiTestLeague && memberIds.length > 0) {
        // Get the most recent GW that members have submitted for
        const { data: submissionsCheck } = await supabase
          .from("gw_submissions")
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
                .from("fixtures")
                .select("gw")
                .eq("gw", submittedGw)
                .limit(1);
              
              if (fixtureCheck && fixtureCheck.length > 0) {
                console.log('[League] Found fixtures for GW', submittedGw, 'from submissions - using this GW (currentGw was', gwForData, ')');
                gwForData = submittedGw;
                break; // Use the most recent GW with fixtures
              }
            }
          }
        }
        
        // If we still don't have a valid gwForData, use currentGw if it exists
        if (!gwForData && currentGw) {
          gwForData = currentGw;
          console.log('[League] Using currentGw as fallback:', currentGw);
        }
      }
      
      console.log('[League] gwForData:', gwForData, 'memberIds:', memberIds);
      
      if (!gwForData && !useTestFixtures) {
        setFixtures([]);
        setPicks([]);
        setSubs([]);
        setResults([]);
        return;
      }
      
      let fx;
      if (useTestFixtures) {
        // Fetch from test_api_fixtures for API Test league GW 1
        const { data: testFx } = await supabase
          .from("test_api_fixtures")
          .select(
            "id,test_gw,fixture_index,home_team,away_team,home_code,away_code,home_name,away_name,kickoff_time,api_match_id"
          )
          .eq("test_gw", 1)
          .order("fixture_index", { ascending: true });
        // Map test_gw to gw for consistency
        fx = testFx?.map(f => ({ ...f, gw: f.test_gw })) || null;
      } else {
        // Regular fixtures - ALWAYS use main database table for non-API Test leagues
        // CRITICAL: Never use test_api_fixtures for regular leagues
        // Regular fixtures - ALWAYS use main database table for non-API Test leagues
        // CRITICAL: Never use test_api_fixtures for regular leagues
        // NOTE: fixtures table does NOT have api_match_id column (only test_api_fixtures has it)
        console.log('[League] Fetching from MAIN database table (fixtures) for regular league, GW:', gwForData);
        const { data: regularFx } = await supabase
          .from("fixtures")
          .select(
            "id,gw,fixture_index,home_team,away_team,home_code,away_code,home_name,away_name,kickoff_time"
          )
          .eq("gw", gwForData)
          .order("fixture_index", { ascending: true });
        
        // Map to include api_match_id as null (for consistency with API Test fixtures)
        fx = regularFx?.map((f: any) => ({
          ...f,
          api_match_id: null
        })) || null;
        console.log('[League] Fetched fixtures from main database:', regularFx?.length || 0, 'fixtures');
      }

      if (!alive) return;
      setFixtures((fx as Fixture[]) ?? []);

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
        // Fetch from test_api_picks for API Test league
        const { data: testPicks } = await supabase
          .from("test_api_picks")
          .select("user_id,matchday,fixture_index,pick")
          .eq("matchday", 1)
          .in("user_id", memberIds);
        // Map matchday to gw for consistency
        pk = testPicks?.map(p => ({ ...p, gw: p.matchday })) || null;
        
        // Fetch from test_api_submissions for API Test league
        // IMPORTANT: Only get submissions that have a non-null submitted_at (actually submitted)
        const { data: testSubs, error: testSubsError } = await supabase
          .from("test_api_submissions")
          .select("user_id,matchday,submitted_at")
          .eq("matchday", 1)
          .not("submitted_at", "is", null)  // CRITICAL: Only count submissions with non-null submitted_at
          .in("user_id", memberIds);
        if (testSubsError) {
          console.error('Error fetching test_api_submissions:', testSubsError);
        }
        
        // CRITICAL: Only count submissions if the user has picks for the CURRENT fixtures
        // This filters out old submissions from previous test runs (like Brazil picks)
        // Get the current fixtures with their teams to verify picks match actual teams, not just indices
        const { data: currentTestFixtures } = await supabase
          .from("test_api_fixtures")
          .select("fixture_index,home_team,away_team,home_code,away_code,kickoff_time")
          .eq("test_gw", 1)
          .order("fixture_index", { ascending: true });
        
        const currentFixtureIndicesSet = new Set((currentTestFixtures || []).map(f => f.fixture_index));
        console.log('[League] Current fixture indices from test_api_fixtures:', Array.from(currentFixtureIndicesSet));
        console.log('[League] Current fixtures:', currentTestFixtures?.map(f => ({ index: f.fixture_index, home: f.home_team, away: f.away_team })));
        
        // Filter submissions: only count if user has picks for ALL current fixtures AND those picks match the actual teams
        // This ensures we don't count old submissions (like Brazil picks) even if they have matching fixture indices
        const validSubmissions: typeof testSubs = [];
        if (testSubs && pk && currentTestFixtures) {
          const requiredFixtureCount = currentFixtureIndicesSet.size;
          console.log('[League] Required fixture count for valid submission:', requiredFixtureCount);
          
          // Get the picks that were fetched - we need to match them against current fixtures
          // Note: We can't directly match teams from picks table, but we can verify:
          // 1. User has picks for ALL current fixture indices
          // 2. The submission timestamp is recent (after current fixtures were created)
          // For now, we'll require ALL picks match current fixture indices
          
          // Get the earliest kickoff time from current fixtures to determine cutoff date
          // Submissions before this date are from old test runs
          const currentFixtureKickoffs = (currentTestFixtures || [])
            .map(f => f.kickoff_time ? new Date(f.kickoff_time) : null)
            .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
          const earliestKickoff = currentFixtureKickoffs.length > 0 
            ? new Date(Math.min(...currentFixtureKickoffs.map(d => d.getTime())))
            : null;
          
          // Use a cutoff date: submissions must be after Nov 18, 2025 (when new fixtures were likely loaded)
          // We use Nov 18 as the cutoff because that's when the new Premier League fixtures were loaded
          // Old submissions from Nov 15 (Brazil picks) will be filtered out
          // Recent submissions from Nov 19+ (Carl, ThomasJamesBird) will be counted
          const cutoffDate = new Date('2025-11-18T00:00:00Z'); // Nov 18, 2025 - when new fixtures were loaded
          console.log('[League] Submission cutoff date (submissions before this are old):', cutoffDate.toISOString());
          console.log('[League] Earliest kickoff:', earliestKickoff?.toISOString());
          
          testSubs.forEach((sub) => {
            // Check if this user has picks for ALL current fixtures
            const userPicks = (pk || []).filter((p: PickRow) => p.user_id === sub.user_id && (p as any).matchday === 1);
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
              console.log('[League] ✅ VALID submission (has picks for ALL current fixtures AND recent submission):', {
                user_id: sub.user_id,
                submitted_at: sub.submitted_at,
                submissionDate: submissionDate?.toISOString(),
                cutoffDate: cutoffDate.toISOString(),
                picksCount: userPicks.length,
                picksForCurrentFixtures: picksForCurrentFixtures.length,
                uniqueIndices: uniqueFixtureIndices.size,
                requiredCount: requiredFixtureCount
              });
            } else {
              const reasons = [];
              if (!hasAllRequiredPicks) reasons.push('missing picks');
              if (!hasExactMatch) reasons.push('duplicate/extra picks');
              if (!isRecentSubmission) reasons.push(`old submission (${submissionDate?.toISOString()} < ${cutoffDate.toISOString()})`);
              
              console.log('[League] ❌ INVALID submission:', {
                user_id: sub.user_id,
                submitted_at: sub.submitted_at,
                submissionDate: submissionDate?.toISOString(),
                cutoffDate: cutoffDate.toISOString(),
                picksCount: userPicks.length,
                picksForCurrentFixtures: picksForCurrentFixtures.length,
                uniqueIndices: uniqueFixtureIndices.size,
                requiredCount: requiredFixtureCount,
                hasAllRequired: hasAllRequiredPicks,
                hasExactMatch: hasExactMatch,
                isRecent: isRecentSubmission,
                reason: reasons.join(', ')
              });
            }
          });
        }
        
        // Map matchday to gw for consistency
        submissions = validSubmissions.map(s => ({ ...s, gw: s.matchday })) || null;
        console.log('[League] Test API submissions fetched (filtered to only current fixtures):', submissions);
        console.log('[League] Valid submissions count:', validSubmissions.length, 'out of', testSubs?.length || 0, 'total');
      } else {
        // Regular picks and submissions - ALWAYS use main database tables for non-API Test leagues
        // CRITICAL: Never use test_api_picks or test_api_submissions for regular leagues
        console.log('[League] Fetching from MAIN database tables (picks, gw_submissions) for regular league');
        const { data: regularPicks } = await supabase
          .from("picks")
          .select("user_id,gw,fixture_index,pick")
          .eq("gw", gwForData)
          .in("user_id", memberIds);
        pk = regularPicks;
        console.log('[League] Fetched picks from main database:', regularPicks?.length || 0, 'picks');
        
        const { data: regularSubs } = await supabase
          .from("gw_submissions")
          .select("user_id,gw,submitted_at")
          .eq("gw", gwForData)
          .in("user_id", memberIds);
        submissions = regularSubs;
        console.log('[League] Fetched submissions from main database:', regularSubs?.length || 0, 'submissions');
      }
      
      if (!alive) return;
      setPicks((pk as PickRow[]) ?? []);
      setSubs((submissions as SubmissionRow[]) ?? []);

      // For API Test league GW 1, results are stored with gw=1 (same as regular results)
      // We'll need to check if results exist for test fixtures specifically
      const { data: rs } = await supabase
        .from("gw_results")
        .select("gw,fixture_index,result")
        .eq("gw", useTestFixtures ? 1 : (gwForData || 0));
      if (!alive) return;
      setResults((rs as ResultRowRaw[]) ?? []);
    })();

    return () => {
      alive = false;
    };
  }, [tab, currentGw, latestResultsGw, selectedGw, memberIds]);

  // Fetch live scores from Football Data API
  // Fetch live score from Supabase ONLY (updated by scheduled Netlify function)
  // NO API calls from client - all API calls go through the scheduled function
  const fetchLiveScore = async (apiMatchId: number, kickoffTime?: string | null) => {
    try {
      console.log('[League] fetchLiveScore called for matchId:', apiMatchId, 'kickoffTime:', kickoffTime);
      
      // Read from Supabase live_scores table (updated by scheduled Netlify function)
      const { data: liveScore, error } = await supabase
        .from('live_scores')
        .select('*')
        .eq('api_match_id', apiMatchId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No row found - scheduled function hasn't run yet or game hasn't started
          console.log('[League] No live score found in Supabase for match', apiMatchId, '- scheduled function may not have run yet');
          return null;
        }
        console.error('[League] Error fetching live score from Supabase:', error);
        return null;
      }
      
      if (!liveScore) {
        console.warn('[League] No live score data in Supabase');
        return null;
      }
      
      console.log('[League] Live score from Supabase:', liveScore);
      
      const homeScore = liveScore.home_score ?? 0;
      const awayScore = liveScore.away_score ?? 0;
      const status = liveScore.status || 'SCHEDULED';
      let minute = liveScore.minute;
      
      // If minute is not provided, calculate from kickoff time (fallback)
      if ((minute === null || minute === undefined) && (status === 'IN_PLAY' || status === 'PAUSED') && kickoffTime) {
        try {
          const matchStart = new Date(kickoffTime);
          const now = new Date();
          const diffMinutes = Math.floor((now.getTime() - matchStart.getTime()) / (1000 * 60));
          
          if (diffMinutes > 0 && diffMinutes < 120) {
            if (status === 'PAUSED') {
              minute = null;
            } else if (status === 'IN_PLAY') {
              if (diffMinutes <= 50) {
                minute = diffMinutes;
              } else {
                minute = 46 + Math.max(0, diffMinutes - 50);
              }
            }
          }
        } catch (e) {
          console.warn('[League] Error calculating minute from kickoff time:', e);
        }
      }
      
      const result = { homeScore, awayScore, status, minute, retryAfter: null as number | null };
      console.log('[League] Returning score data from Supabase:', result);
      return result;
    } catch (error: any) {
      console.error('[League] Error fetching live score from Supabase:', error?.message || error, error?.stack);
      return null;
    }
  };

  // Sync ref with liveScores state whenever it changes
  useEffect(() => {
    liveScoresRef.current = liveScores;
  }, [liveScores]);

  // Fetch existing live scores immediately, then poll for updates
  useEffect(() => {
    // Load live scores for all leagues
    if (!fixtures.length || tab !== 'gwr') return;
    
    const fixturesWithApi = fixtures.filter((f: any) => f.api_match_id);
    if (fixturesWithApi.length === 0) return;
    
    // Immediately fetch all existing live scores from Supabase
    const loadExistingScores = async () => {
      console.log('[League] Loading existing live scores from Supabase for', fixturesWithApi.length, 'fixtures');
      
      // Fetch all live scores in parallel
      const scorePromises = fixturesWithApi.map(async (fixture: any) => {
        const scoreData = await fetchLiveScore(fixture.api_match_id!, fixture.kickoff_time);
        if (!scoreData) return null;
        
        return {
          fixtureIndex: fixture.fixture_index,
          scoreData
        };
      });
      
      const results = await Promise.all(scorePromises);
      
      // Update live scores state with all fetched scores
      setLiveScores(prev => {
        const updated = { ...prev };
        results.forEach(result => {
          if (result) {
            updated[result.fixtureIndex] = {
              homeScore: result.scoreData.homeScore,
              awayScore: result.scoreData.awayScore,
              status: result.scoreData.status,
              minute: result.scoreData.minute ?? null
            };
          }
        });
        return updated;
      });
      
      console.log('[League] Loaded', results.filter(r => r !== null).length, 'existing live scores');
    };
    
    loadExistingScores();
  }, [fixtures.map((f: any) => `${f.fixture_index}-${f.api_match_id}`).join(','), tab]);

  // Simple live score polling - poll fixtures whose kickoff has passed
  useEffect(() => {
    // Poll for all leagues, not just API Test
    if (!fixtures.length || tab !== 'gwr') return;
    
    const fixturesToPoll = fixtures.filter((f: any) => f.api_match_id && f.kickoff_time);
    if (fixturesToPoll.length === 0) return;
    
    const intervals = new Map<number, ReturnType<typeof setInterval>>();
    
    // Simple polling function - reads from Supabase (no rate limits!)
    const startPolling = (fixture: any) => {
      const fixtureIndex = fixture.fixture_index;
      if (intervals.has(fixtureIndex)) return; // Already polling
      
      const poll = async () => {
        const scoreData = await fetchLiveScore(fixture.api_match_id!, fixture.kickoff_time);
        if (!scoreData) return;
        
        const isFinished = scoreData.status === 'FINISHED';
        
        // Update live scores using functional update to avoid dependency on liveScores
        setLiveScores(prev => {
          // Check if already finished to avoid unnecessary updates
          const current = prev[fixtureIndex];
          if (current?.status === 'FINISHED' && isFinished) {
            return prev; // No change needed
          }
          
          return {
            ...prev,
            [fixtureIndex]: {
              homeScore: scoreData.homeScore,
              awayScore: scoreData.awayScore,
              status: scoreData.status,
              minute: scoreData.minute ?? null
            }
          };
        });
        
        // Stop polling if finished
        if (isFinished) {
          const interval = intervals.get(fixtureIndex);
          if (interval) {
            clearInterval(interval);
            intervals.delete(fixtureIndex);
          }
        }
      };
      
      // Poll immediately, then every 10 seconds
      poll(); // Fetch immediately
      const interval = setInterval(poll, 10 * 1000); // Every 10 seconds - Supabase is fast!
      intervals.set(fixtureIndex, interval);
    };
    
    // Check which fixtures should be polled
    // Use ref to access current liveScores without causing re-renders
    const checkFixtures = () => {
      const now = new Date();
      fixturesToPoll.forEach((fixture: any) => {
        if (!fixture.api_match_id || !fixture.kickoff_time) return;
        
        const fixtureIndex = fixture.fixture_index;
        const kickoffTime = new Date(fixture.kickoff_time);
        const kickoffHasPassed = kickoffTime.getTime() <= now.getTime();
        const isCurrentlyPolling = intervals.has(fixtureIndex);
        const currentScore = liveScoresRef.current[fixtureIndex];
        const isFinished = currentScore?.status === 'FINISHED';
        
        // Stop if finished
        if (isFinished && isCurrentlyPolling) {
          console.log(`[League] Stopping polling for fixture ${fixtureIndex} (finished)`);
          const interval = intervals.get(fixtureIndex);
          if (interval) {
            clearInterval(interval);
            intervals.delete(fixtureIndex);
          }
          return;
        }
        
        // Start polling if kickoff passed and not finished
        if (kickoffHasPassed && !isFinished && !isCurrentlyPolling) {
          startPolling(fixture);
        }
      });
    };
    
    checkFixtures();
    const checkInterval = setInterval(checkFixtures, 60000); // Check every 1 minute (local check only, no API calls)
    
    return () => {
      intervals.forEach(clearInterval);
      clearInterval(checkInterval);
    };
  }, [league?.name, fixtures.map((f: any) => f.api_match_id).join(','), tab]); // Removed liveScores from dependencies

  // Set default tab to "gwr" (GW Results) if gameweek is live or finished within 12 hours
  // Only runs once on initial load when on chat tab - never auto-switches after user manually selects a tab
  useEffect(() => {
    // Only set initial tab once, and only if we're on the chat tab
    // Once initialTabSet is true OR user has manually selected a tab, this effect will never run again
    if (initialTabSet || manualTabSelectedRef.current || !fixtures.length || tab !== "chat") return;
    
    // Only apply to current GW (or API Test league GW 1)
    const isApiTestLeague = league?.name === 'API Test';
    const viewingCurrentGw = isApiTestLeague ? true : (selectedGw === currentGw || selectedGw === null);
    if (!viewingCurrentGw) {
      setInitialTabSet(true);
      return;
    }
    
    const now = new Date();
    
    // Check if first game has started
    const firstFixture = fixtures[0];
    const firstKickoff = firstFixture?.kickoff_time ? new Date(firstFixture.kickoff_time) : null;
    const firstGameStarted = firstKickoff && firstKickoff <= now;
    
    // Check if last game has finished and it's been less than 12 hours since finish
    const lastFixture = fixtures[fixtures.length - 1];
    const lastKickoff = lastFixture?.kickoff_time ? new Date(lastFixture.kickoff_time) : null;
    const lastFixtureIndex = lastFixture?.fixture_index;
    
    // Check liveScores for last fixture status
    const lastFixtureScore = lastFixtureIndex !== undefined ? liveScores[lastFixtureIndex] : null;
    const lastGameFinished = lastFixtureScore?.status === 'FINISHED';
    
    // If last game finished, check if it's been less than 12 hours since finish
    let lastGameFinishedWithin12Hours = false;
    if (lastGameFinished && lastKickoff) {
      // Estimate finish time as kickoff + 2 hours (typical match duration ~90 min + stoppage + halftime)
      const estimatedFinishTime = new Date(lastKickoff.getTime() + (2 * 60 * 60 * 1000));
      const hoursSinceFinish = (now.getTime() - estimatedFinishTime.getTime()) / (1000 * 60 * 60);
      // Check if finished and it's been less than 12 hours since finish
      lastGameFinishedWithin12Hours = hoursSinceFinish <= 12 && hoursSinceFinish >= 0;
    }
    
    // Also check if any game is currently live (IN_PLAY or PAUSED)
    const hasLiveGame = Object.values(liveScores).some(
      score => score.status === 'IN_PLAY' || score.status === 'PAUSED'
    );
    
    // Set tab to "gwr" if first game started OR last game finished within 12 hours OR has live game
    if (firstGameStarted || lastGameFinishedWithin12Hours || hasLiveGame) {
      console.log('[League] Setting default tab to GW Results:', {
        firstGameStarted,
        lastGameFinishedWithin12Hours,
        hasLiveGame,
        lastFixtureScore: lastFixtureScore?.status,
        viewingCurrentGw
      });
      setTab("gwr");
      setInitialTabSet(true);
    } else {
      setInitialTabSet(true);
    }
    // Note: Removed 'tab' from dependencies to prevent re-running when user manually switches tabs
    // The effect only needs to run once when fixtures/liveScores first load
  }, [fixtures, liveScores, initialTabSet, currentGw, selectedGw, league?.name]);

  const submittedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    console.log('[League] Building submittedMap from subs:', subs);
    subs.forEach((s) => {
      // Only count as submitted if submitted_at is not null
      if (s.submitted_at) {
        const key = `${s.user_id}:${s.gw}`;
        console.log(`[League] Adding submission key: ${key}`, s);
        m.set(key, true);
      } else {
        console.log(`[League] Skipping submission with null submitted_at:`, s);
      }
    });
    console.log('[League] Final submittedMap:', Array.from(m.entries()));
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

  /* ---------- Compute Mini League Table (season) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!members.length) {
        setMltRows([]);
        return;
      }
      
      // Special handling for "API Test" league - it uses test API data, not regular game data
      if (league?.name === 'API Test') {
        // Show empty table with zero points for all members (test league starts fresh)
        setMltRows(createEmptyMltRows(members));
        setMltLoading(false);
        return;
      }
      
      // Don't calculate until we have currentGw loaded
      if (currentGw === null) {
        return;
      }
      
      setMltLoading(true);

      const { data: rs } = await supabase.from("gw_results").select("gw,fixture_index,result");
      const resultList = (rs as ResultRowRaw[]) ?? [];

      const outcomeByGwIdx = new Map<string, "H" | "D" | "A">();
      resultList.forEach((r) => {
        const out = rowToOutcome(r);
        if (!out) return;
        outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
      });

      if (outcomeByGwIdx.size === 0) {
        setMltRows(createEmptyMltRows(members));
        setMltLoading(false);
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
      const relevantGws = gwsWithResults.filter(gw => gw >= leagueStartGw);

      // For late-starting leagues, if there are no results for the start gameweek or later, show empty table
      if (!specialLeagues.includes(league?.name || '') && !gw7StartLeagues.includes(league?.name || '') && relevantGws.length === 0) {
        setMltRows(createEmptyMltRows(members));
        setMltLoading(false);
        return;
      }

      const { data: pk } = await supabase
        .from("picks")
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
      setMltLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [members, league, currentGw, createEmptyMltRows]);

  /* =========================
     Renderers
     ========================= */

  function MltTab() {
    const renderForm = (formArr: ("W" | "D" | "L")[]) => {
      const last5 = formArr.slice(-5);
      const pad = 5 - last5.length;

      return (
        <div className="flex items-center justify-between w-full">
          {Array.from({ length: pad }).map((_, i) => (
            <div key={`dot-${i}`} className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
          ))}
          {last5.map((result, i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                result === "W"
                  ? "bg-green-100 text-green-700"
                  : result === "D"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {result}
            </div>
          ))}
        </div>
      );
    };

    // Check if this is a late-starting league (not one of the special leagues that start from GW0)
    // Note: "API Test" is excluded - it uses test API data, not regular game data
    const specialLeagues = ['Prem Predictions', 'FC Football', 'Easy League'];
    const gw7StartLeagues = ['The Bird league'];
    const gw8StartLeagues = ['gregVjofVcarl', 'Let Down'];
    const isLateStartingLeague = league && !specialLeagues.includes(league.name) && !gw7StartLeagues.includes(league.name) && !gw8StartLeagues.includes(league.name);

    const rows = mltRows.length
      ? mltRows
      : members.map((m) => ({
          user_id: m.id,
          name: m.name,
          mltPts: 0,
          ocp: 0,
          unicorns: 0,
          wins: 0,
          draws: 0,
          form: [] as ("W" | "D" | "L")[],
        }));

    if (members.length === 1) {
      return (
        <div className="text-center p-8 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Invite at least one more user to make the ML start</h3>
          <p className="text-slate-600 mb-4">Share your league code with friends to get the competition going!</p>
          <button
            onClick={() => setShowInvite(true)}
            className="px-4 py-2 bg-[#1C8376] text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Share League Code
          </button>
        </div>
      );
    }

    return (
      <div className="pt-4">
        <style>{`
          .mlt-table tbody tr:last-child {
            border-bottom: none !important;
            border: none !important;
          }
          .mlt-table tbody tr:last-child td {
            border-bottom: none !important;
            border: none !important;
          }
          .mlt-table tbody tr:last-child th {
            border-bottom: none !important;
            border: none !important;
          }
          .mlt-table {
            border-bottom: none !important;
          }
          .mlt-table tbody {
            border-bottom: none !important;
          }
          .mlt-table-container {
            border-bottom: none !important;
          }
          .mlt-table-container table {
            border-bottom: none !important;
          }
          .mlt-table-container tbody {
            border-bottom: none !important;
          }
          .mlt-table-container tbody tr:last-child {
            border-bottom: none !important;
            border: none !important;
          }
          .mlt-table-container tbody tr:last-child td {
            border-bottom: none !important;
            border: none !important;
          }
        `}</style>
        <div 
          className="mlt-table-container overflow-y-auto overflow-x-hidden -mx-4 sm:mx-0 rounded-none sm:rounded-2xl border-x-0 sm:border-x bg-slate-50"
          style={{ 
            backgroundColor: '#f8fafc',
            borderBottom: 'none',
            boxShadow: 'none'
          }}
        >
          <table className="mlt-table w-full text-sm border-collapse" style={{ tableLayout: 'fixed', backgroundColor: '#f8fafc', border: 'none', borderBottom: 'none' }}>
            <thead className="sticky top-0" style={{ 
              position: 'sticky', 
              top: 0, 
              zIndex: 25, 
              backgroundColor: '#f8fafc', 
              display: 'table-header-group'
            } as any}>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: 'none' }}>
                <th className="py-3 text-left font-normal" style={{ backgroundColor: '#f8fafc', width: '30px', paddingLeft: '0.75rem', paddingRight: '0.5rem', color: '#94a3b8' }}>#</th>
                <th className="py-3 text-left font-normal text-xs" style={{ backgroundColor: '#f8fafc', color: '#94a3b8', paddingLeft: '0.5rem', paddingRight: '1rem' }}>Player</th>
                {showForm ? (
                  <th className="px-4 py-3 text-left font-normal text-xs" style={{ backgroundColor: '#f8fafc', color: '#94a3b8' }}>Form</th>
                ) : (
                  <>
                    <th className="py-3 text-center font-normal text-xs" style={{ backgroundColor: '#f8fafc', width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8', fontSize: '0.75rem' }}>W</th>
                    <th className="py-3 text-center font-normal text-xs" style={{ backgroundColor: '#f8fafc', width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8', fontSize: '0.75rem' }}>D</th>
                    <th className="py-3 text-center font-normal text-xs" style={{ backgroundColor: '#f8fafc', width: '40px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8', fontSize: '0.75rem' }}>{isLateStartingLeague ? 'CP' : 'OCP'}</th>
                    {members.length >= 3 && <th className="py-3 text-center font-normal" style={{ backgroundColor: '#f8fafc', width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8', fontSize: '1rem' }}>🦄</th>}
                    <th className="py-3 text-center font-normal text-xs" style={{ backgroundColor: '#f8fafc', width: '40px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8', fontSize: '0.75rem' }}>PTS</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isMe = r.user_id === user?.id;
                const isLastRow = i === rows.length - 1;
                return (
                  <tr 
                    key={r.user_id} 
                    className={isMe ? 'flash-user-row' : ''}
                    style={{
                      position: 'relative',
                      backgroundColor: '#f8fafc',
                      ...(isLastRow ? {} : { borderBottom: '1px solid #e2e8f0' })
                    }}
                  >
                    <td className="py-4 text-left tabular-nums whitespace-nowrap relative" style={{ 
                      paddingLeft: '0.75rem', 
                      paddingRight: '0.5rem',
                      backgroundColor: '#f8fafc',
                      width: '30px'
                    }}>
                      {i + 1}
                    </td>
                    <td className="py-4 truncate whitespace-nowrap" style={{ backgroundColor: '#f8fafc', paddingLeft: '0.5rem', paddingRight: '1rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</td>
                    {showForm ? (
                      <td className="px-4 py-4" style={{ backgroundColor: '#f8fafc' }}>
                        {renderForm(r.form)}
                      </td>
                    ) : (
                      <>
                        <td className="py-4 text-center tabular-nums" style={{ width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', backgroundColor: '#f8fafc' }}>{r.wins}</td>
                        <td className="py-4 text-center tabular-nums" style={{ width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', backgroundColor: '#f8fafc' }}>{r.draws}</td>
                        <td className="py-4 text-center tabular-nums" style={{ width: '40px', paddingLeft: '0.25rem', paddingRight: '0.25rem', backgroundColor: '#f8fafc' }}>{r.ocp}</td>
                        {members.length >= 3 && <td className="py-4 text-center tabular-nums" style={{ width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', backgroundColor: '#f8fafc' }}>{r.unicorns}</td>}
                        <td className="py-4 text-center tabular-nums font-bold" style={{ width: '40px', paddingLeft: '0.25rem', paddingRight: '0.25rem', backgroundColor: '#f8fafc', color: '#1C8376' }}>{r.mltPts}</td>
                      </>
                    )}
                  </tr>
                );
              })}
              {mltLoading && (
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <td className="px-4 py-6 text-slate-500 text-center" colSpan={showForm ? 3 : (members.length >= 3 ? 7 : 6)} style={{ backgroundColor: '#f8fafc' }}>
                    Calculating…
                  </td>
                </tr>
              )}
          {!mltLoading && !mltRows.length && (
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <td className="px-4 py-6 text-slate-500 text-center" colSpan={showForm ? 3 : (members.length >= 3 ? 7 : 6)} style={{ backgroundColor: '#f8fafc' }}>
                    No gameweeks completed yet — this will populate after the first results are saved.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-between items-center">
          <div className="flex items-center justify-between w-full">
            <div className="inline-flex rounded-full bg-slate-100 p-0.5 shadow-sm border border-slate-200">
              <button
                onClick={() => setShowForm(false)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                  !showForm ? "bg-[#1C8376] text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                Points
              </button>
              <button
                onClick={() => setShowForm(true)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                  showForm ? "bg-[#1C8376] text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                Form
              </button>
            </div>
            <button
              onClick={() => {
                console.log('Button clicked, setting modal to true');
                setShowTableModal(true);
              }}
              className="flex items-center justify-center gap-1.5 bg-white border-2 border-slate-300 hover:bg-slate-50 rounded-full text-slate-600 hover:text-slate-800 cursor-help transition-colors flex-shrink-0 px-3 py-2"
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
    const picksGw = league?.name === 'API Test' ? 1 : currentGw;
    if (!picksGw) {
      return <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-600">No current game week available.</div>;
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
    results.forEach((r) => {
      if (r.gw !== picksGw) return;
      const out = rowToOutcome(r);
      if (!out) return;
      outcomes.set(r.fixture_index, out);
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
    
    // Debug logging for API Test league
    if (isApiTestLeague && picksGw === 1) {
      console.log('[League] API Test filtering:', {
        currentFixtureIndices: Array.from(currentFixtureIndices),
        totalPicks: picks.length,
        picksForGw: picks.filter(p => p.gw === picksGw).length,
        submittedMapSize: submittedMap.size,
        allSubmitted,
        members: members.map(m => ({ id: m.id, name: m.name, submitted: submittedMap.get(`${m.id}:${picksGw}`) })),
        fixturesCount: fixtures.filter(f => f.gw === picksGw).length
      });
      
      // Log all picks to see what we're dealing with
      const allPicksForGw = picks.filter(p => p.gw === picksGw);
      console.log('[League] All picks for GW1:', allPicksForGw.map(p => ({
        user_id: p.user_id,
        userName: members.find(m => m.id === p.user_id)?.name,
        fixture_index: p.fixture_index,
        pick: p.pick,
        hasSubmitted: !!submittedMap.get(`${p.user_id}:${picksGw}`),
        inCurrentFixtures: currentFixtureIndices.has(p.fixture_index)
      })));
    }
    
    const picksByFixture = new Map<number, PickRow[]>();
    
    // For API Test league, if not all submitted, don't process ANY picks - they shouldn't be shown
    if (!isApiTestLeague || allSubmitted) {
      picks.forEach((p) => {
        if (p.gw !== picksGw) return;
        
        // CRITICAL: For API Test league ONLY, only include picks from users who have submitted (confirmed) their predictions
        // For regular leagues, show ALL picks regardless of submission status
        if (isApiTestLeague) {
          const hasSubmitted = submittedMap.get(`${p.user_id}:${picksGw}`);
          if (!hasSubmitted) {
            if (picksGw === 1) {
              console.log('[League] API Test: Filtering out unsubmitted pick:', { user_id: p.user_id, fixture_index: p.fixture_index, userName: members.find(m => m.id === p.user_id)?.name });
            }
            return;
          }
        }
        
        // CRITICAL: Only include picks for current fixtures (filter out old picks like Brazil)
        // This ensures we don't show picks from previous test runs
        if (!currentFixtureIndices.has(p.fixture_index)) {
          if (isApiTestLeague && picksGw === 1) {
            console.log('[League] Filtering out old pick (not in current fixtures):', { 
              fixture_index: p.fixture_index, 
              currentIndices: Array.from(currentFixtureIndices),
              userName: members.find(m => m.id === p.user_id)?.name
            });
          }
          return;
        }
        
        const arr = picksByFixture.get(p.fixture_index) ?? [];
        arr.push(p);
        picksByFixture.set(p.fixture_index, arr);
      });
    } else {
      console.log('[League] API Test: Not all submitted - skipping ALL picks processing. allSubmitted=', allSubmitted);
    }
    const resultsPublished = latestResultsGw !== null && latestResultsGw >= picksGw;
    const remaining = members.filter((m) => !submittedMap.get(`${m.id}:${picksGw}`)).length;
    const whoDidntSubmit = members.filter((m) => !submittedMap.get(`${m.id}:${picksGw}`)).map(m => m.name);
    
    // Check if deadline has passed for this GW
    const gwDeadline = gwDeadlines.get(picksGw);
    const deadlinePassed = gwDeadline ? new Date() >= gwDeadline : false;
    
    // Debug logging for API Test league
    if (isApiTestLeague && picksGw === 1) {
      const memberSubmissionStatus = members.map(m => {
        const key = `${m.id}:${picksGw}`;
        const submitted = submittedMap.get(key);
        return { id: m.id, name: m.name, submitted: !!submitted, key };
      });
      console.log(`[League] ===== API Test GW${picksGw} SUBMISSION CHECK =====`);
      console.log(`[League] All submitted:`, allSubmitted);
      console.log(`[League] Remaining:`, remaining);
      console.log(`[League] Who didn't submit:`, whoDidntSubmit);
      console.log(`[League] Member submission status:`, memberSubmissionStatus);
      console.log(`[League] Submitted map entries:`, Array.from(submittedMap.entries()));
      console.log(`[League] ================================================`);
      
      // Specifically check for Steve and Jof
      const steve = members.find(m => m.name.toLowerCase().includes('steve') || m.name.toLowerCase().includes('s'));
      const jof = members.find(m => m.name.toLowerCase().includes('jof') || m.name.toLowerCase().includes('j'));
      if (steve) {
        const steveKey = `${steve.id}:${picksGw}`;
        console.log(`[League] STEVE (${steve.name}):`, { id: steve.id, submitted: !!submittedMap.get(steveKey), key: steveKey });
      }
      if (jof) {
        const jofKey = `${jof.id}:${picksGw}`;
        console.log(`[League] JOF (${jof.name}):`, { id: jof.id, submitted: !!submittedMap.get(jofKey), key: jofKey });
      }
    }
    
    console.log(`GW${picksGw} deadline check:`, {
      gwDeadline,
      now: new Date(),
      deadlinePassed,
      allSubmitted,
      willShowPredictions: allSubmitted || deadlinePassed
    });

    // For API Test league, show submission status only if not all submitted
    // Also show it if user is on "gw" tab but not all submitted (they should see "Who's submitted" instead of predictions)
    const showSubmissionStatus = isApiTestLeague 
      ? !allSubmitted  // Always show "Who's submitted" if not all submitted, regardless of tab
      : (!allSubmitted && !deadlinePassed);

    // For ALL leagues, if not all submitted (and deadline hasn't passed for regular leagues), ONLY show "Who's submitted" view, nothing else
    // This is CRITICAL - no predictions/fixtures should show if not all submitted
    const shouldShowWhoSubmitted = isApiTestLeague ? !allSubmitted : (!allSubmitted && !deadlinePassed);
    
    if (shouldShowWhoSubmitted) {
      console.log('[League] Not all submitted, showing ONLY "Who\'s submitted" view. Blocking all predictions/fixtures.', {
        isApiTestLeague,
        allSubmitted,
        deadlinePassed,
        remaining
      });
      return (
        <div className="mt-2 pt-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">
              <>Waiting for <span className="font-semibold">{remaining}</span> of {members.length} to submit.</>
            </div>
            {/* Share reminder button - only show if not all submitted */}
            <button
              onClick={() => {
                // Generate share message
                const message = `Game Week ${picksGw} Predictions Reminder!\n\nDEADLINE: THIS ${(() => {
                  const firstKickoff = new Date(fixtures.find(f => f.gw === picksGw)?.kickoff_time || '');
                  const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000));
                  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
                  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                  const dayOfWeek = dayNames[deadlineTime.getUTCDay()];
                  const day = deadlineTime.getUTCDate();
                  const month = months[deadlineTime.getUTCMonth()];
                  const hours = deadlineTime.getUTCHours().toString().padStart(2, '0');
                  const minutes = deadlineTime.getUTCMinutes().toString().padStart(2, '0');
                  return `${dayOfWeek} ${day} ${month}, ${hours}:${minutes} BST`;
                })()}\n\nDon't forget!\nplaytotl.com`;
                
                // Create WhatsApp link
                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                
                // Try to open WhatsApp, fallback to copy to clipboard
                try {
                  window.open(whatsappUrl, '_blank');
                } catch {
                  navigator.clipboard.writeText(message).then(() => {
                    alert('Message copied to clipboard! You can now paste it in WhatsApp or Messages.');
                  }).catch(() => {
                    alert('Unable to open WhatsApp. Please copy this message manually:\n\n' + message);
                  });
                }
              }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
              </svg>
              Share Reminder
            </button>
          </div>

          {/* Deadline display */}
          {(() => {
            const kickoffTimes = fixtures
              .map(f => f.kickoff_time)
              .filter((kt): kt is string => !!kt)
              .map(kt => new Date(kt))
              .filter(d => !isNaN(d.getTime()));
            
            if (kickoffTimes.length === 0) return null;
            
            const firstKickoff = new Date(Math.min(...kickoffTimes.map(d => d.getTime())));
            const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000));
            const deadlinePassed = new Date() >= deadlineTime;
            
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const dayOfWeek = dayNames[deadlineTime.getUTCDay()];
            const day = deadlineTime.getUTCDate();
            const month = months[deadlineTime.getUTCMonth()];
            const hours = deadlineTime.getUTCHours().toString().padStart(2, '0');
            const minutes = deadlineTime.getUTCMinutes().toString().padStart(2, '0');
            const deadlineStr = `${dayOfWeek} ${day} ${month}, ${hours}:${minutes} BST`;
            
            return (
              <div className={`mb-3 text-xs font-medium ${deadlinePassed ? 'text-orange-600' : 'text-slate-600'} flex items-center gap-1.5`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {deadlinePassed ? 'Deadline Passed: ' : 'Deadline: '}{deadlineStr}
              </div>
            );
          })()}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 w-2/3 font-semibold text-slate-600">Player</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {members
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((m) => {
                    const key = `${m.id}:${picksGw}`;
                    const submitted = !!submittedMap.get(key);
                    return (
                      <tr key={m.id} className="border-t border-slate-200">
                        <td className="px-4 py-3 font-bold text-slate-900 truncate whitespace-nowrap" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</td>
                        <td className="px-4 py-3">
                          {submitted ? (
                            <span className="inline-flex items-center gap-1.5 justify-center rounded-full bg-[#1C8376]/10 text-[#1C8376]/90 text-xs px-2.5 py-1 border border-emerald-300 font-bold shadow-sm whitespace-nowrap w-24">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Submitted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 justify-center rounded-full bg-amber-50 text-amber-700 text-xs px-2.5 py-1 border border-amber-200 font-semibold whitespace-nowrap w-24">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
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
      );
    }

    return (
      <div className="mt-2 pt-2">

        {showSubmissionStatus ? (
          <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-700">
            <div className="mb-3 flex items-center justify-between">
              <div>
                {allSubmitted ? (
                  <>All {members.length} members have submitted.</>
                ) : (
                  <>Waiting for <span className="font-semibold">{remaining}</span> of {members.length} to submit.</>
                )}
              </div>
              {/* Share reminder button - only show if not all submitted */}
              {!allSubmitted && (
              <button
                onClick={() => {
                  // Generate share message
                  const message = `Game Week ${picksGw} Predictions Reminder!\n\nDEADLINE: THIS ${(() => {
                    const firstKickoff = new Date(fixtures.find(f => f.gw === picksGw)?.kickoff_time || '');
                    const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000));
                    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
                    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                    const dayOfWeek = dayNames[deadlineTime.getUTCDay()];
                    const day = deadlineTime.getUTCDate();
                    const month = months[deadlineTime.getUTCMonth()];
                    const hours = deadlineTime.getUTCHours().toString().padStart(2, '0');
                    const minutes = deadlineTime.getUTCMinutes().toString().padStart(2, '0');
                    return `${dayOfWeek} ${day} ${month}, ${hours}:${minutes} BST`;
                  })()}\n\nDon't forget!\nplaytotl.com`;
                  
                  // Create WhatsApp link
                  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                  
                  // Try to open WhatsApp, fallback to copy to clipboard
                  try {
                    window.open(whatsappUrl, '_blank');
                  } catch {
                    navigator.clipboard.writeText(message).then(() => {
                      alert('Message copied to clipboard! You can now paste it in WhatsApp or Messages.');
                    }).catch(() => {
                      alert('Unable to open WhatsApp. Please copy this message manually:\n\n' + message);
                    });
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                </svg>
                Share Reminder
              </button>
              )}
            </div>

            {/* Deadline display - calculate from actual fixtures like Predictions page */}
            {(() => {
              // Calculate deadline from fixtures (same logic as Predictions page)
              // Find the earliest kickoff time
              const kickoffTimes = fixtures
                .map(f => f.kickoff_time)
                .filter((kt): kt is string => !!kt)
                .map(kt => new Date(kt))
                .filter(d => !isNaN(d.getTime()));
              
              if (kickoffTimes.length === 0) return null;
              
              const firstKickoff = new Date(Math.min(...kickoffTimes.map(d => d.getTime())));
              const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000)); // 75 minutes before
              const deadlinePassed = new Date() >= deadlineTime;
              
              // Format deadline (same as Predictions page)
              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const dayOfWeek = dayNames[deadlineTime.getUTCDay()];
              const day = deadlineTime.getUTCDate();
              const month = months[deadlineTime.getUTCMonth()];
              const hours = deadlineTime.getUTCHours().toString().padStart(2, '0');
              const minutes = deadlineTime.getUTCMinutes().toString().padStart(2, '0');
              const deadlineStr = `${dayOfWeek} ${day} ${month}, ${hours}:${minutes} BST`;
              
              return (
                <div className={`mb-3 text-sm ${deadlinePassed ? 'text-orange-600 font-semibold' : 'text-slate-600'}`}>
                  {deadlinePassed ? '⏰ Deadline Passed: ' : '⏰ Deadline: '}{deadlineStr}
                </div>
              );
            })()}

            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 w-2/3 font-semibold text-slate-600">Player</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {members
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((m) => {
                      const key = `${m.id}:${picksGw}`;
                      const submitted = !!submittedMap.get(key);
                      if (m.name === 'Jof') {
                        console.log(`Checking Jof submission: key=${key}, submitted=${submitted}, submittedMap has:`, submittedMap.has(key), 'picksGw=', picksGw);
                      }
                      return (
                        <tr key={m.id} className="border-t border-slate-200">
                          <td className="px-4 py-3 font-bold text-slate-900 truncate whitespace-nowrap" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</td>
                          <td className="px-4 py-3">
                            {submitted ? (
                              <span className="inline-flex items-center justify-center rounded-full bg-[#1C8376]/10 text-[#1C8376]/90 text-xs px-2 py-1 border border-emerald-300 font-bold shadow-sm whitespace-nowrap w-24">
                                ✅ Submitted
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center rounded-full bg-amber-50 text-amber-700 text-xs px-2 py-1 border border-amber-200 font-semibold whitespace-nowrap w-24">
                                ⏳ Not yet
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
          
          // Use filtered live scores
          const combinedLiveScores = filteredLiveScores;
          
          const hasLiveGames = fixturesToCheck.some(f => {
            const score = combinedLiveScores[f.fixture_index];
            return score && (score.status === 'IN_PLAY' || score.status === 'PAUSED');
          });
          const allGamesFinished = fixturesToCheck.length > 0 && fixturesToCheck.every(f => {
            const score = combinedLiveScores[f.fixture_index];
            return score && score.status === 'FINISHED';
          });
          const hasStarted = hasLiveGames || allGamesFinished || fixturesToCheck.some(f => combinedLiveScores[f.fixture_index]);
          
          // Count live fixtures where user has correct predictions (matches Home page logic)
          let liveFixturesCount = 0;
          if (user?.id) {
            fixturesToCheck.forEach(f => {
              const liveScore = combinedLiveScores[f.fixture_index];
              const isLive = liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
              const isFinished = liveScore && liveScore.status === 'FINISHED';
              
              // Count both live and finished games (like Home page)
              if (liveScore && (isLive || isFinished)) {
                // Get user's pick for this fixture
                const userPicks = picksByFixture.get(f.fixture_index) ?? [];
                const userPick = userPicks.find(p => p.user_id === user.id);
                
                if (userPick) {
                  // Determine if pick is correct based on live score (matches Home page logic)
                  let isCorrect = false;
                  if (userPick.pick === 'H' && liveScore.homeScore > liveScore.awayScore) isCorrect = true;
                  else if (userPick.pick === 'A' && liveScore.awayScore > liveScore.homeScore) isCorrect = true;
                  else if (userPick.pick === 'D' && liveScore.homeScore === liveScore.awayScore) isCorrect = true;
                  
                  // Only count if user's pick is correct
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
                <div key={si}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-slate-700 font-normal text-lg">{sec.label}</div>
                    {si === 0 && (
                      <>
                        {hasLiveGames && (() => {
                          const totalFixtures = fixturesToCheck.length;
                          
                          return (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-sm font-bold border border-red-700 shadow-sm" style={{ marginTop: '-2px' }}>
                              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                              <span className="text-xs sm:text-sm font-medium opacity-90">Live</span>
                              <span className="flex items-baseline gap-0.5">
                                <span className="text-base sm:text-lg font-extrabold">{liveFixturesCount}</span>
                                <span className="text-xs sm:text-sm font-medium opacity-90">/</span>
                                <span className="text-sm sm:text-base font-semibold opacity-80">{totalFixtures}</span>
                              </span>
                            </span>
                          );
                        })()}
                        {allGamesFinished && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#1C8376]/10 text-[#1C8376]/90 text-sm font-bold border border-emerald-300 shadow-sm" style={{ marginTop: '-2px' }}>
                            Round Complete!
                          </span>
                        )}
                        {!hasStarted && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-bold border border-blue-300 shadow-sm" style={{ marginTop: '-2px' }}>
                            All Submitted
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="rounded-2xl border bg-slate-50 overflow-hidden">
                    <ul>
                      {sec.items.map((f, idx) => {
                        try {
                          // For API Test league, use short names first
                          const homeName = f.home_team || f.home_name || "Home";
                          const awayName = f.away_team || f.away_name || "Away";
                          // Use fallback pattern like Home.tsx
                          const homeKey = (f.home_code || f.home_team || f.home_name || "").toUpperCase();
                          const awayKey = (f.away_code || f.away_team || f.away_name || "").toUpperCase();

                          const timeOf = (iso?: string | null) => {
                            if (!iso) return "";
                            const d = new Date(iso);
                            if (isNaN(d.getTime())) return "";
                            const hh = String(d.getUTCHours()).padStart(2, '0');
                            const mm = String(d.getUTCMinutes()).padStart(2, '0');
                            return `${hh}:${mm}`;
                          };
                          const timeStr = timeOf(f.kickoff_time);

                          const fxIdx = f.fixture_index;
                          const these = picksByFixture.get(fxIdx) ?? [];
                          
                          // Get live score for this fixture (using combined mock + real scores)
                          const liveScore = combinedLiveScores[fxIdx];
                          const isLive = liveScore && liveScore.status === 'IN_PLAY';
                          const isHalfTime = liveScore && (liveScore.status === 'PAUSED' || liveScore.status === 'HALF_TIME' || liveScore.status === 'HT');
                          const isFinished = liveScore && liveScore.status === 'FINISHED';
                          const isOngoing = isLive || isHalfTime;

                          const toChips = (want: "H" | "D" | "A") => {
                            const filtered = these.filter((p) => p.pick === want);
                            // For API Test league, check live scores for outcomes
                            let actualResult: "H" | "D" | "A" | null = null;
                            if (league?.name === 'API Test' && picksGw === 1) {
                              if (liveScore) {
                                if (liveScore.homeScore > liveScore.awayScore) actualResult = 'H';
                                else if (liveScore.awayScore > liveScore.homeScore) actualResult = 'A';
                                else if (liveScore.homeScore === liveScore.awayScore) actualResult = 'D';
                              }
                            } else {
                              actualResult = outcomes.get(fxIdx) || null;
                            }
                          const allPicked = these.length === members.length && filtered.length === members.length;
                          
                          // Group chips into rows of maximum 4
                          const chipsPerRow = 4;
                          const rows = [];
                          
                          for (let i = 0; i < filtered.length; i += chipsPerRow) {
                            const rowChips = filtered.slice(i, i + chipsPerRow);
                            rows.push(rowChips);
                          }
                          
                          return (
                            <div className="flex flex-col gap-1">
                              {rows.map((row, rowIdx) => (
                                <div key={rowIdx} className="flex items-center justify-center">
                                  {row.map((p, idx) => {
                                    const m = members.find((mm) => mm.id === p.user_id);
                                    const letter = initials(m?.name ?? "?");
                                    // Check if this member has submitted
                                    const hasSubmitted = submittedMap.has(`${p.user_id}:${picksGw}`);
                                    // Show correct=true only when result exists AND pick matches result
                                    const isCorrect = actualResult && actualResult === want ? true : null;
                                    
                                    if (allPicked) {
                                      // Stack effect - use relative positioning with negative margins
                                      const overlapAmount = 8;
                                      return (
                                        <span 
                                          key={p.user_id}
                                          className="inline-block"
                                          style={{
                                            marginLeft: idx > 0 ? `-${overlapAmount}px` : '0',
                                            position: 'relative',
                                            zIndex: idx
                                          }}
                                        >
                                          <Chip letter={letter} correct={isCorrect} unicorn={false} hasSubmitted={hasSubmitted} isLive={isLive} isOngoing={isOngoing} isFinished={isFinished} />
                                        </span>
                                      );
                                    }
                                    
                                    return (
                                      <Chip key={p.user_id} letter={letter} correct={isCorrect} unicorn={false} hasSubmitted={hasSubmitted} isLive={isLive} isOngoing={isOngoing} isFinished={isFinished} />
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          );
                        };

                        return (
                          <li key={`${f.gw}-${f.fixture_index}`} className={idx > 0 ? "border-t" : ""}>
                            <div className="p-4 bg-white relative">
                              {/* LIVE indicator - red dot top left for live games, always says LIVE */}
                              {(isLive || isHalfTime) && (
                                <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pb-6">
                                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                  <span className="text-xs font-bold text-red-600">LIVE</span>
                                </div>
                              )}
                              {/* FT indicator for finished games - grey, no pulse */}
                              {isFinished && !isLive && !isHalfTime && (
                                <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pb-6">
                                  <span className="text-xs font-semibold text-slate-500">FT</span>
                                </div>
                              )}
                              {/* Fixture display - same as Home Page */}
                              <div className={`grid grid-cols-3 items-center ${isOngoing ? 'pt-4' : ''}`}>
                                <div className="flex items-center justify-center">
                                  <span className="text-sm sm:text-base font-medium text-slate-900 truncate">{homeName}</span>
                                </div>
                                <div className="flex items-center justify-center gap-2">
                                  {homeKey && (
                                    <img 
                                      src={`/assets/badges/${homeKey}.png`} 
                                      alt={`${homeName} badge`} 
                                      className="h-6 w-6 object-contain"
                                      onError={(e) => {
                                        // Reduce opacity if badge fails to load, don't hide completely
                                        (e.currentTarget as HTMLImageElement).style.opacity = "0.35";
                                      }}
                                    />
                                  )}
                                  <div className="text-[15px] sm:text-base font-semibold text-slate-600">
                                    {liveScore && (isLive || isHalfTime || isFinished) ? (
                                      <span className="font-bold text-base text-slate-900">
                                        {liveScore.homeScore} - {liveScore.awayScore}
                                      </span>
                                    ) : (
                                      <span>{timeStr}</span>
                                    )}
                                  </div>
                                  {awayKey && (
                                    <img 
                                      src={`/assets/badges/${awayKey}.png`} 
                                      alt={`${awayName} badge`} 
                                      className="h-6 w-6 object-contain"
                                      onError={(e) => {
                                        // Reduce opacity if badge fails to load, don't hide completely
                                        (e.currentTarget as HTMLImageElement).style.opacity = "0.35";
                                      }}
                                    />
                                  )}
                                </div>
                                <div className="flex items-center justify-center">
                                  <span className="text-sm sm:text-base font-medium text-slate-900 truncate">{awayName}</span>
                                </div>
                              </div>
                              {/* Score indicator (phase label for ML results table) */}
                              {liveScore && (isOngoing || isFinished) && (
                                <div className="flex justify-center mt-1">
                                  <span className={`text-[10px] font-semibold ${isOngoing ? 'text-red-600' : 'text-slate-500'}`}>
                                    {formatMinuteDisplay(liveScore.status, liveScore.minute)}
                                  </span>
                                </div>
                              )}
                              
                              {/* Pips underneath - same as Home Page */}
                              <div className="mt-2 grid grid-cols-3">
                                <div className="relative min-h-6">
                                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                    {toChips("H")}
                                  </div>
                                </div>
                                <div className="relative min-h-6">
                                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                    {toChips("D")}
                                  </div>
                                </div>
                                <div className="relative min-h-6">
                                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                    {toChips("A")}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      } catch (error) {
                        console.error("Error rendering fixture:", error, f);
                        return (
                          <li key={`${f.gw}-${f.fixture_index}`} className="p-4 text-red-500">
                            Error loading fixture: {f.fixture_index}
                          </li>
                        );
                      }
                    })}
                    {!sec.items.length && (
                      <li className="p-4 text-slate-500">
                        No fixtures.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          );
        })()}

        {/* Regular league predictions view - NEVER show for API Test league (it has its own view above) */}
        {sections.length > 0 && league?.name !== 'API Test' && (
          <div className="mt-3 space-y-6">
            {sections.map((sec, si) => (
              <div key={si}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-slate-700 font-normal text-lg">{sec.label}</div>
                  {si === 0 && allSubmitted && resultsPublished && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#1C8376]/10 text-[#1C8376]/90 text-sm font-bold border border-emerald-300 shadow-sm" style={{ marginTop: '-2px' }}>
                      Round Complete!
                    </span>
                  )}
                  {si === 0 && allSubmitted && !resultsPublished && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-bold border border-blue-300 shadow-sm" style={{ marginTop: '-2px' }}>
                      All Submitted
                    </span>
                  )}
                  {si === 0 && deadlinePassed && !allSubmitted && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-sm font-bold border border-orange-300 shadow-sm" style={{ marginTop: '-2px' }}>
                      Deadline Passed {whoDidntSubmit.length > 0 && `(${whoDidntSubmit.join(', ')} didn't submit)`}
                    </span>
                  )}
                </div>
                <div className="rounded-2xl border bg-slate-50 overflow-hidden">
                  <ul>
                    {sec.items.map((f, idx) => {
                        try {
                          const homeName = f.home_name || f.home_team || "Home";
                          const awayName = f.away_name || f.away_team || "Away";
                          const homeCode = f.home_code || "";
                          const awayCode = f.away_code || "";

                          const timeOf = (iso?: string | null) => {
                            if (!iso) return "";
                            const d = new Date(iso);
                            if (isNaN(d.getTime())) return "";
                            const hh = String(d.getUTCHours()).padStart(2, '0');
                            const mm = String(d.getUTCMinutes()).padStart(2, '0');
                            return `${hh}:${mm}`;
                          };
                          const timeStr = timeOf(f.kickoff_time);

                          const fxIdx = f.fixture_index;
                          const these = picksByFixture.get(fxIdx) ?? [];
                          
                          // Get live score for this fixture
                          const liveScore = liveScores[fxIdx];
                          const isLive = liveScore && liveScore.status === 'IN_PLAY';
                          const isHalfTime = liveScore && (liveScore.status === 'PAUSED' || liveScore.status === 'HALF_TIME' || liveScore.status === 'HT');
                          const isFinished = liveScore && liveScore.status === 'FINISHED';
                          const isOngoing = isLive || isHalfTime;

                          const toChips = (want: "H" | "D" | "A") => {
                            const filtered = these.filter((p) => p.pick === want);
                            const actualResult = outcomes.get(fxIdx);
                            const allPicked = these.length === members.length && filtered.length === members.length;
                            
                            // Group chips into rows of maximum 4
                            const chipsPerRow = 4;
                            const rows = [];
                            
                            for (let i = 0; i < filtered.length; i += chipsPerRow) {
                              const rowChips = filtered.slice(i, i + chipsPerRow);
                              rows.push(rowChips);
                            }
                            
                            return (
                              <div className="flex flex-col gap-1">
                                {rows.map((row, rowIdx) => (
                                  <div key={rowIdx} className="flex items-center justify-center">
                                    {row.map((p, idx) => {
                                      const m = members.find((mm) => mm.id === p.user_id);
                                      const letter = initials(m?.name ?? "?");
                                      // Check if this member has submitted
                                      const hasSubmitted = submittedMap.has(`${p.user_id}:${picksGw}`);
                                      // Show correct=true only when result exists AND pick matches result
                                      const isCorrect = actualResult && actualResult === want ? true : null;
                                      
                                      if (allPicked) {
                                        // Stack effect - use relative positioning with negative margins
                                        const overlapAmount = 8;
                                        return (
                                          <span 
                                            key={p.user_id}
                                            className="inline-block"
                                            style={{
                                              marginLeft: idx > 0 ? `-${overlapAmount}px` : '0',
                                              position: 'relative',
                                              zIndex: idx
                                            }}
                                          >
                                            <Chip letter={letter} correct={isCorrect} unicorn={false} hasSubmitted={hasSubmitted} isLive={isLive} isOngoing={isOngoing} isFinished={isFinished} />
                                          </span>
                                        );
                                      }
                                      
                                      return (
                                        <Chip key={p.user_id} letter={letter} correct={isCorrect} unicorn={false} hasSubmitted={hasSubmitted} isLive={isLive} isOngoing={isOngoing} isFinished={isFinished} />
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            );
                          };

                          const homeBadge = `/assets/badges/${homeCode.toUpperCase()}.png`;
                          const awayBadge = `/assets/badges/${awayCode.toUpperCase()}.png`;

                          return (
                            <li key={`${f.gw}-${f.fixture_index}`} className={idx > 0 ? "border-t" : ""}>
                              <div className="p-4 bg-white">
                                {/* Fixture display - same as Home Page */}
                                <div className="grid grid-cols-3 items-center">
                                  <div className="flex items-center justify-center">
                                    <span className="text-sm sm:text-base font-medium text-slate-900 truncate">{homeName}</span>
                                  </div>
                                  <div className="flex items-center justify-center gap-2">
                                    <img src={homeBadge} alt={`${homeName} badge`} className="h-6 w-6" />
                                    <div className="text-[15px] sm:text-base font-semibold text-slate-600">
                                      {timeStr}
                                    </div>
                                    <img src={awayBadge} alt={`${awayName} badge`} className="h-6 w-6" />
                                  </div>
                                  <div className="flex items-center justify-center">
                                    <span className="text-sm sm:text-base font-medium text-slate-900 truncate">{awayName}</span>
                                  </div>
                                </div>
                                
                                {/* Pips underneath - same as Home Page */}
                                <div className="mt-2 grid grid-cols-3">
                                  <div className="relative min-h-6">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                      {toChips("H")}
                                    </div>
                                  </div>
                                  <div className="relative min-h-6">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                      {toChips("D")}
                                    </div>
                                  </div>
                                  <div className="relative min-h-6">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                      {toChips("A")}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        } catch (error) {
                          console.error("Error rendering fixture:", error, f);
                          return (
                            <li key={`${f.gw}-${f.fixture_index}`} className="p-4 text-red-500">
                              Error loading fixture: {f.fixture_index}
                            </li>
                          );
                        }
                      })}
                      {!sec.items.length && (
                        <li className="p-4 text-slate-500">
                          No fixtures.
                        </li>
                      )}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}

        {!sections.length && !showSubmissionStatus && (
          <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-500">No fixtures for GW {picksGw}.</div>
        )}

      </div>
    );
  }

  function GwResultsTab() {
    const resGw = league?.name === 'API Test' ? 1 : selectedGw;
    
    if (!resGw || (availableGws.length === 0 && league?.name !== 'API Test')) {
      return <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-600">No game week selected.</div>;
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
    
    // For API Test league, ONLY use live scores (ignore database results)
    if (isApiTestLeague && resGw === 1) {
      // Check live scores for first 3 fixtures - count both live and finished fixtures
      const fixturesToCheck = fixtures;
      fixturesToCheck.forEach((f: any) => {
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
    } else {
      // Regular league - use results
      results.forEach((r) => {
        if (r.gw !== resGw) return;
        const out = rowToOutcome(r);
        if (!out) return;
        outcomes.set(r.fixture_index, out);
      });
    }

    type Row = { user_id: string; name: string; score: number; unicorns: number };
    const rows: Row[] = members.map((m) => ({ user_id: m.id, name: m.name, score: 0, unicorns: 0 }));

    const picksByFixture = new Map<number, PickRow[]>();
    picks.forEach((p) => {
      if (p.gw !== resGw) return;
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
    if (isApiTestLeague && resGw === 1) {
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
        allFixturesFinished = fixturesForGw.every(f => outcomes.has(f.fixture_index));
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
        
        {/* SP Wins Banner - only show when all fixtures have finished */}
        {rows.length > 0 && allFixturesFinished && (
          <div className="mt-4 mb-4 py-6 px-6 rounded-xl bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 shadow-2xl shadow-slate-600/50 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/30 after:to-transparent after:animate-[shimmer_2.5s_ease-in-out_infinite_0.6s]">
            <div className="text-center relative z-10">
              {rows[0].score === rows[1]?.score && rows[0].unicorns === rows[1]?.unicorns ? (
                <div className="text-lg font-bold text-white break-words whitespace-normal px-2 leading-normal">🤝 It's a Draw!</div>
              ) : (
                <div className="text-lg font-bold text-white break-words whitespace-normal px-2 leading-normal">{rows[0].name} Wins!</div>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div 
          className="overflow-y-auto overflow-x-hidden -mx-4 sm:mx-0 rounded-none sm:rounded-2xl border-x-0 sm:border-x border-b border-slate-200 bg-slate-50 shadow-sm"
          style={{ 
            backgroundColor: '#f8fafc'
          }}
        >
          <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed', backgroundColor: '#f8fafc' }}>
            <thead className="sticky top-0" style={{ 
              position: 'sticky', 
              top: 0, 
              zIndex: 25, 
              backgroundColor: '#f8fafc', 
              display: 'table-header-group'
            } as any}>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: 'none' }}>
                <th className="py-4 text-left font-normal" style={{ backgroundColor: '#f8fafc', width: '30px', paddingLeft: '0.75rem', paddingRight: '0.5rem', color: '#94a3b8' }}>#</th>
                <th className="py-4 text-left font-normal text-xs" style={{ backgroundColor: '#f8fafc', color: '#94a3b8', paddingLeft: '0.5rem', paddingRight: '1rem' }}>
                  <div className="flex items-center gap-2">
                    Player
                    {isApiTestLeague && hasLiveFixtures && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white shadow-md shadow-red-500/30">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-medium">
                          LIVE
                        </span>
                      </div>
                    )}
                    {isApiTestLeague && !allFixturesFinished && hasStartingSoonFixtures && !hasLiveFixtures && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-md shadow-amber-500/30">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[10px] font-medium">{hasStartedFixtures ? 'Next Game Starting Soon' : 'Starting soon'}</span>
                      </div>
                    )}
                  </div>
                </th>
                <th className="py-4 text-center font-normal" style={{ backgroundColor: '#f8fafc', width: '50px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8' }}>Score</th>
                {members.length >= 3 && <th className="py-4 text-center font-normal" style={{ backgroundColor: '#f8fafc', width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', color: '#94a3b8', fontSize: '1rem' }}>🦄</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isMe = r.user_id === user?.id;
                const isLastRow = i === rows.length - 1;
                const hasPositionChanged = positionChangeKeys.has(r.user_id);
                return (
                  <tr 
                    key={r.user_id} 
                    className={`${isMe ? 'flash-user-row' : ''} ${hasPositionChanged ? 'position-changed' : ''}`}
                    style={{
                      position: 'relative',
                      backgroundColor: '#f8fafc',
                      ...(isLastRow ? {} : { borderBottom: '1px solid #e2e8f0' })
                    }}
                  >
                    <td className="py-4 text-left tabular-nums whitespace-nowrap relative" style={{ 
                      paddingLeft: '0.75rem', 
                      paddingRight: '0.5rem',
                      backgroundColor: '#f8fafc',
                      width: '30px'
                    }}>
                      {i + 1}
                    </td>
                    <td className="py-4 truncate whitespace-nowrap" style={{ backgroundColor: '#f8fafc', paddingLeft: '0.5rem', paddingRight: '1rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <div className="flex items-center gap-2">
                        {isApiTestLeague && hasLiveFixtures && (
                          <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse flex-shrink-0" style={{ minWidth: '8px', minHeight: '8px' }}></div>
                        )}
                        {isApiTestLeague && !hasLiveFixtures && hasStartingSoonFixtures && (
                          <svg className="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        <span>{r.name}</span>
                      </div>
                    </td>
                    <td className={`py-4 text-center tabular-nums font-bold ${isApiTestLeague && hasLiveFixtures ? 'pulse-live-score' : ''}`} style={{ width: '50px', paddingLeft: '0.25rem', paddingRight: '0.25rem', backgroundColor: '#f8fafc', color: '#1C8376' }}>{r.score}</td>
                    {members.length >= 3 && <td className={`py-4 text-center tabular-nums ${isApiTestLeague && hasLiveFixtures ? 'pulse-live-score' : ''}`} style={{ width: '35px', paddingLeft: '0.25rem', paddingRight: '0.25rem', backgroundColor: '#f8fafc' }}>{r.unicorns}</td>}
                </tr>
                );
              })}
              {!rows.length && (
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <td className="px-4 py-6 text-slate-500 text-center" colSpan={members.length >= 3 ? 4 : 3} style={{ backgroundColor: '#f8fafc' }}>
                    No results recorded for GW {resGw} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* GW Selector and Rules Button */}
        {availableGws.length > 1 && (
          <div className="mt-6 mb-4 flex flex-col items-center gap-3 px-4">
            <div className="flex items-center justify-center gap-3 w-full max-w-sm">
              <div className="flex-1">
                <select
                  value={resGw}
                  onChange={(e) => setSelectedGw(parseInt(e.target.value, 10))}
                  className="gw-selector w-full bg-white rounded-full border-2 border-slate-300 px-3 py-2 text-xs font-normal text-slate-600 text-center focus:outline-none focus:ring-2 focus:ring-[#1C8376] focus:border-[#1C8376] active:bg-slate-50 transition-colors"
                  style={{
                    fontSize: '12px',
                    minHeight: '40px', // Smaller
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
                    backgroundSize: '1em 1em',
                    paddingRight: '2.5rem'
                  }}
                >
                  {availableGws.map((gw) => (
                    <option key={gw} value={gw} style={{ fontSize: '12px', padding: '0.5rem', fontWeight: 'normal', color: '#64748b', textTransform: 'uppercase' }}>
                      GAME WEEK {gw}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setShowScoringModal(true)}
                className="flex items-center justify-center gap-1.5 bg-white border-2 border-slate-300 hover:bg-slate-50 rounded-full text-slate-600 hover:text-slate-800 cursor-help transition-colors flex-shrink-0 px-3 py-2"
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
        {showScoringModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowScoringModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 relative" onClick={(e) => e.stopPropagation()}>
              {/* Close button */}
              <button
                onClick={() => setShowScoringModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Modal content */}
              <div className="p-6 pt-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Weekly Winner</h2>
                
                <div className="space-y-4">
                  <div className="bg-[#1C8376]/10 border border-[#1C8376]/20 rounded-lg p-4">
                    <h3 className="font-semibold text-[#1C8376]/90 mb-3">🏆 How to Win the Week:</h3>
                    <p className="text-[#1C8376]/80">
                      The player with the <strong>most correct predictions</strong> wins that gameweek.
                    </p>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h3 className="font-semibold text-purple-800 mb-2">🦄 Unicorn Rule</h3>
                    <p className="text-purple-700">
                      In Mini-Leagues with <strong>3 or more players</strong>, if you're the <strong>only person</strong> to correctly predict a
                      fixture, that's a <strong>🦄 Unicorn</strong>. In ties, the player with most <strong>🦄 Unicorns</strong> wins!
                    </p>
                  </div>
                </div>
              </div>
            </div>
        </div>
      )}

    </div>
  );
}

  // Scroll to top when tab changes - MUST be before any conditional returns
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [tab]);

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
    }}>
      <style>{`
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
          overscroll-behavior: contain;
          padding-bottom: 2rem;
          padding-left: 1rem;
          padding-right: 1rem;
        }
        .league-content-wrapper.has-banner {
          top: calc(3.5rem + 3rem + 3.5rem + env(safe-area-inset-top, 0px) + 0.5rem);
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
          pointer-events: none;
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
      <div className="league-header-fixed bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          {/* Compact header bar */}
          <div className="flex items-center justify-between h-14">
            {/* Back button */}
            <Link 
              to="/leagues" 
              className="flex items-center text-slate-600 hover:text-slate-900 transition-colors -ml-2 px-2 py-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>

            {/* Title */}
            <h1 className="text-lg font-normal text-slate-900 truncate flex-1 text-left px-2">
              {league.name}
            </h1>
            
            {/* Menu button */}
            <div className="relative" style={{ zIndex: 100 }}>
              <button
                onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100 transition-colors -mr-2"
                aria-label="Menu"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
                    </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 bg-white">
            <button
              onClick={() => {
                manualTabSelectedRef.current = true; // Mark as manually selected (synchronous)
                setInitialTabSet(true); // Prevent auto-switch from interfering
                setTab("chat");
              }}
              className={
                "flex-1 px-3 sm:px-6 py-3 text-sm font-semibold transition-colors relative " +
                (tab === "chat" ? "text-[#1C8376]" : "text-slate-400")
              }
            >
              Chat
              {tab === "chat" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C8376]" />
              )}
            </button>
            {/* Show GW Results tab if there are any results available (or if it's API Test league) */}
            {(availableGws.length > 0 || league?.name === 'API Test') && (
              <button
                onClick={() => {
                  manualTabSelectedRef.current = true; // Mark as manually selected (synchronous)
                  setInitialTabSet(true); // Prevent auto-switch from interfering
                  setTab("gwr");
                }}
                className={
                  "flex-1 px-2 sm:px-4 py-3 text-xs font-semibold transition-colors relative leading-tight flex items-center justify-center gap-1.5 " +
                  (tab === "gwr" ? "text-[#1C8376]" : "text-slate-400")
                }
              >
                {(() => {
                  const resGw = league?.name === 'API Test' ? 1 : (selectedGw || currentGw);
                  // Check if GW is live: first game started AND last game not finished
                  const now = new Date();
                  const firstFixture = fixtures[0];
                  const firstKickoff = firstFixture?.kickoff_time ? new Date(firstFixture.kickoff_time) : null;
                  const firstGameStarted = firstKickoff && firstKickoff <= now;
                  
                  const lastFixture = fixtures[fixtures.length - 1];
                  const lastFixtureIndex = lastFixture?.fixture_index;
                  const lastFixtureScore = lastFixtureIndex !== undefined ? liveScores[lastFixtureIndex] : null;
                  const lastGameFinished = lastFixtureScore?.status === 'FINISHED';
                  
                  const isGwLive = firstGameStarted && !lastGameFinished;
                  const label = isGwLive ? 'Live Table' : 'Results';
                  
                  return (
                    <>
                      {isGwLive && (
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0"></div>
                      )}
                      <span className="hidden sm:inline">
                        {resGw ? `GW ${resGw} ${label}` : `GW ${label}`}
                      </span>
                      <span className="sm:hidden whitespace-pre-line text-center">
                        {resGw ? `GW${resGw}\n${label}` : `GW\n${label}`}
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
                  setInitialTabSet(true); // Prevent auto-switch from interfering
                  setTab("gw");
                }}
                className={
                  "flex-1 px-2 sm:px-4 py-3 text-xs font-semibold transition-colors relative leading-tight " +
                  (tab === "gw" ? "text-[#1C8376]" : "text-slate-400")
                }
              >
                <span className="hidden sm:inline">{league?.name === 'API Test' ? 'GW 1 Predictions' : (currentGw ? `GW ${currentGw} Predictions` : "GW Predictions")}</span>
                <span className="sm:hidden whitespace-pre-line">{league?.name === 'API Test' ? 'GW1\nPredictions' : (currentGw ? `GW${currentGw}\nPredictions` : "GW\nPredictions")}</span>
                {tab === "gw" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C8376]" />
                )}
              </button>
            )}
            <button
              onClick={() => {
                manualTabSelectedRef.current = true; // Mark as manually selected (synchronous)
                setInitialTabSet(true); // Prevent auto-switch from interfering
                setTab("mlt");
              }}
              className={
                "flex-1 px-3 sm:px-6 py-3 text-sm font-semibold transition-colors relative " +
                (tab === "mlt" ? "text-[#1C8376]" : "text-slate-400")
              }
            >
              Table
              {tab === "mlt" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C8376]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Menu Portal - render at body level to ensure it's always on top */}
      {showHeaderMenu && typeof document !== 'undefined' && document.body && createPortal(
        <>
          {/* Backdrop - transparent overlay to close menu on outside click */}
          <div 
            className="fixed inset-0" 
            onClick={() => setShowHeaderMenu(false)}
            style={{ backgroundColor: 'transparent', zIndex: 99998 }}
          />
          {/* Menu - positioned fixed to appear above everything */}
          <div 
            className="fixed w-56 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden" 
            style={{ 
              zIndex: 99999, 
              top: 'calc(3.5rem + 0.5rem + env(safe-area-inset-top, 0px))',
              right: '1rem',
            }}
          >
            {isAdmin && (
              <>
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="text-xs text-slate-600 mb-1">Admin:</div>
                  <div className="text-sm font-semibold text-slate-800">{adminName}</div>
        </div>
                <button
                  onClick={() => {
                    setShowAdminMenu(true);
                    setShowHeaderMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100"
                >
                  ⚙️ Manage
                </button>
                <button
                  onClick={() => {
                    setShowAvatarUpload(true);
                    setShowHeaderMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100"
                >
                  🖼️ Upload avatar
                </button>
              </>
            )}
                      <button
              onClick={() => {
                setShowInvite(true);
                setShowHeaderMenu(false);
              }}
              className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100"
            >
              ➕ Invite players
                      </button>
            <button
              onClick={() => {
                shareLeague();
                setShowHeaderMenu(false);
              }}
              className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100"
            >
              Share league code
            </button>
                <button
              onClick={() => {
                setShowLeaveConfirm(true);
                setShowHeaderMenu(false);
              }}
              className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Leave
                </button>
              </div>
        </>,
        document.body
      )}

      {tab === "chat" ? (
        <div className="chat-tab-wrapper">
          <ChatTab
            chat={chat}
            userId={user?.id}
            nameById={memberNameById}
            isMember={isMember}
            newMsg={newMsg}
            setNewMsg={setNewMsg}
            onSend={sendChat}
            leagueCode={league?.code}
            memberCount={members.length}
            maxMembers={MAX_MEMBERS}
            notificationStatus={notificationStatus}
          />
            </div>
      ) : (
        <div className="league-content-wrapper">
          <div className="px-1 sm:px-2">
            {tab === "mlt" && <MltTab />}
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
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal content */}
            <div className="p-6 pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">League Management</h2>
              
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
                            className="px-3 py-1.5 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors font-medium"
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
                    className="w-full px-4 py-3 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    🗑️ End League
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Upload Modal */}
      {isAdmin && showAvatarUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAvatarUpload(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 relative" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => {
                setShowAvatarUpload(false);
                setAvatarUploadError(null);
                setAvatarUploadSuccess(false);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal content */}
            <div className="p-6 pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload League Avatar</h2>
              
              {/* Current avatar preview */}
              <div className="mb-6">
                <div className="text-sm text-slate-600 mb-2 font-medium">Current Avatar:</div>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
                    <img
                      src={league ? getLeagueAvatarUrl(league) : '/assets/league-avatars/ML-avatar-1.png'}
                      alt="League avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/assets/league-avatars/ML-avatar-1.png';
                      }}
                    />
                  </div>
                  {league?.avatar && (
                    <button
                      onClick={handleRemoveAvatar}
                      disabled={uploadingAvatar}
                      className="px-3 py-1.5 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors font-medium disabled:opacity-50"
                    >
                      Remove Avatar
                    </button>
                  )}
                </div>
              </div>

              {/* Upload section */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Upload New Avatar
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleAvatarUpload(file);
                      }
                    }}
                    disabled={uploadingAvatar}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#1C8376] file:text-white hover:file:bg-emerald-700 file:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Images will be automatically compressed to ~60KB and resized to 256x256px. Max file size: 2MB before compression.
                  </p>
                </div>

                {/* Upload progress */}
                {uploadingAvatar && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1C8376]"></div>
                    <span>Processing and uploading...</span>
                  </div>
                )}

                {/* Success message */}
                {avatarUploadSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    ✓ Avatar uploaded successfully!
                  </div>
                )}

                {/* Error message */}
                {avatarUploadError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    {avatarUploadError}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowTableModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 relative" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setShowTableModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal content */}
            <div className="p-6 pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">League Points</h2>
              
              <div className="space-y-4">
                <div className="bg-[#1C8376]/10 border border-[#1C8376]/20 rounded-lg p-4">
                  <h3 className="font-semibold text-[#1C8376]/90 mb-3">League Points:</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[#1C8376] font-bold">■</span>
                      <span className="text-[#1C8376]/80"><strong>Win the week</strong> – 3 points</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[#1C8376] font-bold">■</span>
                      <span className="text-[#1C8376]/80"><strong>Draw</strong> – 1 point</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[#1C8376] font-bold">■</span>
                      <span className="text-[#1C8376]/80"><strong>Lose</strong> – 0 points</span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 mb-2">🤝 Ties</h3>
                  <p className="text-blue-700">
                    If two or more players are tied on Points, the player with the most overall <strong>🦄 Unicorns</strong> in the mini league is ranked higher.
                  </p>
                </div>
              </div>
              
              {/* Late starting league explanation */}
              {league && (['The Bird league'].includes(league.name) || ['gregVjofVcarl', 'Let Down'].includes(league.name)) && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-700 text-sm">
                    <strong>Note:</strong> This mini league started after GW1, so the "CP" column shows correct predictions since this mini league began.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Invite players</h3>
            <p className="text-slate-600 text-sm">Share this code (up to {MAX_MEMBERS} members):</p>
            <div className="mt-3 flex items-center gap-2">
              <code className="font-mono text-lg font-bold">{league.code}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(league.code);
                }}
                className="px-3 py-1.5 border rounded-md text-sm hover:bg-slate-50"
              >
                Copy
              </button>
              <button onClick={shareLeague} className="px-3 py-1.5 border rounded-md text-sm hover:bg-slate-50">
                Share
              </button>
            </div>
            <div className="mt-3 text-xs text-slate-500">{members.length}/{MAX_MEMBERS} members</div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowInvite(false)} className="px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                disabled={leaving}
              >
                Cancel
              </button>
              <button
                onClick={leaveLeague}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
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
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                disabled={joining}
              >
                Cancel
              </button>
              <button
                onClick={joinLeague}
                className="flex-1 px-4 py-2 bg-[#1C8376] text-white rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
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
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                disabled={removing}
              >
                Cancel
              </button>
              <button
                onClick={removeMember}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
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
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                disabled={ending}
              >
                Cancel
              </button>
              <button
                onClick={endLeague}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
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

    </div>
  );
}
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const MAX_MEMBERS = 8;

// Helper function to determine league start GW based on creation date and current GW deadline
async function getLeagueStartGw(league: any, currentGw: number): Promise<number> {
  const specialLeagues = ['Prem Predictions', 'FC Football', 'Easy League'];
  const gw7StartLeagues = ['The Bird league'];
  const gw8StartLeagues = ['gregVjofVcarl', 'Let Down'];
  
  if (specialLeagues.includes(league?.name || '')) {
    return 0; // Show all results from GW0
  } else if (gw7StartLeagues.includes(league?.name || '')) {
    return 7; // Only show from GW7 onwards
  } else if (gw8StartLeagues.includes(league?.name || '')) {
    return 8; // Only show from GW8 onwards
  } else {
    // For new leagues: check if created before the most recent completed GW deadline
    if (league?.created_at && currentGw) {
      // Find the most recent GW that has results (completed GW)
      const { data: resultsData } = await supabase
        .from("gw_results")
        .select("gw")
        .order("gw", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const latestCompletedGw = resultsData?.gw;
      
      if (latestCompletedGw) {
        // Get the deadline for the most recent completed GW
        const { data: firstFixture } = await supabase
          .from("fixtures")
          .select("kickoff_time")
          .eq("gw", latestCompletedGw)
          .order("kickoff_time", { ascending: true })
          .limit(1)
          .maybeSingle();
        
        if (firstFixture?.kickoff_time) {
          const firstKickoff = new Date(firstFixture.kickoff_time);
          const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000)); // 75 minutes before
          const leagueCreatedAt = new Date(league.created_at);
          
          
          if (leagueCreatedAt <= deadlineTime) {
            return latestCompletedGw; // Created before deadline - include completed GW
          } else {
            return latestCompletedGw + 1; // Created after deadline - start from next GW
          }
        } else {
          return currentGw; // No fixtures for completed GW - start from current
        }
      } else {
        return currentGw; // No completed GWs - start from current
      }
    } else {
      return currentGw; // Fallback - start from current GW
    }
  }
}

// Helper function to check if a specific GW should be shown for a league (synchronous)
function shouldShowGwForLeague(league: any, gw: number, gwDeadlines: Map<number, Date>): boolean {
  const specialLeagues = ['Prem Predictions', 'FC Football', 'Easy League'];
  const gw7StartLeagues = ['The Bird league'];
  const gw8StartLeagues = ['gregVjofVcarl', 'Let Down'];
  
  if (specialLeagues.includes(league?.name || '')) {
    return true; // Show all GWs
  } else if (gw7StartLeagues.includes(league?.name || '')) {
    return gw >= 7; // Only show from GW7 onwards
  } else if (gw8StartLeagues.includes(league?.name || '')) {
    return gw >= 8; // Only show from GW8 onwards
  } else {
    // For new leagues: check if league was created before the GW deadline
    if (league?.created_at && gwDeadlines.has(gw)) {
      const leagueCreatedAt = new Date(league.created_at);
      const gwDeadline = gwDeadlines.get(gw)!;
      
      // If league was created before GW deadline, show the GW
      return leagueCreatedAt <= gwDeadline;
    }
    
    // If no deadline info available, default to showing GW
    return true;
  }
}

/* =========================
   Types
   ========================= */
type League = { id: string; name: string; code: string; created_at?: string; created_by?: string };
type Member = { id: string; name: string };

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
}: {
  letter: string;
  correct: boolean | null;
  unicorn: boolean;
}) {
  const tone =
    correct === null
      ? "bg-slate-100 text-slate-600 border-slate-200"
      : correct
      ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl shadow-yellow-400/40 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s] ring-2 ring-yellow-300/60"
      : "bg-slate-50 text-slate-400 border-slate-200";

  return (
    <span
      className={[
        "inline-flex items-center justify-center h-5 min-w-[18px] px-1.5",
        "rounded-full border text-[11px] font-semibold mb-0.5",
        "align-middle",
        tone,
      ].join(" ")}
      title={unicorn ? "Correct!" : undefined}
    >
      {letter}
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
};

function ChatTab({ chat, userId, nameById, isMember, newMsg, setNewMsg, onSend }: ChatTabProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on mount and whenever chat grows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length]);

  return (
    <div className="mt-4">
      <div className="flex flex-col h-[30vh]">
        <div ref={listRef} className="flex-1 overflow-y-auto rounded-xl border bg-white shadow-sm p-3">
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
          <div ref={bottomRef} />
        </div>

        <div className="mt-3">
          {isMember ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSend();
              }}
              className="flex gap-2"
            >
              <input
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                placeholder="Message your league…"
                maxLength={2000}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#1C8376] text-white font-semibold rounded-md disabled:opacity-50"
                disabled={!newMsg.trim()}
              >
                Send
              </button>
            </form>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 p-3 text-sm">
              Join this league to chat with other members.
            </div>
          )}
        </div>
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

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // tabs: Chat / Mini League Table / GW Picks / GW Results
  const [tab, setTab] = useState<"chat" | "mlt" | "gw" | "gwr">("gwr");

  const [showForm, setShowForm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [currentGw, setCurrentGw] = useState<number | null>(null);
  const [latestResultsGw, setLatestResultsGw] = useState<number | null>(null);
  const [selectedGw, setSelectedGw] = useState<number | null>(null);
  const [availableGws, setAvailableGws] = useState<number[]>([]);
  const [showGwDropdown, setShowGwDropdown] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showScoringModal, setShowScoringModal] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [showJoinConfirm, setShowJoinConfirm] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showEndLeagueConfirm, setShowEndLeagueConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [ending, setEnding] = useState(false);
  const [firstMember, setFirstMember] = useState<Member | null>(null);

  /* ----- Chat state ----- */
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [newMsg, setNewMsg] = useState("");
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
      
      // Get deadlines for completed GWs (GWs that have results)
      for (const gw of availableGws) {
        const { data: firstFixture } = await supabase
          .from("fixtures")
          .select("kickoff_time")
          .eq("gw", gw)
          .order("kickoff_time", { ascending: true })
          .limit(1)
          .maybeSingle();
        
        if (firstFixture?.kickoff_time) {
          const firstKickoff = new Date(firstFixture.kickoff_time);
          const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000)); // 75 minutes before
          deadlines.set(gw, deadlineTime);
        }
      }
      
      setGwDeadlines(deadlines);
    })();
  }, [availableGws]);

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

  /* ---------- realtime chat: load + subscribe ---------- */
  useEffect(() => {
    if (!league?.id) return;
    let alive = true;

    (async () => {
      const { data, error } = await supabase
        .from("league_messages")
        .select("id, league_id, user_id, content, created_at")
        .eq("league_id", league.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!alive) return;
      if (!error) setChat((data as ChatMsg[]) ?? []);
    })();

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
          setChat((prev) => [...prev, payload.new as ChatMsg]);
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [league?.id]);

  /* ---------- mark-as-read when viewing Chat ---------- */
  useEffect(() => {
    if (tab !== "chat" || !league?.id || !user?.id) return;
    const mark = async () => {
      await supabase
        .from("league_message_reads")
        .upsert(
          { league_id: league.id, user_id: user.id, last_read_at: new Date().toISOString() },
          { onConflict: "league_id,user_id" }
        );
    };
    mark();
  }, [tab, league?.id, user?.id, chat.length]);

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
  async function sendChat() {
    if (!league || !user?.id) return;
    const text = newMsg.trim();
    if (!text) return;
    setNewMsg("");
    const { error } = await supabase.from("league_messages").insert({
      league_id: league.id,
      user_id: user.id,
      content: text,
    });
    if (error) {
      console.error(error);
      alert("Failed to send message.");
    }
  }

  /* ---------- load fixtures + picks + submissions + results for selected GW ---------- */
  useEffect(() => {
    let alive = true;

    (async () => {
      const gwForData = tab === "gwr" ? selectedGw : tab === "gw" ? currentGw : currentGw;
      if (!gwForData) {
        setFixtures([]);
        setPicks([]);
        setSubs([]);
        setResults([]);
        return;
      }
      const { data: fx } = await supabase
        .from("fixtures")
        .select(
          "id,gw,fixture_index,home_team,away_team,home_code,away_code,home_name,away_name,kickoff_time"
        )
        .eq("gw", gwForData)
        .order("fixture_index", { ascending: true });

      if (!alive) return;
      setFixtures((fx as Fixture[]) ?? []);

      if (!memberIds.length) {
        setPicks([]);
        setSubs([]);
        setResults([]);
        return;
      }

      const { data: pk } = await supabase
        .from("picks")
        .select("user_id,gw,fixture_index,pick")
        .eq("gw", gwForData)
        .in("user_id", memberIds);
      if (!alive) return;
      setPicks((pk as PickRow[]) ?? []);

      // Check submissions by looking at picks table - user has submitted if they have picks for all fixtures
      const { data: fixtures } = await supabase
        .from("fixtures")
        .select("fixture_index")
        .eq("gw", gwForData);
      
      if (fixtures && fixtures.length > 0) {
        const { data: picks } = await supabase
          .from("picks")
          .select("user_id")
          .eq("gw", gwForData)
          .in("user_id", memberIds);
        
        if (!alive) return;
        
        // Create submission records for users who have picks for all fixtures
        const submissions: SubmissionRow[] = [];
        const totalFixtures = fixtures.length;
        
        // Group picks by user_id and count them
        const picksByUser = new Map<string, number>();
        picks?.forEach(pick => {
          const count = picksByUser.get(pick.user_id) || 0;
          picksByUser.set(pick.user_id, count + 1);
        });
        
        // Create submission record for users who have picks for all fixtures
        picksByUser.forEach((pickCount, userId) => {
          if (pickCount === totalFixtures) {
            submissions.push({
              user_id: userId,
              gw: gwForData,
              submitted_at: new Date().toISOString()
            });
          }
        });
        
        setSubs(submissions);
      } else {
        setSubs([]);
      }

      const { data: rs } = await supabase.from("gw_results").select("gw,fixture_index,result");
      if (!alive) return;
      setResults((rs as ResultRowRaw[]) ?? []);
    })();

    return () => {
      alive = false;
    };
  }, [tab, currentGw, latestResultsGw, selectedGw, memberIds]);

  const submittedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    subs.forEach((s) => m.set(`${s.user_id}:${s.gw}`, true));
    return m;
  }, [subs]);

  /* ---------- Compute Mini League Table (season) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!members.length) {
        setMltRows([]);
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
        setMltRows(
          members.map((m) => ({
            user_id: m.id,
            name: m.name,
            mltPts: 0,
            ocp: 0,
            unicorns: 0,
            wins: 0,
            draws: 0,
            form: [],
          }))
        );
        setMltLoading(false);
        return;
      }

      const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort(
        (a, b) => a - b
      );

      // Filter gameweeks to only include those from the league's start_gw onwards
      // Special leagues that should include all historical data (start from GW0)
      const specialLeagues = ['Prem Predictions', 'FC Football', 'Easy League'];
      const gw7StartLeagues = ['The Bird league'];
      
      const leagueStartGw = await getLeagueStartGw(league, currentGw);
      const relevantGws = gwsWithResults.filter(gw => gw >= leagueStartGw);

      // For late-starting leagues, if there are no results for the start gameweek or later, show empty table
      if (!specialLeagues.includes(league?.name || '') && !gw7StartLeagues.includes(league?.name || '') && relevantGws.length === 0) {
        setMltRows(
          members.map((m) => ({
            user_id: m.id,
            name: m.name,
            mltPts: 0,
            ocp: 0,
            unicorns: 0,
            wins: 0,
            draws: 0,
            form: [],
          }))
        );
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
  }, [members, league, currentGw]);

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
      <div>
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <div className="min-w-full">
              <div className="grid grid-cols-[32px_80px_1fr] gap-0 bg-slate-50 text-xs font-semibold text-slate-600">
                <div className="px-2 py-3 text-left">#</div>
                <div className="px-2 py-3 text-left">PLAYER</div>
                {showForm ? (
                  <div className="px-2 py-3 text-left">FORM</div>
                ) : (
                  <div className="px-2 py-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-center font-semibold w-8">W</span>
                      <span className="text-center font-semibold w-8">D</span>
                      <span className="text-center font-semibold w-10">{isLateStartingLeague ? 'CP' : 'OCP'}</span>
                      {members.length >= 3 && <span className="text-center font-semibold w-8">🦄</span>}
                      <span className="text-center font-semibold w-10 pr-2">PTS</span>
                    </div>
                  </div>
                )}
              </div>

              {rows.map((r, i) => (
                <div key={r.user_id} className="grid grid-cols-[32px_80px_1fr] gap-0 border-t border-slate-200 text-sm">
                  <div className="px-2 py-3 font-semibold text-slate-600">{i + 1}</div>
                  <div className="px-2 py-3 font-bold text-slate-900 truncate text-xs">{r.name}</div>
                  <div className="px-2 py-3">
                    {showForm ? (
                      renderForm(r.form)
                    ) : (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-center font-semibold w-8">{r.wins}</span>
                        <span className="text-center font-semibold w-8">{r.draws}</span>
                        <span className="text-center font-semibold w-10">{r.ocp}</span>
                        {members.length >= 3 && <span className="text-center font-semibold w-8">{r.unicorns}</span>}
                        <span className="text-center font-bold text-[#1C8376] w-10 pr-2">{r.mltPts}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {mltLoading && <div className="p-3 text-slate-500 text-xs sm:text-sm">Calculating…</div>}
          {!mltLoading && !mltRows.length && (
            <div className="p-3 text-slate-500 text-xs sm:text-sm">No gameweeks completed yet — this will populate after the first results are saved.</div>
          )}
        </div>

        <div className="mt-3 flex justify-between items-center">
          <div className="flex items-center justify-between w-full">
            <div className="inline-flex rounded-lg bg-slate-100 p-1 shadow-sm">
              <button
                onClick={() => setShowForm(false)}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                  !showForm ? "bg-[#1C8376] text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                Points
              </button>
              <button
                onClick={() => setShowForm(true)}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-600 hover:text-slate-800 cursor-help transition-colors"
            >
              <span className="text-sm">📖</span>
              <span className="text-sm">Rules</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  function GwPicksTab() {
    const picksGw = currentGw;
    if (!picksGw) {
      return <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-600">No current game week available.</div>;
    }

    // Check if this specific GW should be shown for this league
    if (!shouldShowGwForLeague(league, picksGw, gwDeadlines)) {
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

    const picksByFixture = new Map<number, PickRow[]>();
    picks.forEach((p) => {
      if (p.gw !== picksGw) return;
      const arr = picksByFixture.get(p.fixture_index) ?? [];
      arr.push(p);
      picksByFixture.set(p.fixture_index, arr);
    });

    const allSubmitted = members.length > 0 && members.every((m) => submittedMap.get(`${m.id}:${picksGw}`));
    const resultsPublished = latestResultsGw !== null && latestResultsGw >= picksGw;
    const remaining = members.filter((m) => !submittedMap.get(`${m.id}:${picksGw}`)).length;

    return (
      <div className="mt-4">
        <div className="flex items-center gap-4 text-sm mb-4">
          <div className="text-slate-900 font-bold text-xl">Game Week {picksGw}</div>
          {allSubmitted && resultsPublished ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#1C8376]/10 text-[#1C8376]/90 text-sm font-bold border border-emerald-300 shadow-sm">
              Round Complete!
            </span>
          ) : allSubmitted ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-bold border border-blue-300 shadow-sm">
              All Submitted
            </span>
          ) : (
            <span className="text-slate-500">not all submitted</span>
          )}
        </div>

        {!allSubmitted ? (
          <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-700">
            <div className="mb-3 flex items-center justify-between">
              <div>
                Waiting for <span className="font-semibold">{remaining}</span> of {members.length} to submit.
              </div>
              {/* Share reminder button */}
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
            </div>

            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
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
                      const submitted = !!submittedMap.get(`${m.id}:${picksGw}`);
                      return (
                        <tr key={m.id} className="border-t border-slate-200">
                          <td className="px-4 py-3 font-bold text-slate-900">{m.name}</td>
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
        ) : (
          <div className="mt-3 space-y-6">
            {sections.map((sec, si) => (
              <div key={si}>
                <div className="text-slate-700 font-semibold text-lg mb-3">{sec.label}</div>
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
                                      const isCorrect = actualResult ? actualResult === want : null;
                                      
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
                                            <Chip letter={letter} correct={isCorrect} unicorn={isCorrect === true} />
                                          </span>
                                        );
                                      }
                                      
                                      return (
                                        <Chip key={p.user_id} letter={letter} correct={isCorrect} unicorn={isCorrect === true} />
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
            {!sections.length && <div className="rounded-2xl border bg-white shadow-sm p-4 text-slate-500">No fixtures for GW {picksGw}.</div>}
          </div>
        )}

      </div>
    );
  }

  function GwResultsTab() {
    const resGw = selectedGw;
    
    if (!resGw) return <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-600">No game week selected.</div>;

    // Check if this specific GW should be shown for this league
    if (!shouldShowGwForLeague(league, resGw, gwDeadlines)) {
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
    results.forEach((r) => {
      if (r.gw !== resGw) return;
      const out = rowToOutcome(r);
      if (!out) return;
      outcomes.set(r.fixture_index, out);
    });

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

    return (
      <div className="mt-4">
        <div className="text-slate-900 font-bold text-xl mb-4">Game Week {resGw}</div>

        {rows.length > 0 && (
          <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 shadow-2xl shadow-slate-600/50 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/30 after:to-transparent after:animate-[shimmer_2.5s_ease-in-out_infinite_0.6s]">
            <div className="text-center relative z-10">
              {rows[0].score === rows[1]?.score && rows[0].unicorns === rows[1]?.unicorns ? (
                <div className="text-lg font-bold text-white">🤝 It's a Draw!</div>
              ) : (
                <div className="text-lg font-bold text-white">🏆 {rows[0].name} Wins!</div>
              )}
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Player</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Score</th>
                {members.length >= 3 && <th className="text-center px-4 py-3 font-semibold text-slate-600 text-lg">🦄</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-bold text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 text-center font-semibold text-[#1C8376]">{r.score}</td>
                  {members.length >= 3 && <td className="px-4 py-3 text-center font-semibold">{r.unicorns}</td>}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className="px-4 py-6 text-slate-500 text-center" colSpan={members.length >= 3 ? 3 : 2}>
                    No results recorded for GW {resGw} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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

  /* ---------- page chrome ---------- */
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-slate-500">Loading…</div>
      </div>
    );
  }

  if (!league) {
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

  return (
    <div className={`min-h-screen ${oldSchoolMode ? 'oldschool-theme' : 'bg-slate-50'}`}>
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-6">
        {/* Header with back link */}
        <div className="mb-6">
          <Link to="/leagues" className="inline-flex items-center text-slate-500 hover:text-slate-700 text-sm mb-3">
            ← Back to Mini Leagues
          </Link>

          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mt-0 mb-6">
              {league.name}
            </h1>

            <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap mb-6">
              <button
                onClick={() => setShowInvite(true)}
                className="px-2 sm:px-3 py-1.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors text-xs sm:text-sm font-medium"
                title="Invite players"
              >
                ➕ <span className="hidden sm:inline">Invite</span>
              </button>
              <button
                onClick={shareLeague}
                className="px-2 sm:px-3 py-1.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors text-xs sm:text-sm font-medium"
                title="Share league code"
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                  />
                </svg>
                <span className="hidden sm:inline">Share</span>
              </button>
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="px-2 sm:px-3 py-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors text-xs sm:text-sm font-medium"
                title="Leave league"
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Leave</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6">
          <div className="flex rounded-lg bg-slate-100 p-1 shadow-sm gap-1">
            <button
              onClick={() => setTab("chat")}
              className={
                "flex-1 px-3 sm:px-6 py-3 rounded-md text-sm font-semibold transition-colors " +
                (tab === "chat" ? "bg-[#1C8376] text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white/50")
              }
            >
              Chat
            </button>
            {/* Show GW Results tab if there are any results available */}
            {availableGws.length > 0 && (
              <button
                onClick={() => setTab("gwr")}
                className={
                  "flex-1 px-2 sm:px-4 py-3 rounded-md text-xs font-semibold transition-colors leading-tight " +
                  (tab === "gwr" ? "bg-[#1C8376] text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white/50")
                }
              >
                <span className="hidden sm:inline">{selectedGw ? `GW ${selectedGw} Results` : (currentGw ? `GW ${currentGw} Results` : "GW Results")}</span>
                <span className="sm:hidden whitespace-pre-line">{selectedGw ? `GW${selectedGw}\nResults` : (currentGw ? `GW${currentGw}\nResults` : "GW\nResults")}</span>
              </button>
            )}
            {/* Show GW Predictions tab if there's a current GW */}
            {currentGw && (
              <button
                onClick={() => setTab("gw")}
                className={
                  "flex-1 px-2 sm:px-4 py-3 rounded-md text-xs font-semibold transition-colors leading-tight " +
                  (tab === "gw" ? "bg-[#1C8376] text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white/50")
                }
              >
                <span className="hidden sm:inline">{currentGw ? `GW ${currentGw} Predictions` : "GW Predictions"}</span>
                <span className="sm:hidden whitespace-pre-line">{currentGw ? `GW${currentGw}\nPredictions` : "GW\nPredictions"}</span>
              </button>
            )}
            <button
              onClick={() => setTab("mlt")}
              className={
                "flex-1 px-3 sm:px-6 py-3 rounded-md text-sm font-semibold transition-colors " +
                (tab === "mlt" ? "bg-[#1C8376] text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white/50")
              }
            >
              Table
            </button>
          </div>
        </div>

        <div className="mt-6">
          {tab === "chat" && (
            <ChatTab
              chat={chat}
              userId={user?.id}
              nameById={memberNameById}
              isMember={isMember}
              newMsg={newMsg}
              setNewMsg={setNewMsg}
              onSend={sendChat}
            />
          )}
          {tab === "mlt" && <MltTab />}
          {tab === "gw" && <GwPicksTab />}
          {tab === "gwr" && <GwResultsTab />}
        </div>


        {/* Game Week Switcher for Results */}
        {tab === "gwr" && availableGws.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 px-4 py-2 shadow-sm">
              <span className="text-sm font-medium text-slate-600">Game Week:</span>
              <div className="relative gw-dropdown-container">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowGwDropdown(!showGwDropdown);
                  }}
                  className="text-sm font-semibold text-slate-900 bg-transparent border-none outline-none cursor-pointer py-1 px-2 min-w-[100px] text-left flex items-center justify-between"
                >
                  {selectedGw ? `GW ${selectedGw}` : "Select GW"}
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showGwDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[140px]">
                    {availableGws.map((gw) => (
                      <button
                        key={gw}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGw(gw);
                          setShowGwDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-base font-medium hover:bg-slate-50 transition-colors ${
                          selectedGw === gw ? "bg-blue-50 text-blue-700" : "text-slate-900"
                        }`}
                      >
                        GW {gw}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Rules Button */}
            <button
              onClick={() => setShowScoringModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-600 hover:text-slate-800 cursor-help transition-colors"
            >
              <span className="text-sm">📖</span>
              <span className="text-sm">Rules</span>
            </button>
          </div>
        )}

        {/* Code/Members and Admin Section - show on all tabs */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="text-sm text-slate-600">
            Code: <span className="font-mono font-semibold">{league.code}</span> · {members.length}/{MAX_MEMBERS} member{members.length === 1 ? "" : "s"}
          </div>
          {isAdmin && (
            <div className="text-sm text-slate-600 flex justify-center items-center">
              Admin: <span className="font-semibold text-slate-800">{adminName}</span>
              <button
                onClick={() => setShowAdminMenu(!showAdminMenu)}
                className="ml-2 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                ⚙️ Manage
              </button>
            </div>
          )}
        </div>

      </div>

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

    </div>
  );
}
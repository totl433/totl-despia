import { useEffect, useMemo, useState } from"react";
import { Link, useParams } from"react-router-dom";
import { supabase } from"../lib/supabase";

/* ---------- local dev “auth” ---------- */
type LiteUser = { id: string; name: string };
const LS_USER ="totl:user";
function getOrInitUser(): LiteUser {
 try {
 const raw = localStorage.getItem(LS_USER);
 if (raw) return JSON.parse(raw);
 } catch {}
 const id =
 typeof crypto !=="undefined" &&"randomUUID" in crypto
 ? crypto.randomUUID()
 : `u_${Math.random().toString(36).slice(2)}${Date.now()}`;
 const u: LiteUser = { id, name:"" };
 localStorage.setItem(LS_USER, JSON.stringify(u));
 return u;
}

/* ---------- db types (loose for picks to tolerate any schema) ---------- */
type League = { id: string; name: string; code: string; created_at: string };
type MemberRow = { users: { id: string; name: string | null } };
type RawPick = Record<string, any>;
type SubmissionRow = { user_id: string; gw: number | string; submitted_at: string };

const fixtureTitle = (i: number) => `Fixture ${i + 101}`;
const initials = (name: string) =>
 name
 .split(/\s+/)
 .filter(Boolean)
 .slice(0, 2)
 .map((s) => s[0]?.toUpperCase())
 .join("");

/* ---------- normalizers (accept multiple shapes/types) ---------- */
function normalizeGw(v: any): number | null {
 if (v == null) return null;
 const n = typeof v ==="string" ? parseInt(v, 10) : v;
 return Number.isFinite(n) ? n : null;
}
function normalizeFixtureIndex(row: RawPick): number | null {
 let fi =
 row.fixture_index ??
 row.fixture_id ??
 row.fixture_no ??
 row.fixture ??
 null;
 if (fi == null) return null;
 if (typeof fi ==="string") {
 const n = parseInt(fi, 10);
 if (!Number.isFinite(n)) return null;
 fi = n;
 }
 if (fi >= 0 && fi <= 9) return fi; // 0..9
 if (fi >= 1 && fi <= 10) return fi - 1; // 1..10
 if (fi >= 101 && fi <= 110) return fi - 101; // 101..110
 return null;
}
function normalizePick(v: any): ("H" |"D" |"A") | null {
 if (!v) return null;
 const s = String(v).trim().toLowerCase();
 if (s ==="h" || s ==="home") return"H";
 if (s ==="d" || s ==="draw") return"D";
 if (s ==="a" || s ==="away") return"A";
 return null;
}

export default function LeaguePage() {
 const { code ="" } = useParams();
 const [me] = useState<LiteUser>(() => getOrInitUser());

 const [loading, setLoading] = useState(true);
 const [league, setLeague] = useState<League | null>(null);
 const [members, setMembers] = useState<{ id: string; name: string }[]>([]);

 const [tab, setTab] = useState<"table" |"gw">("gw");
 const [gw, setGw] = useState<number>(1);

 const [picks, setPicks] = useState<RawPick[]>([]);
 const [subs, setSubs] = useState<SubmissionRow[]>([]);
 const shortId = `${me.id.slice(0, 4)}…${me.id.slice(-4)}`;

 /* ------------ load league + members ------------ */
 useEffect(() => {
 let mounted = true;
 (async () => {
 setLoading(true);

 const { data: lg } = await supabase
 .from("leagues")
 .select("*")
 .eq("code", code)
 .maybeSingle();

 if (!mounted) return;

 if (!lg) {
 setLeague(null);
 setMembers([]);
 setLoading(false);
 return;
 }
 setLeague(lg as League);

 const { data: mm } = await supabase
 .from("league_members")
 .select("users(id,name)")
 .eq("league_id", (lg as League).id);

 const ms =
 (mm as MemberRow[] | null)?.map((r) => ({
 id: r.users.id,
 name: r.users.name ??"(no name)",
 })) ?? [];

 setMembers(ms);
 setLoading(false);
 })();
 return () => {
 mounted = false;
 };
 }, [code]);

 /* ------------ load GLOBAL picks + submissions (no filters; normalize client-side) ------------ */
 const memberIds = useMemo(() => members.map((m) => m.id), [members]);

 useEffect(() => {
 let mounted = true;
 (async () => {
 // Load all picks (tolerant); we’ll filter by user + gw client-side.
 const { data: pk } = await supabase.from("picks").select("*");
 if (!mounted) return;
 setPicks((pk as RawPick[]) ?? []);

 // Submissions keep server filter by members (loose on gw type below)
 if (memberIds.length) {
 const { data: sb } = await supabase
 .from("gw_submissions")
 .select("user_id,gw,submitted_at")
 .in("user_id", memberIds);
 if (!mounted) return;
 setSubs((sb as SubmissionRow[]) ?? []);
 } else {
 setSubs([]);
 }
 })();
 return () => {
 mounted = false;
 };
 }, [memberIds]);

 const submittedMap = useMemo(() => {
 const m = new Map<string, boolean>();
 subs.forEach((s) => {
 const g = normalizeGw(s.gw);
 if (g != null) m.set(`${s.user_id}:${g}`, true);
 });
 return m;
 }, [subs]);

 /* ------------ renderers ------------ */
 function MembersTable() {
 if (!members.length) return <div className="text-slate-500">No members yet.</div>;
 return (
 <div className="overflow-hidden rounded border bg-white">
 <table className="w-full text-sm">
 <thead className="bg-slate-50">
 <tr>
 <th className="text-left px-3 py-2">Name</th>
 <th className="text-left px-3 py-2">User ID</th>
 </tr>
 </thead>
 <tbody>
 {members.map((m) => (
 <tr key={m.id} className="border-t">
 <td className="px-3 py-2">{m.name}</td>
 <td className="px-3 py-2 font-mono text-slate-500">{m.id}</td>
 </tr>))}
 </tbody>
 </table>
 </div>);
 }

 function GwPicks() {
 const memberSet = new Set(memberIds);
 const byFixture = Array.from({ length: 10 }, () => ({
 H: [] as { id: string; name: string }[],
 D: [] as { id: string; name: string }[],
 A: [] as { id: string; name: string }[],
 }));

 // normalize + filter client-side
 let usedRows = 0;
 picks.forEach((row) => {
 const uid = row.user_id as string | undefined;
 if (!uid || !memberSet.has(uid)) return;

 const g = normalizeGw(row.gw);
 if (g !== gw) return;

 const idx = normalizeFixtureIndex(row);
 if (idx == null || idx < 0 || idx > 9) return;

 const p = normalizePick(row.pick);
 if (!p) return;

 const mem = members.find((m) => m.id === uid);
 byFixture[idx][p].push({ id: uid, name: mem?.name ??"Player" });
 usedRows++;
 });

 const allSubmitted = members.length
 ? members.every((m) => submittedMap.get(`${m.id}:${gw}`))
 : false;

 const chip = (name: string) => (
 <span
 key={name}
 title={name}
 className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs mr-1 mb-1"
 >
 {initials(name)}
 </span>);

 return (
 <div className="mt-4">
 <div className="flex items-center gap-3 justify-end text-sm text-slate-500">
 <label className="mr-1">GW</label>
 <select
 value={gw}
 onChange={(e) => setGw(parseInt(e.target.value, 10))}
 className="border rounded px-2 py-1"
 >
 {Array.from({ length: 38 }, (_, i) => i + 1).map((g) => (
 <option key={g} value={g}>
 {g}
 </option>))}
 </select>
 <span>
 {members.length} members · {allSubmitted ?"all submitted" :"waiting…"}
 </span>
 <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs">
 {usedRows} pick rows
 </span>
 <a href="/predictions" className="ml-4 underline">
 TOTL
 </a>
 </div>

 <div className="mt-4 overflow-hidden rounded border bg-white">
 <table className="w-full text-sm">
 <thead className="bg-slate-50">
 <tr>
 <th className="text-left px-3 py-2">Fixture</th>
 <th className="text-left px-3 py-2">Home Win</th>
 <th className="text-left px-3 py-2">Draw</th>
 <th className="text-left px-3 py-2">Away Win</th>
 </tr>
 </thead>
 <tbody>
 {byFixture.map((row, fx) => (
 <tr key={fx} className="border-t align-top">
 <td className="px-3 py-2">{fixtureTitle(fx)}</td>
 <td className="px-3 py-2">
 {row.H.length ? row.H.map((m) => chip(m.name)) : (
 <span className="text-slate-400">—</span>)}
 </td>
 <td className="px-3 py-2">
 {row.D.length ? row.D.map((m) => chip(m.name)) : (
 <span className="text-slate-400">—</span>)}
 </td>
 <td className="px-3 py-2">
 {row.A.length ? row.A.map((m) => chip(m.name)) : (
 <span className="text-slate-400">—</span>)}
 </td>
 </tr>))}
 </tbody>
 </table>
 </div>

 <p className="mt-3 text-xs text-slate-400">
 Initials are derived from member names. Example: “Thomas Bird” → TB.
 </p>
 </div>);
 }

 if (loading) {
 return (
 <div className="max-w-4xl mx-auto px-4 py-10">
 <div className="text-slate-500">Loading…</div>
 </div>);
 }

 if (!league) {
 return (
 <div className="max-w-3xl mx-auto px-4 py-10">
 <div className="rounded border bg-white p-6">
 <div className="font-semibold mb-2">League not found</div>
 <Link to="/tables" className="text-slate-600 underline">
 Back to Tables
 </Link>
 </div>
 </div>);
 }

 return (
 <div className="max-w-5xl mx-auto px-4 py-10">
 {/* top bar with user badge */}
 <div className="flex items-center justify-between">
 <Link to="/tables" className="text-slate-500">
 ← Back to Tables
 </Link>
 <div className="flex items-center gap-2">
 <span className="text-xs text-slate-500">Signed in:</span>
 <span className="text-xs rounded-full bg-slate-100 px-2 py-1">
 <span className="font-medium">{me.name ||"Unnamed"}</span>
 <span className="text-slate-400"> · {shortId}</span>
 </span>
 <button
 onClick={() => {
 localStorage.removeItem(LS_USER);
 window.location.reload();
 }}
     className="text-xs px-2 py-1 rounded border"
     >
     Switch user
 </button>
 </div>
 </div>

 <h1 className="mt-6 text-2xl font-semibold">{league.name}</h1>
 <div className="mt-1 text-sm text-slate-500">
 Code: <span className="font-mono">{league.code}</span> · Created{""}
 {new Date(league.created_at).toLocaleDateString()}
 </div>

 {/* tabs */}
 <div className="mt-6 flex items-center gap-2">
 <button
 onClick={() => setTab("table")}
 className={`px-3 py-1.5 rounded border ${tab ==="table" ?"bg-slate-900 text-white" :""}`}
 >
 Table
 </button>
 <button
 onClick={() => setTab("gw")}
 className={`px-3 py-1.5 rounded border ${tab ==="gw" ?"bg-slate-900 text-white" :""}`}
 >
 GW Picks
 </button>

 <div className="ml-auto">
 <a href="/predictions" className="text-sm text-slate-500 underline" title="Open predictions">
 TOTL
 </a>
 </div>
 </div>

 {tab ==="table" ? (
 <div className="mt-6">
 <div className="text-sm text-slate-500 mb-2">Members</div>
 <MembersTable />
 </div>) : (
 <GwPicks />)}
 </div>);
}
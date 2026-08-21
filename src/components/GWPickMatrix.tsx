// src/components/GWPickMatrix.tsx
import { useMemo } from 'react';

type Member = { id: string; name: string };
type Fixture = {
  id: string;           // e.g. "F1"
  gw: number;           // gameweek number
  home: string;         // full team name, e.g. "Manchester City"
  away: string;         // full team name, e.g. "Chelsea"
  kickoff?: string;     // optional ISO string
};

type Props = {
  gw: number;
  fixtures: Fixture[];
  members: Member[];
};

type PicksMap = Record<string, 'H' | 'D' | 'A'>; // fixtureId -> choice

function initials(name: string) {
  // 1 or 2-letter initials (e.g. "Thomas Bird" -> "TB", "Jof" -> "J")
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '??';
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function abbr(team: string) {
  const map: Record<string,string> = {
    'Arsenal':'ARS','Aston Villa':'AVL','AFC Bournemouth':'BOU','Bournemouth':'BOU','Brentford':'BRE',
    'Brighton & Hove Albion':'BHA','Brighton and Hove Albion':'BHA','Chelsea':'CHE','Crystal Palace':'CRY',
    'Everton':'EVE','Fulham':'FUL','Hull City':'HUL','Hull':'HUL','Ipswich Town':'IPS','Ipswich':'IPS',
    'Coventry City':'COV','Coventry':'COV','Leeds United':'LEE','Leicester City':'LEI',
    'Liverpool':'LIV','Manchester City':'MCI','Man City':'MCI','Manchester United':'MUN','Man United':'MUN',
    'Newcastle United':'NEW','Nottingham Forest':'NFO','Southampton':'SOU','Tottenham Hotspur':'TOT',
    'Tottenham':'TOT','West Ham United':'WHU','Wolverhampton Wanderers':'WOL','Wolves':'WOL','Sunderland':'SUN'
  };
  return map[team] || team.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3) || team.toUpperCase();
}

function loadPicks(userId: string, gw: number): PicksMap {
  try {
    const raw = localStorage.getItem(`totl:picks:${userId}:${gw}`);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') return obj;
    return {};
  } catch { return {}; }
}

export default function GWPickMatrix({ gw, fixtures, members }: Props) {
  // Build columns: Fixture, Home Win, Draw, Away Win
  // For each fixture, show which members picked H / D / A using initials.

  const matrix = useMemo(() => {
    // For speed, pre-load every member’s picks once
    const picksByMember: Record<string, PicksMap> = {};
    members.forEach(m => { picksByMember[m.id] = loadPicks(m.id, gw); });

    return fixtures.map(fx => {
      const H: string[] = [];
      const D: string[] = [];
      const A: string[] = [];

      members.forEach(m => {
        const choice = picksByMember[m.id]?.[fx.id];
        if (!choice) return;
        const tag = initials(m.name);
        if (choice === 'H') H.push(tag);
        else if (choice === 'D') D.push(tag);
        else if (choice === 'A') A.push(tag);
      });

      // keep stable order by name
      const sorter = (a: string, b: string) => a.localeCompare(b);
      H.sort(sorter); D.sort(sorter); A.sort(sorter);

      return {
        key: fx.id,
        label: `${abbr(fx.home)} v ${abbr(fx.away)}`,
        homeShort: abbr(fx.home),
        awayShort: abbr(fx.away),
        H, D, A
      };
    });
  }, [gw, fixtures, members]);

  if (!fixtures.length) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <p className="text-slate-600">No fixtures for this gameweek.</p>
      </div>
    );
  }

  return (
    <section className="rounded-xl border bg-white p-0 overflow-auto">
      {/* Header row */}
      <div className="min-w-[720px] grid grid-cols-[260px,1fr,1fr,1fr] border-b bg-slate-50/60">
        <div className="px-4 py-3 text-xs font-bold tracking-wide text-slate-600">FIXTURE</div>
        <div className="px-4 py-3 text-xs font-bold tracking-wide text-slate-600 text-center">HOME&nbsp;WIN</div>
        <div className="px-4 py-3 text-xs font-bold tracking-wide text-slate-600 text-center">DRAW</div>
        <div className="px-4 py-3 text-xs font-bold tracking-wide text-slate-600 text-center">AWAY&nbsp;WIN</div>
      </div>

      {/* Rows */}
      <div className="min-w-[720px]">
        {matrix.map((row, idx) => (
          <div
            key={row.key}
            className={`grid grid-cols-[260px,1fr,1fr,1fr] items-center ${idx % 2 ? 'bg-white' : 'bg-slate-50/30'}`}
          >
            {/* Fixture label */}
            <div className="px-4 py-3 text-sm font-semibold">
              {row.label}
            </div>

            {/* H / D / A cells with initials */}
            <Cell tags={row.H}  />
            <Cell tags={row.D}  />
            <Cell tags={row.A}  />
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="border-t bg-slate-50/60 px-4 py-3 text-xs text-slate-600">
        <p>
          Initials = member picks. Stored as <code className="font-mono">localStorage</code> keys:
          <code className="font-mono"> totl:picks:&lt;userId&gt;:{gw}</code>, value like
          <code className="font-mono"> {"{ F1:'H', F2:'D', F3:'A' }"}</code>.
        </p>
      </div>
    </section>
  );
}

function Cell({ tags }: { tags: string[] }) {
  if (!tags.length) {
    return <div className="px-4 py-3 text-sm text-slate-400 text-center">—</div>;
  }
  return (
    <div className="px-2 py-2 flex flex-wrap gap-2 justify-center">
      {tags.map((t, i) => (
        <span
          key={i}
          className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-slate-900/90 px-2 text-xs font-bold text-white"
          title={t}
        >
          {t}
        </span>
      ))}
    </div>
  );
}
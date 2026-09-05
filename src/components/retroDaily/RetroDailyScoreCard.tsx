import { useEffect, useState } from 'react';
import type { RetroFixture } from '../../lib/retroDaily/mockPuzzle';
import type { RetroPick } from '../../lib/retroDaily/mockPuzzle';
import { retroBadgeUrl } from '../../lib/retroDaily/badges';
import { supabase } from '../../lib/supabase';
import UserAvatar from '../UserAvatar';
import type { RetroRoundOutcome } from './RetroDailyRevealCard';

export function retroScoreBlurb(score: number, _total: number, perfect: boolean): string {
  if (perfect) return 'Perfect ten — absolute scenes. See you tomorrow.';
  if (score === 0) return 'Rough start — try again tomorrow.';
  return 'Solid run — try again tomorrow.';
}

/** Canonical 3-letter codes for the score sheet (matches Prem TLA style). */
const CODE_ALIASES: Record<string, string> = {
  NOT: 'NFO',
  SHE: 'SHW', // prefer Wednesday when ambiguous; SHU stays SHU
  ManU: 'MUN',
  MUFC: 'MUN',
};

export function retroSheetCode(code: string): string {
  const raw = String(code || '').trim().toUpperCase();
  return CODE_ALIASES[raw] ?? raw.slice(0, 3);
}

/**
 * Final score card — scoresheet layout: avatar + name, score pill, 3-letter rows.
 * Blurb lives above the card (parent).
 */
export default function RetroDailyScoreCard({
  seasonLabel,
  fixtures,
  outcomes,
  score,
  userId,
  userNameFallback,
}: {
  seasonLabel: string;
  fixtures: RetroFixture[];
  outcomes: RetroRoundOutcome[];
  score: number;
  perfect: boolean;
  userId?: string | null;
  userNameFallback?: string | null;
}) {
  const byId = new Map(outcomes.map((o) => [o.fixture.id, o]));
  const [displayName, setDisplayName] = useState(userNameFallback?.trim() || 'Player');

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const { data } = await supabase.from('users').select('name').eq('id', userId).maybeSingle();
      if (!alive) return;
      const name = typeof data?.name === 'string' ? data.name.trim() : '';
      if (name) setDisplayName(name);
      else if (userNameFallback?.trim()) setDisplayName(userNameFallback.trim());
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, userNameFallback]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] bg-white px-3 pb-2 pt-2.5 shadow-lg">
      {/* Top corners: user | title + season | score */}
      <div className="mb-1 grid shrink-0 grid-cols-[1fr_auto_1fr] items-start gap-1 px-1">
        <div className="flex min-w-0 items-center gap-2 justify-self-start">
          {userId ? (
            <UserAvatar userId={userId} name={displayName} size={36} className="shrink-0" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1C8376] text-sm font-black text-white">
              {(displayName[0] || 'P').toUpperCase()}
            </div>
          )}
          <p className="truncate text-base font-bold leading-tight text-slate-800">{displayName}</p>
        </div>

        <div className="flex flex-col items-center justify-start pt-0.5 text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-600">Retro Totl Daily</p>
          <p
            className="mt-1 text-lg leading-none text-[#1C8376]"
            style={{ fontFamily: "'PressStart2P', monospace" }}
          >
            {seasonLabel}
          </p>
        </div>

        <div className="justify-self-end">
          <div className="inline-flex shrink-0 items-baseline gap-0.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
            <span className="text-base font-extrabold text-slate-900">{score}</span>
            <span className="text-xs font-semibold text-slate-400">/</span>
            <span className="text-sm font-bold text-slate-500">{fixtures.length}</span>
          </div>
        </div>
      </div>

      {/* Evenly fill the card — no empty slab at the bottom */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col justify-evenly py-0.5">
        {fixtures.map((fixture, i) => {
          const o = byId.get(fixture.id);
          const muted = !o;
          const homeCode = retroSheetCode(fixture.homeCode);
          const awayCode = retroSheetCode(fixture.awayCode);
          const pick = o?.pick as RetroPick | null | undefined;
          return (
            <div
              key={fixture.id}
              className={`flex h-full min-h-0 flex-1 items-center px-1 ${
                i % 2 === 0 ? 'bg-slate-50/90' : 'bg-white'
              } ${muted ? 'opacity-40 blur-[2.5px]' : ''}`}
            >
              <div className="flex w-7 shrink-0 items-center justify-center">
                {o ? (
                  o.correct ? (
                    <span className="text-lg font-black leading-none text-emerald-600">✓</span>
                  ) : (
                    <span className="text-lg font-black leading-none text-red-600">✗</span>
                  )
                ) : (
                  <span className="text-slate-300">·</span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-end gap-1 pr-1">
                <span
                  className={`text-sm font-bold tabular-nums text-slate-800 ${
                    pick === 'H' ? 'underline decoration-2 decoration-slate-400 underline-offset-4' : ''
                  }`}
                >
                  {homeCode}
                </span>
                <Badge code={fixture.homeCode} />
              </div>

              <div className="flex w-[52px] shrink-0 items-center justify-center gap-1">
                <span className="text-sm font-extrabold tabular-nums text-slate-900">{fixture.homeScore}</span>
                <span className="text-xs font-bold text-slate-400">-</span>
                <span className="text-sm font-extrabold tabular-nums text-slate-900">{fixture.awayScore}</span>
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-start gap-1 pl-1">
                <Badge code={fixture.awayCode} />
                <span
                  className={`text-sm font-bold tabular-nums text-slate-800 ${
                    pick === 'A' ? 'underline decoration-2 decoration-slate-400 underline-offset-4' : ''
                  }`}
                >
                  {awayCode}
                </span>
              </div>

              <div className="w-4 shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ code }: { code: string }) {
  const src = retroBadgeUrl(code);
  if (!src) return <span className="h-5 w-5 shrink-0" />;
  return <img src={src} alt="" className="h-5 w-5 shrink-0 object-contain" />;
}

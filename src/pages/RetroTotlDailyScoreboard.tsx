import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MOCK_RETRO_SEASON, MOCK_RETRO_SEASON_FULL } from '../lib/retroDaily/mockPuzzle';

const BG = '#0B1F3A';

type BoardTab = 'today' | 'allTime';
type BoardRow = { rank: number; name: string; score: number; you?: boolean };

const MOCK_TODAY: BoardRow[] = [
  { rank: 1, name: 'PixelPundit', score: 10 },
  { rank: 2, name: 'RetroRonnie', score: 9 },
  { rank: 3, name: 'You', score: 8, you: true },
  { rank: 4, name: 'WembleyWizard', score: 7 },
  { rank: 5, name: 'TerraceTom', score: 6 },
  { rank: 6, name: 'CornerFlag', score: 5 },
  { rank: 7, name: 'LastMinute', score: 4 },
  { rank: 8, name: 'OffsideOwl', score: 3 },
];

const MOCK_ALL_TIME: BoardRow[] = [
  { rank: 1, name: 'RetroRonnie', score: 186 },
  { rank: 2, name: 'PixelPundit', score: 172 },
  { rank: 3, name: 'WembleyWizard', score: 164 },
  { rank: 4, name: 'You', score: 141, you: true },
  { rank: 5, name: 'TerraceTom', score: 128 },
  { rank: 6, name: 'CornerFlag', score: 119 },
  { rank: 7, name: 'LastMinute', score: 97 },
  { rank: 8, name: 'OffsideOwl', score: 84 },
  { rank: 9, name: 'BackPassBill', score: 71 },
  { rank: 10, name: 'NutmegNed', score: 58 },
];

/** Full-page RTD scoreboard — Today + All Time (public with the play link). */
export default function RetroTotlDailyScoreboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<BoardTab>('today');

  const rows = tab === 'today' ? MOCK_TODAY : MOCK_ALL_TIME;
  const scoreHeader = tab === 'today' ? 'Score' : 'Total';
  const youName =
    (typeof user?.user_metadata?.display_name === 'string' && user.user_metadata.display_name) ||
    user?.email?.split('@')[0] ||
    'You';

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: BG }}>
      <div className="mx-auto max-w-md px-4 pb-10 pt-3">
        <header className="relative mb-4 flex h-10 items-center justify-center">
          <Link
            to="/admin/retro-totl-daily"
            aria-label="Back"
            className="absolute left-0 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none hover:bg-white/10"
          >
            ×
          </Link>
          <h1 className="text-lg font-black">Scoreboard</h1>
        </header>

        <div className="mb-4 flex rounded-2xl bg-white/10 p-1">
          <TabButton label="Today" active={tab === 'today'} onClick={() => setTab('today')} />
          <TabButton label="All Time" active={tab === 'allTime'} onClick={() => setTab('allTime')} />
        </div>

        {tab === 'today' ? (
          <>
            <p className="text-center text-sm text-teal-300" style={{ fontFamily: "'PressStart2P', monospace" }}>
              {MOCK_RETRO_SEASON_FULL}
            </p>
            <p className="mt-2 text-center text-sm font-bold text-white/65">
              Today’s board · season {MOCK_RETRO_SEASON}
            </p>
          </>
        ) : (
          <p className="text-center text-sm font-bold text-white/65">All-time Retro Totl Daily</p>
        )}

        <div className="mt-5 overflow-hidden rounded-2xl bg-white/5">
          <div className="grid grid-cols-[48px_1fr_72px] border-b border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white/45">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">{scoreHeader}</span>
          </div>
          {rows.map((row) => (
            <div
              key={`${tab}-${row.rank}-${row.name}`}
              className={`grid grid-cols-[48px_1fr_72px] items-center px-4 py-3 text-sm ${
                row.you ? 'bg-[#1C8376]/25 font-extrabold' : 'font-semibold'
              } ${row.rank < rows.length ? 'border-b border-white/5' : ''}`}
            >
              <span className="tabular-nums text-white/70">{row.rank}</span>
              <span className="truncate">{row.you ? youName : row.name}</span>
              <span className="text-right tabular-nums text-teal-300">{row.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold transition ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-white/70'
      }`}
    >
      {label}
    </button>
  );
}

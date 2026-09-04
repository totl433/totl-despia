import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isFounderAdmin } from '../lib/adminIds';
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

/** Full-page RTD scoreboard — Today + All Time (prototype). */
export default function RetroTotlDailyScoreboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isAdmin = isFounderAdmin(user?.id);
  const [tab, setTab] = useState<BoardTab>('today');

  useEffect(() => {
    if (!loading && user && !isAdmin) navigate('/profile');
  }, [loading, user, isAdmin, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: BG }}>
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
      </div>
    );
  }
  if (!isAdmin) return null;

  const rows = tab === 'today' ? MOCK_TODAY : MOCK_ALL_TIME;
  const scoreHeader = tab === 'today' ? 'Score' : 'Total';

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
          <>
            <p className="text-center text-sm text-teal-300" style={{ fontFamily: "'PressStart2P', monospace" }}>
              ALL TIME
            </p>
            <p className="mt-2 text-center text-sm font-bold text-white/65">
              Cumulative correct picks across every day
            </p>
          </>
        )}

        <div className="mt-5 overflow-hidden rounded-[20px] bg-white py-1.5 text-slate-900">
          <div className="flex border-b border-slate-200 px-4 py-2.5 text-[11px] font-extrabold text-slate-400">
            <span className="w-9">#</span>
            <span className="flex-1">Player</span>
            <span className="w-14 text-right">{scoreHeader}</span>
          </div>
          {rows.map((row, i) => (
            <div
              key={`${tab}-${row.name}`}
              className={`flex items-center px-4 py-3.5 ${row.you ? 'bg-teal-50' : ''} ${
                i < rows.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <span
                className={`w-9 text-sm ${row.rank <= 3 ? 'text-teal-700' : 'text-slate-700'}`}
                style={{ fontFamily: "'PressStart2P', monospace" }}
              >
                {row.rank}
              </span>
              <span className={`flex-1 truncate text-[15px] ${row.you ? 'font-black' : 'font-bold'}`}>
                {row.name}
                {row.you ? '  · you' : ''}
              </span>
              <span className="w-14 text-right text-base" style={{ fontFamily: "'PressStart2P', monospace" }}>
                {row.score}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-xs font-semibold text-white/50">
          Prototype rankings — live boards ship with the real daily seed.
        </p>
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 flex-1 rounded-[11px] text-sm font-extrabold text-white ${
        active ? 'bg-[#1C8376]' : 'bg-transparent'
      }`}
    >
      {label}
    </button>
  );
}

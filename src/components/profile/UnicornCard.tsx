import SwipeCard from '../predictions/SwipeCard';
import type { SwipeCardFixture } from '../predictions/SwipeCard';
import { getMediumName } from '../../lib/teamNames';

interface UnicornCardProps {
  fixture: {
    fixture_index: number;
    gw: number;
    home_team: string;
    away_team: string;
    home_code: string | null;
    away_code: string | null;
    home_name: string | null;
    away_name: string | null;
    kickoff_time: string | null;
    pick: "H" | "D" | "A";
  };
  leagueNames: string[];
  isActive?: boolean;
}

export default function UnicornCard({ fixture, leagueNames, isActive = false }: UnicornCardProps) {
  // Use getMediumName to ensure consistent team name formatting
  const homeKey = fixture.home_code || fixture.home_name || fixture.home_team || '';
  const awayKey = fixture.away_code || fixture.away_name || fixture.away_team || '';
  const homeDisplayName = getMediumName(homeKey) || fixture.home_name || fixture.home_team || 'Home';
  const awayDisplayName = getMediumName(awayKey) || fixture.away_name || fixture.away_name || 'Away';

  // Format pick for display
  const pickDisplay = fixture.pick === "H" ? "Home Win" : fixture.pick === "A" ? "Away Win" : "Draw";

  const swipeCardFixture: SwipeCardFixture = {
    id: `${fixture.gw}-${fixture.fixture_index}`,
    fixture_index: fixture.fixture_index,
    home_team: homeDisplayName,
    away_team: awayDisplayName,
    home_code: fixture.home_code,
    away_code: fixture.away_code,
    home_name: homeDisplayName,
    away_name: awayDisplayName,
    kickoff_time: fixture.kickoff_time,
  };

  const scale = isActive ? 1 : 0.85;
  const opacity = isActive ? 1 : 0.7;

  return (
    <div 
      className="flex-shrink-0 relative transition-all duration-300 ease-out" 
      style={{ 
        scrollSnapAlign: 'start',
        transform: `scale(${scale})`,
        opacity: opacity,
        width: '280px',
      }}
    >
      <style>{`
        .unicorn-card-wrapper {
          position: relative;
        }
        .unicorn-card-wrapper > div:first-child {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
          position: relative;
        }
        .unicorn-card-wrapper > div:first-child > div:first-child {
          padding-top: 1.5rem !important;
        }
        .unicorn-card-wrapper .flex.items-center.gap-1\\.5.mt-3 {
          display: none !important;
        }
        .unicorn-card-wrapper > div.absolute {
          box-shadow: none !important;
        }
        .unicorn-card-wrapper::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 1.5rem;
          padding: 10px;
          background: linear-gradient(135deg, #fbbf24, #f97316, #ec4899, #9333ea, #fbbf24);
          background-size: 300% 300%;
          -webkit-mask: 
            linear-gradient(#fff 0 0) content-box, 
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: gradient-shift 3s ease infinite;
          pointer-events: none;
          z-index: 100;
        }
        @keyframes gradient-shift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        .shiny-pick-badge {
          background: linear-gradient(135deg, #fbbf24, #f97316, #ec4899, #9333ea, #fbbf24);
          background-size: 300% 300%;
          animation: gradient-shift 3s ease infinite;
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }
      `}</style>
      <div className="relative unicorn-card-wrapper">
        <SwipeCard 
          fixture={swipeCardFixture}
          showSwipeHint={false}
        />
        {/* League names overlay */}
        <div className="absolute bottom-0 left-0 right-0 pt-6 px-4 pb-8 rounded-b-3xl" style={{
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.65) 25%, rgba(0, 0, 0, 0.45) 45%, rgba(0, 0, 0, 0.25) 65%, rgba(0, 0, 0, 0.1) 80%, transparent 100%)'
        }}>
          <div className="text-white text-sm font-semibold text-center mb-2">
            <span className="inline-flex items-center px-3 py-1.5 rounded-full shiny-pick-badge">
              {pickDisplay}
            </span>
          </div>
          <div className="text-white text-sm font-semibold text-center">
            {leagueNames.length === 1 ? (
              leagueNames[0]
            ) : (
              <div className="space-y-1">
                <div>{leagueNames.join(', ')}</div>
              </div>
            )}
          </div>
          <div className="text-white/80 text-xs text-center mt-1">
            GW{fixture.gw}
          </div>
        </div>
      </div>
    </div>
  );
}

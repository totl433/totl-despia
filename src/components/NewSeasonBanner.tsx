import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'totl_new_season_banner_2026_27_dismissed';

export type NewSeasonBannerProps = {
  /** Override season label for Storybook / tests */
  seasonLabel?: string;
  /** Force visibility (Storybook) */
  forceVisible?: boolean;
  className?: string;
};

/**
 * Dismissible “new season” promo banner for 2026/27 kickoff.
 * Usage: <NewSeasonBanner /> under the home logo / page header.
 */
export default function NewSeasonBanner({
  seasonLabel = '2026/27',
  forceVisible = false,
  className = '',
}: NewSeasonBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (forceVisible) {
      setVisible(true);
      return;
    }
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') {
        setVisible(false);
        return;
      }
    } catch {
      // ignore storage failures
    }
    setVisible(true);
  }, [forceVisible]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <section
      className={`new-season-banner relative mb-4 overflow-hidden rounded-2xl text-white shadow-md ${className}`}
      aria-label={`New season ${seasonLabel}`}
      data-banner-height
    >
      <style>{`
        @keyframes newSeasonFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes newSeasonShimmer {
          0% { transform: translateX(-40%) skewX(-12deg); opacity: 0; }
          30% { opacity: 0.35; }
          60% { opacity: 0.15; }
          100% { transform: translateX(140%) skewX(-12deg); opacity: 0; }
        }
        @keyframes newSeasonPulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.06); }
        }
        .new-season-banner {
          animation: newSeasonFadeUp 420ms ease-out both;
          background:
            radial-gradient(ellipse 80% 120% at 100% 0%, rgba(255,255,255,0.18) 0%, transparent 55%),
            radial-gradient(ellipse 60% 80% at 0% 100%, rgba(10, 60, 55, 0.55) 0%, transparent 50%),
            linear-gradient(135deg, #0f5c54 0%, #1C8376 48%, #156b61 100%);
        }
        .new-season-shimmer {
          pointer-events: none;
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        .new-season-shimmer::after {
          content: '';
          position: absolute;
          top: -20%;
          left: 0;
          width: 40%;
          height: 140%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.22),
            transparent
          );
          animation: newSeasonShimmer 4.5s ease-in-out 0.6s infinite;
        }
        .new-season-orb {
          position: absolute;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.12);
          animation: newSeasonPulse 5s ease-in-out infinite;
        }
      `}</style>

      <div className="new-season-shimmer" aria-hidden="true" />
      <div
        className="new-season-orb pointer-events-none -right-6 -top-8 h-28 w-28"
        aria-hidden="true"
      />
      <div
        className="new-season-orb pointer-events-none -bottom-10 left-8 h-24 w-24"
        style={{ animationDelay: '1.2s' }}
        aria-hidden="true"
      />

      <div className="relative z-[1] flex items-start gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
            New season
          </p>
          <h2 className="text-2xl font-black leading-none tracking-tight sm:text-[1.75rem]">
            {seasonLabel}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-snug text-white/90">
            Clean slate. Fresh fixtures. Lock in early — the title race starts at GW1.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              to="/predictions"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#1C8376] shadow-sm transition active:scale-[0.98]"
            >
              Make your picks
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              to="/global"
              className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3.5 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/15 active:scale-[0.98]"
            >
              Leaderboards
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-white/90 transition hover:bg-white/25"
          aria-label="Dismiss new season banner"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </section>
  );
}

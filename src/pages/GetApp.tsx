import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { APP_STORE_URL, setPreferPlayOnline } from '../lib/playOnlinePreference';

/**
 * Six swipe pages:
 * 1 splash + 4 feature screens + final download CTA
 */
const SLIDES = [
  {
    id: 'splash',
    kind: 'splash' as const,
  },
  {
    id: 'predict',
    kind: 'feature' as const,
    title: 'Predict every gameweek',
    body: 'Ten fixtures. Three outcomes. Score out of 10 depending on how often you’re right, or confidently wrong.',
    image: '/assets/get-app/predict.jpg',
    alt: 'Swipe prediction cards for Premier League fixtures',
  },
  {
    id: 'leaderboard',
    kind: 'feature' as const,
    title: 'Climb the global leaderboard',
    body: 'Every correct prediction adds up. Follow your gut, stay consistent and work from beginner to actual menace.',
    image: '/assets/get-app/leaderboard.jpg',
    alt: 'Global leaderboard with ranks and points',
  },
  {
    id: 'leagues',
    kind: 'feature' as const,
    title: 'Mini leagues get personal',
    body: 'Create leagues with 2–8 friends. Each week is head-to-head. Highest score wins. Group chats take a hit.',
    image: '/assets/get-app/leagues.jpg',
    alt: 'Mini league group chat',
  },
  {
    id: 'form',
    kind: 'feature' as const,
    title: 'Start anytime and still compete',
    body: 'Joined late? Fear not. Your form tracks the last 5 and 10 weeks, so every gameweek is a chance to push on.',
    image: '/assets/get-app/form.jpg',
    alt: 'Form leaderboard for the last 10 gameweeks',
  },
  {
    id: 'download',
    kind: 'cta' as const,
    title: 'Get TotL on iPhone',
    body: 'Make your picks, climb the table, and settle it with your mates.',
  },
] as const;

const SLIDE_COUNT = SLIDES.length;

function AppStoreBadge({ className = '', imgClassName = 'h-11 w-auto' }: { className?: string; imgClassName?: string }) {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block transition-opacity hover:opacity-90 active:opacity-80 ${className}`}
      aria-label="Download on the App Store"
    >
      <img
        src="/assets/get-app/app-store-badge-transparent.png"
        alt="Download on the App Store"
        className={imgClassName}
        draggable={false}
      />
    </a>
  );
}

function SplashCtas({ onPlayOnline }: { onPlayOnline: () => void }) {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <AppStoreBadge imgClassName="h-14 w-auto sm:h-16" />
      <button
        type="button"
        disabled
        className="w-full max-w-xs cursor-not-allowed rounded-xl border border-white/25 py-3 text-[15px] font-medium text-white/45"
        aria-disabled="true"
      >
        Google Play — Coming soon
      </button>
      <button
        type="button"
        onClick={onPlayOnline}
        className="py-2 text-base font-semibold text-white underline underline-offset-4 decoration-white/40"
      >
        Play online
      </button>
    </div>
  );
}

/**
 * Download-first marketing page.
 * Always a single phone-width column. On small screens: full-bleed.
 * On wider screens: inset rounded card on a white page (matches feature art).
 */
export default function GetAppPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const wheelLockRef = useRef(false);
  const [index, setIndex] = useState(0);

  function handlePlayOnline() {
    setPreferPlayOnline();
    if (user) {
      window.location.assign('/');
      return;
    }
    navigate('/auth?returnTo=/', { replace: true });
  }

  function goTo(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const next = Math.min(SLIDE_COUNT - 1, Math.max(0, i));
    const left = next * el.clientWidth;
    el.scrollLeft = left;
    indexRef.current = next;
    setIndex(next);
  }

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    function onScroll() {
      if (!el) return;
      const w = el.clientWidth || 1;
      const next = Math.min(SLIDE_COUNT - 1, Math.max(0, Math.round(el.scrollLeft / w)));
      if (next !== indexRef.current) {
        indexRef.current = next;
        setIndex(next);
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Trackpad/mouse: one vertical flick = one horizontal page (avoids getting stuck)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      if (!el) return;
      const dominant =
        Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(dominant) < 8) return;
      e.preventDefault();
      if (wheelLockRef.current) return;
      wheelLockRef.current = true;
      goTo(indexRef.current + (dominant > 0 ? 1 : -1));
      window.setTimeout(() => {
        wheelLockRef.current = false;
      }, 420);
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goTo(indexRef.current + 1);
      if (e.key === 'ArrowLeft') goTo(indexRef.current - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep snap aligned if the column resizes (Simple Browser drag, etc.)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastW = el.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (!w || w === lastW) return;
      lastW = w;
      el.scrollLeft = indexRef.current * w;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onSplash = index === 0;
  const onCta = index === SLIDE_COUNT - 1;

  return (
    <div className="relative flex h-[100svh] w-full items-center justify-center overflow-hidden bg-white">
      {/* Phone-width stage: full-bleed on small screens; inset card on wider ones */}
      <div className="get-app-column relative z-10 flex h-full w-full max-w-[430px] flex-col overflow-hidden bg-white sm:h-[min(760px,calc(100svh-3rem))] sm:rounded-[1.75rem] sm:border sm:border-black/[0.06] sm:shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
        <div
          ref={scrollerRef}
          className="flex h-full w-full min-w-0 flex-1 touch-pan-x snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SLIDES.map((slide) => {
            if (slide.kind === 'splash') {
              return (
                <section
                  key={slide.id}
                  className="relative box-border h-full w-full flex-[0_0_100%] snap-center snap-always overflow-hidden"
                >
                  <img
                    src="/assets/get-app/crowd.jpg"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-center get-app-fade-in"
                    fetchPriority="high"
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/70 to-black/85"
                    aria-hidden
                  />
                  <div className="relative z-10 flex h-full flex-col px-5 pb-28 pt-[max(2rem,env(safe-area-inset-top))]">
                    <div className="mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col items-center justify-center text-center get-app-rise-in">
                      {/* SVG art is already angled — do not add extra CSS rotate */}
                      <img
                        src="/assets/badges/totl-logo1.svg"
                        alt="TotL"
                        className="h-[84px] w-auto drop-shadow-xl brightness-0 invert"
                      />
                      <h1 className="mt-5 text-[1.85rem] font-semibold tracking-tight text-white drop-shadow-md">
                        Gamify your gameday
                      </h1>
                      <p className="mt-3 max-w-[20rem] text-[16px] leading-relaxed text-white/90 drop-shadow">
                        Premier League predictions. Mini leagues. Bragging rights.
                      </p>
                    </div>
                    <div className="mx-auto mb-2 w-full max-w-sm shrink-0 get-app-rise-in-late">
                      <SplashCtas onPlayOnline={handlePlayOnline} />
                    </div>
                  </div>
                </section>
              );
            }

            if (slide.kind === 'cta') {
              return (
                <section
                  key={slide.id}
                  className="relative box-border flex h-full w-full flex-[0_0_100%] snap-center snap-always flex-col overflow-hidden bg-white"
                >
                  <div className="flex h-full w-full flex-col items-center justify-center px-6 pb-36 pt-[max(1.75rem,env(safe-area-inset-top))] text-center">
                    <img
                      src="/assets/badges/totl-logo1.svg"
                      alt="TotL"
                      className="h-[84px] w-auto"
                    />
                    <h2 className="mt-5 text-[1.65rem] font-medium leading-tight tracking-tight text-[#0a1224]">
                      {slide.title}
                    </h2>
                    <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-black/60">
                      {slide.body}
                    </p>
                    <div className="mt-8">
                      <AppStoreBadge imgClassName="h-14 w-auto" />
                    </div>
                    <button
                      type="button"
                      disabled
                      className="mt-3 w-full max-w-xs cursor-not-allowed rounded-xl border border-black/15 py-3 text-[15px] font-medium text-black/35"
                      aria-disabled="true"
                    >
                      Google Play — Coming soon
                    </button>
                    <button
                      type="button"
                      onClick={handlePlayOnline}
                      className="mt-4 text-sm font-medium text-black/55 underline underline-offset-4"
                    >
                      Continue in browser
                    </button>
                  </div>
                </section>
              );
            }

            return (
              <section
                key={slide.id}
                className="relative box-border flex h-full w-full flex-[0_0_100%] snap-center snap-always flex-col overflow-hidden bg-white"
              >
                <div className="flex h-full w-full flex-col px-5 pb-36 pt-[max(1.75rem,env(safe-area-inset-top))]">
                  <div className="shrink-0">
                    <h2 className="text-[1.55rem] font-medium leading-tight tracking-tight text-[#0a1224]">
                      {slide.title}
                    </h2>
                    <p className="mt-2.5 text-[14px] leading-relaxed text-black/60">{slide.body}</p>
                  </div>
                  <div className="mt-4 flex min-h-0 flex-1 items-start justify-center overflow-hidden">
                    <img
                      src={slide.image}
                      alt={slide.alt}
                      className="h-full w-auto max-w-full object-contain object-top"
                      loading="lazy"
                      draggable={false}
                    />
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-14 ${
            onSplash
              ? 'bg-gradient-to-t from-black/55 via-black/20 to-transparent'
              : 'bg-gradient-to-t from-white via-white/90 to-transparent'
          }`}
        >
          <div className="pointer-events-auto flex flex-col items-center gap-3">
            {!onSplash && !onCta && <AppStoreBadge />}
            <div className="flex items-center gap-2" role="tablist" aria-label="Landing slides">
              {SLIDES.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={index === i}
                  aria-label={`Go to slide ${i + 1} of ${SLIDE_COUNT}`}
                  onClick={() => goTo(i)}
                  className={`h-2 rounded-full transition-all ${
                    index === i
                      ? onSplash
                        ? 'w-6 bg-white'
                        : 'w-6 bg-[#0a1224]'
                      : onSplash
                        ? 'w-2 bg-white/40'
                        : 'w-2 bg-black/20'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes get-app-fade-in {
          from { opacity: 0; transform: scale(1.04); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes get-app-rise-in {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .get-app-fade-in {
          animation: get-app-fade-in 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .get-app-rise-in {
          animation: get-app-rise-in 700ms cubic-bezier(0.22, 1, 0.36, 1) 160ms both;
        }
        .get-app-rise-in-late {
          animation: get-app-rise-in 700ms cubic-bezier(0.22, 1, 0.36, 1) 320ms both;
        }
        @media (prefers-reduced-motion: reduce) {
          .get-app-fade-in,
          .get-app-rise-in,
          .get-app-rise-in-late { animation: none; }
        }
      `}</style>
    </div>
  );
}

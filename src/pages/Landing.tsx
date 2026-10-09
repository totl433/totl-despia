import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  trackAppStoreClick,
  type AppStoreClickPlacement,
} from '../lib/googleAnalytics';
import { APP_STORE_URL } from '../lib/playOnlinePreference';

const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.despia.totlnative';

const ASSETS = '/assets/landing';

/** Card shadow from Figma ("Flat iPhone", 1:3186); the exported card art has none. */
const CARD_SHADOW =
  'drop-shadow(0px 27.62px 11.05px rgba(0,0,0,0.07)) drop-shadow(0px 15.48px 6.19px rgba(0,0,0,0.05)) drop-shadow(0px 8.22px 3.29px rgba(0,0,0,0.04)) drop-shadow(0px 3.42px 1.37px rgba(0,0,0,0.03))';

/**
 * Large soft halo behind the form/leaderboard cards in the feature rows (Figma groups
 * 1:3292 and 1:3453: drop shadow, 0 offset, 210.87px blur, black 10%). Scales with
 * the layout below 1440px.
 */
const FEATURE_HALO = 'drop-shadow(0px 0px min(14.64vw, 210.87px) rgba(0,0,0,0.1))';

/** Green section background (radial gradient from the Figma frame). */
const GREEN_GRADIENT = `url("data:image/svg+xml;utf8,<svg viewBox='0 0 1440 1305' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(112.8 157.91 -174.24 447.82 720 652.5)'><stop stop-color='rgba(28,131,118,1)' offset='0'/><stop stop-color='rgba(23,106,95,1)' offset='0.25'/><stop stop-color='rgba(17,80,72,1)' offset='0.5'/><stop stop-color='rgba(12,55,49,1)' offset='0.75'/><stop stop-color='rgba(6,29,26,1)' offset='1'/></radialGradient></defs></svg>")`;

/**
 * Feature rows. `fit` scales and offsets each image so its card lands on the
 * card box from the Figma frame (506px cards for form/leaderboard, 462px back card
 * for predict); percentages are of the 584px slot width.
 */
const FEATURES = [
  {
    id: 'predict',
    title: 'Predict every gameweek',
    body: 'Ten fixtures. Three outcomes. Score out of 10 depending on how often you’re right, or confidently wrong.',
    image: `${ASSETS}/slide-predict.png`,
    alt: 'Swipe prediction cards for Premier League fixtures',
    fit: { width: '101.64%', left: '0.10%', top: '0.00%', bottom: '-1.71%' },
  },
  {
    id: 'leagues',
    title: 'Mini leagues get personal',
    body: 'Create leagues with 2–8 friends. Each week is head-to-head. Highest score wins. Group chats take a hit.',
    image: `${ASSETS}/slide-leagues.png`,
    alt: 'Mini league group chat',
    fit: { width: '100%', left: '0%', top: '0%', bottom: '0%' },
    chatArt: true,
  },
  {
    id: 'form',
    title: 'Start anytime and still compete',
    body: 'Joined late? Fear not. Your form tracks the last 5 and 10 weeks, so every gameweek is a chance to push on.',
    image: `${ASSETS}/slide-form.png`,
    alt: 'Form leaderboard showing a player climbing over the last 10 gameweeks',
    fit: { width: '114.58%', left: '-7.27%', top: '0.02%', bottom: '-7.41%' },
    halo: true,
  },
  {
    id: 'leaderboard',
    title: 'Climb the global leaderboard',
    body: 'Every correct prediction adds up. Follow your gut, stay consistent and work from beginner to actual menace.',
    image: `${ASSETS}/slide-leaderboard.png`,
    alt: 'Global leaderboard with the top three players highlighted',
    fit: { width: '120.36%', left: '-10.05%', top: '0.02%', bottom: '-0.21%' },
    halo: true,
  },
] as const;

/**
 * Route line (Figma "Vector 3082") in its own 851.73×2669.26 box, placed at
 * (162.3, 187.9) in the 1203px feature column. Every segment heads downwards, so
 * scroll depth maps straight onto a length along the line.
 */
const ROUTE_BOX = { left: 162.3, top: 187.9, width: 851.733, height: 2669.26 };
const ROUTE_POINTS: ReadonlyArray<readonly [number, number]> = [
  [843.654, 16.6427],
  [208.154, 325.143],
  [25.6544, 576.143],
  [393.654, 853.643],
  [740.654, 1137.14],
  [48.6544, 1761.14],
  [772.154, 2657.64],
];
const ROUTE_D = ROUTE_POINTS.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('');
const ROUTE_CUMULATIVE = ROUTE_POINTS.reduce<number[]>((acc, [x, y], i) => {
  if (i === 0) return [0];
  const [px, py] = ROUTE_POINTS[i - 1];
  return [...acc, acc[i - 1] + Math.hypot(x - px, y - py)];
}, []);
const ROUTE_LENGTH = ROUTE_CUMULATIVE[ROUTE_CUMULATIVE.length - 1];

/** Length along the route at a given height inside the route box. */
function routeLengthAtY(y: number): number {
  if (y <= ROUTE_POINTS[0][1]) return 0;
  for (let i = 1; i < ROUTE_POINTS.length; i++) {
    const [, y0] = ROUTE_POINTS[i - 1];
    const [, y1] = ROUTE_POINTS[i];
    if (y <= y1) {
      const t = (y - y0) / (y1 - y0);
      return ROUTE_CUMULATIVE[i - 1] + t * (ROUTE_CUMULATIVE[i] - ROUTE_CUMULATIVE[i - 1]);
    }
  }
  return ROUTE_LENGTH;
}

/** Grey rings on the route (px in the 1203px column); `at` = length along the route. */
const PATH_RINGS = [
  { left: 308, top: 454, at: 709 },
  { left: 740, top: 1174, at: 1791 },
  { left: 157, top: 1886, at: 2851 },
  { left: 863, top: 2784, at: 4004 },
] as const;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Route line that draws itself as the page scrolls (its tip follows 60% down the
 * viewport, reaching the end as the page bottoms out); each ring turns brand green
 * once the line reaches it. Reduced motion
 * shows the finished route. Only rendered at xl, where the column is a fixed 1203px.
 */
function RouteLine() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const ringRefs = useRef<Array<SVGCircleElement | null>>([]);

  useEffect(() => {
    const svg = svgRef.current;
    const path = pathRef.current;
    if (!svg || !path) return;

    const paint = (drawn: number) => {
      path.style.strokeDashoffset = String(ROUTE_LENGTH - drawn);
      ringRefs.current.forEach((ring, i) => ring?.classList.toggle('is-reached', drawn >= PATH_RINGS[i].at - 2));
    };

    if (prefersReducedMotion()) {
      paint(ROUTE_LENGTH);
      return;
    }

    // Nearest scrolling ancestor (the landing page scrolls inside its own container).
    let scroller: HTMLElement | null = svg.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    const root = scroller ?? document.documentElement;

    let raf = 0;
    const update = () => {
      raf = 0;
      const box = svg.getBoundingClientRect();
      if (box.width === 0) return; // hidden below xl
      // The tip sits 60% down the viewport, sliding to the bottom edge over the last
      // 40% of a screen of scroll so the route finishes as the page bottoms out.
      const vh = window.innerHeight;
      const remaining = root.scrollHeight - root.clientHeight - root.scrollTop;
      const finish = Math.min(1, Math.max(0, 1 - remaining / (vh * 0.4)));
      paint(routeLengthAtY(vh * (0.6 + 0.4 * finish) - box.top));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    // The landing page scrolls inside its own container, so listen in the capture phase.
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <>
      <svg
        ref={svgRef}
        aria-hidden
        className="pointer-events-none absolute hidden overflow-visible xl:block"
        style={{ left: ROUTE_BOX.left, top: ROUTE_BOX.top, width: ROUTE_BOX.width, height: ROUTE_BOX.height }}
        viewBox={`0 0 ${ROUTE_BOX.width} ${ROUTE_BOX.height}`}
        fill="none"
      >
        <path
          ref={pathRef}
          d={ROUTE_D}
          stroke="black"
          strokeOpacity={0.05}
          strokeWidth={37}
          style={{ strokeDasharray: ROUTE_LENGTH, strokeDashoffset: ROUTE_LENGTH }}
        />
      </svg>
      {PATH_RINGS.map((ring, i) => (
        <svg
          key={ring.at}
          aria-hidden
          className="pointer-events-none absolute hidden h-[124px] w-[124px] xl:block"
          style={{ left: ring.left, top: ring.top }}
          viewBox="0 0 124 124"
          fill="none"
        >
          <circle
            ref={(el) => {
              ringRefs.current[i] = el;
            }}
            className="landing-ring"
            cx="62"
            cy="62"
            r="50"
            fill="white"
            strokeWidth="24"
          />
        </svg>
      ))}
    </>
  );
}

/** Flips to true the first time the element scrolls into view (immediately under reduced motion). */
function useRevealOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(
    () => typeof IntersectionObserver === 'undefined' || prefersReducedMotion()
  );
  useEffect(() => {
    if (shown || !ref.current) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -15% 0px' }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [shown]);
  return [ref, shown] as const;
}

const MARQUEE_ITEMS = ['Premier League predictions', 'Mini leagues', 'Bragging rights'];

/**
 * Emoji stickers from Figma (1:3276 😂, 1:3277 😎). The chat art matches the Figma
 * group (443×362, scaled to 584×477 in the feature row), so positions are % of that
 * box; each 80–82px emoji is centred in its rotated ~100px bounding box.
 */
const CHAT_EMOJIS: EmojiSticker[] = [
  { src: `${ASSETS}/emoji-laugh.png`, left: '79.70%', top: '23.12%', width: '18.15%', rotate: 16 },
  { src: `${ASSETS}/emoji-cool.png`, left: '2.19%', top: '63.82%', width: '18.52%', rotate: -16 },
];

type EmojiSticker = { src: string; left: string; top: string; width: string; rotate: number };

/** Mini-league chat art with its emoji stickers, sized by its parent (height or width). */
function ChatArtWithEmojis({
  alt,
  className = '',
  popped,
}: {
  alt: string;
  className?: string;
  /** When set, emojis pop in (with a slight overshoot) once this turns true. */
  popped?: boolean;
}) {
  return (
    <div className={`relative ${className}`}>
      <img
        src={`${ASSETS}/slide-leagues.png`}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="block h-full w-full max-w-none"
        style={{ filter: CARD_SHADOW }}
      />
      {CHAT_EMOJIS.map((emoji, i) => {
        const hidden = popped === false;
        const delay = 450 + i * 150;
        return (
          <img
            key={emoji.src}
            src={emoji.src}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute h-auto max-w-none motion-reduce:transition-none"
            style={{
              left: emoji.left,
              top: emoji.top,
              width: emoji.width,
              opacity: hidden ? 0 : 1,
              transform: `rotate(${emoji.rotate}deg) scale(${hidden ? 0.3 : 1})`,
              transition:
                popped === undefined
                  ? undefined
                  : `transform 550ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms, opacity 200ms ease-out ${delay}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

/** One feature row: text, then its card ~100ms later, fade up once on first view. */
function FeatureRow({ feature, imageFirst }: { feature: (typeof FEATURES)[number]; imageFirst: boolean }) {
  const [ref, shown] = useRevealOnce<HTMLDivElement>();
  const reveal = `transition-[opacity,transform] duration-[600ms] ease-out motion-reduce:transition-none ${
    shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
  }`;
  return (
    <div
      ref={ref}
      className={`flex flex-col items-center gap-10 lg:items-center lg:justify-between lg:gap-0 ${
        imageFirst ? 'lg:flex-row-reverse' : 'lg:flex-row'
      }`}
    >
      <div className={`relative z-10 flex w-full max-w-[474px] flex-col gap-5 lg:w-[39.4%] lg:gap-[31.5px] ${reveal}`}>
        <h3 className="landing-display text-[40px] leading-none text-black sm:text-[48px] lg:text-[min(4.07vw,58.5px)]">
          {feature.title}
        </h3>
        <p className="text-[18px] leading-[1.4] text-black/70 sm:text-[22px] lg:text-[min(1.88vw,27px)]">
          {feature.body}
        </p>
      </div>
      <div className={`w-full max-w-[584px] delay-100 lg:w-[48.55%] ${reveal}`}>
        {'chatArt' in feature ? (
          <ChatArtWithEmojis alt={feature.alt} popped={shown} className="aspect-[1246/1018] w-full" />
        ) : (
          <img
            src={feature.image}
            alt={feature.alt}
            className="block h-auto max-w-none"
            style={{
              width: feature.fit.width,
              marginLeft: feature.fit.left,
              marginTop: feature.fit.top,
              marginBottom: feature.fit.bottom,
              filter: 'halo' in feature ? `${CARD_SHADOW} ${FEATURE_HALO}` : CARD_SHADOW,
            }}
            draggable={false}
          />
        )}
      </div>
    </div>
  );
}

function StoreBadges({
  placement,
  slideId,
  size,
}: {
  placement: AppStoreClickPlacement;
  slideId: string;
  size: 'md' | 'lg';
}) {
  const googleClass =
    size === 'lg' ? 'h-[52px] w-auto sm:h-[70px]' : 'h-[48px] w-auto sm:h-[55.5px]';
  const appleClass =
    size === 'lg' ? 'h-[52px] w-auto sm:h-[70px]' : 'h-[48px] w-auto sm:h-[55.5px]';

  return (
    <div
      className={`flex flex-wrap items-center ${
        size === 'lg' ? 'justify-center gap-4 sm:gap-[28.6px]' : 'justify-center gap-4 sm:gap-[22.7px]'
      }`}
    >
      <a
        href={GOOGLE_PLAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block transition-opacity hover:opacity-90 active:opacity-80"
        aria-label="Get TotL on Google Play"
      >
        <img
          src={`${ASSETS}/google-play-badge.svg`}
          alt="Get it on Google Play"
          className={googleClass}
          draggable={false}
        />
      </a>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          trackAppStoreClick({ placement, slideId, linkUrl: APP_STORE_URL });
        }}
        className="inline-block transition-opacity hover:opacity-90 active:opacity-80"
        aria-label="Download on the App Store"
      >
        <img
          src={`${ASSETS}/app-store-badge.svg`}
          alt="Download on the App Store"
          className={appleClass}
          draggable={false}
        />
      </a>
    </div>
  );
}

function MarqueeStrip({ side }: { side: 'left' | 'right' }) {
  // Two identical halves so the -50% loop is seamless.
  const half = Array.from({ length: 4 }, () => MARQUEE_ITEMS).flat();
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 z-20 hidden w-[35px] overflow-hidden md:block ${
        side === 'left' ? 'left-0 rotate-180' : 'right-0'
      }`}
    >
      <div className="landing-marquee-track flex flex-col items-center [writing-mode:vertical-rl]">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center gap-[7px] pb-[7px]">
            {half.map((item, i) => (
              <span key={`${copy}-${i}`} className="flex items-center gap-[7px]">
                <span
                  className="whitespace-nowrap px-[12px] py-[4px] text-[16px] font-extrabold uppercase text-white"
                  style={{ fontFamily: "'Tourney', 'Gramatika', sans-serif", fontVariationSettings: "'wdth' 100" }}
                >
                  {item}
                </span>
                <span className="text-[16px] font-extrabold text-white">•</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Download-first marketing landing page (Figma "Desktop - 1").
 * Desktop matches the 1440px frame and scales down proportionally to 1024px;
 * below that, sections stack into a single column.
 */
export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  function handlePlayOnline() {
    if (user) {
      window.location.assign('/');
      return;
    }
    navigate('/auth?returnTo=/', { replace: true });
  }

  return (
    // The page is its own full-viewport scroller: index.html pins window scroll to 0
    // (mobile app-shell fix) and the mobile CSS locks html/body/#root.
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-white font-sans text-black">
      {/* ---------- Hero ---------- */}
      <header className="relative overflow-hidden bg-[#1a1a1a] pb-16 lg:pb-[min(10.42vw,150px)]">
        <img
          src={`${ASSETS}/hero-bg.jpg`}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <img
          src={`${ASSETS}/hero-swoosh.svg`}
          alt=""
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[76px] h-auto w-[79.68%] -translate-x-1/2 max-lg:w-[140%]"
          draggable={false}
        />

        <nav className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-9">
          <a href="/app" aria-label="TotL home" className="block">
            <img src={`${ASSETS}/logo.svg`} alt="TotL" className="h-12 w-[53.8px]" draggable={false} />
          </a>
          <div className="flex items-center gap-3 sm:gap-5">
            <a
              href="#download"
              onClick={(e) => {
                // Land with the green download block's bottom edge on the viewport bottom.
                const target = document.getElementById('download');
                if (!target) return;
                e.preventDefault();
                const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                target.scrollIntoView({ block: 'end', behavior: reduce ? 'auto' : 'smooth' });
              }}
              className="p-1 text-base text-white transition-opacity hover:opacity-80 sm:text-[20px]"
            >
              Download
            </a>
            <button
              type="button"
              onClick={handlePlayOnline}
              className="p-1 text-base text-white transition-opacity hover:opacity-80 sm:text-[20px]"
            >
              Play online
            </button>
          </div>
        </nav>

        {/* Centred hero: headline, subtitle and store badges (Figma 1:3126: 40.69px gaps,
            top 133px). Figma trims text boxes to cap height and baseline, so the negative
            margins remove the font's extra space above/below the glyphs (measured from
            Tourney and Gramatika metrics). The phones in the next section overlap the
            bottom padding, so they peek in under the badges. */}
        <div className="relative z-10 mx-auto flex max-w-[1440px] flex-col items-center gap-8 px-5 pt-8 text-center sm:px-9 lg:gap-[min(2.83vw,40.7px)] lg:pt-[min(3.68vw,53px)]">
          <h1 className="landing-display -my-[0.1em] text-[64px] leading-[0.9] tracking-[-0.035em] text-white sm:text-[96px] lg:text-[min(13.89vw,200px)]">
            TotL: Top of
            <br />
            the league
          </h1>
          <p className="text-[20px] leading-snug text-white sm:text-[26px] lg:-mb-[0.2405em] lg:-mt-[0.2622em] lg:text-[min(2.31vw,33.3px)] lg:leading-[normal]">
            Premier League predictions,
            <br />
            Mini leagues and Bragging rights.
          </p>
          <StoreBadges placement="splash" slideId="hero" size="md" />
        </div>
      </header>

      {/* ---------- Phones + download CTA ---------- */}
      <section
        id="download"
        className="relative z-10 flow-root pb-16 lg:pb-[min(5.49vw,79px)]"
        style={{ backgroundImage: GREEN_GRADIENT, backgroundSize: '100% 100%' }}
      >
        <img
          src={`${ASSETS}/green-shape.svg`}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
          draggable={false}
        />
        <MarqueeStrip side="left" />
        <MarqueeStrip side="right" />

        <img
          src={`${ASSETS}/phones.png`}
          alt="The TotL app on two iPhones: gameweek predictions and a swipe prediction card"
          className="relative mx-auto -mt-6 h-auto w-[92%] lg:-mt-[min(7.5vw,108px)] lg:ml-[min(8.82vw,127px)] lg:w-[min(82.85vw,1193px)]"
          draggable={false}
        />

        <div className="relative flex flex-col items-center gap-8 px-5 pt-6 text-center sm:px-8 lg:gap-[50px] lg:pt-[min(2.43vw,35px)]">
          <h2 className="landing-display max-w-[1376px] text-[48px] leading-[0.9] tracking-[-0.035em] text-white sm:text-[80px] lg:text-[min(8.33vw,120px)]">
            Psst, you don’t know anything about football!
          </h2>
          <p className="text-[20px] text-white sm:text-[26px] lg:text-[min(2.31vw,33.3px)]">
            Download now and earn your bragging rights
          </p>
          <StoreBadges placement="final_cta" slideId="download" size="lg" />
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="relative px-5 pb-24 pt-20 sm:px-9 lg:px-[min(8.13vw,117px)] lg:pb-[444px] lg:pt-[186px]">
        <div className="relative mx-auto max-w-[1203px]">
          {/* Decorative route line + rings (only where the column is its full 1203px). */}
          <RouteLine />

          <div className="relative flex flex-col gap-24 lg:gap-[200px]">
            {FEATURES.map((feature, i) => (
              <FeatureRow key={feature.id} feature={feature} imageFirst={i % 2 === 1} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

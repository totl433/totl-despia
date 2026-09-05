import RetroDailyTotlPattern from './RetroDailyTotlPattern';
import RetroDailyShimmer from './RetroDailyShimmer';

/**
 * Intro face — matches Expo: season + pixel copy + swipe hint over logo pattern.
 * Soft white shimmer like Expo WinnerShimmer on first view.
 * Type scales down on short Safari viewports so the card never overflows.
 */
export default function RetroDailyIntroCard({ seasonLabel }: { seasonLabel: string }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[28px] bg-[#0F766E] px-5 shadow-lg sm:px-7">
      <RetroDailyTotlPattern />
      <RetroDailyShimmer durationMs={1300} delayMs={4200} opacity={0.38} skipFirstDelay />
      <p className="relative z-[3] text-center text-[11px] font-bold uppercase tracking-[1.2px] text-white/75 sm:text-[13px]">
        Retro Totl Daily
      </p>
      <p
        className="relative z-[3] mt-3 text-center text-[clamp(22px,7vw,36px)] leading-[1.25] text-white sm:mt-5"
        style={{ fontFamily: "'PressStart2P', monospace" }}
      >
        {seasonLabel}
      </p>
      <p
        className="relative z-[3] mt-3 text-center text-[clamp(9px,2.8vw,12px)] leading-5 text-white/90 sm:mt-4"
        style={{ fontFamily: "'PressStart2P', monospace" }}
      >
        Ten fixtures.
        <br />
        Ten seconds each.
      </p>
      <p className="relative z-[3] mt-5 text-center text-sm font-extrabold leading-5 text-white sm:mt-8 sm:text-[15px]">
        Swipe to start
      </p>
    </div>
  );
}

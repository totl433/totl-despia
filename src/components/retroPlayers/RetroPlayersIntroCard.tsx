import RetroDailyTotlPattern from '../retroDaily/RetroDailyTotlPattern';
import RetroDailyShimmer from '../retroDaily/RetroDailyShimmer';

/** Intro face for Retro Totl Daily — The Players. */
export default function RetroPlayersIntroCard() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[28px] bg-[#0F766E] px-5 shadow-lg sm:px-7">
      <RetroDailyTotlPattern />
      <RetroDailyShimmer durationMs={1300} delayMs={4200} opacity={0.38} skipFirstDelay />
      <p className="relative z-[3] text-center text-[11px] font-bold uppercase tracking-[1.2px] text-white/75 sm:text-[13px]">
        Retro Totl Daily
      </p>
      <p
        className="relative z-[3] mt-3 text-center text-[clamp(18px,6vw,30px)] leading-[1.3] text-white sm:mt-5"
        style={{ fontFamily: "'PressStart2P', monospace" }}
      >
        The Players
      </p>
      <p
        className="relative z-[3] mt-3 text-center text-[clamp(9px,2.8vw,12px)] leading-5 text-white/90 sm:mt-4"
        style={{ fontFamily: "'PressStart2P', monospace" }}
      >
        Ten Players
        <br />
        Which Ten Clubs
      </p>
      <p className="relative z-[3] mt-5 text-center text-sm font-extrabold leading-5 text-white sm:mt-8 sm:text-[15px]">
        Swipe or tap Start
      </p>
    </div>
  );
}

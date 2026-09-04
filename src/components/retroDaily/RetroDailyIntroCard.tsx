import RetroDailyTotlPattern from './RetroDailyTotlPattern';

/**
 * Intro face — matches Expo: season + pixel copy + swipe hint over logo pattern.
 */
export default function RetroDailyIntroCard({ seasonLabel }: { seasonLabel: string }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[28px] bg-[#0F766E] px-7 shadow-lg">
      <RetroDailyTotlPattern />
      <p className="relative z-[1] text-center text-[13px] font-bold uppercase tracking-[1.2px] text-white/75">
        Retro Totl Daily
      </p>
      <p
        className="relative z-[1] mt-5 text-center text-[36px] leading-[48px] text-white"
        style={{ fontFamily: "'PressStart2P', monospace" }}
      >
        {seasonLabel}
      </p>
      <p
        className="relative z-[1] mt-4 text-center text-xs leading-5 text-white/90"
        style={{ fontFamily: "'PressStart2P', monospace" }}
      >
        Ten fixtures.
        <br />
        Ten seconds each.
      </p>
      <p className="relative z-[1] mt-8 text-center text-[15px] font-extrabold leading-5 text-white">
        Swipe to start
      </p>
    </div>
  );
}

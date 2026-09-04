import RetroDailyTotlPattern from './RetroDailyTotlPattern';

/** Teal card back with season year over the TOTL logo pattern. */
export default function RetroDailyLogoBack({ seasonLabel }: { seasonLabel?: string }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[28px] bg-[#0F766E] px-5 shadow-lg">
      <RetroDailyTotlPattern />
      {seasonLabel ? (
        <p
          className="relative z-[1] px-4 text-center text-[28px] leading-10 text-white"
          style={{ fontFamily: "'PressStart2P', monospace" }}
        >
          {seasonLabel}
        </p>
      ) : null}
    </div>
  );
}

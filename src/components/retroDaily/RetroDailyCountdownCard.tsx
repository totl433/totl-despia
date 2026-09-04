import RetroDailyTotlPattern from './RetroDailyTotlPattern';

/** 3-2-1 face — Press Start 2P on teal with logo pattern. */
export default function RetroDailyCountdownCard({ value }: { value: number }) {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[28px] bg-[#0F766E] shadow-lg">
      <RetroDailyTotlPattern />
      <span
        className="relative z-[1] select-none text-7xl leading-none text-white"
        style={{ fontFamily: "'PressStart2P', monospace" }}
      >
        {Math.max(1, value)}
      </span>
    </div>
  );
}

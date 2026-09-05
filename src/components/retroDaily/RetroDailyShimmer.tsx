/**
 * Diagonal shine sweep — web twin of Expo WinnerShimmer (white tint).
 * First pass runs immediately when skipFirstDelay; then delayMs between loops.
 */
export default function RetroDailyShimmer({
  durationMs = 1300,
  delayMs = 4200,
  opacity = 0.38,
  skipFirstDelay = true,
}: {
  durationMs?: number;
  delayMs?: number;
  opacity?: number;
  skipFirstDelay?: boolean;
}) {
  const cycleMs = durationMs + delayMs;
  const sweepPct = (durationMs / cycleMs) * 100;

  return (
    <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden rounded-[28px]" aria-hidden>
      <div
        className="absolute -inset-y-6 left-0 w-[55%]"
        style={{
          opacity,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.75) 50%, transparent 100%)',
          animation: `retroDailyShimmer ${cycleMs}ms ease-in-out infinite`,
          animationDelay: skipFirstDelay ? '0ms' : `${delayMs}ms`,
        }}
      />
      <style>{`
        @keyframes retroDailyShimmer {
          0% { transform: translateX(-120%) rotate(14deg); }
          ${sweepPct}% { transform: translateX(220%) rotate(14deg); }
          100% { transform: translateX(220%) rotate(14deg); }
        }
      `}</style>
    </div>
  );
}

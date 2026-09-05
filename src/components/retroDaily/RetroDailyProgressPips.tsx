export type PipResult = 'correct' | 'wrong' | 'pending';

/**
 * Dual-mode pips (fixed slot size so the row doesn’t jump between states):
 * - progress: fixture steps (empty → current → ✓)
 * - countdown: 10s timer — each pip is a second; active one pulses with the number
 * - results: end-of-run ✓ / ✗ / empty from actual outcomes
 */
export default function RetroDailyProgressPips({
  total,
  completed,
  current,
  mode = 'progress',
  secondsLeft = 10,
  timerPct = 1,
  results,
}: {
  total: number;
  completed: number;
  current: number;
  mode?: 'progress' | 'countdown' | 'results';
  /** Whole seconds remaining (10 → 1) while countdown is running. */
  secondsLeft?: number;
  /** 1 = full time (blue), 0 = expired (red). */
  timerPct?: number;
  /** End screen: one entry per fixture. */
  results?: PipResult[];
}) {
  /** Every pip sits in the same box so modes never shift the row. */
  const slot = 'flex h-7 w-7 shrink-0 items-center justify-center';

  if (mode === 'countdown') {
    const n = Math.max(1, Math.min(total, Math.round(secondsLeft)));
    // Countdown runs right → left: 10 on the rightmost pip, then 9, …
    const activeIndex = n - 1;
    const color = timerColorFromPct(timerPct);

    return (
      <div
        className="flex h-7 items-center justify-center gap-1.5"
        role="timer"
        aria-label={`${n} second${n === 1 ? '' : 's'} left`}
      >
        <style>{`
          @keyframes retroPipPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.12); }
          }
        `}</style>
        {Array.from({ length: total }, (_, i) => {
          const elapsed = i > activeIndex;
          const active = i === activeIndex;
          return (
            <span key={i} className={slot}>
              {active ? (
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black leading-none text-white shadow-md"
                  style={{
                    backgroundColor: color,
                    animation: 'retroPipPulse 0.9s ease-in-out infinite',
                  }}
                >
                  {n}
                </span>
              ) : elapsed ? (
                <span className="block h-3 w-3 rounded-full bg-white/25" />
              ) : (
                <span className="block h-3.5 w-3.5 rounded-full bg-white/40" />
              )}
            </span>
          );
        })}
      </div>
    );
  }

  if (mode === 'results') {
    const row = results ?? Array.from({ length: total }, () => 'pending' as PipResult);
    const correctCount = row.filter((r) => r === 'correct').length;
    return (
      <div
        className="flex h-7 items-center justify-center gap-1.5"
        role="list"
        aria-label={`Score ${correctCount} of ${total}`}
      >
        {Array.from({ length: total }, (_, i) => {
          const r = row[i] ?? 'pending';
          return (
            <span key={i} role="listitem" className={slot}>
              {r === 'correct' ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1C8376] text-[11px] font-black leading-none text-white">
                  ✓
                </span>
              ) : r === 'wrong' ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DC2626] text-[11px] font-black leading-none text-white">
                  ✗
                </span>
              ) : (
                <span className="block h-3.5 w-3.5 rounded-full bg-white/25" />
              )}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="flex h-7 items-center justify-center gap-1.5"
      role="list"
      aria-label={`Fixture ${Math.min(current + 1, total)} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const done = i < completed;
        const active = !done && i === current;
        return (
          <span
            key={i}
            role="listitem"
            aria-label={done ? `Fixture ${i + 1} done` : active ? `Fixture ${i + 1} current` : `Fixture ${i + 1}`}
            className={slot}
          >
            {done ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1C8376] text-[11px] font-black leading-none text-white">
                ✓
              </span>
            ) : (
              <span
                className={`block rounded-full ${
                  active ? 'h-3.5 w-3.5 bg-white' : 'h-3.5 w-3.5 bg-white/35'
                }`}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

/** Same blue→red ramp as the old top timer bar. */
function timerColorFromPct(p: number): string {
  const t = Math.min(1, Math.max(0, p));
  const r = Math.round(59 + (220 - 59) * (1 - t));
  const g = Math.round(130 + (38 - 130) * (1 - t));
  const b = Math.round(246 + (38 - 246) * (1 - t));
  return `rgb(${r},${g},${b})`;
}

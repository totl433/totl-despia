
export interface PickChipProps {
  letter: string;
  correct: boolean | null;
  unicorn: boolean;
  hasSubmitted?: boolean;
  isLive?: boolean;
  isOngoing?: boolean;
  isFinished?: boolean;
}

/**
 * PickChip - Displays a user's pick as a colored chip with their initial
 * Used in League page to show who picked what for each fixture
 */
export default function PickChip({
  letter,
  correct,
  unicorn,
  hasSubmitted,
  isLive,
  isOngoing,
  isFinished,
}: PickChipProps) {
  // Logic matches Home Page:
  // - Pulsing green when correct during live/ongoing games
  // - Pulsing shiny gradient when correct in finished games
  // - Green when submitted (even if no result or incorrect)
  // - Grey when member hasn't submitted
  let tone: string;
  if (correct === true) {
    // PRIORITY: Check live/ongoing FIRST - never show shiny during live games
    if (isLive || isOngoing) {
      // Live and correct - pulse in emerald green
      tone = "bg-emerald-600 text-white border-emerald-600 animate-pulse shadow-lg shadow-emerald-500/50";
    } else if (isFinished) {
      // Shiny gradient with pulse for correct picks in finished games
      tone = "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-xl shadow-yellow-400/40 relative overflow-hidden animate-pulse before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]";
    } else {
      // Correct but game hasn't started - show emerald green (no pulse, no shiny)
      tone = "bg-emerald-600 text-white border-emerald-600";
    }
  } else if (hasSubmitted) {
    // Green when submitted (even if no result or incorrect)
    tone = "bg-emerald-600 text-white border-emerald-600";
  } else {
    // Grey when not submitted
    tone = "bg-slate-100 text-slate-600 border-slate-200";
  }

  return (
    <span
      className={[
        "inline-flex items-center justify-center h-5 min-w-[18px] px-1.5",
        "rounded-full border text-[11px] font-semibold mb-0.5",
        "align-middle",
        tone,
      ].join(" ")}
      title={unicorn ? "Correct!" : undefined}
    >
      {letter}
    </span>
  );
}


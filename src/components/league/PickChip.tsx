import UserAvatar from '../UserAvatar';

export interface PickChipProps {
  letter: string;
  userId?: string;
  userName?: string | null;
  correct: boolean | null;
  unicorn: boolean;
  hasSubmitted?: boolean;
  isLive?: boolean;
  isOngoing?: boolean;
  isFinished?: boolean;
}

/**
 * PickChip - Displays a user's pick as a colored chip with their avatar
 * Used in League page to show who picked what for each fixture
 */
export default function PickChip({
  letter,
  userId,
  userName,
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
      // Fun, visible shimmer for correct picks in finished games
      // Using a wider, brighter shimmer with faster animation for more fun
      tone = "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white relative overflow-hidden before:absolute before:inset-0 before:z-10 before:pointer-events-none before:w-[200%] before:bg-gradient-to-r before:from-transparent before:via-white/40 before:via-white/50 before:via-white/40 before:to-transparent before:animate-[shimmer_2.5s_ease-in-out_infinite] after:absolute after:inset-0 after:z-10 after:pointer-events-none after:w-[200%] after:bg-gradient-to-r after:from-transparent after:via-yellow-200/30 after:via-yellow-200/40 after:via-yellow-200/30 after:to-transparent after:animate-[shimmer_3s_ease-in-out_infinite_0.5s]";
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

  // Use avatar if userId is provided, otherwise fallback to letter
  const useAvatar = !!userId;

  // Remove border classes from tone when using avatars
  const finalTone = useAvatar ? tone.replace(/\bborder-\S+/g, '').trim() : tone;

  return (
    <span
      className={[
        "inline-flex items-center justify-center",
        useAvatar ? "h-9 w-9 min-w-[36px]" : "h-5 min-w-[18px]",
        useAvatar ? "rounded-full mb-0.5" : "rounded-full border mb-0.5",
        "align-middle overflow-hidden",
        useAvatar ? "p-0" : "px-1.5 text-xs font-semibold",
        finalTone,
      ].join(" ")}
      title={unicorn ? "Correct!" : userName || undefined}
    >
      {useAvatar ? (
        <UserAvatar
          userId={userId}
          name={userName}
          size={36}
          className="border-0 relative z-0"
          fallbackToInitials={true}
        />
      ) : (
        letter
      )}
    </span>
  );
}


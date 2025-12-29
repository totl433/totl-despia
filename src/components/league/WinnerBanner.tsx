
export interface WinnerBannerProps {
  winnerName: string;
  isDraw: boolean;
}

/**
 * WinnerBanner - Displays the winner of a gameweek with a shiny gradient effect
 * Used in GW Results tab when all fixtures have finished
 */
export default function WinnerBanner({ winnerName, isDraw }: WinnerBannerProps) {
  return (
    <div className="mt-4 mb-4 py-6 px-6 rounded-xl bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 shadow-2xl shadow-slate-600/50 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/30 after:to-transparent after:animate-[shimmer_2.5s_ease-in-out_infinite_0.6s]">
      <div className="text-center relative z-10">
        {isDraw ? (
          <div className="text-lg font-bold text-white break-words whitespace-normal px-2 leading-normal">It's a Draw!</div>
        ) : (
          <div className="text-lg font-bold text-white break-words whitespace-normal px-2 leading-normal">{winnerName} Wins!</div>
        )}
      </div>
    </div>
  );
}


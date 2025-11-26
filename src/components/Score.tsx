
export type ScoreProps = {
  score: number;
  total: number;
  className?: string;
};

/**
 * Score component - displays score in format "Score X / Y"
 * Used for displaying gameweek scores
 */
export default function Score({ score, total, className = "" }: ScoreProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white bg-slate-600 ${className}`}>
      <span className="text-xs sm:text-sm font-medium opacity-90">Score</span>
      <span className="flex items-baseline gap-0.5">
        <span className="text-base sm:text-lg font-semibold">{score}</span>
        <span className="text-sm sm:text-base font-medium opacity-90">/</span>
        <span className="text-base sm:text-lg font-semibold opacity-80">{total}</span>
      </span>
    </div>
  );
}



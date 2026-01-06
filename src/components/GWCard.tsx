export type GWCardProps = {
  gw: number;
  score: number | null;
  submitted: boolean;
};

/**
 * Gameweek score card showing last week's score
 */
export default function GWCard({ gw, score, submitted }: GWCardProps) {
  const display = score !== null ? score : (submitted ? 0 : NaN);
  
  return (
    <div className="h-full rounded-3xl border-2 border-[#1C8376]/20 bg-amber-50/60 p-4 sm:p-6 relative flex items-center justify-center">
      {/* Corner badges */}
      <div className="absolute top-4 left-4 text-[#1C8376] text-sm sm:text-base font-semibold">
        GW{gw}
      </div>
      <div className="absolute bottom-4 left-4 text-[#1C8376] text-sm sm:text-base font-semibold">
        Last week's score
      </div>
      {/* Big score */}
      <div>
        {Number.isNaN(display) ? (
          <span className="text-5xl sm:text-6xl text-slate-900">—</span>
        ) : (
          <span className="text-5xl sm:text-6xl text-slate-900">{display}</span>
        )}
      </div>
    </div>
  );
}








































/** Rules modal for web RTD. */
export default function RetroDailyRulesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white px-5 pb-8 pt-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-medium text-slate-900">Retro Totl Daily — Rules</h2>
        <div className="mt-4 space-y-4">
          <Rule
            title="One season a day"
            body="Each day unlocks a Premier League season from the past. Everyone gets the same 10 fixtures."
          />
          <Rule
            title="Guess the result"
            body="Swipe left for Home, right for Away, or down for a Draw — or use the buttons. One guess per card."
          />
          <Rule
            title="Ten seconds"
            body="The bar above the card is your clock. It turns red as time runs out — if it hits zero, you’re out."
          />
          <Rule
            title="Stay alive"
            body="Get it right to keep going. Get it wrong (or time out) and that run ends after the reveal."
          />
          <Rule
            title="Your score"
            body="Score is how far you get through the 10. Nail all 10 and we’ll make some noise."
          />
          <Rule
            title="Fair play"
            body="Live game: one attempt per day after 8am UK. This admin build lets you replay as much as you like."
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-14 w-full rounded-xl bg-[#1C8376] text-base font-black text-white"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function Rule({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-sm font-extrabold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}

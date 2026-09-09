/** Rules for Retro Totl Daily — The Players. */
export default function RetroPlayersRulesModal({
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
        <h2 className="text-xl font-medium text-slate-900">The Players — Rules</h2>
        <div className="mt-4 space-y-4">
          <Rule
            title="Guess the club"
            body="Each card shows a Premier League player and one season. Pick which club he played for that season."
          />
          <Rule
            title="One season"
            body="The clue is a single year — e.g. 96/97. After you answer, you’ll see the full spell at that club."
          />
          <Rule
            title="Gets harder"
            body="Later cards lean on short spells — and often put another club from their career in the options."
          />
          <Rule
            title="Ten seconds"
            body="Swipe the card or tap a club. If the timer hits zero, that run ends."
          />
          <Rule
            title="Stay alive"
            body="Get it right to keep going. Wrong answer or timeout — check the reveal, then see your score."
          />
          <Rule
            title="Appearances"
            body="Totals are Premier League league games for that club across their career."
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

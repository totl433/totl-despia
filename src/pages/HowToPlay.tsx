import { useState } from "react";
import Section from "../components/Section";
import { PageHeader } from "../components/PageHeader";

export default function HowToPlayPage() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    predictions: true, // Open by default
    leaderboard: false,
    form: false,
    "mini-leagues": false,
    unicorns: false,
    summary: false,
  });


  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-4 pb-16">
        {/* Header */}
        <PageHeader title="How To Play" as="h2" />
        <p className="mt-2 mb-2 text-sm text-slate-600 w-full">
            Welcome to TOTL (Top of the League) — the game of quick Predictions and friendly rivalries. Here's how it all works.
          </p>
        <div className="flex justify-center mb-2">
          <img 
            src="/assets/Volley/Volley-Coach.png" 
            alt="" 
            className="w-24 h-24 object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Sections */}
        <div className="space-y-4">
          <Section id="predictions" title="Predictions Centre" icon="🎯" collapsible defaultOpen={openSections.predictions} onToggle={(isOpen: boolean) => setOpenSections(prev => ({ ...prev, predictions: isOpen }))}>
            <div className="space-y-4">
              <p className="text-base leading-relaxed">
                Before each Premier League Gameweek, head to the <strong>Predictions Centre</strong> and make your
                picks for every match — <strong>Home Win</strong>, <strong>Draw</strong>, or <strong>Away Win</strong>.
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-semibold text-amber-800 mb-2">⚠️ Important</h3>
                <p className="text-amber-700">
                  Once the first match kicks off, predictions are locked, so make sure you get them in before the deadline.
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <h3 className="font-semibold text-emerald-800 mb-2">📊 Scoring</h3>
                <p className="text-emerald-700">
                  Each correct Prediction adds <strong>1</strong> to your <strong>Overall Correct Predictions (OCP)</strong> — that's your running total for the season.
                </p>
              </div>
            </div>
          </Section>

          <Section id="mini-leagues" title="Mini-Leagues" icon="🏆" collapsible defaultOpen={openSections['mini-leagues']} onToggle={(isOpen: boolean) => setOpenSections(prev => ({ ...prev, 'mini-leagues': isOpen }))}>
            <div className="space-y-4">
              <p className="text-base leading-relaxed">
                Want to play with your friends? Create a <strong>Mini-League</strong> and invite up to <strong>8 players</strong> to join.
                Share your league code, get everyone predicting, and battle it out week by week.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-800 mb-2">How it works:</h3>
                <p className="text-slate-700">
                  Each Gameweek, whoever gets the <strong>most correct Predictions</strong> wins that week.
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <h3 className="font-semibold text-emerald-800 mb-3">League Points:</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-600 font-bold">■</span>
                    <span className="text-emerald-700"><strong>Win the week</strong> – 3 points</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-600 font-bold">■</span>
                    <span className="text-emerald-700"><strong>Draw</strong> – 1 point</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-600 font-bold">■</span>
                    <span className="text-emerald-700"><strong>Lose</strong> – 0 points</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-2">🤝 Ties</h3>
                <p className="text-blue-700">
                  If two or more players finish with the same number of correct Predictions, the player with
                  the most <strong>Unicorns</strong> wins the week. Still tied? It's a draw.
                </p>
              </div>
            </div>
          </Section>

          <Section id="unicorns" title="Unicorns" icon="🦄" collapsible defaultOpen={openSections.unicorns} onToggle={(isOpen: boolean) => setOpenSections(prev => ({ ...prev, unicorns: isOpen }))}>
            <div className="space-y-4">
              <p className="text-base leading-relaxed">
                In Mini-Leagues with <strong>3 or more players</strong>, if you're the <strong>only person</strong> to correctly predict a
                fixture, that's a <strong>Unicorn</strong>.
              </p>
              
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-semibold text-purple-800 mb-2">💡 Strategy Tip</h3>
                <p className="text-purple-700">
                  They can make all the difference in tight weeks — so sometimes
                  it's worth backing the surprise result nobody else will.
                </p>
              </div>
            </div>
          </Section>

          <Section id="leaderboard" title="Leaderboard" icon="📈" collapsible defaultOpen={openSections.leaderboard} onToggle={(isOpen: boolean) => setOpenSections(prev => ({ ...prev, leaderboard: isOpen }))}>
            <div className="space-y-4">
              <p className="text-base leading-relaxed">
                The <strong>Leaderboard</strong> shows how you stack up against everyone else playing TOTL.
              </p>
              
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <h3 className="font-semibold text-emerald-800 mb-2">🎯 Simple Rules</h3>
                <p className="text-emerald-700">
                  The more correct Predictions you make, the higher you climb. <strong>No extra points, no ties</strong> — just football instincts and consistency.
                </p>
              </div>
            </div>
          </Section>

          <Section id="form" title="Form Leaderboards" icon="⚡" collapsible defaultOpen={openSections.form} onToggle={(isOpen: boolean) => setOpenSections(prev => ({ ...prev, form: isOpen }))}>
            <div className="space-y-4">
              <p className="text-base leading-relaxed">
                <strong>Form Leaderboards</strong> focus on how you're performing <strong>right now</strong>, not over the whole season.
              </p>

              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 mb-2">⚡ 5-Week Form Table</h3>
                  <p className="text-blue-700">
                    Your short-term <strong>"hot streak"</strong> — great for spotting who's on fire lately.
                  </p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-800 mb-2">🔥 10-Week Form Table</h3>
                  <p className="text-purple-700">
                    The standard rolling form that rewards <strong>consistency and momentum</strong>.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-800 mb-2">📊 How They Work</h3>
                <p className="text-slate-700">
                  Both update each week and show the players in top form. To appear on the <strong>10-Week Form Table</strong>, make sure you've played 10 Gameweeks in a row — <strong>consistency is key</strong>!
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-semibold text-amber-800 mb-2">💡 Don't worry if you joined TOTL late</h3>
                <p className="text-amber-700">
                  Once you've played enough weeks, you'll automatically show up in these tables.
                </p>
              </div>
            </div>
          </Section>

          <Section id="summary" title="That's It" icon="🎉" collapsible defaultOpen={openSections.summary} onToggle={(isOpen: boolean) => setOpenSections(prev => ({ ...prev, summary: isOpen }))}>
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-lg p-4">
                <h3 className="font-semibold text-emerald-800 mb-2">🏆 Your Mission</h3>
                <p className="text-emerald-700">
                  Predict each week. Beat your mates. Climb the Leaderboard — or rise up the Form
                  Tables. Stay sharp and see who's truly <strong>Top of the League</strong>.
                </p>
              </div>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Ready to Start Playing?</h3>
            <p className="text-slate-600 mb-4">
              Head to the Predictions page and make your first picks!
            </p>
            <a
              href="/predictions"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              <span>🎯</span>
              Make Predictions
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

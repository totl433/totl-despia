import { useState } from "react";
import Section from "../components/Section";
import { PageHeader } from "../components/PageHeader";

export default function HowToPlayPage() {
 const [openSections, setOpenSections] = useState<Record<string, boolean>>({
 predictions: true, // Open by default
 leaderboard: false,
 monthly: false,
 "mini-leagues": false,
 unicorns: false,
 summary: false,
 });


 return (
 <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
 <div className="mx-auto max-w-6xl lg:max-w-[1024px] px-4 lg:px-6 py-4 pb-16">
 {/* Header */}
 <PageHeader title="How To Play" as="h2" />
 <p className="mt-2 mb-2 lg:mb-6 text-sm text-slate-600 dark:text-slate-300 w-full">
 Welcome to TOTL (Top of the League) — the game of quick Predictions and friendly rivalries. Here's how it all works.
 </p>
 <div className="flex justify-center mb-2 lg:hidden">
 <img 
 src="/assets/Volley/Volley-Coach.png" 
 alt="" 
 className="w-24 h-24 object-contain"
 style={{ imageRendering: 'pixelated' }}
 />
 </div>

 {/* Sections */}
 <div className="space-y-4">
 <Section id="predictions" title="Predictions" icon="🎯" collapsible defaultOpen={openSections.predictions} onToggle={(isOpen: boolean) => setOpenSections(prev => ({ ...prev, predictions: isOpen }))}>
 <div className="space-y-4">
 <p className="text-base leading-relaxed text-slate-900 dark:text-slate-100">
 Before each Premier League Gameweek, head to <strong>Predictions</strong> and make your
 predictions for every match — <strong>Home Win</strong>, <strong>Draw</strong>, or <strong>Away Win</strong>.
 </p>
 
 <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
 <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">⚠️ Important</h3>
 <p className="text-amber-700 dark:text-amber-300">
 Once the first match kicks off, predictions are locked, so make sure you get them in before the deadline.
 </p>
 </div>

 <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
 <h3 className="font-semibold text-emerald-800 dark:text-emerald-300 mb-2">📊 Scoring</h3>
 <p className="text-emerald-700 dark:text-emerald-300">
 Each correct Prediction adds <strong>1</strong> to your <strong>Overall Correct Predictions (OCP)</strong> — that's your running total for the season.
 </p>
 </div>
 </div>
 </Section>

 <Section id="mini-leagues" title="Mini-Leagues" icon="🏆" collapsible defaultOpen={openSections['mini-leagues']} onToggle={(isOpen: boolean) => setOpenSections(prev => ({ ...prev, 'mini-leagues': isOpen }))}>
 <div className="space-y-4">
 <p className="text-base leading-relaxed text-slate-900 dark:text-slate-100">
 Want to play with your friends? Create a <strong>Mini-League</strong> and invite up to <strong>8 players</strong> to join.
 Share your league code, get everyone predicting, and battle it out week by week.
 </p>

 <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
 <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">How it works:</h3>
 <p className="text-slate-700 dark:text-slate-300">
 Each Gameweek, whoever gets the <strong>most correct Predictions</strong> wins that week.
 </p>
 </div>

 <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
 <h3 className="font-semibold text-emerald-800 mb-3">League Points:</h3>
 <div className="space-y-2">
 <div className="flex items-center gap-3">
 <span className="text-emerald-600 dark:text-emerald-400 font-bold">■</span>
 <span className="text-emerald-700 dark:text-emerald-300"><strong>Win the week</strong> – 3 points</span>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-emerald-600 dark:text-emerald-400 font-bold">■</span>
 <span className="text-emerald-700 dark:text-emerald-300"><strong>Draw</strong> – 1 point</span>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-emerald-600 dark:text-emerald-400 font-bold">■</span>
 <span className="text-emerald-700 dark:text-emerald-300"><strong>Lose</strong> – 0 points</span>
 </div>
 </div>
 </div>

 <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
 <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">🤝 Ties</h3>
 <p className="text-blue-700 dark:text-blue-300">
 If two or more players finish with the same number of correct Predictions, the player with
 the most <strong>Unicorns</strong> wins the week. Still tied? It's a draw.
 </p>
 </div>
 </div>
 </Section>

 <Section id="unicorns" title="Unicorns" icon="🦄" collapsible defaultOpen={openSections.unicorns} onToggle={(isOpen: boolean) => setOpenSections(prev => ({ ...prev, unicorns: isOpen }))}>
 <div className="space-y-4">
 <p className="text-base leading-relaxed text-slate-900 dark:text-slate-100">
 In Mini-Leagues with <strong>3 or more players</strong>, if you're the <strong>only person</strong> to correctly predict a
 fixture, that's a <strong>Unicorn</strong>.
 </p>
 
 <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
 <h3 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">💡 Strategy Tip</h3>
 <p className="text-purple-700 dark:text-purple-300">
 They can make all the difference in tight weeks — so sometimes
 it's worth backing the surprise result nobody else will.
 </p>
 </div>
 </div>
 </Section>

 <Section id="leaderboard" title="Leaderboard" icon="📈" collapsible defaultOpen={openSections.leaderboard} onToggle={(isOpen: boolean) => setOpenSections(prev => ({ ...prev, leaderboard: isOpen }))}>
 <div className="space-y-4">
 <p className="text-base leading-relaxed text-slate-900 dark:text-slate-100">
 The <strong>Leaderboard</strong> shows how you stack up against everyone else playing TOTL.
 </p>
 
 <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
 <h3 className="font-semibold text-emerald-800 mb-2">🎯 Simple Rules</h3>
 <p className="text-emerald-700">
 The more correct Predictions you make, the higher you climb. There's an <strong>Overall</strong> table for the season, a <strong>Gameweek</strong> table for this week, and a <strong>Monthly</strong> table that resets each month.
 </p>
 </div>
 </div>
 </Section>

 <Section id="monthly" title="Monthly comps" icon="📅" collapsible defaultOpen={openSections.monthly} onToggle={(isOpen: boolean) => setOpenSections(prev => ({ ...prev, monthly: isOpen }))}>
 <div className="space-y-4">
 <p className="text-base leading-relaxed text-slate-900 dark:text-slate-100">
 The <strong>Monthly</strong> table is a fresh race each calendar month. Same scoring as everything else: <strong>1 point per correct Prediction</strong>, added up across that month's Gameweeks.
 </p>

 <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
 <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">⏰ Joined late?</h3>
 <p className="text-amber-700 dark:text-amber-300">
 You can still win the month. Each month starts from zero, so you don't need a season's worth of weeks behind you.
 </p>
 </div>

 <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
 <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">📊 How you get on the table</h3>
 <p className="text-slate-700 dark:text-slate-300">
 Submit for a Gameweek in that month and you're in, even if you're still on 0.
 </p>
 </div>

 <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
 <h3 className="font-semibold text-emerald-800 dark:text-emerald-300 mb-2">🏆 Winning the month</h3>
 <p className="text-emerald-700 dark:text-emerald-300">
 When the last Gameweek of the month is finished, whoever has the most points that month wins. <strong>Ties share first</strong> — everyone on the top score gets the month.
 </p>
 </div>

 <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
 <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">🏅 Trophies</h3>
 <p className="text-blue-700 dark:text-blue-300">
 A monthly win (or a tie for first) goes in your trophy cabinet, alongside Gameweek wins.
 </p>
 </div>
 </div>
 </Section>

 <Section id="summary" title="That's It" icon="🎉" collapsible defaultOpen={openSections.summary} onToggle={(isOpen: boolean) => setOpenSections(prev => ({ ...prev, summary: isOpen }))}>
 <div className="space-y-4">
 <div className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
 <h3 className="font-semibold text-emerald-800 dark:text-emerald-300 mb-2">🏆 Your Mission</h3>
 <p className="text-emerald-700 dark:text-emerald-300">
 Predict each week. Beat your mates. Climb Overall — or win the month. Stay sharp and see who's truly <strong>Top of the League</strong>.
 </p>
 </div>
 </div>
 </Section>
 </div>

 {/* Footer */}
 <div className="mt-12 text-center">
 <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
 <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Ready to Start Playing?</h3>
 <p className="text-slate-600 dark:text-slate-300 mb-4">
 Head to the Predictions page and make your first picks!
 </p>
 <a
 href="/predictions"
 className="inline-flex items-center gap-2 bg-emerald-600 text-white font-semibold px-6 py-3 rounded-lg"
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

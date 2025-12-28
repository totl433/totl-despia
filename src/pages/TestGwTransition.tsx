import { useState } from "react";
import { PageHeader } from "../components/PageHeader";

export default function TestGwTransition() {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showGw19, setShowGw19] = useState(false);

  const handleTransition = () => {
    setIsTransitioning(true);
    
    // After shimmer animation completes, switch to GW19
    setTimeout(() => {
      setShowGw19(true);
      setIsTransitioning(false);
    }, 1200); // Match animation duration (slightly longer for staggered effect)
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pt-2 pb-4 min-h-screen relative">
      {/* Banner */}
      {!showGw19 && (
        <div className="mb-4 rounded-xl border bg-gradient-to-br from-[#1C8376]/10 to-blue-50/50 shadow-sm px-6 py-5">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <svg className="w-6 h-6 text-[#1C8376]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-900">Gameweek 19 is ready for you. Play now?</h3>
            </div>
            <button
              onClick={handleTransition}
              disabled={isTransitioning}
              className="px-6 py-2.5 bg-[#1C8376] text-white rounded-full font-medium hover:bg-[#1C8376]/90 transition-colors disabled:opacity-50"
            >
              {isTransitioning ? "Transitioning..." : "Let's Go!"}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div>
        <PageHeader title={showGw19 ? "Gameweek 19" : "Gameweek 18 Results"} />
        
        <div className="mt-6 space-y-4">
          {/* Leaderboard Cards */}
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`rounded-xl border bg-white shadow-sm p-4 h-32 flex items-center justify-center relative overflow-hidden ${
                  isTransitioning ? 'shimmer-box' : ''
                }`}
                style={{
                  animationDelay: `${i * 100}ms`
                }}
              >
                <div className="text-center relative z-10">
                  <div className="text-2xl font-bold text-[#1C8376]">{showGw19 ? 'GW19' : 'GW18'}</div>
                  <div className="text-sm text-slate-600">Card {i}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Mini Leagues */}
          <div className={`rounded-xl border bg-white shadow-sm p-6 relative overflow-hidden ${
            isTransitioning ? 'shimmer-box' : ''
          }`}
          style={{
            animationDelay: '500ms'
          }}
          >
            <div className="relative z-10">
              <h3 className="font-semibold mb-4">Mini Leagues</h3>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span>League {i}</span>
                    <span className="text-sm text-slate-600">{showGw19 ? 'GW19 Ready' : 'GW18 Complete'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Games Section */}
          <div className={`rounded-xl border bg-white shadow-sm p-6 relative overflow-hidden ${
            isTransitioning ? 'shimmer-box' : ''
          }`}
          style={{
            animationDelay: '800ms'
          }}
          >
            <div className="relative z-10">
              <h3 className="font-semibold mb-4">Games</h3>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span>Game {i}</span>
                    <span className="text-sm text-slate-600">{showGw19 ? 'Upcoming' : 'Finished'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer-box-sweep {
          0% {
            transform: translateX(-100%) skewX(-15deg);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateX(200%) skewX(-15deg);
            opacity: 0;
          }
        }

        .shimmer-box::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.6) 25%,
            rgba(28, 131, 118, 0.25) 50%,
            rgba(255, 255, 255, 0.6) 75%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: shimmer-box-sweep 0.8s ease-in-out;
          pointer-events: none;
          z-index: 1;
        }
      `}</style>
    </div>
  );
}


import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { APP_STORE_URL, setPreferPlayOnline } from '../lib/playOnlinePreference';

const SECTIONS = [
  {
    title: 'Predict every gameweek',
    body: 'Ten fixtures. Three outcomes. Score out of 10 depending on how often you’re right, or confidently wrong.',
  },
  {
    title: 'Climb the global leaderboard',
    body: 'Every correct prediction adds up. Follow your gut, stay consistent and work from beginner to actual menace.',
  },
  {
    title: 'Mini leagues get personal',
    body: 'Create leagues with 2–8 friends. Each week is head-to-head. Highest score wins. Group chats take a hit.',
  },
  {
    title: 'Start anytime and still compete',
    body: 'Joined late? Fear not. Your form tracks the last 5 and 10 weeks, so every gameweek is a chance to push on.',
  },
] as const;

/**
 * Download-first marketing page for web.
 * Used at / and /app — primary CTA is the App Store; Play online is the escape hatch.
 */
export default function GetAppPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  function handlePlayOnline() {
    setPreferPlayOnline();
    if (user) {
      // Hard assign so / remounts and picks up the cookie (soft nav may no-op on /).
      window.location.assign('/');
      return;
    }
    navigate('/auth?returnTo=/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#0b1f1c] text-white">
      {/* Hero — stadium vibe placeholder until Carl swaps the real asset */}
      <section
        className="relative flex flex-col overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% 0%, #1a4a42 0%, #0b1f1c 55%, #061412 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 80%, rgba(28,131,118,0.45) 0%, transparent 40%), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.08) 0%, transparent 35%)',
          }}
        />

        <div className="relative z-10 px-5 pt-2 pb-5 w-full max-w-lg mx-auto text-center">
          <img
            src="/assets/badges/totl-logo1.svg"
            alt="TotL"
            className="mx-auto h-12 w-auto -mt-1 mb-2 drop-shadow-lg"
          />
          <p className="text-xl font-semibold tracking-tight text-white/95 mb-1">
            Gamify your gameday
          </p>
          <p className="text-white/70 text-sm mb-5 max-w-sm mx-auto leading-snug">
            Premier League predictions. Mini leagues. Bragging rights.
          </p>

          <div className="flex flex-col gap-2">
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-xl bg-white text-[#0b1f1c] text-[15px] font-semibold"
            >
              Download on the App Store
            </a>
            <button
              type="button"
              disabled
              className="w-full py-2.5 rounded-xl border border-white/25 text-white/50 text-[15px] font-medium cursor-not-allowed"
              aria-disabled="true"
            >
              Google Play — Coming soon
            </button>
            <button
              type="button"
              onClick={handlePlayOnline}
              className="w-full py-2 text-white/85 text-sm font-medium underline underline-offset-4 decoration-white/40"
            >
              Play online
            </button>
          </div>
        </div>
      </section>

      {SECTIONS.map((section) => (
        <section
          key={section.title}
          className="px-5 py-6 border-t border-white/10 max-w-lg mx-auto"
        >
          <h2 className="text-lg font-semibold tracking-tight text-white mb-1.5">
            {section.title}
          </h2>
          <p className="text-white/70 text-sm leading-snug">{section.body}</p>
        </section>
      ))}

      <footer className="px-5 py-6 border-t border-white/10 text-center max-w-lg mx-auto">
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full py-3 rounded-xl bg-[#1C8376] text-white text-[15px] font-semibold mb-3"
        >
          Get the app
        </a>
        <button
          type="button"
          onClick={handlePlayOnline}
          className="text-white/70 text-sm underline underline-offset-4"
        >
          Continue in browser
        </button>
        <p className="mt-5 text-xs text-white/40">TotL — Top of the League</p>
      </footer>
    </div>
  );
}

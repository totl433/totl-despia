import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { isDespiaAvailable } from '../lib/platform';
import { onAppScroll } from '../lib/appScroll';

/**
 * Top-right profile / how-to-play shortcuts on the home page (mobile).
 * Sits under the sticky GW predictions banner when present; otherwise flush top-right.
 * Does NOT track in-content promos (e.g. new-season banner) — those pushed the icons down.
 */
export default function FloatingProfile() {
  const [topOffsetPx, setTopOffsetPx] = useState(16);
  const isNativeApp = isDespiaAvailable();

  useEffect(() => {
    const checkBanner = () => {
      // Only the full-width GW strip at the top of the viewport (PredictionsBanner /
      // ComingSoonBanner). Mid-page promos must not affect this.
      const banners = document.querySelectorAll('.gameweek-banner');
      let offset = 16;

      banners.forEach((el) => {
        const rect = el.getBoundingClientRect();
        // Stuck / sitting at the top of the screen
        if (rect.height > 0 && rect.top >= -4 && rect.top < 40) {
          offset = Math.max(offset, Math.round(rect.bottom) + 8);
        }
      });

      setTopOffsetPx(offset);
    };

    const timeoutId = setTimeout(checkBanner, 50);

    const observer = new MutationObserver(() => {
      setTimeout(checkBanner, 50);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('resize', checkBanner);
    const removeScroll = onAppScroll(checkBanner, { passive: true });

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
      window.removeEventListener('resize', checkBanner);
      removeScroll();
    };
  }, []);

  const topStyle = isNativeApp
    ? `calc(${topOffsetPx}px + var(--safe-area-top, 0px))`
    : `${topOffsetPx}px`;

  return (
    <div
      className="fixed right-4 z-50 flex items-center gap-2"
      style={{ top: topStyle, transition: 'top 0.2s ease-in-out' }}
    >
      <Link
        to="/how-to-play"
        className="w-12 h-12 rounded-full bg-[#1C8376] shadow-lg flex items-center justify-center"
        style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}
        aria-label="How to play"
      >
        <img
          src="/assets/Icons/School--Streamline-Outlined-Material-Pr0_White.png"
          alt=""
          className="w-6 h-6"
        />
      </Link>

      <Link
        to="/profile"
        className="w-12 h-12 rounded-full bg-[#1C8376] shadow-lg flex items-center justify-center"
        style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}
        aria-label="Profile"
      >
        <img
          src="/assets/Icons/Person--Streamline-Outlined-Material-Pro_white.png"
          alt=""
          className="w-6 h-6"
        />
      </Link>
    </div>
  );
}

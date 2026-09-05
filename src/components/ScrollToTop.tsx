import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollAppToTop } from '../lib/appScroll';

/**
 * ScrollToTop component - ensures page always loads at the top on navigation
 * This is critical for React Router apps where scroll position can persist.
 * Works for both eagerly and lazily loaded pages.
 * Mobile scrolls inside `.app-shell-scroll`; desktop uses the window.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const scrollToTop = () => {
      scrollAppToTop();
    };

    scrollToTop();

    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToTop);
    });

    const timeoutId = setTimeout(scrollToTop, 100);

    return () => clearTimeout(timeoutId);
  }, [pathname]);

  return null;
}

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollAppToTop } from '../lib/appScroll';

/**
 * Always land at the top on route changes and cold link-opens.
 * Safari otherwise restores a mid-page scroll → TotL logo mid-spin / clipped.
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

    const times = [0, 50, 100, 250, 500, 1000, 2000].map((ms) =>
      window.setTimeout(scrollToTop, ms)
    );

    window.addEventListener('pageshow', scrollToTop);
    window.addEventListener('load', scrollToTop);

    return () => {
      times.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('pageshow', scrollToTop);
      window.removeEventListener('load', scrollToTop);
    };
  }, [pathname]);

  return null;
}

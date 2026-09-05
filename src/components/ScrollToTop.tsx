import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollAppToTop } from '../lib/appScroll';

/**
 * Reset app scroll once on route change.
 * Do not spam resets — that fights the user and breaks scrolling.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    scrollAppToTop();
    const id = requestAnimationFrame(() => scrollAppToTop());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}

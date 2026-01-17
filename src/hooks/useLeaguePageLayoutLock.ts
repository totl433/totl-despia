import { useEffect, useRef } from 'react';

interface UseLeaguePageLayoutLockReturn {
  headerRef: React.RefObject<HTMLDivElement>;
}

/**
 * League page needs aggressive scroll + keyboard handling for the Despia wrapper
 * (iOS Safari-like behavior). This hook encapsulates those side-effects so
 * `src/pages/League.tsx` can stay focused on data + UI.
 */
export function useLeaguePageLayoutLock(): UseLeaguePageLayoutLockReturn {
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.add('league-page-active');
    document.documentElement.classList.add('league-page-active');

    const preventHeaderScroll = () => {
      const header = headerRef.current;
      if (!header) return;
      const currentTop = header.style.top || window.getComputedStyle(header).top;
      if (currentTop !== '0px' && currentTop !== '0') {
        header.style.top = '0';
        header.style.transform = 'translate3d(0, 0, 0)';
      }
    };

    const handleWindowScroll = () => {
      preventHeaderScroll();
      if (window.scrollY !== 0 || window.pageYOffset !== 0) {
        window.scrollTo(0, 0);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const isInScrollableArea =
        target.closest('.league-content-wrapper') ||
        target.closest('.league-header-fixed') ||
        target.closest('.chat-tab-wrapper');
      if (!isInScrollableArea) e.preventDefault();
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    const checkInterval = window.setInterval(preventHeaderScroll, 100);
    preventHeaderScroll();

    return () => {
      document.body.classList.remove('league-page-active');
      document.documentElement.classList.remove('league-page-active');
      window.removeEventListener('scroll', handleWindowScroll);
      document.removeEventListener('touchmove', handleTouchMove);
      clearInterval(checkInterval);
    };
  }, []);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          window.scrollTo(0, 0);
          const header = headerRef.current;
          if (header) header.style.top = '0';
        }, 100);
      }
    };

    const handleResize = () => {
      const header = headerRef.current;
      if (header) header.style.top = '0';
    };

    document.addEventListener('focusin', handleFocusIn);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    let raf: number | null = null;

    const applyTransform = () => {
      const headerEl = headerRef.current;
      if (!headerEl) return;
      const offset = visualViewport.offsetTop ?? 0;
      headerEl.style.setProperty(
        'transform',
        `translate3d(0, ${offset}px, 0)`,
        'important'
      );
    };

    const scheduleUpdate = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(applyTransform);
    };

    scheduleUpdate();
    visualViewport.addEventListener('resize', scheduleUpdate);
    visualViewport.addEventListener('scroll', scheduleUpdate);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      visualViewport.removeEventListener('resize', scheduleUpdate);
      visualViewport.removeEventListener('scroll', scheduleUpdate);
      if (headerRef.current) headerRef.current.style.removeProperty('transform');
    };
  }, []);

  return { headerRef };
}


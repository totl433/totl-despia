/**
 * Mobile Safari layout helpers.
 *
 * Hard rules (do not regress):
 * - Never reset `.app-shell-scroll` — that is the app’s scroll surface.
 * - Never drive `#root` height from JS / `--app-height` — a short first
 *   measurement on link-open leaves a permanent bottom gap until refresh.
 * - Shell size is CSS-only: `position:fixed; inset:0` + `min-height: 100lvh`.
 * - Only pin the *window* (layout) scroll so the shell isn’t shifted under chrome.
 */
export function installViewportHeightLock(): () => void {
  if (typeof window === 'undefined') return () => {};

  const html = document.documentElement;
  let raf = 0;

  const clearRootInlineSize = () => {
    const root = document.getElementById('root');
    if (!root) return;
    // Drop any leftover inline sizing from older boots / hot reloads
    root.style.removeProperty('top');
    root.style.removeProperty('bottom');
    root.style.removeProperty('height');
    root.style.removeProperty('min-height');
    root.style.removeProperty('max-height');
    root.style.removeProperty('left');
    root.style.removeProperty('right');
    root.style.removeProperty('width');
    // Keep position under CSS media query; only clear if we had forced fixed inline
    // (CSS still applies position:fixed on mobile)
    root.style.removeProperty('position');
  };

  const pinWindowScroll = () => {
    if (window.scrollY !== 0 || window.pageYOffset !== 0) {
      window.scrollTo(0, 0);
    }
    if (document.documentElement.scrollTop !== 0) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body && document.body.scrollTop !== 0) {
      document.body.scrollTop = 0;
    }
  };

  const apply = () => {
    pinWindowScroll();
    clearRootInlineSize();

    // Keep vars for any leftover consumers — do NOT size #root from these.
    const vv = window.visualViewport;
    const height = Math.max(
      1,
      Math.round(Math.max(vv?.height ?? 0, window.innerHeight || 0, html.clientHeight || 0))
    );
    html.style.setProperty('--app-height', `${height}px`);
    html.style.setProperty('--app-offset-top', '0px');
  };

  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
  };

  apply();

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('visibilitychange', schedule);
  window.visualViewport?.addEventListener('resize', schedule);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    window.removeEventListener('pageshow', schedule);
    window.removeEventListener('scroll', schedule);
    document.removeEventListener('visibilitychange', schedule);
    window.visualViewport?.removeEventListener('resize', schedule);
  };
}

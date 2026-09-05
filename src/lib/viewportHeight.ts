/**
 * Mobile Safari: keep the layout viewport pinned to the top.
 * Shell size comes from CSS (`#root { position: fixed; inset: 0 }`) — do not
 * drive height from a first-load JS pixel value (that caused the gap-until-refresh).
 */
export function installViewportHeightLock(): () => void {
  if (typeof window === 'undefined') return () => {};

  const root = document.documentElement;
  let raf = 0;

  const apply = () => {
    if (window.scrollY !== 0 || window.pageYOffset !== 0) {
      window.scrollTo(0, 0);
    }
    // Keep vars updated for any leftover consumers, but sizing does not depend on them.
    const vv = window.visualViewport;
    const height = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
    const offset = Math.max(0, Math.round(vv?.offsetTop ?? 0));
    root.style.setProperty('--app-height', `${height}px`);
    root.style.setProperty('--app-offset-top', `${offset}px`);
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
  window.visualViewport?.addEventListener('scroll', schedule);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    window.removeEventListener('pageshow', schedule);
    window.removeEventListener('scroll', schedule);
    document.removeEventListener('visibilitychange', schedule);
    window.visualViewport?.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('scroll', schedule);
  };
}

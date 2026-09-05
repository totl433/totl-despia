/**
 * Sync `--app-height` to the visible viewport for the mobile app shell.
 *
 * Hard rules (do not regress):
 * - Never reset `.app-shell-scroll` — that breaks scrolling.
 * - Never set `#root` top from visualViewport.offsetTop — that creates gaps.
 * - Never write inline height/top/bottom on `#root` — CSS uses `--app-height`.
 * - Only pin the window (layout) scroll.
 */
export function installViewportHeightLock(): () => void {
  if (typeof window === 'undefined') return () => {};

  const html = document.documentElement;
  let raf = 0;
  let lastH = -1;
  const startedAt = performance.now();
  const SETTLE_MS = 5000;

  const pinWindowScroll = () => {
    if (window.scrollY !== 0 || window.pageYOffset !== 0) {
      window.scrollTo(0, 0);
    }
  };

  const apply = () => {
    pinWindowScroll();

    const vv = window.visualViewport;
    let height = Math.max(
      1,
      Math.round(Math.max(vv?.height ?? 0, window.innerHeight || 0))
    );

    // First seconds: only grow — a short link-open reading must not stick.
    const settling = performance.now() - startedAt < SETTLE_MS;
    if (settling && lastH > 0) {
      height = Math.max(height, lastH);
    }

    if (height === lastH) return;
    lastH = height;

    html.style.setProperty('--app-height', `${height}px`);
    html.style.setProperty('--app-offset-top', '0px');
  };

  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(apply);
    });
  };

  apply();
  schedule();

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) lastH = -1;
    schedule();
  });
  window.addEventListener('focus', schedule);
  window.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      lastH = -1;
      schedule();
    }
  });
  document.addEventListener('touchend', schedule, { passive: true });

  const vv = window.visualViewport;
  vv?.addEventListener('resize', schedule);

  const timers = [50, 250, 800, 2000, 4000].map((ms) => window.setTimeout(schedule, ms));
  const earlyPoll = window.setInterval(schedule, 250);
  const stopEarly = window.setTimeout(() => window.clearInterval(earlyPoll), 5000);

  return () => {
    cancelAnimationFrame(raf);
    timers.forEach((id) => window.clearTimeout(id));
    window.clearTimeout(stopEarly);
    window.clearInterval(earlyPoll);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    window.removeEventListener('pageshow', schedule);
    window.removeEventListener('focus', schedule);
    window.removeEventListener('scroll', schedule);
    document.removeEventListener('touchend', schedule);
    vv?.removeEventListener('resize', schedule);
  };
}

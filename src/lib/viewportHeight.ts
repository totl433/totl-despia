/**
 * Keep the mobile shell sized to the *visible* viewport.
 *
 * iOS Safari intermittently:
 * 1) scrolls the layout viewport (`visualViewport.offsetTop > 0`) → cut-off top
 * 2) leaves `--app-height` stuck small after the URL bar collapses → empty gap
 *    at the bottom until refresh
 *
 * Strategy: pin scroll to 0, always keep `#root` at top:0, and remeasure often
 * enough that a missed resize still corrects within a beat.
 */
export function installViewportHeightLock(): () => void {
  if (typeof window === 'undefined') return () => {};

  const root = document.documentElement;
  let raf = 0;
  let lastHeight = -1;

  const measure = () => {
    const vv = window.visualViewport;

    // Pin layout scroll — never leave the shell shifted by offsetTop
    if ((vv?.offsetTop ?? 0) > 0 || window.scrollY !== 0 || window.pageYOffset !== 0) {
      window.scrollTo(0, 0);
    }

    const height = Math.max(1, Math.round(vv?.height ?? window.innerHeight));

    // Always zero — CSS pins #root to top:0; shifting by offsetTop caused bottom gaps
    root.style.setProperty('--app-offset-top', '0px');

    if (height === lastHeight) return;
    lastHeight = height;
    root.style.setProperty('--app-height', `${height}px`);
  };

  const apply = () => {
    measure();
    // Safari sometimes applies scrollTo asynchronously — remeasure once more
    measure();
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
  window.addEventListener('pageshow', schedule);
  window.addEventListener('focus', schedule);
  window.addEventListener('scroll', schedule, { passive: true });

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      lastHeight = -1; // force rewrite after tab resume
      schedule();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  // URL-bar / chrome settle often only shows up after a touch
  document.addEventListener('touchstart', schedule, { passive: true });
  document.addEventListener('touchend', schedule, { passive: true });

  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
  }

  // Catch late chrome settle after first paint / auth hydrate
  const t1 = window.setTimeout(schedule, 50);
  const t2 = window.setTimeout(schedule, 250);
  const t3 = window.setTimeout(schedule, 800);
  const t4 = window.setTimeout(schedule, 2000);

  // Aggressive early poll (missed resize on load), then light while visible
  const earlyPoll = window.setInterval(schedule, 200);
  const stopEarly = window.setTimeout(() => window.clearInterval(earlyPoll), 4000);
  const slowPoll = window.setInterval(() => {
    if (document.visibilityState === 'visible') schedule();
  }, 1500);

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(t1);
    window.clearTimeout(t2);
    window.clearTimeout(t3);
    window.clearTimeout(t4);
    window.clearTimeout(stopEarly);
    window.clearInterval(earlyPoll);
    window.clearInterval(slowPoll);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    window.removeEventListener('pageshow', schedule);
    window.removeEventListener('focus', schedule);
    window.removeEventListener('scroll', schedule);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('touchstart', schedule);
    document.removeEventListener('touchend', schedule);
    if (vv) {
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
    }
  };
}

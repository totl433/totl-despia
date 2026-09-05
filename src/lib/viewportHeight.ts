/**
 * Keep the mobile shell sized to the *visible* viewport.
 *
 * iOS Safari / Chrome intermittently:
 * 1) scrolls the layout viewport (`visualViewport.offsetTop > 0`) → cut-off top (logo clipped)
 * 2) leaves `--app-height` stuck wrong after the URL bar moves → empty gap under the nav
 *
 * Strategy: pin window + app-shell scroll to 0, size `#root` to the visual
 * viewport (top + height together), and remeasure often enough that a missed
 * resize still corrects within a beat.
 */
export function installViewportHeightLock(): () => void {
  if (typeof window === 'undefined') return () => {};

  const root = document.documentElement;
  let raf = 0;
  let lastHeight = -1;
  let lastOffset = -1;

  const pinScroll = () => {
    // Only pin the *window* layout scroll (iOS visualViewport offset).
    // Never reset `.app-shell-scroll` here — that is real page scroll.
    if (window.scrollY !== 0 || window.pageYOffset !== 0) {
      window.scrollTo(0, 0);
    }
  };

  const measure = () => {
    const vv = window.visualViewport;

    pinScroll();

    // Prefer visualViewport; clamp to innerHeight so we never size taller than the layout viewport
    const vvHeight = vv?.height ?? window.innerHeight;
    const height = Math.max(1, Math.round(Math.min(vvHeight, window.innerHeight)));
    // If iOS still reports an offset after pinScroll, shift the shell to match the visible area
    const offset = Math.max(0, Math.round(vv?.offsetTop ?? 0));

    if (height === lastHeight && offset === lastOffset) return;
    lastHeight = height;
    lastOffset = offset;
    root.style.setProperty('--app-height', `${height}px`);
    root.style.setProperty('--app-offset-top', `${offset}px`);
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
      lastHeight = -1;
      lastOffset = -1;
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

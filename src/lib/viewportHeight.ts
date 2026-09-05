/**
 * Keep the mobile shell sized to the *visible* viewport.
 *
 * iOS Safari / Chrome intermittently on *first* load (fixes itself after refresh):
 * 1) reports a short visualViewport → white gap under the shell
 * 2) scrolls the layout viewport (`offsetTop > 0`) → cut-off top
 *
 * Strategy: pin window scroll, size `#root` with top+height, and during the
 * first few seconds only allow the height to grow (high-water) so a too-small
 * first paint can’t stick until the user refreshes.
 */
export function installViewportHeightLock(): () => void {
  if (typeof window === 'undefined') return () => {};

  const root = document.documentElement;
  let raf = 0;
  let lastHeight = -1;
  let lastOffset = -1;
  const startedAt = performance.now();
  /** First-load settle window — only grow height so we never stick undersized. */
  const SETTLE_MS = 4000;

  const pinScroll = () => {
    if (window.scrollY !== 0 || window.pageYOffset !== 0) {
      window.scrollTo(0, 0);
    }
  };

  const readHeight = () => {
    const vv = window.visualViewport;
    const vvH = vv?.height ?? window.innerHeight;
    const innerH = window.innerHeight;
    const clientH = document.documentElement.clientHeight;
    const offset = vv?.offsetTop ?? 0;
    const settling = performance.now() - startedAt < SETTLE_MS;

    // During settle: take the max so a tiny first reading can’t leave a white gap.
    // After settle: track the live visual viewport (clamped to layout height).
    if (settling || offset === 0) {
      return Math.max(1, Math.round(Math.max(vvH, innerH, clientH || 0)));
    }
    return Math.max(1, Math.round(Math.min(vvH, innerH)));
  };

  const measure = () => {
    const vv = window.visualViewport;
    pinScroll();

    let height = readHeight();
    const offset = Math.max(0, Math.round(vv?.offsetTop ?? 0));
    const settling = performance.now() - startedAt < SETTLE_MS;

    // High-water during settle — never shrink back to a bad first paint
    if (settling && lastHeight > 0) {
      height = Math.max(height, lastHeight);
    }

    if (height === lastHeight && offset === lastOffset) return;
    lastHeight = height;
    lastOffset = offset;
    root.style.setProperty('--app-height', `${height}px`);
    root.style.setProperty('--app-offset-top', `${offset}px`);
  };

  const apply = () => {
    measure();
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
  window.addEventListener('pageshow', (e) => {
    // bfcache / refresh — remeasure from scratch
    if ((e as PageTransitionEvent).persisted) {
      lastHeight = -1;
      lastOffset = -1;
    }
    schedule();
  });
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

  document.addEventListener('touchstart', schedule, { passive: true });
  document.addEventListener('touchend', schedule, { passive: true });

  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
  }

  // Dense early poll — first load often misses the URL-bar resize until refresh
  const t1 = window.setTimeout(schedule, 0);
  const t2 = window.setTimeout(schedule, 50);
  const t3 = window.setTimeout(schedule, 100);
  const t4 = window.setTimeout(schedule, 250);
  const t5 = window.setTimeout(schedule, 500);
  const t6 = window.setTimeout(schedule, 1000);
  const t7 = window.setTimeout(schedule, 2000);
  const t8 = window.setTimeout(schedule, 3500);

  const earlyPoll = window.setInterval(schedule, 100);
  const stopEarly = window.setTimeout(() => window.clearInterval(earlyPoll), 5000);
  const slowPoll = window.setInterval(() => {
    if (document.visibilityState === 'visible') schedule();
  }, 2000);

  return () => {
    cancelAnimationFrame(raf);
    [t1, t2, t3, t4, t5, t6, t7, t8, stopEarly].forEach((id) => window.clearTimeout(id));
    window.clearInterval(earlyPoll);
    window.clearInterval(slowPoll);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    window.removeEventListener('pageshow', schedule as EventListener);
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

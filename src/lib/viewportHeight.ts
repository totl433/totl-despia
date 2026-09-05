/**
 * Keep `#root` sized to the visible viewport on mobile Safari.
 *
 * Rules (hard-won):
 * - Never reset `.app-shell-scroll` — that is the app’s scroll surface.
 * - Never set `#root` top from visualViewport.offsetTop — that creates gaps.
 * - Only pin the *window* scroll (layout viewport), not the app shell.
 */
export function installViewportHeightLock(): () => void {
  if (typeof window === 'undefined') return () => {};

  const html = document.documentElement;
  let raf = 0;
  let lastH = -1;
  const startedAt = performance.now();
  const SETTLE_MS = 6000;

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

  const readHeight = () => {
    const vv = window.visualViewport;
    const vvH = vv?.height ?? 0;
    const innerH = window.innerHeight || 0;
    const clientH = document.documentElement.clientHeight || 0;
    return Math.max(1, Math.round(Math.max(vvH, innerH, clientH)));
  };

  const apply = () => {
    pinWindowScroll();

    let height = readHeight();
    const settling = performance.now() - startedAt < SETTLE_MS;
    if (settling && lastH > 0) {
      height = Math.max(height, lastH);
    }

    html.style.setProperty('--app-height', `${height}px`);
    html.style.setProperty('--app-offset-top', '0px');

    if (height === lastH) return;
    lastH = height;

    const root = document.getElementById('root');
    if (root) {
      root.style.position = 'fixed';
      root.style.left = '0px';
      root.style.right = '0px';
      root.style.width = '100%';
      root.style.top = '0px';
      root.style.bottom = '0px';
      root.style.height = `${height}px`;
      root.style.minHeight = `${height}px`;
      root.style.maxHeight = 'none';
    }
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
  window.addEventListener('load', schedule);
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) lastH = -1;
    schedule();
  });
  window.addEventListener('focus', schedule);
  // Window scroll only — pin layout viewport; do NOT touch .app-shell-scroll
  window.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      lastH = -1;
      schedule();
    }
  });

  const vv = window.visualViewport;
  vv?.addEventListener('resize', schedule);
  // Do not listen to vv.scroll for apply — fires while chrome moves and is noisy

  const timers = [0, 50, 100, 250, 500, 1000, 2000, 4000].map((ms) =>
    window.setTimeout(schedule, ms)
  );
  const earlyPoll = window.setInterval(schedule, 200);
  const stopEarly = window.setTimeout(() => window.clearInterval(earlyPoll), 6000);

  return () => {
    cancelAnimationFrame(raf);
    timers.forEach((id) => window.clearTimeout(id));
    window.clearTimeout(stopEarly);
    window.clearInterval(earlyPoll);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    window.removeEventListener('load', schedule);
    window.removeEventListener('pageshow', schedule);
    window.removeEventListener('focus', schedule);
    window.removeEventListener('scroll', schedule);
    vv?.removeEventListener('resize', schedule);
  };
}

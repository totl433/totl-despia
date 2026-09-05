/**
 * Keep `#root` glued to the visible iOS Safari viewport.
 *
 * Opening via an external link (Messages, Slack, etc.) often paints with a
 * too-short viewport; a refresh then gets the right size. CSS `inset:0` alone
 * does not correct that on first paint — we must set pixel height from
 * visualViewport and keep remeasuring until Safari settles.
 */
export function installViewportHeightLock(): () => void {
  if (typeof window === 'undefined') return () => {};

  const html = document.documentElement;
  let raf = 0;
  let lastH = -1;
  let lastTop = -1;

  const apply = () => {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    const shell = document.querySelector('.app-shell-scroll') as HTMLElement | null;
    if (shell) shell.scrollTop = 0;

    const vv = window.visualViewport;
    const height = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
    const top = Math.max(0, Math.round(vv?.offsetTop ?? 0));

    html.style.setProperty('--app-height', `${height}px`);
    html.style.setProperty('--app-offset-top', `${top}px`);

    if (height === lastH && top === lastTop) return;
    lastH = height;
    lastTop = top;

    const root = document.getElementById('root');
    if (root) {
      root.style.position = 'fixed';
      root.style.left = '0px';
      root.style.right = '0px';
      root.style.width = '100%';
      root.style.top = `${top}px`;
      root.style.height = `${height}px`;
      root.style.maxHeight = `${height}px`;
      root.style.bottom = 'auto';
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
  window.addEventListener('pageshow', schedule);
  window.addEventListener('focus', schedule);
  window.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('visibilitychange', schedule);
  // First tap often forces Safari to publish the real viewport after a link-open
  document.addEventListener('touchstart', schedule, { passive: true });
  document.addEventListener('touchend', schedule, { passive: true });

  const vv = window.visualViewport;
  vv?.addEventListener('resize', schedule);
  vv?.addEventListener('scroll', schedule);

  // Link-open chrome settle is slow — poll hard, then ease off
  const timers = [0, 50, 100, 200, 400, 800, 1500, 3000, 5000, 8000].map((ms) =>
    window.setTimeout(schedule, ms)
  );
  const earlyPoll = window.setInterval(schedule, 100);
  const stopEarly = window.setTimeout(() => window.clearInterval(earlyPoll), 10000);
  const slowPoll = window.setInterval(() => {
    if (document.visibilityState === 'visible') schedule();
  }, 2000);

  return () => {
    cancelAnimationFrame(raf);
    timers.forEach((id) => window.clearTimeout(id));
    window.clearTimeout(stopEarly);
    window.clearInterval(earlyPoll);
    window.clearInterval(slowPoll);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    window.removeEventListener('load', schedule);
    window.removeEventListener('pageshow', schedule);
    window.removeEventListener('focus', schedule);
    window.removeEventListener('scroll', schedule);
    document.removeEventListener('visibilitychange', schedule);
    document.removeEventListener('touchstart', schedule);
    document.removeEventListener('touchend', schedule);
    vv?.removeEventListener('resize', schedule);
    vv?.removeEventListener('scroll', schedule);
  };
}

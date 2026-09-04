/**
 * Keep the mobile shell sized to the *visible* viewport.
 *
 * iOS Safari/Chrome intermittently scroll the layout viewport under the browser
 * chrome (`visualViewport.offsetTop > 0`). That shows a cut-off top + empty gap
 * at the bottom until a refresh. Sync `--app-height` / `--app-offset-top` from
 * the visual viewport and force scroll back to 0.
 */
export function installViewportHeightLock(): () => void {
  if (typeof window === 'undefined') return () => {};

  const root = document.documentElement;
  let raf = 0;

  const apply = () => {
    const vv = window.visualViewport;
    const height = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
    const offsetTop = Math.max(0, Math.round(vv?.offsetTop ?? 0));

    root.style.setProperty('--app-height', `${height}px`);
    root.style.setProperty('--app-offset-top', `${offsetTop}px`);

    if (window.scrollY !== 0 || window.pageYOffset !== 0) {
      window.scrollTo(0, 0);
    }
  };

  const schedule = () => {
    cancelAnimationFrame(raf);
    // Double rAF: let Safari finish chrome / address-bar layout first
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

  const onVisibility = () => {
    if (document.visibilityState === 'visible') schedule();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
  }

  // Catch late chrome settle after first paint / auth hydrate
  const t1 = window.setTimeout(schedule, 50);
  const t2 = window.setTimeout(schedule, 300);
  const t3 = window.setTimeout(schedule, 1000);

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(t1);
    window.clearTimeout(t2);
    window.clearTimeout(t3);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    window.removeEventListener('pageshow', schedule);
    window.removeEventListener('focus', schedule);
    document.removeEventListener('visibilitychange', onVisibility);
    if (vv) {
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
    }
  };
}

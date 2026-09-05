/**
 * Keep the mobile shell in the visible Safari viewport.
 *
 * Cut-off top + gap at bottom = layout scrolled under the chrome.
 * Fix: pin window scroll to 0, keep #root at top:0, size height from visualViewport.
 * Never shift #root by offsetTop (that causes the gap). Never touch .app-shell-scroll.
 *
 * Desktop uses normal document scroll — never pin window scroll there.
 * Mobile shell breakpoint must match CSS in index.css (max-width: 1023.98px).
 */
const MOBILE_SHELL_MQ = '(max-width: 1023.98px)';

function isMobileShellViewport(): boolean {
  return window.matchMedia(MOBILE_SHELL_MQ).matches;
}

export function installViewportHeightLock(): () => void {
  if (typeof window === 'undefined') return () => {};

  const root = document.documentElement;
  let raf = 0;
  let lastHeight = -1;

  const measure = () => {
    const mobile = isMobileShellViewport();
    const vv = window.visualViewport;

    // Only pin window scroll on mobile — desktop scrolls the document.
    if (
      mobile &&
      ((vv?.offsetTop ?? 0) > 0 || window.scrollY !== 0 || window.pageYOffset !== 0)
    ) {
      window.scrollTo(0, 0);
    }

    const height = Math.max(1, Math.round(vv?.height ?? window.innerHeight));

    root.style.setProperty('--app-offset-top', '0px');

    if (height === lastHeight) return;
    lastHeight = height;
    root.style.setProperty('--app-height', `${height}px`);
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
  window.addEventListener('pageshow', schedule);
  window.addEventListener('focus', schedule);
  // Scroll pin is mobile-only; still listen so Safari chrome show/hide is caught.
  window.addEventListener('scroll', schedule, { passive: true });

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      lastHeight = -1;
      schedule();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('touchend', schedule, { passive: true });

  const vv = window.visualViewport;
  vv?.addEventListener('resize', schedule);
  vv?.addEventListener('scroll', schedule);

  const mq = window.matchMedia(MOBILE_SHELL_MQ);
  const onMq = () => {
    lastHeight = -1;
    schedule();
  };
  mq.addEventListener?.('change', onMq);

  const timers = [50, 250, 800, 2000].map((ms) => window.setTimeout(schedule, ms));
  const earlyPoll = window.setInterval(schedule, 250);
  const stopEarly = window.setTimeout(() => window.clearInterval(earlyPoll), 4000);

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
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('touchend', schedule);
    vv?.removeEventListener('resize', schedule);
    vv?.removeEventListener('scroll', schedule);
    mq.removeEventListener?.('change', onMq);
  };
}

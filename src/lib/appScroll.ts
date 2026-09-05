/**
 * Mobile layout scrolls inside `.app-shell-scroll` (not the window).
 * Helpers keep route resets / logo animations working on either surface.
 */

export function getAppScrollElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.app-shell-scroll') as HTMLElement | null;
}

export function getAppScrollTop(): number {
  const el = getAppScrollElement();
  if (el) return el.scrollTop;
  return window.scrollY || document.documentElement.scrollTop || 0;
}

export function scrollAppToTop(): void {
  const el = getAppScrollElement();
  if (el) el.scrollTop = 0;
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  if (document.documentElement) document.documentElement.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;
}

/** Call once at app boot — link-opens otherwise restore a mid-page scroll. */
export function disableBrowserScrollRestoration(): void {
  if (typeof window === 'undefined') return;
  try {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  } catch {
    // ignore
  }
}

export function onAppScroll(listener: () => void, options?: AddEventListenerOptions): () => void {
  const el = getAppScrollElement();
  if (el) {
    el.addEventListener('scroll', listener, options);
    return () => el.removeEventListener('scroll', listener);
  }
  window.addEventListener('scroll', listener, options);
  return () => window.removeEventListener('scroll', listener);
}

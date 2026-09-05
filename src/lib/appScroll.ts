/**
 * Mobile layout scrolls inside `.app-shell-scroll` (not the window).
 * Desktop uses normal document scroll.
 * Helpers keep route resets / logo animations working on either surface.
 * Breakpoint must match CSS in index.css (max-width: 1023.98px).
 */

const MOBILE_SHELL_MQ = '(max-width: 1023.98px)';

function usesMobileShellScroll(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_SHELL_MQ).matches;
}

export function getAppScrollElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (!usesMobileShellScroll()) return null;
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

export function onAppScroll(listener: () => void, options?: AddEventListenerOptions): () => void {
  const el = getAppScrollElement();
  if (el) {
    el.addEventListener('scroll', listener, options);
    return () => el.removeEventListener('scroll', listener);
  }
  window.addEventListener('scroll', listener, options);
  return () => window.removeEventListener('scroll', listener);
}

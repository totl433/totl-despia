import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const RELOAD_KEY = 'totl_chunk_reload';

/** Vite / Safari failures after a deploy when old hashed chunks 404. */
export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  const name = error instanceof Error ? error.name : '';
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Unable to preload CSS/i.test(msg)
  );
}

/**
 * Hard-reload once to pick up the new deploy. Returns false if we already
 * reloaded recently (avoids a loop when the network is actually down).
 */
export function reloadForStaleChunk(): boolean {
  try {
    const last = sessionStorage.getItem(RELOAD_KEY);
    const now = Date.now();
    if (last && now - Number(last) < 20_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    // sessionStorage blocked — still try one reload
  }
  window.location.reload();
  return true;
}

/** lazy() that auto-reloads once on stale chunk / module import failure. */
// Matches React.lazy's factory shape; pages have varying props.
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (isChunkLoadError(err) && reloadForStaleChunk()) {
        // Page is reloading; never settle so Suspense keeps showing loader
        return new Promise(() => {});
      }
      throw err;
    }
  });
}

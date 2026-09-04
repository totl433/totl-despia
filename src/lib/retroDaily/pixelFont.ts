/** Self-hosted pixel font used on Retro Totl Daily cards. */
export const RETRO_PIXEL_FONT = "'PressStart2P', monospace";

const LOAD_SPEC = '28px PressStart2P';

/**
 * Ensure PressStart2P is ready before painting pixel copy.
 * Resolves immediately if already loaded; times out so we never hang.
 */
export function ensureRetroPixelFont(timeoutMs = 2000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) {
    return Promise.resolve();
  }

  try {
    if (document.fonts.check(LOAD_SPEC)) {
      return Promise.resolve();
    }
  } catch {
    // ignore check errors
  }

  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const timer = window.setTimeout(done, timeoutMs);
    document.fonts
      .load(LOAD_SPEC)
      .then(() => {
        window.clearTimeout(timer);
        done();
      })
      .catch(() => {
        window.clearTimeout(timer);
        done();
      });
  });
}

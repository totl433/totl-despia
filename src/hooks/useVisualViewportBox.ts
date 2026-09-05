import { useLayoutEffect, useRef, useState } from 'react';

export type VisualViewportBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function readInitial(): VisualViewportBox {
  if (typeof window === 'undefined') {
    return { top: 0, left: 0, width: 390, height: 700 };
  }
  const vv = window.visualViewport;
  const vvH = vv?.height ?? window.innerHeight;
  const innerH = window.innerHeight;
  const clientH = document.documentElement.clientHeight || 0;
  return {
    top: Math.max(0, Math.round(vv?.offsetTop ?? 0)),
    left: Math.max(0, Math.round(vv?.offsetLeft ?? 0)),
    width: Math.max(1, Math.round(vv?.width ?? window.innerWidth)),
    height: Math.max(1, Math.round(Math.max(vvH, innerH, clientH))),
  };
}

/**
 * Fullscreen overlay glued to the live iOS Safari visual viewport.
 * Same first-load high-water rule as the site shell (no white gap).
 */
export function useVisualViewportBox(fillBackground?: string): VisualViewportBox {
  const [box, setBox] = useState<VisualViewportBox>(() => readInitial());
  const prevBg = useRef<{ html: string; body: string; root: string } | null>(null);

  useLayoutEffect(() => {
    let raf = 0;
    let lastH = 0;
    const started = performance.now();

    const apply = () => {
      const vv = window.visualViewport;
      const top = Math.max(0, Math.round(vv?.offsetTop ?? 0));
      const left = Math.max(0, Math.round(vv?.offsetLeft ?? 0));
      const width = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
      const vvH = vv?.height ?? window.innerHeight;
      const innerH = window.innerHeight;
      const clientH = document.documentElement.clientHeight || 0;
      let height = Math.max(1, Math.round(Math.max(vvH, innerH, clientH)));
      if (performance.now() - started < 4000) {
        height = Math.max(height, lastH);
      }
      lastH = height;
      setBox((prev) =>
        prev.top === top && prev.left === left && prev.width === width && prev.height === height
          ? prev
          : { top, left, width, height }
      );
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };

    apply();
    schedule();

    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('visibilitychange', schedule);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);

    const t1 = window.setTimeout(schedule, 50);
    const t2 = window.setTimeout(schedule, 250);
    const t3 = window.setTimeout(schedule, 1000);
    const poll = window.setInterval(schedule, 100);
    const stopPoll = window.setTimeout(() => window.clearInterval(poll), 5000);

    if (fillBackground) {
      const html = document.documentElement;
      const body = document.body;
      const root = document.getElementById('root');
      prevBg.current = {
        html: html.style.backgroundColor,
        body: body.style.backgroundColor,
        root: root?.style.backgroundColor ?? '',
      };
      html.style.backgroundColor = fillBackground;
      body.style.backgroundColor = fillBackground;
      if (root) root.style.backgroundColor = fillBackground;
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(stopPoll);
      window.clearInterval(poll);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.removeEventListener('scroll', schedule);
      document.removeEventListener('visibilitychange', schedule);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
      if (fillBackground && prevBg.current) {
        document.documentElement.style.backgroundColor = prevBg.current.html;
        document.body.style.backgroundColor = prevBg.current.body;
        const root = document.getElementById('root');
        if (root) root.style.backgroundColor = prevBg.current.root;
      }
    };
  }, [fillBackground]);

  return box;
}

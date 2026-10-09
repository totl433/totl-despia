import { useEffect } from 'react';

/**
 * Per-route <title>, meta description and canonical for the public, indexable pages
 * (the same list as public/sitemap.xml). index.html carries the defaults for every route,
 * so this only fills in what differs. Other routes keep the defaults and get no canonical.
 */
const ORIGIN = 'https://playtotl.com';

type RouteSeo = { title: string; description: string; canonicalPath: string };

const HOME: Omit<RouteSeo, 'canonicalPath'> = {
  title: 'TOTL: Top of the League — Premier League prediction game',
  description: 'Predict football results, take on your mates and climb the leaderboards.',
};

const PUBLIC_ROUTES: Record<string, RouteSeo> = {
  '/': { ...HOME, canonicalPath: '/' },
  // Same landing page as "/".
  '/app': { ...HOME, canonicalPath: '/' },
  '/support': {
    title: 'Support — TOTL: Top of the League',
    description:
      'Help with TOTL, the Premier League prediction game: answers to common questions and how to contact the team.',
    canonicalPath: '/support',
  },
  '/privacy-policy': {
    title: 'Privacy Policy — TOTL: Top of the League',
    description: 'How TOTL (Top of the League) collects, uses and protects your personal data.',
    canonicalPath: '/privacy-policy',
  },
  '/terms-and-conditions': {
    title: 'Terms and Conditions — TOTL: Top of the League',
    description: 'The terms of use for TOTL (Top of the League), the Premier League prediction game.',
    canonicalPath: '/terms-and-conditions',
  },
  '/delete-data': {
    title: 'Delete your TOTL account — TOTL: Top of the League',
    description: 'How to request deletion of your TOTL (Top of the League) account and the data that is removed.',
    canonicalPath: '/delete-data',
  },
};

export function routeSeoFor(pathname: string): RouteSeo | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PUBLIC_ROUTES[path] ?? null;
}

function setCanonical(href: string | null) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

/** Keeps the document head in step with the current route. */
export function useRouteSeo(pathname: string) {
  useEffect(() => {
    const seo = routeSeoFor(pathname);
    document.title = seo?.title ?? HOME.title;
    document.head
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', seo?.description ?? HOME.description);
    setCanonical(seo ? `${ORIGIN}${seo.canonicalPath}` : null);
  }, [pathname]);
}

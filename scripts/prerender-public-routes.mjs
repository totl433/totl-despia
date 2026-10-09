/**
 * Post-build: write per-route HTML for the public, indexable pages so crawlers get the
 * right <title>, description and canonical without running JavaScript (the SPA otherwise
 * serves dist/index.html, canonical "/", for every route). Each file is dist/index.html
 * with route-specific head tags and crawler fallback content; the React app boots the
 * same way. Keep in sync with public/sitemap.xml.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ORIGIN = 'https://playtotl.com';
const DIST = 'dist';

const ROUTES = [
  {
    path: '/support',
    title: 'Support — TOTL: Top of the League',
    description:
      'Help with TOTL, the Premier League prediction game: answers to common questions and how to contact the team.',
    heading: 'TOTL support',
    intro: 'Answers to common questions about TOTL, plus how to contact the team at hello@playtotl.com.',
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy — TOTL: Top of the League',
    description: 'How TOTL (Top of the League) collects, uses and protects your personal data.',
    heading: 'TOTL Privacy Policy',
    intro: 'How TOTL (Top of the League) collects, uses and protects your personal data.',
  },
  {
    path: '/terms-and-conditions',
    title: 'Terms and Conditions — TOTL: Top of the League',
    description: 'The terms of use for TOTL (Top of the League), the Premier League prediction game.',
    heading: 'TOTL Terms and Conditions',
    intro: 'The terms of use for TOTL (Top of the League), the Premier League prediction game.',
  },
  {
    path: '/delete-data',
    title: 'Delete your TOTL account — TOTL: Top of the League',
    description: 'How to request deletion of your TOTL (Top of the League) account and the data that is removed.',
    heading: 'Delete your TOTL account',
    intro: 'How to request deletion of your TOTL (Top of the League) account and which data is deleted.',
  },
];

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Replace exactly one match, failing the build if the template has drifted. */
function replaceOnce(html, pattern, replacement, label) {
  const matches = html.match(new RegExp(pattern.source, 'g')) ?? [];
  if (matches.length !== 1) throw new Error(`prerender: expected 1 ${label} in dist/index.html, found ${matches.length}`);
  return html.replace(pattern, replacement);
}

const template = readFileSync(join(DIST, 'index.html'), 'utf8');

for (const route of ROUTES) {
  const url = `${ORIGIN}${route.path}`;
  const t = esc(route.title);
  const d = esc(route.description);
  let html = template;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${t}</title>`, '<title>');
  html = replaceOnce(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${d}" />`, 'description');
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`, 'canonical');
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`, 'og:url');
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${t}" />`, 'og:title');
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${d}" />`, 'og:description');
  html = replaceOnce(html, /<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${t}" />`, 'twitter:title');
  html = replaceOnce(html, /<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${d}" />`, 'twitter:description');
  html = replaceOnce(
    html,
    /<!-- seo-fallback:start -->[\s\S]*<!-- seo-fallback:end -->/,
    `<!-- seo-fallback:start -->
      <main class="seo-fallback">
        <h1>${esc(route.heading)}</h1>
        <p>${esc(route.intro)}</p>
        <p><a href="${ORIGIN}/">TOTL: Top of the League</a> is a free-to-download Premier League prediction game on the web, <a href="https://apps.apple.com/app/id6754661450">iPhone</a> and <a href="https://play.google.com/store/apps/details?id=com.despia.totlnative">Android</a>.</p>
      </main>
      <!-- seo-fallback:end -->`,
    'seo fallback block'
  );
  const out = join(DIST, route.path.slice(1), 'index.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`[prerender] ${route.path} -> ${out}`);
}

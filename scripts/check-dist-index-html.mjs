import fs from 'node:fs';
import path from 'node:path';

const distIndexPath = path.resolve(process.cwd(), 'dist', 'index.html');

if (!fs.existsSync(distIndexPath)) {
  console.error(`[check-dist-index-html] Missing file: ${distIndexPath}`);
  process.exit(1);
}

const html = fs.readFileSync(distIndexPath, 'utf8');

const bannedMatchers = [
  { name: 'Google Tag Manager (gtag.js)', re: /googletagmanager\.com\/gtag\/js/i },
  { name: 'Google Analytics domain', re: /google-analytics\.com/i },
  { name: 'Inline gtag() usage', re: /\bgtag\s*\(/i },
];

const violations = bannedMatchers
  .map((m) => ({ ...m, match: html.match(m.re) }))
  .filter((v) => v.match);

if (violations.length === 0) {
  console.log('[check-dist-index-html] ✅ OK: dist/index.html contains no GA/gtag references.');
  process.exit(0);
}

console.error('[check-dist-index-html] ❌ FAIL: dist/index.html contains GA/gtag references.');
violations.forEach((v) => {
  const idx = v.match?.index ?? -1;
  const start = Math.max(0, idx - 120);
  const end = Math.min(html.length, idx + 120);
  const snippet = html.slice(start, end).replace(/\s+/g, ' ');
  console.error(`- ${v.name}: ${v.re}`);
  console.error(`  Snippet: ${snippet}`);
});

process.exit(1);


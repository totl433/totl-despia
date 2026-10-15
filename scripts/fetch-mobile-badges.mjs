// scripts/fetch-mobile-badges.mjs
// High-res club crests for the Expo app (apps/mobile/assets/badges).
// Usage (needs `sharp`; Python 3 + Pillow for the finishing step):
//   node scripts/fetch-mobile-badges.mjs /tmp/badges-raw
//   python3 scripts/finish-mobile-badges.py /tmp/badges-raw apps/mobile/assets/badges
// Renders each football-data.org crest (SVG where available) at 2048px; the
// Python step removes white backgrounds and fits each onto a 512px canvas.
// HUL, SHW, OLD, DER and WIM are era crests copied from public/assets/badges.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Our codes → football-data.org team ids (crests.football-data.org/{id}.svg).
const IDS = {
  ARS: 57, AVL: 58, BAR: 357, BHA: 397, BIR: 332, BLA: 59, BLP: 336, BOL: 60,
  BOU: 'bournemouth', BRD: 1067, BRE: 402, BUR: 328, CAR: 715, CHA: 348, CHE: 61,
  COV: 1076, CRY: 354, EVE: 62, FUL: 63, HUD: 394, IPS: 349, LEE: 341, LEI: 338,
  LIV: 64, LUT: 389, MCI: 65, MID: 343, MUN: 66, NEW: 67, NFO: 351, NOR: 68,
  NOT: 351, POR: 325, QPR: 69, REA: 355, SHU: 356, SOU: 340, STK: 70, SUN: 71,
  SWA: 72, SWI: 1079, TOT: 73, WAT: 346, WBA: 74, WHU: 563, WIG: 75, WOL: 76,
};

const outDir = path.resolve(process.argv[2] || 'badges-raw');
await fs.mkdir(outDir, { recursive: true });

async function get(url) {
  const res = await fetch(url);
  return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

for (const [code, id] of Object.entries(IDS)) {
  // BOU and POR only have 200px PNGs.
  let buf = await get(`https://crests.football-data.org/${id}.svg`);
  const svg = Boolean(buf);
  if (!buf) buf = await get(`https://crests.football-data.org/${id}.png`);
  if (!buf) {
    console.warn('Missing crest', code);
    continue;
  }
  const src = svg ? sharp(buf, { density: 1200 }) : sharp(buf);
  const trimmed = await src.ensureAlpha().trim({ threshold: 5 }).png().toBuffer();
  await sharp(trimmed)
    .resize({ width: 2048, height: 2048, fit: 'inside', kernel: 'lanczos3' })
    .png()
    .toFile(path.join(outDir, `${code}.png`));
  console.log('Wrote', code, svg ? 'svg' : 'png');
}

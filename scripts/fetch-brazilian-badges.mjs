// scripts/fetch-brazilian-badges.mjs
// Fetches badges for Brazilian teams used in test API fixtures
// Usage: FOOTBALL_DATA_API_KEY=ed3153d132b847db836289243894706e node scripts/fetch-brazilian-badges.mjs

import fs from 'node:fs/promises';
import path from 'node:path';

const API_KEY = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';
const OUT_DIR = path.resolve('public/assets/badges');
const WIDTH = 128;

// Brazilian teams mapping: code -> team name (for searching)
const BRAZILIAN_TEAMS = [
  { code: 'REC', name: 'SC Recife', searchTerms: ['Recife', 'Sport Recife'] },
  { code: 'FLA', name: 'CR Flamengo', searchTerms: ['Flamengo', 'Clube de Regatas do Flamengo'] },
  { code: 'SAN', name: 'Santos FC', searchTerms: ['Santos'] },
  { code: 'PAL', name: 'SE Palmeiras', searchTerms: ['Palmeiras', 'Sociedade Esportiva Palmeiras'] },
  { code: 'RBB', name: 'RB Bragantino', searchTerms: ['Bragantino', 'Red Bull Bragantino'] },
  { code: 'CAM', name: 'CA Mineiro', searchTerms: ['Atlético Mineiro', 'Atletico Mineiro', 'Atletico MG', 'Atlético MG', 'Mineiro'], teamId: 1766 },
];

async function ensureDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

async function fetchArrayBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch crest failed ${res.status} ${url}`);
  return await res.arrayBuffer();
}

async function saveBadge(code, buf, formatHint, url) {
  const out = path.join(OUT_DIR, `${code}.png`);
  
  // If it's already a PNG, save directly
  if (formatHint === 'png') {
    await fs.writeFile(out, Buffer.from(buf));
    console.log(`✓ Saved ${code}.png`);
    return;
  }
  
  // For SVG or other formats, try to convert using a simple approach
  // If sharp is not available, we'll save as-is and let the browser handle it
  try {
    // Try to use sharp if available
    const sharp = await import('sharp').catch(() => null);
    if (sharp) {
      let pipeline = sharp.default(Buffer.from(buf));
      if (formatHint === 'svg') {
        pipeline = sharp.default(Buffer.from(buf), { density: 384 });
      }
      const png = await pipeline
        .resize({ width: WIDTH, height: WIDTH, fit: 'inside', withoutEnlargement: true })
        .png({ quality: 90 })
        .toBuffer();
      await fs.writeFile(out, png);
      console.log(`✓ Saved ${code}.png (converted from ${formatHint})`);
      return;
    }
  } catch (e) {
    // Sharp not available, continue with direct save
  }
  
  // Fallback: save as-is (browser will handle SVG/WebP)
  const ext = formatHint === 'svg' ? 'svg' : 'png';
  const outFile = path.join(OUT_DIR, `${code}.${ext}`);
  await fs.writeFile(outFile, Buffer.from(buf));
  console.log(`✓ Saved ${code}.${ext} (direct save, may need conversion)`);
}

function inferFormatFromUrl(u) {
  try {
    const ext = new URL(u).pathname.split('.').pop()?.toLowerCase();
    if (ext === 'svg' || ext === 'svgz') return 'svg';
    if (ext === 'webp') return 'webp';
    if (ext === 'png') return 'png';
  } catch {}
  return 'unknown';
}

async function searchTeamByName(searchTerm) {
  // Search in Brazilian Serie A (BSA) competition
  const competitions = ['BSA']; // Brazilian Serie A
  for (const comp of competitions) {
    try {
      const url = `https://api.football-data.org/v4/competitions/${comp}/teams`;
      const res = await fetch(url, {
        headers: { 'X-Auth-Token': API_KEY },
      });
      if (!res.ok) {
        console.warn(`  Competition ${comp} returned ${res.status}`);
        continue;
      }
      const json = await res.json();
      const teams = Array.isArray(json?.teams) ? json.teams : [];
      
      console.log(`  Found ${teams.length} teams in ${comp}`);
      
      // Search for team by name (more flexible matching)
      const found = teams.find(team => {
        const name = (team.name || '').toLowerCase();
        const shortName = (team.shortName || '').toLowerCase();
        const tla = (team.tla || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return name.includes(search) || shortName.includes(search) || tla.includes(search) ||
               search.includes(name.split(' ')[0]) || search.includes(shortName.split(' ')[0]);
      });
      
      if (found) {
        console.log(`  Match: ${found.name} (short: ${found.shortName}, TLA: ${found.tla})`);
        return found;
      }
    } catch (e) {
      console.warn(`  Error searching ${comp}:`, e.message);
    }
  }
  return null;
}

async function fetchTeamById(teamId) {
  try {
    const url = `https://api.football-data.org/v4/teams/${teamId}`;
    const res = await fetch(url, {
      headers: { 'X-Auth-Token': API_KEY },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function fetchBadgeForTeam(teamInfo) {
  // Check if badge already exists
  const existingPng = path.join(OUT_DIR, `${teamInfo.code}.png`);
  const existingSvg = path.join(OUT_DIR, `${teamInfo.code}.svg`);
  try {
    await fs.access(existingPng);
    console.log(`✓ ${teamInfo.code}.png already exists, skipping...`);
    return true;
  } catch {
    try {
      await fs.access(existingSvg);
      console.log(`✓ ${teamInfo.code}.svg already exists, skipping...`);
      return true;
    } catch {
      // File doesn't exist, continue to fetch
    }
  }
  
  console.log(`\nSearching for ${teamInfo.name}...`);
  
  // Try direct team ID fetch first if available
  let team = null;
  if (teamInfo.teamId) {
    console.log(`  Trying direct fetch by team ID ${teamInfo.teamId}...`);
    team = await fetchTeamById(teamInfo.teamId);
    if (team) {
      console.log(`  Found via ID: ${team.name} (TLA: ${team.tla || 'N/A'})`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // If not found by ID, try search
  if (!team) {
    for (const term of teamInfo.searchTerms) {
      team = await searchTeamByName(term);
      if (team) break;
      // Wait a bit between searches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  if (!team) {
    console.warn(`✗ Could not find team: ${teamInfo.name}`);
    return false;
  }
  
  if (!team.crest && !team.crestUrl) {
    console.warn(`  ✗ No crest URL for ${teamInfo.name}`);
    return false;
  }
  
  const crestUrl = team.crest || team.crestUrl || '';
  
  try {
    const ab = await fetchArrayBuffer(crestUrl);
    const hint = inferFormatFromUrl(crestUrl);
    await saveBadge(teamInfo.code, ab, hint, crestUrl);
    return true;
  } catch (e) {
    console.warn(`  ✗ Failed to fetch/save badge for ${teamInfo.name}:`, e.message);
    return false;
  }
}

async function main() {
  if (!API_KEY) {
    throw new Error('Missing FOOTBALL_DATA_API_KEY env var.');
  }
  
  await ensureDir();
  
  console.log('Fetching badges for Brazilian teams...\n');
  
  let successCount = 0;
  for (const teamInfo of BRAZILIAN_TEAMS) {
    const success = await fetchBadgeForTeam(teamInfo);
    if (success) successCount++;
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n✓ Successfully fetched ${successCount}/${BRAZILIAN_TEAMS.length} badges`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


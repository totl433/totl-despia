#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkForgetItMltPoints() {
  console.log('🔍 Checking MLT points for "forget it" league...\n');
  
  // Find the league
  const { data: league } = await supabase
    .from('leagues')
    .select('id, name')
    .ilike('name', 'forget it')
    .maybeSingle();
  
  if (!league) {
    console.error('❌ League not found');
    return;
  }
  
  console.log(`✅ Found league: ${league.name} (${league.id})\n`);
  
  // Get members
  const { data: members } = await supabase
    .from('league_members')
    .select('user_id, users(id, name)')
    .eq('league_id', league.id);
  
  const memberMap = new Map();
  members?.forEach(m => {
    if (m.users) {
      memberMap.set(m.user_id, { id: m.user_id, name: m.users.name });
    }
  });
  
  console.log('📊 Members:');
  memberMap.forEach((m, id) => {
    console.log(`   ${m.name} (${id.slice(0, 8)})`);
  });
  
  // Get picks for all members
  const memberIds = Array.from(memberMap.keys());
  const { data: picks } = await supabase
    .from('app_picks')
    .select('user_id, gw, fixture_index, pick')
    .in('user_id', memberIds);
  
  // Get results
  const { data: results } = await supabase
    .from('app_gw_results')
    .select('gw, fixture_index, result');
  
  // Get fixtures to determine relevant GWs
  const { data: fixtures } = await supabase
    .from('app_fixtures')
    .select('gw, kickoff_time')
    .order('gw');
  
  // Calculate MLT points exactly like Home page
  const outcomeByGwIdx = new Map();
  results?.forEach(r => {
    if (r.result === 'H' || r.result === 'D' || r.result === 'A') {
      outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, r.result);
    }
  });
  
  const gwsWithResults = [...new Set(results?.map(r => r.gw) || [])].sort((a, b) => a - b);
  const relevantGws = gwsWithResults; // Assume league started at GW1
  
  console.log(`\n📊 Relevant GWs: ${relevantGws.join(', ')}`);
  console.log(`📊 Total picks: ${picks?.length || 0}`);
  console.log(`📊 Total results: ${results?.length || 0}\n`);
  
  // Build outcomeByGwAndIdx
  const outcomeByGwAndIdx = new Map();
  relevantGws.forEach((g) => {
    outcomeByGwAndIdx.set(g, new Map());
  });
  outcomeByGwIdx.forEach((out, key) => {
    const [gwStr, idxStr] = key.split(":");
    const g = parseInt(gwStr, 10);
    const idx = parseInt(idxStr, 10);
    if (relevantGws.includes(g)) {
      outcomeByGwAndIdx.get(g)?.set(idx, out);
    }
  });
  
  // Calculate per-GW scores
  const perGw = new Map();
  const gwWinners = new Map();
  
  relevantGws.forEach((g) => {
    const map = new Map();
    memberIds.forEach((id) => map.set(id, { user_id: id, score: 0, unicorns: 0 }));
    perGw.set(g, map);
  });
  
  const picksByGwIdx = new Map();
  picks?.forEach((p) => {
    const key = `${p.gw}:${p.fixture_index}`;
    const arr = picksByGwIdx.get(key) ?? [];
    arr.push(p);
    picksByGwIdx.set(key, arr);
  });
  
  const memberIdsSet = new Set(memberIds);
  
  relevantGws.forEach((g) => {
    const gwOutcomes = outcomeByGwAndIdx.get(g);
    const map = perGw.get(g);
    
    gwOutcomes?.forEach((out, idx) => {
      const key = `${g}:${idx}`;
      const thesePicks = (picksByGwIdx.get(key) ?? []).filter((p) => memberIdsSet.has(p.user_id));
      const correctUsers = [];
      
      thesePicks.forEach((p) => {
        if (p.pick === out) {
          const row = map.get(p.user_id);
          if (row) {
            row.score += 1;
            correctUsers.push(p.user_id);
          }
        }
      });
      
      if (correctUsers.length === 1 && memberIds.length >= 3) {
        const row = map.get(correctUsers[0]);
        if (row) row.unicorns += 1;
      }
    });
  });
  
  // Calculate MLT points
  const mltPts = new Map();
  const ocp = new Map();
  const unis = new Map();
  memberIds.forEach((id) => {
    mltPts.set(id, 0);
    ocp.set(id, 0);
    unis.set(id, 0);
  });
  
  relevantGws.forEach((g) => {
    const gwRows = Array.from(perGw.get(g).values());
    gwRows.forEach((r) => {
      ocp.set(r.user_id, (ocp.get(r.user_id) ?? 0) + r.score);
      unis.set(r.user_id, (unis.get(r.user_id) ?? 0) + r.unicorns);
    });
    
    gwRows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);
    if (gwRows.length === 0) return;
    
    const top = gwRows[0];
    const coTop = gwRows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);
    const winners = new Set(coTop.map((r) => r.user_id));
    gwWinners.set(g, winners);
    
    if (coTop.length === 1) {
      mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
    } else {
      coTop.forEach((r) => {
        mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
      });
    }
  });
  
  // Build ML table rows
  const mltRows = memberIds.map((id) => ({
    user_id: id,
    name: memberMap.get(id).name,
    mltPts: mltPts.get(id) ?? 0,
    unicorns: unis.get(id) ?? 0,
    ocp: ocp.get(id) ?? 0,
  }));
  
  const sortedMltRows = [...mltRows].sort((a, b) =>
    b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name)
  );
  
  console.log('📊 Calculated MLT Points:');
  sortedMltRows.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.name}: MLT=${r.mltPts}, Unicorns=${r.unicorns}, OCP=${r.ocp}`);
  });
  
  console.log('\n📊 Per-GW breakdown:');
  relevantGws.forEach(g => {
    const gwRows = Array.from(perGw.get(g).values());
    gwRows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);
    console.log(`\n   GW${g}:`);
    gwRows.forEach((r, i) => {
      const name = memberMap.get(r.user_id)?.name || 'Unknown';
      console.log(`     ${i + 1}. ${name}: Score=${r.score}, Unicorns=${r.unicorns}`);
    });
    const winners = gwWinners.get(g);
    console.log(`     Winners: ${Array.from(winners || []).map(id => memberMap.get(id)?.name || id.slice(0, 8)).join(', ')}`);
  });
}

checkForgetItMltPoints().catch(console.error);

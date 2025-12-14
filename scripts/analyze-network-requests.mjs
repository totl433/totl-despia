#!/usr/bin/env node
/**
 * Analyze network requests to see which table is being queried
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const networkFile = join(__dirname, '..', '.cursor', 'projects', 'Users-jof-Documents-GitHub-totl-web', 'agent-tools', 'd7fe6f33-f7b9-49e8-9cef-ade8d8d117b5.txt');

try {
  const content = readFileSync(networkFile, 'utf-8');
  const requests = JSON.parse(content);
  
  console.log('🔍 Analyzing network requests for picks data...\n');
  
  const picksQueries = requests.filter(r => r.url && r.url.includes('/rest/v1/picks'));
  const appPicksQueries = requests.filter(r => r.url && r.url.includes('/rest/v1/app_picks'));
  
  console.log(`📊 Total queries to "picks" table: ${picksQueries.length}`);
  console.log(`📊 Total queries to "app_picks" table: ${appPicksQueries.length}\n`);
  
  if (picksQueries.length > 0) {
    console.log('📋 Sample queries to "picks" table:');
    picksQueries.slice(0, 5).forEach((q, i) => {
      console.log(`   ${i + 1}. ${q.url.substring(0, 120)}...`);
    });
  }
  
  if (appPicksQueries.length > 0) {
    console.log('\n📋 Queries to "app_picks" table:');
    appPicksQueries.forEach((q, i) => {
      console.log(`   ${i + 1}. ${q.url}`);
    });
  } else {
    console.log('\n❌ NO queries found to "app_picks" table!');
    console.log('   All picks queries are going to "picks" table.');
  }
  
  // Check for GW16 queries specifically
  const gw16PicksQueries = picksQueries.filter(q => q.url.includes('gw=eq.16') || q.url.includes('gw%3Deq.16'));
  console.log(`\n📊 GW16 queries to "picks" table: ${gw16PicksQueries.length}`);
  
  if (gw16PicksQueries.length > 0) {
    console.log('\n📋 GW16 picks queries:');
    gw16PicksQueries.forEach((q, i) => {
      console.log(`   ${i + 1}. ${q.url}`);
    });
  }
  
} catch (error) {
  console.error('Error reading network file:', error.message);
}

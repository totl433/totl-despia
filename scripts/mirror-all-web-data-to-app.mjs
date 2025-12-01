#!/usr/bin/env node
/**
 * Mirror all existing Web data to App tables
 * This copies fixtures, picks, gw_submissions, and gw_results from Web tables to App tables
 * So that GWs 1-13 are available in the App system
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// Use service role key to bypass RLS for data migration
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY) are set');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('\n⚠️  Note: Using service role key is recommended for data migration to bypass RLS');
    console.error('   You can find it in: Supabase Dashboard → Settings → API → service_role key');
  }
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function mirrorAllData() {
  console.log('🔄 Mirroring all Web data to App tables...\n');
  
  try {
    // 1. Mirror fixtures
    console.log('📅 Step 1: Mirroring fixtures...');
    const { data: webFixtures, error: fixturesError } = await supabase
      .from('fixtures')
      .select('*')
      .order('gw', { ascending: true })
      .order('fixture_index', { ascending: true });
    
    if (fixturesError) throw fixturesError;
    
    if (!webFixtures || webFixtures.length === 0) {
      console.log('   ⚠️  No fixtures found in Web tables');
    } else {
      const appFixtures = webFixtures.map(f => ({
        gw: f.gw,
        fixture_index: f.fixture_index,
        home_team: f.home_team,
        away_team: f.away_team,
        home_code: f.home_code,
        away_code: f.away_code,
        home_name: f.home_name,
        away_name: f.away_name,
        kickoff_time: f.kickoff_time,
        api_match_id: null, // Web fixtures don't have API match IDs
      }));
      
      const { error: insertFixturesError } = await supabase
        .from('app_fixtures')
        .upsert(appFixtures, { onConflict: 'gw,fixture_index' });
      
      if (insertFixturesError) throw insertFixturesError;
      console.log(`   ✅ Mirrored ${appFixtures.length} fixtures (GWs ${Math.min(...appFixtures.map(f => f.gw))} - ${Math.max(...appFixtures.map(f => f.gw))})`);
    }
    
    // 2. Mirror picks
    console.log('\n👥 Step 2: Mirroring picks...');
    const { data: webPicks, error: picksError } = await supabase
      .from('picks')
      .select('*')
      .order('gw', { ascending: true })
      .order('fixture_index', { ascending: true });
    
    if (picksError) throw picksError;
    
    if (!webPicks || webPicks.length === 0) {
      console.log('   ⚠️  No picks found in Web tables');
    } else {
      const appPicks = webPicks.map(p => ({
        user_id: p.user_id,
        gw: p.gw,
        fixture_index: p.fixture_index,
        pick: p.pick,
      }));
      
      // Insert in batches to avoid payload size limits
      const batchSize = 1000;
      let inserted = 0;
      for (let i = 0; i < appPicks.length; i += batchSize) {
        const batch = appPicks.slice(i, i + batchSize);
        const { error: insertPicksError } = await supabase
          .from('app_picks')
          .upsert(batch, { onConflict: 'user_id,gw,fixture_index' });
        
        if (insertPicksError) throw insertPicksError;
        inserted += batch.length;
      }
      
      const uniqueGws = [...new Set(appPicks.map(p => p.gw))].sort((a, b) => a - b);
      console.log(`   ✅ Mirrored ${inserted} picks across GWs ${uniqueGws.join(', ')}`);
    }
    
    // 3. Mirror gw_submissions
    console.log('\n📝 Step 3: Mirroring submissions...');
    const { data: webSubmissions, error: submissionsError } = await supabase
      .from('gw_submissions')
      .select('*')
      .order('gw', { ascending: true });
    
    if (submissionsError) throw submissionsError;
    
    if (!webSubmissions || webSubmissions.length === 0) {
      console.log('   ⚠️  No submissions found in Web tables');
    } else {
      const appSubmissions = webSubmissions.map(s => ({
        user_id: s.user_id,
        gw: s.gw,
        submitted_at: s.submitted_at,
      }));
      
      const { error: insertSubmissionsError } = await supabase
        .from('app_gw_submissions')
        .upsert(appSubmissions, { onConflict: 'user_id,gw' });
      
      if (insertSubmissionsError) throw insertSubmissionsError;
      const uniqueGws = [...new Set(appSubmissions.map(s => s.gw))].sort((a, b) => a - b);
      console.log(`   ✅ Mirrored ${appSubmissions.length} submissions across GWs ${uniqueGws.join(', ')}`);
    }
    
    // 4. Mirror gw_results
    console.log('\n🏆 Step 4: Mirroring results...');
    const { data: webResults, error: resultsError } = await supabase
      .from('gw_results')
      .select('*')
      .order('gw', { ascending: true })
      .order('fixture_index', { ascending: true });
    
    if (resultsError) throw resultsError;
    
    if (!webResults || webResults.length === 0) {
      console.log('   ⚠️  No results found in Web tables');
    } else {
      const appResults = webResults.map(r => ({
        gw: r.gw,
        fixture_index: r.fixture_index,
        result: r.result,
        decided_at: r.decided_at,
        home_score: r.home_score || null,
        away_score: r.away_score || null,
        api_match_id: null, // Web results don't have API match IDs
      }));
      
      const { error: insertResultsError } = await supabase
        .from('app_gw_results')
        .upsert(appResults, { onConflict: 'gw,fixture_index' });
      
      if (insertResultsError) throw insertResultsError;
      const uniqueGws = [...new Set(appResults.map(r => r.gw))].sort((a, b) => a - b);
      console.log(`   ✅ Mirrored ${appResults.length} results across GWs ${uniqueGws.join(', ')}`);
    }
    
    // 5. Update app_meta to match Web meta
    console.log('\n⚙️  Step 5: Updating app_meta...');
    const { data: webMeta, error: metaError } = await supabase
      .from('meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle();
    
    if (metaError) {
      console.log('   ⚠️  Could not read Web meta, using default');
    } else if (webMeta) {
      const { error: updateMetaError } = await supabase
        .from('app_meta')
        .update({ current_gw: webMeta.current_gw })
        .eq('id', 1);
      
      if (updateMetaError) throw updateMetaError;
      console.log(`   ✅ Updated app_meta.current_gw to ${webMeta.current_gw}`);
    }
    
    console.log('\n🎉 Mirroring complete! All Web data has been copied to App tables.');
    console.log('   The App can now use App tables and will have access to all historical GWs.\n');
    
  } catch (error) {
    console.error('❌ Error mirroring data:', error.message);
    console.error(error);
    process.exit(1);
  }
}

mirrorAllData();


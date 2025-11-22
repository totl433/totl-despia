import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function showCarlTestApiPicks() {
  console.log('Finding Carl and his Test API picks...\n');

  // First, find Carl's user ID
  const { data: carlUsers, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', 'carl');

  if (userError) {
    console.error('Error finding Carl:', userError);
    return;
  }

  if (!carlUsers || carlUsers.length === 0) {
    console.log('❌ No user named Carl found');
    return;
  }

  // If multiple Carls, show all of them
  if (carlUsers.length > 1) {
    console.log(`⚠️  Found ${carlUsers.length} users with "carl" in name:`);
    carlUsers.forEach(u => console.log(`  - ${u.name} (ID: ${u.id})`));
    console.log('\nShowing picks for all of them...\n');
  }

  for (const carl of carlUsers) {
    console.log(`\n📋 ${carl.name} (ID: ${carl.id})`);
    console.log('─'.repeat(50));

    // Get Carl's Test API picks
    const { data: picks, error: picksError } = await supabase
      .from('test_api_picks')
      .select('matchday, fixture_index, pick')
      .eq('user_id', carl.id)
      .eq('matchday', 1)
      .order('fixture_index', { ascending: true });

    if (picksError) {
      console.error(`Error fetching picks for ${carl.name}:`, picksError);
      continue;
    }

    if (!picks || picks.length === 0) {
      console.log(`  ❌ No Test API picks found for ${carl.name}`);
      continue;
    }

    // Get the fixtures to show team names
    const { data: fixtures } = await supabase
      .from('test_api_fixtures')
      .select('fixture_index, home_team, away_team, home_name, away_name')
      .eq('test_gw', 1)
      .order('fixture_index', { ascending: true });

    const fixturesMap = new Map();
    (fixtures || []).forEach(f => {
      fixturesMap.set(f.fixture_index, {
        home: f.home_name || f.home_team || 'Home',
        away: f.away_name || f.away_team || 'Away'
      });
    });

    console.log(`  ✅ Found ${picks.length} picks for Test GW 1:\n`);

    picks.forEach(p => {
      const fixture = fixturesMap.get(p.fixture_index);
      const homeTeam = fixture?.home || 'Unknown';
      const awayTeam = fixture?.away || 'Unknown';
      const pickSymbol = p.pick === 'H' ? '🏠 Home Win' : p.pick === 'A' ? '✈️  Away Win' : '🤝 Draw';
      
      console.log(`  Fixture ${p.fixture_index}: ${homeTeam} vs ${awayTeam}`);
      console.log(`    Pick: ${pickSymbol} (${p.pick})`);
      console.log('');
    });

    // Check if Carl has submitted
    const { data: submission } = await supabase
      .from('test_api_submissions')
      .select('submitted_at')
      .eq('user_id', carl.id)
      .eq('matchday', 1)
      .maybeSingle();

    if (submission?.submitted_at) {
      console.log(`  ✅ Submitted at: ${new Date(submission.submitted_at).toLocaleString()}`);
    } else {
      console.log(`  ⚠️  Not submitted yet (picks are saved but not confirmed)`);
    }
  }
}

showCarlTestApiPicks().catch(console.error);


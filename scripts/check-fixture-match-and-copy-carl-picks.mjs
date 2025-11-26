import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Use service role key for writes (required for RLS)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials (need SUPABASE_SERVICE_ROLE_KEY for writes)');
  console.error('   Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')).join(', '));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkAndCopyCarlPicks() {
  console.log('🔍 Checking if fixtures match between Main GW 12 and Test GW 1...\n');

  // Find Carl
  const { data: carlUsers } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', 'carl')
    .limit(1);

  if (!carlUsers || carlUsers.length === 0) {
    console.log('❌ Carl not found');
    return;
  }

  const carl = carlUsers[0];
  console.log(`📋 Found: ${carl.name} (ID: ${carl.id})\n`);

  // Get Main GW 12 fixtures
  const { data: mainFixtures } = await supabase
    .from('fixtures')
    .select('fixture_index, home_team, away_team, home_name, away_name, home_code, away_code')
    .eq('gw', 12)
    .order('fixture_index', { ascending: true });

  // Get Test GW 1 fixtures
  const { data: testFixtures } = await supabase
    .from('test_api_fixtures')
    .select('fixture_index, home_team, away_team, home_name, away_name, home_code, away_code')
    .eq('test_gw', 1)
    .order('fixture_index', { ascending: true });

  if (!mainFixtures || mainFixtures.length === 0) {
    console.log('❌ No fixtures found for Main GW 12');
    return;
  }

  if (!testFixtures || testFixtures.length === 0) {
    console.log('❌ No fixtures found for Test GW 1');
    return;
  }

  console.log(`Main GW 12: ${mainFixtures.length} fixtures`);
  console.log(`Test GW 1: ${testFixtures.length} fixtures\n`);

  // Check if they match
  if (mainFixtures.length !== testFixtures.length) {
    console.log('⚠️  WARNING: Different number of fixtures!');
    console.log(`   Main GW 12: ${mainFixtures.length} fixtures`);
    console.log(`   Test GW 1: ${testFixtures.length} fixtures`);
    console.log('\n❌ Cannot copy - fixture counts don\'t match');
    return;
  }

  // Compare each fixture by team codes (more reliable than names)
  let allMatch = true;
  const mismatches = [];

  for (let i = 0; i < mainFixtures.length; i++) {
    const main = mainFixtures[i];
    const test = testFixtures[i];

    // Compare by codes first (most reliable), then by names
    const mainHomeCode = (main.home_code || '').toUpperCase();
    const mainAwayCode = (main.away_code || '').toUpperCase();
    const testHomeCode = (test.home_code || '').toUpperCase();
    const testAwayCode = (test.away_code || '').toUpperCase();

    const mainHome = main.home_name || main.home_team || '';
    const mainAway = main.away_name || main.away_team || '';
    const testHome = test.home_name || test.home_team || '';
    const testAway = test.away_name || test.away_team || '';

    // Match by codes if available, otherwise by names
    // Handle known code variations (NFO vs NOT for Nottingham Forest)
    const codeVariations = {
      'NFO': ['NOT', 'NFO'],
      'NOT': ['NOT', 'NFO']
    };
    
    const normalizeCode = (code) => {
      if (!code) return code;
      const variations = codeVariations[code] || [code];
      return variations;
    };
    
    const mainHomeVariations = normalizeCode(mainHomeCode);
    const mainAwayVariations = normalizeCode(mainAwayCode);
    const testHomeVariations = normalizeCode(testHomeCode);
    const testAwayVariations = normalizeCode(testAwayCode);
    
    const homeMatch = mainHomeCode && testHomeCode 
      ? mainHomeVariations.includes(testHomeCode) || testHomeVariations.includes(mainHomeCode)
      : (!mainHomeCode && !testHomeCode && mainHome === testHome);
    
    const awayMatch = mainAwayCode && testAwayCode
      ? mainAwayVariations.includes(testAwayCode) || testAwayVariations.includes(mainAwayCode)
      : (!mainAwayCode && !testAwayCode && mainAway === testAway);
    
    const codesMatch = homeMatch && awayMatch;

    if (!codesMatch) {
      allMatch = false;
      mismatches.push({
        fixture_index: main.fixture_index,
        main: `${mainHomeCode || mainHome} vs ${mainAwayCode || mainAway}`,
        test: `${testHomeCode || testHome} vs ${testAwayCode || testAway}`
      });
    }
  }

  if (!allMatch) {
    console.log('❌ Fixtures DO NOT match! Mismatches:');
    mismatches.forEach(m => {
      console.log(`   Fixture ${m.fixture_index}:`);
      console.log(`     Main GW 12: ${m.main}`);
      console.log(`     Test GW 1:  ${m.test}`);
    });
    console.log('\n❌ Cannot copy - fixtures don\'t match');
    return;
  }

  console.log('✅ All fixtures match!\n');

  // Get Carl's Main GW 12 picks
  const { data: mainPicks } = await supabase
    .from('picks')
    .select('fixture_index, pick')
    .eq('user_id', carl.id)
    .eq('gw', 12)
    .order('fixture_index', { ascending: true });

  if (!mainPicks || mainPicks.length === 0) {
    console.log('❌ No picks found for Carl in Main GW 12');
    return;
  }

  console.log(`📝 Carl's Main GW 12 picks (${mainPicks.length} picks):`);
  mainPicks.forEach(p => {
    const fixture = mainFixtures.find(f => f.fixture_index === p.fixture_index);
    const home = fixture?.home_name || fixture?.home_team || 'Home';
    const away = fixture?.away_name || fixture?.away_team || 'Away';
    const pickSymbol = p.pick === 'H' ? '🏠 Home' : p.pick === 'A' ? '✈️  Away' : '🤝 Draw';
    console.log(`   ${home} vs ${away}: ${pickSymbol} (${p.pick})`);
  });

  // Get Carl's current Test API picks
  const { data: currentTestPicks } = await supabase
    .from('test_api_picks')
    .select('fixture_index, pick')
    .eq('user_id', carl.id)
    .eq('matchday', 1)
    .order('fixture_index', { ascending: true });

  console.log(`\n📝 Carl's current Test API picks (${currentTestPicks?.length || 0} picks):`);
  if (currentTestPicks && currentTestPicks.length > 0) {
    currentTestPicks.forEach(p => {
      const fixture = testFixtures.find(f => f.fixture_index === p.fixture_index);
      const home = fixture?.home_name || fixture?.home_team || 'Home';
      const away = fixture?.away_name || fixture?.away_team || 'Away';
      const pickSymbol = p.pick === 'H' ? '🏠 Home' : p.pick === 'A' ? '✈️  Away' : '🤝 Draw';
      console.log(`   ${home} vs ${away}: ${pickSymbol} (${p.pick})`);
    });
  } else {
    console.log('   (none)');
  }

  // Check if picks are different
  const picksDifferent = mainPicks.length !== (currentTestPicks?.length || 0) ||
    mainPicks.some(mp => {
      const testPick = currentTestPicks?.find(tp => tp.fixture_index === mp.fixture_index);
      return !testPick || testPick.pick !== mp.pick;
    });

  if (!picksDifferent) {
    console.log('\n✅ Picks are already the same! No changes needed.');
    return;
  }

  // Show what will be copied
  console.log('\n🔄 Changes that will be made:');
  mainPicks.forEach(mp => {
    const testPick = currentTestPicks?.find(tp => tp.fixture_index === mp.fixture_index);
    const fixture = mainFixtures.find(f => f.fixture_index === mp.fixture_index);
    const home = fixture?.home_name || fixture?.home_team || 'Home';
    const away = fixture?.away_name || fixture?.away_team || 'Away';
    
    if (!testPick || testPick.pick !== mp.pick) {
      const oldPick = testPick ? (testPick.pick === 'H' ? 'Home' : testPick.pick === 'A' ? 'Away' : 'Draw') : 'None';
      const newPick = mp.pick === 'H' ? 'Home' : mp.pick === 'A' ? 'Away' : 'Draw';
      console.log(`   ${home} vs ${away}: ${oldPick} → ${newPick}`);
    }
  });

  console.log('\n⚠️  READY TO COPY - This will update Carl\'s Test API picks to match his Main GW 12 picks.');
  console.log('   Run with --execute flag to actually perform the update.\n');
}

// Check if --execute flag is passed
const args = process.argv.slice(2);
const shouldExecute = args.includes('--execute');

if (shouldExecute) {
  // Actually perform the copy
  (async () => {
    const { data: carlUsers } = await supabase
      .from('users')
      .select('id, name')
      .ilike('name', 'carl')
      .limit(1);

    if (!carlUsers || carlUsers.length === 0) {
      console.log('❌ Carl not found');
      process.exit(1);
    }

    const carl = carlUsers[0];

    // Get Main GW 12 picks
    const { data: mainPicks } = await supabase
      .from('picks')
      .select('fixture_index, pick')
      .eq('user_id', carl.id)
      .eq('gw', 12)
      .order('fixture_index', { ascending: true });

    if (!mainPicks || mainPicks.length === 0) {
      console.log('❌ No picks found for Carl in Main GW 12');
      process.exit(1);
    }

    // Prepare picks for test_api_picks table
    const testPicks = mainPicks.map(p => ({
      user_id: carl.id,
      matchday: 1,
      fixture_index: p.fixture_index,
      pick: p.pick
    }));

    // Upsert the picks
    const { error } = await supabase
      .from('test_api_picks')
      .upsert(testPicks, {
        onConflict: 'user_id,matchday,fixture_index',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('❌ Error updating picks:', error);
      process.exit(1);
    }

    console.log(`✅ Successfully copied ${testPicks.length} picks from Main GW 12 to Test API picks!`);
  })();
} else {
  // Just show what would happen
  checkAndCopyCarlPicks().catch(console.error);
}


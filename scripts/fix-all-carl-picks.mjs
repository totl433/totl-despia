import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';

async function fixAllCarlPicks() {
  console.log('🔍 Checking ALL of Carl\'s picks across all gameweeks...\n');

  // Get all gameweeks that have fixtures
  const { data: allFixtures, error: fixturesError } = await supabase
    .from('fixtures')
    .select('gw, fixture_index')
    .order('gw', { ascending: true })
    .order('fixture_index', { ascending: true });

  if (fixturesError) {
    console.error('❌ Error fetching fixtures:', fixturesError.message);
    return;
  }

  // Get all of Carl's picks
  const { data: allPicks, error: picksError } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', CARL_USER_ID)
    .order('gw', { ascending: true });

  if (picksError) {
    console.error('❌ Error fetching picks:', picksError.message);
    return;
  }

  // Get all of Carl's submissions
  const { data: submissions, error: subsError } = await supabase
    .from('gw_submissions')
    .select('gw, submitted_at')
    .eq('user_id', CARL_USER_ID)
    .not('submitted_at', 'is', null)
    .order('gw', { ascending: true });

  if (subsError) {
    console.error('❌ Error fetching submissions:', subsError.message);
    return;
  }

  const submittedGws = new Set(submissions.map(s => s.gw));

  // Group fixtures by gameweek
  const fixturesByGw = new Map();
  allFixtures.forEach(f => {
    if (!fixturesByGw.has(f.gw)) {
      fixturesByGw.set(f.gw, []);
    }
    fixturesByGw.get(f.gw).push(f.fixture_index);
  });

  // Group picks by gameweek
  const picksByGw = new Map();
  allPicks.forEach(p => {
    if (!picksByGw.has(p.gw)) {
      picksByGw.set(p.gw, []);
    }
    picksByGw.get(p.gw).push(p);
  });

  console.log('📊 Checking each gameweek...\n');
  console.log('='.repeat(80));

  const issues = [];
  const fixes = [];

  // Check each gameweek
  for (const [gw, fixtureIndices] of fixturesByGw.entries()) {
    const picks = picksByGw.get(gw) || [];
    const submitted = submittedGws.has(gw);
    
    // Find picks with null fixture_index
    const nullPicks = picks.filter(p => p.fixture_index === null);
    
    // Find which fixture indices have picks
    const pickedIndices = new Set(picks.filter(p => p.fixture_index !== null).map(p => p.fixture_index));
    
    // Find missing fixture indices
    const missingIndices = fixtureIndices.filter(idx => !pickedIndices.has(idx));

    if (submitted) {
      // If submitted, should have picks for ALL fixtures
      const expectedCount = fixtureIndices.length;
      const actualCount = picks.length;
      const validCount = picks.filter(p => p.fixture_index !== null).length;

      console.log(`GW${gw}: ${fixtureIndices.length} fixtures, ${actualCount} picks (${validCount} valid)`);
      
      if (nullPicks.length > 0) {
        console.log(`   ⚠️  Found ${nullPicks.length} pick(s) with null fixture_index`);
        issues.push({ gw, type: 'null_fixture_index', count: nullPicks.length, picks: nullPicks });
      }

      if (missingIndices.length > 0) {
        console.log(`   ⚠️  Missing picks for fixtures: ${missingIndices.join(', ')}`);
        issues.push({ gw, type: 'missing_picks', indices: missingIndices });
      }

      if (nullPicks.length > 0 && missingIndices.length > 0) {
        // Try to match null picks to missing indices
        console.log(`   💡 Attempting to match ${nullPicks.length} null pick(s) to ${missingIndices.length} missing fixture(s)...`);
        
        // Sort missing indices to match in order
        const sortedMissing = missingIndices.sort((a, b) => a - b);
        
        nullPicks.forEach((nullPick, idx) => {
          if (idx < sortedMissing.length) {
            const correctIndex = sortedMissing[idx];
            console.log(`   ✅ Will fix: Pick ID ${nullPick.id} → fixture_index ${correctIndex}`);
            fixes.push({
              pickId: nullPick.id,
              gw: nullPick.gw,
              oldIndex: null,
              newIndex: correctIndex,
              pick: nullPick.pick
            });
          }
        });
      }

      if (nullPicks.length === 0 && missingIndices.length === 0 && actualCount === expectedCount) {
        console.log(`   ✅ All good - ${actualCount} picks for ${expectedCount} fixtures`);
      }
    } else {
      console.log(`GW${gw}: ${fixtureIndices.length} fixtures, ${picks.length} picks (NOT SUBMITTED)`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`   Total issues found: ${issues.length}`);
  console.log(`   Fixes needed: ${fixes.length}\n`);

  if (fixes.length > 0) {
    console.log('🔧 Fixes to apply:');
    fixes.forEach(fix => {
      console.log(`   GW${fix.gw}: Pick ID ${fix.pickId} → fixture_index ${fix.newIndex} (pick: ${fix.pick})`);
    });

    console.log('\n⚠️  Applying fixes...\n');
    
    for (const fix of fixes) {
      const { error } = await supabase
        .from('picks')
        .update({ fixture_index: fix.newIndex })
        .eq('id', fix.pickId);

      if (error) {
        console.error(`   ❌ Error fixing pick ${fix.pickId}:`, error.message);
      } else {
        console.log(`   ✅ Fixed pick ${fix.pickId} → fixture_index ${fix.newIndex}`);
      }
    }

    console.log('\n✅ All fixes applied!\n');
  } else {
    console.log('✅ No fixes needed - all picks are correct!\n');
  }
}

fixAllCarlPicks().catch(console.error);


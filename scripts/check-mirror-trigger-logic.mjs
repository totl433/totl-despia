#!/usr/bin/env node
/**
 * Check the mirror trigger logic for potential bugs
 * The trigger checks if existing_pick != NEW.pick before updating
 * But what if the existing pick is wrong? It would still update.
 */

console.log('🔍 Analyzing mirror trigger logic for potential bugs...\n');

console.log('MIRROR TRIGGER CODE (mirror_picks_to_app):');
console.log(`
CREATE OR REPLACE FUNCTION mirror_picks_to_app()
RETURNS TRIGGER AS $$
DECLARE
  existing_pick TEXT;
BEGIN
  -- Check if the pick already exists in app_picks with the same value
  SELECT pick INTO existing_pick
  FROM app_picks
  WHERE user_id = NEW.user_id 
    AND gw = NEW.gw 
    AND fixture_index = NEW.fixture_index;
  
  -- Only insert/update if the value is different or doesn't exist
  IF existing_pick IS NULL OR existing_pick != NEW.pick THEN
    INSERT INTO app_picks (user_id, gw, fixture_index, pick)
    VALUES (NEW.user_id, NEW.gw, NEW.fixture_index, NEW.pick)
    ON CONFLICT (user_id, gw, fixture_index)
    DO UPDATE SET
      pick = EXCLUDED.pick;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`);

console.log('\n💡 POTENTIAL BUGS:');
console.log('\n1. Race Condition:');
console.log('   - User submits picks: Sunderland=H, Forest=D');
console.log('   - All picks inserted into "picks" table simultaneously');
console.log('   - Mirror trigger fires for each pick');
console.log('   - If app_picks already has wrong values (from previous submission?),');
console.log('     the trigger will update them correctly');
console.log('   - BUT: What if picks were inserted in wrong order?');
console.log('   - OR: What if app_picks had stale/wrong data that got overwritten?');

console.log('\n2. Existing Pick Check:');
console.log('   - Trigger checks: IF existing_pick IS NULL OR existing_pick != NEW.pick');
console.log('   - This means it WILL update if existing_pick is different');
console.log('   - But what if existing_pick was wrong from a previous submission?');
console.log('   - The trigger would correctly update it, but maybe the wrong data');
console.log('     was there in the first place?');

console.log('\n3. ON CONFLICT Behavior:');
console.log('   - Uses ON CONFLICT (user_id, gw, fixture_index) DO UPDATE');
console.log('   - This should work correctly, but what if there are multiple rows?');
console.log('   - Or if the unique constraint isn\'t working properly?');

console.log('\n4. Transaction Timing:');
console.log('   - All picks are inserted in a single transaction');
console.log('   - Mirror triggers fire for each INSERT');
console.log('   - If app_picks already has data, it gets updated');
console.log('   - But what if the data in app_picks was from a different source?');

console.log('\n🎯 KEY QUESTION:');
console.log('   When David Bird submitted his picks, did app_picks already have');
console.log('   wrong values (Sunderland=D, Forest=H) from a previous submission?');
console.log('   If so, the mirror trigger should have updated them correctly.');
console.log('   But maybe the trigger didn\'t fire, or fired incorrectly?');

console.log('\n🔍 NEED TO CHECK:');
console.log('   1. Was there a previous submission that put wrong data in app_picks?');
console.log('   2. Did the mirror trigger fire for all picks?');
console.log('   3. Is there a bug in the trigger that prevents updates?');
console.log('   4. Could picks have been swapped during the mirror process?');
console.log('   5. Is there any code that updates app_picks directly, bypassing the trigger?');

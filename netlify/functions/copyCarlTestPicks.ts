import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export const handler: Handler = async (event) => {
  // Only allow POST to prevent accidental execution
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' }),
    };
  }

  try {
    console.log('[copyCarlTestPicks] Starting...');

    // Find Carl
    const { data: carlUsers, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .ilike('name', 'carl')
      .limit(1);

    if (userError || !carlUsers || carlUsers.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Carl not found', details: userError }),
      };
    }

    const carl = carlUsers[0];
    console.log(`[copyCarlTestPicks] Found: ${carl.name} (${carl.id})`);

    // Get Main GW 12 picks
    const { data: mainPicks, error: picksError } = await supabase
      .from('picks')
      .select('fixture_index, pick')
      .eq('user_id', carl.id)
      .eq('gw', 12)
      .order('fixture_index', { ascending: true });

    if (picksError || !mainPicks || mainPicks.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No picks found for Carl in Main GW 12', details: picksError }),
      };
    }

    console.log(`[copyCarlTestPicks] Found ${mainPicks.length} picks from Main GW 12`);

    // Prepare picks for test_api_picks table
    const testPicks = mainPicks.map(p => ({
      user_id: carl.id,
      matchday: 1,
      fixture_index: p.fixture_index,
      pick: p.pick
    }));

    // Upsert the picks (ONLY updates test_api_picks, ONLY for Carl, ONLY matchday 1)
    const { error: upsertError } = await supabase
      .from('test_api_picks')
      .upsert(testPicks, {
        onConflict: 'user_id,matchday,fixture_index',
        ignoreDuplicates: false
      });

    if (upsertError) {
      console.error('[copyCarlTestPicks] Error:', upsertError);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to update picks', details: upsertError }),
      };
    }

    console.log(`[copyCarlTestPicks] Successfully updated ${testPicks.length} picks`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        message: `Copied ${testPicks.length} picks from Main GW 12 to Test API picks`,
        picksUpdated: testPicks.length
      }),
    };
  } catch (error: any) {
    console.error('[copyCarlTestPicks] Unexpected error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error?.message || 'Unexpected error' }),
    };
  }
};


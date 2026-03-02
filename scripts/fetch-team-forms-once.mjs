// One-off script to fetch and store team forms for a specific gameweek
// Usage: node scripts/fetch-team-forms-once.mjs 17

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Get GW from command line args
const gw = parseInt(process.argv[2], 10);
if (!gw || isNaN(gw)) {
  console.error('Usage: node scripts/fetch-team-forms-once.mjs <gameweek>');
  console.error('Example: node scripts/fetch-team-forms-once.mjs 17');
  process.exit(1);
}

async function fetchAndStoreTeamForms(gw) {
  try {
    console.log(`Fetching team forms for GW ${gw}...`);
    
    // Use current date in YYYY-MM-DD format for form calculation
    const today = new Date().toISOString().split('T')[0];
    const apiUrl = `https://api.football-data.org/v4/competitions/PL/standings?date=${today}`;
    console.log(`📅 Using date parameter: ${today}`);
    
    // Fetch from Football Data API
    const response = await fetch(apiUrl, {
      headers: {
        'X-Auth-Token': FOOTBALL_DATA_API_KEY,
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // Parse standings data to extract form
    const formsMap = new Map();
    const standings = result?.standings || result;
    
    if (standings && Array.isArray(standings)) {
      const overallTable = standings.find((s) => s.type === 'TOTAL') || standings[0];
      
      if (overallTable && overallTable.table && Array.isArray(overallTable.table)) {
        overallTable.table.forEach((team) => {
          const teamCode = (team.team?.tla || team.team?.shortName || '').toUpperCase().trim();
          // API returns comma-separated format (e.g., "D,L,W,D,W") with newest FIRST
          // Reverse it so newest is LAST for display (oldest → newest)
          const formRaw = (team.form || '').trim().toUpperCase().replace(/,/g, '');
          const form = formRaw ? formRaw.split('').reverse().join('') : '';
          
          if (teamCode && form) {
            formsMap.set(teamCode, form);
          }
        });
      }
    }

    if (formsMap.size > 0) {
      // Store forms in database
      const formsToInsert = Array.from(formsMap.entries()).map(([team_code, form]) => ({
        gw,
        team_code,
        form,
      }));

      const { error: formsError } = await supabase
        .from("app_team_forms")
        .upsert(formsToInsert, {
          onConflict: 'gw,team_code',
          ignoreDuplicates: false,
        });

      if (formsError) {
        throw new Error(`Database error: ${formsError.message}`);
      }

      console.log(`✅ Successfully stored ${formsMap.size} team forms for GW ${gw}`);
      console.log('Forms:', Array.from(formsMap.entries()));
    } else {
      console.warn('⚠️  No team forms found in API response');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fetchAndStoreTeamForms(gw);



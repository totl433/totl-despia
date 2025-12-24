// Simple script to fetch team forms
// Usage: node scripts/fetch-team-forms-simple.mjs 17
// Reads from .env file or environment variables

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env files (try .env.local first, then .env)
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const gw = parseInt(process.argv[2], 10);
if (!gw || isNaN(gw)) {
  console.error('Usage: node scripts/fetch-team-forms-simple.mjs <gameweek>');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// Use service role key to bypass RLS for script operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const apiKey = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  process.exit(1);
}

async function fetchAndStore() {
  try {
    console.log(`🔍 Fetching team forms for GW ${gw}...`);
    
    // Use current date in YYYY-MM-DD format for form calculation
    const today = new Date().toISOString().split('T')[0];
    const apiUrl = `https://api.football-data.org/v4/competitions/PL/standings?date=${today}`;
    console.log(`📅 Using date parameter: ${today}`);
    
    const response = await fetch(apiUrl, {
      headers: { 'X-Auth-Token': apiKey },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    const standings = result?.standings || result;
    const forms = [];
    
    if (standings && Array.isArray(standings)) {
      const overallTable = standings.find((s) => s.type === 'TOTAL') || standings[0];
      
      if (overallTable?.table) {
        overallTable.table.forEach((team) => {
          const code = (team.team?.tla || '').toUpperCase().trim();
          // API returns comma-separated format (e.g., "D,L,W,D,W") with newest FIRST
          // Reverse it so newest is LAST for display (oldest → newest)
          const formRaw = team.form ? team.form.trim().toUpperCase().replace(/,/g, '') : null;
          const form = formRaw ? formRaw.split('').reverse().join('') : null;
          
          if (code && form) {
            forms.push({ gw, team_code: code, form });
          } else if (code && !form) {
            console.log(`⚠️  ${code}: form is ${team.form}`);
          }
        });
      }
    }

    if (forms.length === 0) {
      console.warn('⚠️  No team forms found in API response');
      console.warn('The Football Data API standings endpoint returns form: null for all teams.');
      console.warn('Form data may not be available, or might require a different endpoint.');
      return;
    }

    // Store in Supabase
    const upsertUrl = `${supabaseUrl}/rest/v1/app_team_forms?on_conflict=gw,team_code`;
    const upsertResponse = await fetch(upsertUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(forms),
    });

    if (!upsertResponse.ok) {
      const errorText = await upsertResponse.text();
      throw new Error(`Supabase error: ${upsertResponse.status} - ${errorText}`);
    }

    console.log(`✅ Successfully stored ${forms.length} team forms for GW ${gw}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fetchAndStore();

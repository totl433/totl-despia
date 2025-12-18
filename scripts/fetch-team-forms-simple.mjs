// Simple script to fetch team forms
// Usage: SUPABASE_URL=xxx SUPABASE_KEY=xxx node scripts/fetch-team-forms-simple.mjs 17

const gw = parseInt(process.argv[2], 10);
if (!gw || isNaN(gw)) {
  console.error('Usage: node scripts/fetch-team-forms-simple.mjs <gameweek>');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const apiKey = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  process.exit(1);
}

async function fetchAndStore() {
  try {
    console.log(`🔍 Fetching team forms for GW ${gw}...`);
    
    const apiUrl = `https://api.football-data.org/v4/competitions/PL/standings`;
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
          const form = team.form ? team.form.trim().toUpperCase() : null;
          
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

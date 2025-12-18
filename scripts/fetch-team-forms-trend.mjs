// Try to fetch team forms from the trend resource (undocumented endpoint)
const apiKey = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';

const trendEndpoints = [
  'https://api.football-data.org/v4/competitions/PL/trends',
  'https://api.football-data.org/v4/competitions/PL/trend',
  'https://api.football-data.org/v4/trends',
  'https://api.football-data.org/v4/trends?competition=PL',
  'https://api.football-data.org/v4/competitions/PL/standings?type=trend',
  'https://api.football-data.org/v4/competitions/PL/standings?stage=REGULAR_SEASON&type=TOTAL',
];

async function tryTrendEndpoint(url) {
  try {
    console.log(`\n🔍 Trying: ${url}`);
    const response = await fetch(url, {
      headers: { 'X-Auth-Token': apiKey },
    });
    
    if (!response.ok) {
      console.log(`   ❌ Status: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`   ✅ Status: ${response.status}`);
    console.log(`   Response keys:`, Object.keys(data));
    
    // Check if it has form data
    if (data.standings && Array.isArray(data.standings)) {
      const table = data.standings.find(s => s.type === 'TOTAL') || data.standings[0];
      if (table?.table) {
        const firstTeam = table.table[0];
        console.log(`   Sample team:`, {
          code: firstTeam?.team?.tla,
          form: firstTeam?.form,
          hasForm: !!firstTeam?.form
        });
        if (firstTeam?.form) {
          return data;
        }
      }
    }
    
    // Check other possible structures
    if (data.table && Array.isArray(data.table)) {
      const firstTeam = data.table[0];
      console.log(`   Sample team (direct table):`, {
        code: firstTeam?.team?.tla,
        form: firstTeam?.form,
        hasForm: !!firstTeam?.form
      });
      if (firstTeam?.form) {
        return data;
      }
    }
    
    return null;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('Testing trend resource endpoints...\n');
  
  for (const url of trendEndpoints) {
    const result = await tryTrendEndpoint(url);
    if (result) {
      console.log(`\n✅ FOUND FORM DATA AT: ${url}`);
      console.log('\nFull response sample:');
      console.log(JSON.stringify(result, null, 2).substring(0, 1000));
      break;
    }
  }
}

main();


// Check standings response more carefully for form data
const apiKey = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';

async function checkStandings() {
  const url = 'https://api.football-data.org/v4/competitions/PL/standings';
  const response = await fetch(url, {
    headers: { 'X-Auth-Token': apiKey },
  });
  
  const data = await response.json();
  
  console.log('Full standings structure:');
  console.log(JSON.stringify(data, null, 2));
  
  // Check all possible places form might be
  if (data.standings) {
    data.standings.forEach((standing, idx) => {
      console.log(`\nStanding ${idx}:`, standing.type);
      if (standing.table && standing.table[0]) {
        const team = standing.table[0];
        console.log('First team structure:', Object.keys(team));
        console.log('Team object:', JSON.stringify(team, null, 2));
      }
    });
  }
}

checkStandings();



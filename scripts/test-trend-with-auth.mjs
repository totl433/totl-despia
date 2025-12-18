// Try the /trends endpoint with proper auth
const apiKey = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';

async function testTrends() {
  const endpoints = [
    'https://api.football-data.org/v4/trends',
    'https://api.football-data.org/v4/trends?competition=PL',
    'https://api.football-data.org/v4/trends/PL',
  ];
  
  for (const url of endpoints) {
    try {
      console.log(`\n🔍 Trying: ${url}`);
      const response = await fetch(url, {
        headers: { 
          'X-Auth-Token': apiKey,
          'Accept': 'application/json'
        },
      });
      
      const text = await response.text();
      console.log(`   Status: ${response.status}`);
      
      if (response.ok) {
        try {
          const data = JSON.parse(text);
          console.log(`   ✅ Valid JSON response!`);
          console.log(`   Keys:`, Object.keys(data));
          console.log(`   Sample:`, JSON.stringify(data).substring(0, 500));
        } catch (e) {
          console.log(`   Response text:`, text.substring(0, 200));
        }
      } else {
        console.log(`   Error response:`, text.substring(0, 200));
      }
    } catch (error) {
      console.log(`   Exception: ${error.message}`);
    }
  }
}

testTrends();



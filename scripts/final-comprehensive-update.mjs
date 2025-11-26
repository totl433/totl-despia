import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Correct results extracted from all the result sheets
const correctResults = {
  1: ['H', 'D', 'D', 'H', 'H', 'A', 'D', 'H', 'A', 'H'],
  2: ['A', 'A', 'H', 'H', 'H', 'H', 'D', 'H', 'D', 'A'],
  3: ['H', 'H', 'H', 'A', 'A', 'D', 'H', 'A', 'H', 'A'],
  4: ['H', 'H', 'D', 'D', 'H', 'H', 'A', 'D', 'A', 'H'],
  5: ['H', 'D', 'D', 'A', 'A', 'H', 'H', 'D', 'D', 'D'],
  6: ['H', 'A', 'H', 'D', 'H', 'A', 'D', 'H', 'A', 'D'],
  7: ['H', 'A', 'H', 'H', 'H', 'H', 'H', 'H', 'D', 'A']
};

// CSV name to database username mapping
const nameMapping = {
  'Matthew Bird': 'Matthew Bird',
  'Sim': 'Sim',
  'David70': 'David Bird',
  'Phil Bolton': 'Phil Bolton',
  'Paul': 'Paul N',
  'Gregory': 'gregory',
  'SP': 'SP',
  'Carlios': 'Carl',
  'Jof': 'Jof',
  'william middleton': 'Will Middleton',
  'Ben': 'Ben New',
  'Thomas Bird': 'ThomasJamesBird'
};

function parseCsv(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  // First line is headers with fixtures
  const headers = lines[0].split(',');
  
  // Extract fixture names (every 2nd column after "Who are you?")
  const fixtures = [];
  for (let i = 2; i < headers.length; i++) {
    if (headers[i]) {
      fixtures.push(headers[i].replace(/"/g, '').trim());
    }
  }
  
  // Parse player picks
  const playerPicks = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 3) continue;
    
    const playerName = parts[1].trim();
    const picks = [];
    
    for (let j = 2; j < parts.length && j < 12; j++) {
      const pick = parts[j].trim().replace(/"/g, '');
      
      // Convert text predictions to H/A/D
      if (pick.includes('Win') || pick.includes('win')) {
        // Check if it's home or away team winning
        const fixture = fixtures[j - 2] || '';
        const teams = fixture.split(' v ');
        if (teams.length === 2) {
          const homeTeam = teams[0].trim();
          const awayTeam = teams[1].trim();
          
          if (pick.includes(homeTeam) || pick.toLowerCase().includes(homeTeam.toLowerCase())) {
            picks.push('H');
          } else if (pick.includes(awayTeam) || pick.toLowerCase().includes(awayTeam.toLowerCase())) {
            picks.push('A');
          } else {
            // Fallback: if text includes first team name, it's H, otherwise A
            picks.push('H');
          }
        } else {
          picks.push('H');
        }
      } else if (pick.includes('Draw') || pick.toLowerCase() === 'd') {
        picks.push('D');
      } else {
        // Default to H if unclear
        picks.push('H');
      }
    }
    
    playerPicks[playerName] = picks;
  }
  
  return { fixtures, playerPicks };
}

async function updateEverything() {
  console.log('Starting comprehensive update...\n');

  // Get all users
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name');

  if (userError) {
    console.error('Error fetching users:', userError);
    return;
  }

  const userMap = new Map(users.map(u => [u.name, u.id]));
  
  // Step 1: Update all results
  console.log('=== UPDATING RESULTS ===');
  for (const [gw, results] of Object.entries(correctResults)) {
    const gwNumber = parseInt(gw);
    console.log(`Updating GW${gwNumber} results: ${results.join(' ')}`);
    
    // Delete existing results
    const { error: deleteError } = await supabase
      .from('gw_results')
      .delete()
      .eq('gw', gwNumber);
    
    if (deleteError) {
      console.error(`Error deleting GW${gwNumber} results:`, deleteError);
      continue;
    }
    
    // Insert new results
    for (let i = 0; i < results.length; i++) {
      const { error: insertError } = await supabase
        .from('gw_results')
        .insert({
          gw: gwNumber,
          fixture_index: i,
          result: results[i]
        });
      
      if (insertError) {
        console.error(`Error inserting result ${i} for GW${gwNumber}:`, insertError);
      }
    }
    
    console.log(`GW${gwNumber} results updated successfully`);
  }
  
  // Step 2: Read and update picks from CSV files
  console.log('\n=== UPDATING PICKS FROM CSV FILES ===');
  
  const gwFiles = {
    1: '/Users/jof/Desktop/GW1.csv',
    2: '/Users/jof/Desktop/GW2.csv',
    3: '/Users/jof/Desktop/GW3.csv',
    4: '/Users/jof/Desktop/GW4.csv',
    5: '/Users/jof/Desktop/GW5.csv',
    6: '/Users/jof/Desktop/GW6.csv',
    7: '/Users/jof/Desktop/GW7.csv'
  };
  
  // Collect all picks by player
  const allPlayerPicks = {};
  
  for (const [gw, filePath] of Object.entries(gwFiles)) {
    console.log(`\nReading GW${gw} from ${filePath}...`);
    
    try {
      const { playerPicks } = parseCsv(filePath);
      
      for (const [csvName, picks] of Object.entries(playerPicks)) {
        const dbName = nameMapping[csvName];
        if (!dbName) {
          console.log(`  Skipping ${csvName} - not in mapping`);
          continue;
        }
        
        if (!allPlayerPicks[dbName]) {
          allPlayerPicks[dbName] = {};
        }
        
        allPlayerPicks[dbName][gw] = picks;
        console.log(`  ${dbName} (${csvName}): ${picks.join(' ')}`);
      }
    } catch (error) {
      console.error(`Error reading GW${gw}:`, error.message);
    }
  }
  
  // Step 3: Update picks in database
  console.log('\n=== UPDATING DATABASE ===');
  
  for (const [dbName, gwPicks] of Object.entries(allPlayerPicks)) {
    const userId = userMap.get(dbName);
    if (!userId) {
      console.log(`User ${dbName} not found in database`);
      continue;
    }
    
    console.log(`\nUpdating ${dbName}...`);
    
    for (const [gw, picks] of Object.entries(gwPicks)) {
      const gwNumber = parseInt(gw);
      
      // Delete existing picks
      const { error: deleteError } = await supabase
        .from('picks')
        .delete()
        .eq('user_id', userId)
        .eq('gw', gwNumber);
      
      if (deleteError) {
        console.error(`  Error deleting picks for GW${gwNumber}:`, deleteError);
        continue;
      }
      
      // Insert new picks
      for (let i = 0; i < picks.length; i++) {
        const { error: insertError } = await supabase
          .from('picks')
          .insert({
            user_id: userId,
            gw: gwNumber,
            fixture_index: i,
            pick: picks[i]
          });
        
        if (insertError) {
          console.error(`  Error inserting pick ${i} for GW${gwNumber}:`, insertError);
        }
      }
      
      // Upsert submission
      await supabase
        .from('gw_submissions')
        .upsert({
          user_id: userId,
          gw: gwNumber,
          submitted_at: new Date().toISOString()
        }, { onConflict: 'user_id,gw' });
      
      console.log(`  GW${gwNumber} updated`);
    }
    
    console.log(`${dbName} completed successfully`);
  }
  
  // Step 4: Verify scores
  console.log('\n=== VERIFYING SCORES ===');
  
  const expectedScores = {
    'Phil Bolton': 38,
    'David Bird': 36,
    'Sim': 35,
    'Paul N': 33,
    'Carl': 32,
    'Jof': 32,
    'gregory': 31,
    'Matthew Bird': 31,
    'SP': 31,
    'Will Middleton': 29,
    'ThomasJamesBird': 28,
    'Ben New': 26
  };
  
  let allCorrect = true;
  
  for (const [userName, expectedScore] of Object.entries(expectedScores)) {
    const userId = userMap.get(userName);
    if (!userId) continue;

    // Get all picks
    const { data: picks } = await supabase
      .from('picks')
      .select('gw, fixture_index, pick')
      .eq('user_id', userId)
      .lte('gw', 7)
      .order('gw')
      .order('fixture_index');

    // Get all results
    const { data: results } = await supabase
      .from('gw_results')
      .select('gw, fixture_index, result')
      .lte('gw', 7)
      .order('gw')
      .order('fixture_index');

    // Calculate score
    let correctPicks = 0;
    const resultsMap = new Map();
    results.forEach(r => {
      if (!resultsMap.has(r.gw)) {
        resultsMap.set(r.gw, new Map());
      }
      resultsMap.get(r.gw).set(r.fixture_index, r.result);
    });

    for (const pick of picks) {
      const result = resultsMap.get(pick.gw)?.get(pick.fixture_index);
      if (result && pick.pick === result) {
        correctPicks++;
      }
    }
    
    const status = correctPicks === expectedScore ? '✅' : '❌';
    if (correctPicks !== expectedScore) allCorrect = false;
    
    console.log(`${userName.padEnd(20)}: ${correctPicks} (expected ${expectedScore}) ${status}`);
  }
  
  console.log('\n=== SUMMARY ===');
  if (allCorrect) {
    console.log('🎉 SUCCESS! All scores match the leaderboard!');
  } else {
    console.log('❌ Some scores do not match. Check the data.');
  }
}

updateEverything().catch(console.error);


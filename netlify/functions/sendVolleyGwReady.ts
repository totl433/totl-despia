import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const VOLLEY_USER_ID = '00000000-0000-0000-0000-000000000001';

const messages = [
  (gw: number) => `Gameweek ${gw} is ready to go. Hit the banner up top when you're ready to move on.`,
  (gw: number) => `Next up: Gameweek ${gw}. Tap the banner to jump in.`,
];

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { gameweek } = JSON.parse(event.body || '{}');
    
    if (!gameweek || typeof gameweek !== 'number') {
      return json(400, { error: 'gameweek number required' });
    }

    // Get all active leagues
    const { data: leagues, error: leaguesError } = await admin
      .from('leagues')
      .select('id');

    if (leaguesError) throw leaguesError;

    const results = [];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)](gameweek);
    
    for (const league of leagues || []) {
      // Check if we already sent a message for this GW in this league
      const { data: existingMessage } = await admin
        .from('league_messages')
        .select('id')
        .eq('league_id', league.id)
        .eq('user_id', VOLLEY_USER_ID)
        .like('content', `%Gameweek ${gameweek}%`)
        .limit(1);

      if (existingMessage && existingMessage.length > 0) {
        results.push({ leagueId: league.id, skipped: true, reason: 'already sent' });
        continue;
      }

      // Insert message as Volley
      const { error: insertError } = await admin
        .from('league_messages')
        .insert({
          league_id: league.id,
          user_id: VOLLEY_USER_ID,
          content: randomMessage,
        });

      if (insertError) {
        results.push({ leagueId: league.id, error: insertError.message });
      } else {
        results.push({ leagueId: league.id, success: true });
      }
    }

    return json(200, {
      ok: true,
      gameweek,
      message: randomMessage,
      results,
      totalLeagues: leagues?.length || 0,
    });
  } catch (error: any) {
    console.error('[sendVolleyGwReady] Error:', error);
    return json(500, { error: error.message || 'Internal server error' });
  }
};


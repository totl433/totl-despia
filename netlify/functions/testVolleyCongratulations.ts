/**
 * Test function to trigger Volley congratulations for a specific gameweek
 * Usage: POST with { gameweek: number } or GET to use latest completed gameweek
 */
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, supabaseServiceKey);

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  try {
    let gameweek: number | null = null;

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      gameweek = body.gameweek;
    } else if (event.httpMethod === 'GET') {
      // Get latest completed gameweek
      const { data: results } = await admin
        .from('app_gw_results')
        .select('gw')
        .order('gw', { ascending: false })
        .limit(1);
      
      if (results && results.length > 0) {
        gameweek = (results[0] as any).gw;
      }
    } else {
      return json(405, { error: 'Method not allowed. Use GET or POST' });
    }

    if (!gameweek) {
      return json(400, { error: 'No gameweek specified and no completed gameweeks found' });
    }

    // Call the congratulations function
    const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:8888';
    const response = await fetch(`${baseUrl}/.netlify/functions/sendVolleyGwCongratulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameweek }),
    });

    const data = await response.json().catch(() => ({}));

    return json(response.status, {
      message: `Triggered Volley congratulations for Gameweek ${gameweek}`,
      gameweek,
      result: data,
    });
  } catch (error: any) {
    console.error('[testVolleyCongratulations] Error:', error);
    return json(500, { error: error.message || 'Internal server error' });
  }
};







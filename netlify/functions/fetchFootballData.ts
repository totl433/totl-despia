import { Handler } from '@netlify/functions';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return json(200, {});
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || 'ed3153d132b847db836289243894706e';
  const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';

  try {
    // Parse query parameters
    const params = new URLSearchParams(event.queryStringParameters || {});
    const matchId = params.get('matchId');
    const resource = params.get('resource'); // 'standings' or 'matches'
    const competition = params.get('competition') || 'PL';
    
    // If resource is 'standings', fetch standings
    if (resource === 'standings') {
      // Use date parameter for form calculation (defaults to today if not provided)
      const dateParam = params.get('date') || new Date().toISOString().split('T')[0];
      const apiUrl = `${FOOTBALL_DATA_BASE_URL}/competitions/${competition}/standings?date=${dateParam}`;
      console.log('[fetchFootballData] Fetching standings:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'X-Auth-Token': FOOTBALL_DATA_API_KEY,
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[fetchFootballData] API error:', response.status, errorText);
        
        if (response.status === 429) {
          return json(429, { 
            error: 'Rate limit reached', 
            message: 'Too many requests. Please wait a moment.',
            retryAfter: response.headers.get('Retry-After') || '60'
          });
        }
        
        return json(response.status, { 
          error: 'API error', 
          status: response.status,
          message: errorText
        });
      }

      const data = await response.json();
      
      return json(200, {
        success: true,
        data: data,
      });
    }
    
    // If matchId is provided, fetch single match
    if (matchId) {
      const apiUrl = `${FOOTBALL_DATA_BASE_URL}/matches/${matchId}`;
      console.log('[fetchFootballData] Fetching single match:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'X-Auth-Token': FOOTBALL_DATA_API_KEY,
          'Cache-Control': 'no-cache', // Ensure we get fresh data
        },
        cache: 'no-store', // Don't cache the request
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[fetchFootballData] API error:', response.status, errorText);
        
        if (response.status === 429) {
          return json(429, { 
            error: 'Rate limit reached', 
            message: 'Too many requests. Please wait a moment.',
            retryAfter: response.headers.get('Retry-After') || '60'
          });
        }
        
        return json(response.status, { 
          error: 'API error', 
          status: response.status,
          message: errorText
        });
      }

      const data = await response.json();
      
      return json(200, {
        success: true,
        data: data,
      });
    }
    
    // Otherwise, fetch competition matches (existing logic)
    const matchday = params.get('matchday');
    const dateFrom = params.get('dateFrom');
    const dateTo = params.get('dateTo');
    const status = params.get('status');

    // Build API URL
    let apiUrl = `${FOOTBALL_DATA_BASE_URL}/competitions/${competition}/matches`;
    const urlParams = new URLSearchParams();
    
    if (matchday) urlParams.append('matchday', matchday);
    if (dateFrom) urlParams.append('dateFrom', dateFrom);
    if (dateTo) urlParams.append('dateTo', dateTo);
    if (status) urlParams.append('status', status);
    
    if (urlParams.toString()) {
      apiUrl += '?' + urlParams.toString();
    }

    console.log('[fetchFootballData] Fetching from:', apiUrl);

    // Fetch from Football Data API
    const response = await fetch(apiUrl, {
      headers: {
        'X-Auth-Token': FOOTBALL_DATA_API_KEY,
        'Cache-Control': 'no-cache', // Ensure we get fresh data
      },
      cache: 'no-store', // Don't cache the request
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[fetchFootballData] API error:', response.status, errorText);
      
      if (response.status === 429) {
        return json(429, { 
          error: 'Rate limit reached', 
          message: 'Too many requests. Please wait a moment.',
          retryAfter: response.headers.get('Retry-After') || '60'
        });
      }
      
      return json(response.status, { 
        error: 'API error', 
        status: response.status,
        message: errorText
      });
    }

    const data = await response.json();
    
    return json(200, {
      success: true,
      data: data,
    });
  } catch (error: any) {
    console.error('[fetchFootballData] Error:', error);
    return json(500, { 
      error: 'Failed to fetch data', 
      message: error?.message || 'Unknown error'
    });
  }
};


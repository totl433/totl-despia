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
    const competition = params.get('competition') || 'PL';
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
      },
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


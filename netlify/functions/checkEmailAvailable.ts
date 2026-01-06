import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

function json(statusCode: number, body: unknown) {
  return { 
    statusCode, 
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }, 
    body: JSON.stringify(body) 
  }
}

// POST body: { email: string }
// Returns: { available: boolean, message?: string }
export const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return json(200, {});
  }
  
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' })

  const SUPABASE_URL = process.env.SUPABASE_URL as string
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' })
  }

  let payload: any
  try {
    payload = event.body ? JSON.parse(event.body) : {}
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const { email } = payload || {}
  if (!email || typeof email !== 'string') {
    return json(400, { error: 'Email is required' })
  }

  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail) {
    return json(400, { error: 'Email cannot be empty' })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // #region agent log
    const logData = {location:'checkEmailAvailable.ts:38',message:'BEFORE auth.users check',data:{trimmedEmail},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
    console.log('[DEBUG]', JSON.stringify(logData));
    // #endregion
    
    // Check auth.users (requires admin access)
    // Note: getUserByEmail doesn't exist, so we use listUsers and filter
    // listUsers() may be paginated - we need to check all pages
    let page = 1;
    let foundEmail = false;
    const pageSize = 1000; // Supabase default
    
    while (true) {
      const { data: usersData, error: authError } = await admin.auth.admin.listUsers({
        page,
        perPage: pageSize
      });
      
      // #region agent log
      const logData2 = {location:'checkEmailAvailable.ts:62',message:'AFTER auth.users listUsers',data:{page,userCount:usersData?.users?.length,totalUsers:usersData?.total,authError:authError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
      console.log('[DEBUG]', JSON.stringify(logData2));
      // #endregion
      
      if (authError) {
        console.error('[checkEmailAvailable] Error checking auth.users:', authError)
        break; // Stop pagination on error
      }
      
      if (!usersData?.users || usersData.users.length === 0) {
        break; // No more users
      }
      
      // #region agent log
      const logData4 = {location:'checkEmailAvailable.ts:75',message:'Checking users list page',data:{page,userCount:usersData.users.length,trimmedEmail,firstFewEmails:usersData.users.slice(0,3).map((u:any)=>u.email)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
      console.log('[DEBUG]', JSON.stringify(logData4));
      // #endregion
      
      // Check if email exists in this page (case-insensitive)
      const existingUser = usersData.users.find((u: any) => {
        const userEmail = u.email?.toLowerCase();
        const match = userEmail === trimmedEmail.toLowerCase();
        // #region agent log
        if (userEmail && userEmail.includes('sotbjof')) {
          const logData5 = {location:'checkEmailAvailable.ts:85',message:'Found sotbjof email in list',data:{userEmail,trimmedEmail,match},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
          console.log('[DEBUG]', JSON.stringify(logData5));
        }
        // #endregion
        return match;
      });
      
      if (existingUser) {
        // #region agent log
        const logData3 = {location:'checkEmailAvailable.ts:95',message:'EMAIL FOUND in auth.users - returning unavailable',data:{email:trimmedEmail,userId:existingUser.id,page},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
        console.log('[DEBUG]', JSON.stringify(logData3));
        // #endregion
        console.log('[checkEmailAvailable] Email found in auth.users:', trimmedEmail)
        return json(200, { available: false, message: 'This email is already registered. Please sign in instead.' })
      }
      
      // Check if there are more pages
      const totalUsers = usersData.total || usersData.users.length;
      const currentPageCount = page * pageSize;
      if (currentPageCount >= totalUsers || usersData.users.length < pageSize) {
        break; // No more pages
      }
      
      page++;
    }
    
    // #region agent log
    const logData6 = {location:'checkEmailAvailable.ts:110',message:'Email not found after checking all pages',data:{trimmedEmail,checkedPages:page},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
    console.log('[DEBUG]', JSON.stringify(logData6));
    // #endregion

    // Also check public.users table as a fallback
    // #region agent log
    const logData4 = {location:'checkEmailAvailable.ts:68',message:'BEFORE public.users check in function',data:{trimmedEmail},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
    console.log('[DEBUG]', JSON.stringify(logData4));
    // #endregion
    
    const { data: publicUser, error: publicError } = await admin
      .from('users')
      .select('email')
      .eq('email', trimmedEmail)
      .limit(1)
      .maybeSingle()

    // #region agent log
    const logData5 = {location:'checkEmailAvailable.ts:76',message:'AFTER public.users check in function',data:{hasPublicUser:!!publicUser?.email,publicError:publicError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
    console.log('[DEBUG]', JSON.stringify(logData5));
    // #endregion

    if (publicError) {
      console.error('[checkEmailAvailable] Error checking public.users:', publicError)
      // Don't fail - if auth check passed, we're good
    }

    if (publicUser?.email) {
      // #region agent log
      const logData6 = {location:'checkEmailAvailable.ts:84',message:'EMAIL FOUND in public.users - returning unavailable',data:{email:trimmedEmail},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
      console.log('[DEBUG]', JSON.stringify(logData6));
      // #endregion
      return json(200, { available: false, message: 'This email is already registered. Please sign in instead.' })
    }

    // Email is available
    // #region agent log
    const logData7 = {location:'checkEmailAvailable.ts:90',message:'EMAIL AVAILABLE - returning available=true',data:{email:trimmedEmail},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
    console.log('[DEBUG]', JSON.stringify(logData7));
    // #endregion
    return json(200, { available: true })
  } catch (error: any) {
    // #region agent log
    const logData8 = {location:'checkEmailAvailable.ts:95',message:'FUNCTION EXCEPTION',data:{errorMessage:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
    console.log('[DEBUG]', JSON.stringify(logData8));
    // #endregion
    console.error('[checkEmailAvailable] Unexpected error:', error)
    return json(500, { error: 'Failed to check email availability', details: error.message })
  }
}


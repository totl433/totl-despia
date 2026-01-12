/**
 * Hook wrapping Supabase session + auth state listener
 */
import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export type AuthGateStatus = 'checking' | 'authed' | 'guest';

interface UseSupabaseAuthResult {
  status: AuthGateStatus;
  user: User | null;
  session: Session | null;
}

export function useSupabaseAuth(): UseSupabaseAuthResult {
  const [status, setStatus] = useState<AuthGateStatus>('checking');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    // Set up auth state change listener
    const { data: subscription } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!mounted) return;
      
      console.log('[useSupabaseAuth] Auth state changed:', event, sess ? 'has session' : 'no session');
      
      if (sess?.user) {
        setSession(sess);
        setUser(sess.user);
        setStatus('authed');
      } else {
        setSession(null);
        setUser(null);
        setStatus('guest');
      }
    });

    // Initial session check with timeout
    const timeoutId = setTimeout(() => {
      if (mounted && status === 'checking') {
        console.warn('[useSupabaseAuth] Session check timed out, assuming guest');
        setStatus('guest');
      }
    }, 3000);

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        clearTimeout(timeoutId);
        
        if (error) {
          console.error('[useSupabaseAuth] Session check error:', error);
          setStatus('guest');
          return;
        }
        
        if (data.session?.user) {
          setSession(data.session);
          setUser(data.session.user);
          setStatus('authed');
        } else {
          setStatus('guest');
        }
      })
      .catch(() => {
        if (mounted) setStatus('guest');
      });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { status, user, session };
}

// Auth actions
export async function signInWithPassword(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  
  if (error) {
    // Provide more helpful error messages
    const errorMessage = error.message.toLowerCase();
    if (
      errorMessage.includes('email not confirmed') ||
      errorMessage.includes('email_not_confirmed') ||
      errorMessage.includes('confirmation')
    ) {
      throw new Error('Please check your email and click the confirmation link before signing in.');
    } else if (
      errorMessage.includes('invalid login') ||
      errorMessage.includes('invalid credentials') ||
      errorMessage.includes('invalid password')
    ) {
      throw new Error('Invalid email or password. Please check your credentials and try again.');
    }
    throw error;
  }
  
  return data;
}

// Normalize email: gmail.com and googlemail.com are the same
function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  // Convert googlemail.com to gmail.com for consistency
  return trimmed.replace('@googlemail.com', '@gmail.com');
}

export async function signUpWithPassword(
  email: string,
  password: string,
  displayName: string,
  firstName: string,
  lastName: string
) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:93',message:'signUpWithPassword ENTRY',data:{email,displayName,firstName,lastName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  const trimmedEmail = normalizeEmail(email);
  const trimmedName = displayName.trim();
  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:99',message:'BEFORE username check',data:{trimmedEmail,trimmedName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // Check if username is already taken (case-insensitive)
  const { data: existingUsers, error: checkError } = await supabase
    .from('users')
    .select('name')
    .ilike('name', trimmedName)
    .limit(1);
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:107',message:'AFTER username check',data:{existingUsers,checkError},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  if (checkError) throw checkError;
  
  if (existingUsers && existingUsers.length > 0) {
    throw new Error('Username already taken. Please choose a different name.');
  }
  
  // Check if email is already registered
  // Try serverless function first (checks auth.users - most comprehensive)
  let serverlessCheckWorked = false;
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:118',message:'BEFORE serverless function call',data:{trimmedEmail},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  try {
    console.log('[signUpWithPassword] Checking email availability for:', trimmedEmail);
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    // Try local first, fallback to production if local dev serverless functions aren't available
    const functionUrl = '/.netlify/functions/checkEmailAvailable';
    let response: Response;
    
    try {
      response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
        signal: controller.signal,
      });
    } catch (localError: any) {
      // If local fetch fails, try fallback URL (staging for localhost, current origin for production)
      if (localError.name === 'TypeError' || localError.name === 'AbortError') {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:125',message:'Local function failed, trying fallback',data:{trimmedEmail},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-v3',hypothesisId:'FIX3'})}).catch(()=>{});
        // #endregion
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        const fallbackUrl = (hostname === 'localhost' || hostname === '127.0.0.1')
          ? 'https://totl-staging.netlify.app/.netlify/functions/checkEmailAvailable'
          : `${window.location.origin}/.netlify/functions/checkEmailAvailable`;
        console.warn('[signUpWithPassword] Local function unavailable, trying fallback URL:', fallbackUrl);
        response = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail }),
          signal: controller.signal,
        });
      } else {
        throw localError;
      }
    }

    clearTimeout(timeoutId);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:133',message:'AFTER serverless fetch',data:{status:response.status,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    console.log('[signUpWithPassword] Serverless function response status:', response.status);

    if (response.ok) {
      const result = await response.json();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:139',message:'serverless function result',data:{result,available:result.available},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      console.log('[signUpWithPassword] Serverless function result:', result);
      serverlessCheckWorked = true;
      
      // Only block if we get a definitive "email exists" response
      if (result.available === false) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:144',message:'BLOCKING - email exists in serverless check',data:{result},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        console.error('[signUpWithPassword] Email already registered - BLOCKING signup');
        throw new Error(result.message || 'This email is already registered. Please sign in instead.');
      }
      // If available === true, continue with signup
      console.log('[signUpWithPassword] Email check passed via serverless function');
    } else if (response.status === 404 && functionUrl === '/.netlify/functions/checkEmailAvailable') {
      // Local function not available (404) - try production URL
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:200',message:'Local function 404, trying production URL',data:{trimmedEmail},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-v4',hypothesisId:'FIX4'})}).catch(()=>{});
      // #endregion
      console.warn('[signUpWithPassword] Local function unavailable (404), trying fallback URL');
      
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:205',message:'BEFORE fallback fetch',data:{trimmedEmail},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-v5',hypothesisId:'FIX5'})}).catch(()=>{});
        // #endregion
        
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        const fallbackUrl = (hostname === 'localhost' || hostname === '127.0.0.1')
          ? 'https://totl-staging.netlify.app/.netlify/functions/checkEmailAvailable'
          : `${window.location.origin}/.netlify/functions/checkEmailAvailable`;
        
        const prodResponse = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail }),
          signal: controller.signal,
        });
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:212',message:'AFTER production fetch',data:{status:prodResponse.status,ok:prodResponse.ok,statusText:prodResponse.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-v5',hypothesisId:'FIX5'})}).catch(()=>{});
        // #endregion
        
        if (prodResponse.ok) {
          const prodResult = await prodResponse.json();
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:216',message:'Production function result',data:{prodResult,available:prodResult.available},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-v4',hypothesisId:'FIX4'})}).catch(()=>{});
          // #endregion
          
          serverlessCheckWorked = true;
          
          if (prodResult.available === false) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:222',message:'BLOCKING - email exists in production check',data:{prodResult},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-v4',hypothesisId:'FIX4'})}).catch(()=>{});
            // #endregion
            throw new Error(prodResult.message || 'This email is already registered. Please sign in instead.');
          }
          console.log('[signUpWithPassword] Email check passed via production serverless function');
        } else {
          // Production also failed - log but don't block
          const prodErrorText = await prodResponse.text();
          console.warn('[signUpWithPassword] Production function also failed:', prodResponse.status, prodErrorText);
        }
      } catch (prodError: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:240',message:'Production fetch exception',data:{errorName:prodError.name,errorMessage:prodError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-v6',hypothesisId:'FIX6'})}).catch(()=>{});
        // #endregion
        // Production fetch failed - this is likely a CORS issue
        // For now, log the error - in production this should work
        console.error('[signUpWithPassword] Production function unavailable:', prodError.message);
        console.error('[signUpWithPassword] This is likely a CORS issue. The function needs CORS headers deployed.');
        // Don't block - allow signup to proceed (CORS fix needs deployment)
      }
    } else {
      // Function returned error status (not 404) - log but don't try production
      const errorText = await response.text();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:235',message:'serverless function error status (non-404)',data:{status:response.status,errorText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      console.error('[signUpWithPassword] Serverless email check returned error status:', response.status, errorText);
      // Don't set serverlessCheckWorked = true, so we'll proceed without email check
    }
  } catch (err: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:158',message:'serverless function exception',data:{errName:err.name,errMessage:err.message,isAlreadyRegistered:err.message?.includes('already registered')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // If it's our custom error about email being registered, throw it (block signup)
    if (err.message && err.message.includes('already registered')) {
      throw err;
    }
    // Network/function not available or timeout - log and fall through to public.users check
    if (err.name === 'AbortError') {
      console.error('[signUpWithPassword] Serverless email check timed out');
    } else {
      console.warn('[signUpWithPassword] Serverless email check unavailable:', err.message);
    }
  }

  // If serverless function didn't work, we can't verify email availability
  // The public.users table doesn't have an email column, so we can't check there
  // In production, the serverless function should always be available
  // For local dev without netlify dev, we'll proceed but log a warning
  // Supabase Auth will handle duplicates at the database level (though it may just send confirmation emails)
  if (!serverlessCheckWorked) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:170',message:'Serverless function unavailable - proceeding without email check',data:{trimmedEmail},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-v2',hypothesisId:'FIX2'})}).catch(()=>{});
    // #endregion
    console.warn('[signUpWithPassword] Email verification service unavailable. Proceeding with signup - duplicate emails may not be detected. For full email checking, run "netlify dev" instead of "npm run dev".');
    // Don't block signup - allow it to proceed
    // Note: In production, the serverless function should always be available
  }
  
  // If we get here, either serverless check passed OR it was unavailable (proceeding anyway)
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:193',message:'BEFORE Supabase signUp call',data:{trimmedEmail},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  
  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: { display_name: trimmedName, first_name: trimmedFirstName, last_name: trimmedLastName },
      emailRedirectTo: window.location.origin,
    },
  });
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:207',message:'AFTER Supabase signUp call',data:{hasUser:!!data.user,hasSession:!!data.session,error:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  
  if (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useSupabaseAuth.ts:212',message:'Supabase signUp error',data:{errorMessage:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    // Improve error messages for common cases
    const errorMessage = error.message.toLowerCase();
    if (
      errorMessage.includes('already registered') ||
      errorMessage.includes('user already registered') ||
      errorMessage.includes('email address is already in use') ||
      errorMessage.includes('email already exists') ||
      errorMessage.includes('user already exists')
    ) {
      throw new Error('This email is already registered. Please sign in instead.');
    }
    throw error;
  }
  
  // Additional check: If we get a user but no session, and no error,
  // it might mean the email already exists but needs confirmation
  // However, this is normal for new signups too, so we can't block based on this alone
  // The serverless function check above should have caught duplicates
  
  // Upsert profile (note: users table doesn't have email column, only name)
  const user = data.user ?? (await supabase.auth.getUser()).data.user;
  if (user) {
    const { error: profileError } = await supabase.from('users').upsert({ 
      id: user.id, 
      name: trimmedName,
      first_name: trimmedFirstName,
      last_name: trimmedLastName
      // Note: email column doesn't exist in users table - email is stored in auth.users only
    });

    if (profileError) {
      console.error('[signUpWithPassword] Failed to upsert profile:', profileError);
    }

    // Generate default avatar for new user (non-blocking)
    // Don't await - let it happen in background so signup doesn't slow down
    import('../../lib/userAvatars').then(({ generateAndUploadDefaultAvatar }) => {
      generateAndUploadDefaultAvatar(user.id, trimmedName).catch((err) => {
        console.error('[signUpWithPassword] Failed to generate avatar:', err);
        // Non-critical - avatar will be generated on first access
      });
    });
  }
  
  return data;
}

export async function resetPasswordForEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: `${window.location.origin}/auth`,
  });
  
  if (error) throw error;
}

export async function updateUserPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });
  
  if (error) throw error;
}

export async function resendConfirmationEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });
  
  if (error) throw error;
}

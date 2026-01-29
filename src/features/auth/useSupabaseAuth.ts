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
  displayName: string
) {
  const trimmedEmail = normalizeEmail(email);
  const trimmedName = displayName.trim();
  
  // Check if username is already taken (case-insensitive)
  const { data: existingUsers, error: checkError } = await supabase
    .from('users')
    .select('name')
    .ilike('name', trimmedName)
    .limit(1);
  
  if (checkError) throw checkError;
  
  if (existingUsers && existingUsers.length > 0) {
    throw new Error('Username already taken. Please choose a different name.');
  }
  
  // Check if email is already registered
  // Try serverless function first (checks auth.users - most comprehensive)
  let serverlessCheckWorked = false;
  
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
      // If local fetch fails, try production URL (for local dev without netlify dev)
      if (localError.name === 'TypeError' || localError.name === 'AbortError') {
        console.warn('[signUpWithPassword] Local function unavailable, trying production URL');
        response = await fetch('https://totl-staging.netlify.app/.netlify/functions/checkEmailAvailable', {
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
    
    console.log('[signUpWithPassword] Serverless function response status:', response.status);

    if (response.ok) {
      const result = await response.json();
      
      console.log('[signUpWithPassword] Serverless function result:', result);
      serverlessCheckWorked = true;
      
      // Only block if we get a definitive "email exists" response
      if (result.available === false) {
        console.error('[signUpWithPassword] Email already registered - BLOCKING signup');
        throw new Error(result.message || 'This email is already registered. Please sign in instead.');
      }
      // If available === true, continue with signup
      console.log('[signUpWithPassword] Email check passed via serverless function');
    } else if (response.status === 404 && functionUrl === '/.netlify/functions/checkEmailAvailable') {
      // Local function not available (404) - try production URL
      console.warn('[signUpWithPassword] Local function unavailable (404), trying production URL');
      
      try {
        const prodResponse = await fetch('https://totl-staging.netlify.app/.netlify/functions/checkEmailAvailable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail }),
          signal: controller.signal,
        });
        
        if (prodResponse.ok) {
          const prodResult = await prodResponse.json();
          
          serverlessCheckWorked = true;
          
          if (prodResult.available === false) {
            throw new Error(prodResult.message || 'This email is already registered. Please sign in instead.');
          }
          console.log('[signUpWithPassword] Email check passed via production serverless function');
        } else {
          // Production also failed - log but don't block
          const prodErrorText = await prodResponse.text();
          console.warn('[signUpWithPassword] Production function also failed:', prodResponse.status, prodErrorText);
        }
      } catch (prodError: any) {
        // Production fetch failed - this is likely a CORS issue
        // For now, log the error - in production this should work
        console.error('[signUpWithPassword] Production function unavailable:', prodError.message);
        console.error('[signUpWithPassword] This is likely a CORS issue. The function needs CORS headers deployed.');
        // Don't block - allow signup to proceed (CORS fix needs deployment)
      }
    } else {
      // Function returned error status (not 404) - log but don't try production
      const errorText = await response.text();
      
      console.error('[signUpWithPassword] Serverless email check returned error status:', response.status, errorText);
      // Don't set serverlessCheckWorked = true, so we'll proceed without email check
    }
  } catch (err: any) {
    
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
    console.warn('[signUpWithPassword] Email verification service unavailable. Proceeding with signup - duplicate emails may not be detected. For full email checking, run "netlify dev" instead of "npm run dev".');
    // Don't block signup - allow it to proceed
    // Note: In production, the serverless function should always be available
  }
  
  // If we get here, either serverless check passed OR it was unavailable (proceeding anyway)
  
  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: { display_name: trimmedName },
      emailRedirectTo: window.location.origin,
    },
  });
  
  if (error) {
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
    await supabase.from('users').upsert({ 
      id: user.id, 
      name: trimmedName
      // Note: email column doesn't exist in users table - email is stored in auth.users only
    });
  }
  
  return data;
}

export async function resetPasswordForEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    // Force recovery mode on landing so AuthGate shows the set-new-password UI.
    // (Supabase may place tokens in the URL hash; the query param still remains.)
    redirectTo: `${window.location.origin}/auth?type=recovery`,
  });
  
  if (error) throw error;
}

export async function verifyRecoveryToken(tokenHash: string, email?: string) {
  // Supabase recovery links increasingly use the "token_hash" format.
  // For recovery, `email` may be omitted; passing it is optional and can vary by client/link format.
  const normalizedEmail = email ? normalizeEmail(email) : undefined;

  const formatOtpError = (err: any) => {
    const code = err?.code || err?.error_code;
    const message = err?.message || err?.error_description || '';
    const suffix = code ? ` (${code})` : message ? ` (${message})` : '';
    return `This reset link is invalid or has expired. Please request a new one.${suffix}`;
  };

  // Try without email first (works for token_hash links on newer Supabase flows).
  let data: any = null;
  let error: any = null;
  ({ data, error } = await supabase.auth.verifyOtp({
    type: 'recovery',
    token_hash: tokenHash,
  }));

  // If that fails and we have an email, retry including email (older/stricter configurations).
  if (error && normalizedEmail) {
    ({ data, error } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash,
      email: normalizedEmail,
    }));
  }

  if (error) {
    // Common cases: otp_expired, access_denied, malformed token, etc.
    throw new Error(formatOtpError(error));
  }
  // Some email-link flows return a session but don't automatically persist it.
  // Persist it so the user is truly authed before setting a new password.
  if (data?.session?.access_token && data?.session?.refresh_token) {
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }

  // Defensive: ensure we actually have a session after verification (otherwise updateUser will fail).
  const waitForSession = async (): Promise<boolean> => {
    const start = Date.now();
    const maxMs = 2500;
    while (Date.now() - start < maxMs) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) return true;
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  };
  const hasSession = await waitForSession();
  if (!hasSession) {
    throw new Error('This reset link is invalid or has expired. Please request a new one. (no_session)');
  }

  return data;
}

export async function verifySignupToken(tokenHash: string, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await supabase.auth.verifyOtp({
    type: 'signup',
    token_hash: tokenHash,
    email: normalizedEmail,
  });
  if (error) {
    throw new Error('This confirmation link is invalid or has expired. Please request a new one.');
  }
  // Persist session so we can route straight to Home (skip showing auth forms again).
  if (data?.session?.access_token && data?.session?.refresh_token) {
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }
  return data;
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

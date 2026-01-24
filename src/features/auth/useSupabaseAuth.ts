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
  const trimmedName = normalizeDisplayName(displayName);

  if (!trimmedName) {
    throw new Error('Display name is required.');
  }
  if (hasSqlLikeWildcards(trimmedName)) {
    throw new Error('Display name contains invalid characters. Please remove % or _.');
  }

  // Check if username is already taken (case-insensitive).
  // Prefer server-side check (harder to bypass); fall back to client check on localhost only.
  const displayNameAvailable = await checkDisplayNameAvailable(trimmedName);
  if (!displayNameAvailable) {
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
    console.warn('[signUpWithPassword] Email verification service unavailable. Proceeding with signup; Supabase Auth will still block duplicate emails.');
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
    const { error: upsertError } = await supabase.from('users').upsert({ 
      id: user.id, 
      name: trimmedName
      // Note: email column doesn't exist in users table - email is stored in auth.users only
    });
    if (upsertError) {
      const msg = (upsertError.message || '').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists')) {
        throw new Error('Username already taken. Please choose a different name.');
      }
      throw upsertError;
    }
  }
  
  return data;
}

function normalizeDisplayName(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

function hasSqlLikeWildcards(input: string): boolean {
  // We rely on ILIKE for case-insensitive comparison; disallow wildcard characters
  // so the check is an exact match, not a pattern match.
  return input.includes('%') || input.includes('_');
}

async function checkDisplayNameAvailable(displayName: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const fetchCheck = async (url: string) => {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
      signal: controller.signal,
    });
  };

  const clientFallback = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .ilike('name', displayName)
      .limit(1);
    if (error) throw error;
    return !(data && data.length > 0);
  };

  try {
    const localUrl = '/.netlify/functions/checkDisplayNameAvailable';
    let response: Response;
    try {
      response = await fetchCheck(localUrl);
    } catch (localError: any) {
      if (localError?.name === 'TypeError' || localError?.name === 'AbortError') {
        response = await fetchCheck(
          'https://totl-staging.netlify.app/.netlify/functions/checkDisplayNameAvailable'
        );
      } else {
        throw localError;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 404 && isLocalhost) {
      return await clientFallback();
    }

    if (!response.ok) {
      if (!isLocalhost) {
        throw new Error('Unable to verify display name availability. Please try again.');
      }
      return await clientFallback();
    }

    const result = (await response.json()) as { available?: boolean };
    return result.available !== false;
  } catch (err: any) {
    if (!isLocalhost) {
      if (err?.name === 'AbortError') {
        throw new Error('Unable to verify display name availability. Please try again.');
      }
      throw err;
    }
    return await clientFallback();
  }
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

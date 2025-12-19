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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(
  email: string, 
  password: string, 
  displayName: string
) {
  // Check if username is already taken
  const { data: existingUsers, error: checkError } = await supabase
    .from('users')
    .select('name')
    .eq('name', displayName.trim())
    .limit(1);
  
  if (checkError) throw checkError;
  
  if (existingUsers && existingUsers.length > 0) {
    throw new Error('Username already taken. Please choose a different name.');
  }
  
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { display_name: displayName.trim() },
      emailRedirectTo: window.location.origin,
    },
  });
  
  if (error) throw error;
  
  // Upsert profile
  const user = data.user ?? (await supabase.auth.getUser()).data.user;
  if (user) {
    await supabase.from('users').upsert({ id: user.id, name: displayName.trim() });
  }
  
  return data;
}

export async function resetPasswordForEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
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

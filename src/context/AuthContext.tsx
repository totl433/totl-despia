import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ensurePushSubscribed } from '../lib/pushNotifications';
import { bootLog } from '../lib/logEvent';

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  showWelcome: boolean;
  dismissWelcome: () => void;
};

export const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  showWelcome: false,
  dismissWelcome: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Try to get session from localStorage immediately as a fallback
    let fallbackSession: any = null;
    try {
      // Supabase stores session in localStorage with key pattern: sb-<project-ref>-auth-token
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      if (supabaseUrl) {
        const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
        if (projectRef) {
          const storageKey = `sb-${projectRef}-auth-token`;
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (parsed && parsed.currentSession) {
                fallbackSession = parsed.currentSession;
                console.log('[Auth] Found session in localStorage, using as fallback');
                if (mounted) {
                  setSession(fallbackSession);
                  setUser(fallbackSession.user);
                  setLoading(false);
                }
              }
            } catch (e) {
              console.log('[Auth] Could not parse stored session:', e);
            }
          }
        }
      }
    } catch (e) {
      console.log('[Auth] Error checking localStorage:', e);
    }

    // Add timeout to prevent infinite loading (5 seconds max for auth)
    const authTimeout = setTimeout(() => {
      if (mounted && !fallbackSession) {
        console.warn('[Auth] Auth loading timed out after 5 seconds, proceeding without session');
        bootLog.authTimeout();
        setLoading(false);
      }
    }, 5000);

    bootLog.authStart();
    console.log('[Auth] Setting up auth state listener...');
    
    // Set up auth state change listener - this fires on initialization and state changes
    let authStateReceived = false;
    console.log('[Auth] Setting up onAuthStateChange listener...');
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      console.log('[Auth] Auth state changed:', event, sess ? 'has session' : 'no session', sess?.user?.id);
      authStateReceived = true;
      clearTimeout(authTimeout);
      if (!mounted) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
      
      if (sess?.user) {
        bootLog.authSuccess(sess.user.id);
      }
      
      // Show welcome message only when user signs in via email confirmation (new users)
      if (event === 'SIGNED_IN' && sess?.user && !hasShownWelcome) {
        // Check if this is a fresh email confirmation (not just a regular login)
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        // Check various ways Supabase might indicate email confirmation
        const isEmailConfirmation = urlParams.get('type') === 'signup' || 
                                  urlParams.get('confirmation_token') ||
                                  hashParams.get('type') === 'signup' ||
                                  hashParams.get('access_token') ||
                                  window.location.search.includes('confirmation') ||
                                  window.location.hash.includes('confirmation');
        
        if (isEmailConfirmation && sess.user.email_confirmed_at) {
          setShowWelcome(true);
          setHasShownWelcome(true);
          // Clean up the URL to remove confirmation parameters
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    });
    
    // Try to get session with a shorter timeout (3 seconds)
    // If it hangs, we'll rely on onAuthStateChange which should fire
    console.log('[Auth] Attempting to get session (with 3s timeout)...');
    Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('getSession timeout')), 3000))
    ])
      .then((result: any) => {
        if (authStateReceived) return; // Already got it from onAuthStateChange
        clearTimeout(authTimeout);
        if (!mounted) return;
        const { data, error } = result;
        console.log('[Auth] Session result:', error ? 'ERROR: ' + error.message : 'OK', data?.session ? 'has session' : 'no session');
        if (data?.session) {
          setSession(data.session);
          setUser(data.session.user);
        }
        setLoading(false);
      })
      .catch((error: any) => {
        if (authStateReceived) return; // Already got it from onAuthStateChange
        console.log('[Auth] getSession timed out or failed, relying on onAuthStateChange:', error.message);
        // Don't set loading to false here - let onAuthStateChange handle it
        // If onAuthStateChange doesn't fire within 5 seconds, the timeout will handle it
      });

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  // Auto-register OneSignal Player ID (native) when signed in
  // Runs automatically on every app load and keeps subscriptions active
  useEffect(() => {
    // CRITICAL: Check both user AND session.access_token
    // If session exists but access_token is missing, registration will fail
    if (!user || !session || !session.access_token) {
      if (user && session && !session.access_token) {
        console.warn('[Push] ⚠️ User and session exist but access_token is missing - skipping registration');
      }
      return;
    }
    const currentUser: User = user;
    const currentSession: Session = session;
    let cancelled = false;
    let registrationInterval: number | null = null;

    async function attemptRegister(retryCount = 0): Promise<boolean> {
      if (cancelled) {
        console.log('[Push] Registration cancelled');
        return false;
      }

      // Double-check session is still valid before each attempt
      if (!currentSession?.access_token) {
        console.warn(`[Push] ⚠️ Session access_token missing during registration attempt ${retryCount + 1}`);
        return false;
      }

      try {
        console.log(`[Push] Attempting auto-registration (attempt ${retryCount + 1}/15) for user ${currentUser.id}`);
        
        // Use ensurePushSubscribed which handles permission + initialization + registration
        const result = await ensurePushSubscribed(currentSession);
        
        if (result.ok && result.playerId) {
          const lsKey = `totl:last_pid:${currentUser.id}`;
          const lastPid = localStorage.getItem(lsKey);
          localStorage.setItem(lsKey, result.playerId);
          
          if (lastPid !== result.playerId) {
            console.log('[Push] ✅ Auto-registered Player ID:', result.playerId.slice(0, 8) + '…');
          } else {
            console.log('[Push] ✅ Player ID already registered:', result.playerId.slice(0, 8) + '…');
          }
          return true;
        }

        // Retry logic based on reason
        if (result.reason === 'no-player-id') {
          console.log(`[Push] Player ID not ready yet, will retry in 2s (attempt ${retryCount + 1}/15)`);
          if (retryCount < 14 && !cancelled) {
            setTimeout(() => attemptRegister(retryCount + 1), 2000);
          } else {
            console.warn('[Push] Failed to get Player ID after 15 attempts. OneSignal may not be initialized.');
          }
        } else if (result.reason === 'permission-denied') {
          console.warn('[Push] Permission denied - user needs to enable notifications in OS settings');
          // Still retry periodically in case user enables permissions
          if (retryCount < 4 && !cancelled) {
            setTimeout(() => attemptRegister(retryCount + 1), 5000);
          }
        } else if (result.reason === 'api-not-available') {
          console.log('[Push] Despia API not available - not in native app, skipping');
          // Don't retry - not a native app
        } else {
          console.error(`[Push] ❌ Registration failed: ${result.reason}`, result.error ? `- ${result.error}` : '');
          // Retry for unknown errors, but log more details
          if (retryCount < 4 && !cancelled) {
            console.log(`[Push] Will retry registration in 3s (attempt ${retryCount + 1}/5)`);
            setTimeout(() => attemptRegister(retryCount + 1), 3000);
          } else {
            console.error(`[Push] ❌ Registration failed after ${retryCount + 1} attempts. Reason: ${result.reason}`);
            if (result.error) {
              console.error(`[Push] Error details: ${result.error}`);
            }
          }
        }
      } catch (err) {
        console.error('[Push] ❌ Registration exception:', err);
        // Retry on exception
        if (retryCount < 4 && !cancelled) {
          setTimeout(() => attemptRegister(retryCount + 1), 3000);
        }
      }
      return false;
    }

    // Initial attempt with a small delay to let the app fully load
    // Also ensure session.access_token is available before attempting
    const initialTimeout = setTimeout(() => {
      if (!currentSession?.access_token) {
        console.warn('[Push] ⚠️ Delaying registration - session.access_token not yet available');
        // Retry after a short delay if access_token isn't ready
        setTimeout(() => {
          if (currentSession?.access_token && !cancelled) {
            attemptRegister();
          } else {
            console.warn('[Push] ⚠️ Session access_token still not available after delay');
          }
        }, 1000);
      } else {
        attemptRegister();
      }
    }, 500);

    // Retry on app foreground (when user comes back to app)
    const handleVisibilityChange = () => {
      if (!document.hidden && user && session && !cancelled) {
        console.log('[Push] App became visible, re-checking push subscription...');
        setTimeout(() => attemptRegister(0), 1000);
      }
    };

    // Periodic re-registration to keep subscriptions active (every 5 minutes)
    // This ensures subscriptions stay fresh even if OneSignal state changes
    registrationInterval = setInterval(() => {
      if (!cancelled && user && session) {
        console.log('[Push] Periodic re-registration check...');
        attemptRegister(0);
      }
    }, 5 * 60 * 1000); // 5 minutes

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearTimeout(initialTimeout);
      if (registrationInterval) {
        clearInterval(registrationInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, session?.access_token]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  function dismissWelcome() {
    setShowWelcome(false);
    setHasShownWelcome(true);
  }

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    session,
    loading,
    signOut,
    showWelcome,
    dismissWelcome
  }), [user, session, loading, showWelcome]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { 
  registerPushSubscription, 
  deactivatePushSubscription, 
  resetPushSessionState,
  updateHeartbeat 
} from '../lib/pushNotificationsV2';
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
    if (import.meta.env.DEV) {
      console.log('[Auth] Setting up auth state listener...');
    }
    
    // Set up auth state change listener - this fires on initialization and state changes
    let authStateReceived = false;
    if (import.meta.env.DEV) {
      console.log('[Auth] Setting up onAuthStateChange listener...');
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (import.meta.env.DEV) {
        console.log('[Auth] Auth state changed:', event, sess ? 'has session' : 'no session', sess?.user?.id);
      }
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
    if (import.meta.env.DEV) {
      console.log('[Auth] Attempting to get session (with 3s timeout)...');
    }
    Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('getSession timeout')), 3000))
    ])
      .then((result: any) => {
        if (authStateReceived) return; // Already got it from onAuthStateChange
        clearTimeout(authTimeout);
        if (!mounted) return;
        const { data, error } = result;
        if (error) {
          console.error('[Auth] Session error:', error.message);
        } else if (import.meta.env.DEV) {
          console.log('[Auth] Session result:', data?.session ? 'has session' : 'no session');
        }
        if (data?.session) {
          setSession(data.session);
          setUser(data.session.user);
        }
        setLoading(false);
      })
      .catch((error: any) => {
        if (authStateReceived) return; // Already got it from onAuthStateChange
        if (import.meta.env.DEV) {
          console.log('[Auth] getSession timed out or failed, relying on onAuthStateChange:', error.message);
        }
        // Don't set loading to false here - let onAuthStateChange handle it
        // If onAuthStateChange doesn't fire within 5 seconds, the timeout will handle it
      });

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  // Auto-register OneSignal Player ID (V2 - once per session with heartbeat)
  useEffect(() => {
    if (!user || !session?.access_token) {
      return;
    }
    
    let cancelled = false;
    const currentSession = session;

    async function register() {
      if (cancelled || !user) return;

      console.log(`[PushV2] Starting registration for user ${user.id}`);
      // Give OneSignal/Despia a grace period to fetch the device token before we navigate away
      const MIN_WAIT_MS = 2000;
      const wait = new Promise((res) => setTimeout(res, MIN_WAIT_MS));

      // Pass userId explicitly for Despia V2 setonesignalplayerid call
      const resultPromise = registerPushSubscription(currentSession, { userId: user.id });

      const [result] = await Promise.all([resultPromise, wait]);

      if (result.ok) {
        console.log('[PushV2] ✅ Registration successful:', result.playerId?.slice(0, 8) + '…');
      } else if (result.reason === 'api-not-available') {
        console.log('[PushV2] Not in native app, skipping registration');
      } else {
        console.warn(`[PushV2] Registration issue: ${result.reason}`, result.error || '');
      }
    }

    // Initial registration (delayed to let app load)
    const initialTimeout = setTimeout(register, 500);

    // Heartbeat on app foreground (updates last_seen_at and re-links external_user_id)
    // Also force re-registration to ensure device stays subscribed in OneSignal
    const handleVisibilityChange = () => {
      if (!document.hidden && !cancelled && user) {
        console.log('[PushV2] App visible, sending heartbeat and re-registering...');
        updateHeartbeat(currentSession, { userId: user.id });
        // Force re-registration to ensure device stays subscribed in OneSignal
        // This is important because OneSignal can unsubscribe devices when app is backgrounded
        registerPushSubscription(currentSession, { force: true, userId: user.id }).catch(err => {
          console.warn('[PushV2] Re-registration on visibility change failed:', err);
        });
      }
    };

    // Periodic heartbeat (every 5 minutes) - re-links external_user_id to prevent it from being cleared
    const heartbeatInterval = setInterval(() => {
      if (!cancelled && user) {
        updateHeartbeat(currentSession, { userId: user.id });
      }
    }, 5 * 60 * 1000);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearTimeout(initialTimeout);
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, session?.access_token]);

  async function signOut() {
    console.log('[Auth] Sign out initiated');
    
    // Immediately clear local state
    setSession(null);
    setUser(null);
    resetPushSessionState();
    
    // Clear Supabase session from localStorage directly (CRITICAL - prevents session restoration)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      if (supabaseUrl) {
        const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
        if (projectRef) {
          // Clear all Supabase-related localStorage keys
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('supabase') || key.includes(projectRef) || key.startsWith('sb-'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => {
            console.log('[Auth] Removing localStorage key:', key);
            localStorage.removeItem(key);
          });
        }
      }
    } catch (e) {
      console.warn('[Auth] Error clearing localStorage:', e);
    }
    
    // Fire and forget - don't wait for anything
    deactivatePushSubscription(session).catch(() => {});
    supabase.auth.signOut().catch(() => {});
    
    // Use replace() and add a cache-busting query param to force fresh auth check
    console.log('[Auth] Force redirecting to /auth');
    window.location.replace('/auth?logout=' + Date.now());
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

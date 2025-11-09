import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ensurePushSubscribed } from '../lib/pushNotifications';

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  showWelcome: boolean;
  dismissWelcome: () => void;
};

const AuthCtx = createContext<AuthState>({
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

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
      
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

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Auto-register OneSignal Player ID (native) when signed in
  // Runs automatically on every app load and keeps subscriptions active
  useEffect(() => {
    if (!user || !session) return;
    const currentUser: User = user;
    const currentSession: Session = session;
    let cancelled = false;
    let registrationInterval: number | null = null;

    async function attemptRegister(retryCount = 0): Promise<boolean> {
      if (cancelled) {
        console.log('[Push] Registration cancelled');
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
          console.warn(`[Push] Registration failed: ${result.reason}`);
          // Retry for unknown errors
          if (retryCount < 4 && !cancelled) {
            setTimeout(() => attemptRegister(retryCount + 1), 3000);
          }
        }
      } catch (err) {
        console.error('[Push] Registration error:', err);
        // Retry on exception
        if (retryCount < 4 && !cancelled) {
          setTimeout(() => attemptRegister(retryCount + 1), 3000);
        }
      }
      return false;
    }

    // Initial attempt with a small delay to let the app fully load
    const initialTimeout = setTimeout(() => {
      attemptRegister();
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

  return (
    <AuthCtx.Provider value={{ user, session, loading, signOut, showWelcome, dismissWelcome }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

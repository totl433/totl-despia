import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function SignIn() {
  const [mode, setMode] = useState<'signup'|'signin'|'reset'|'password-reset'>('signup');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEmailMessage, setShowEmailMessage] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  // Redirect if already signed in (unless it's a password reset)
  useEffect(() => {
    if (!authLoading && user && mode !== 'password-reset') {
      console.log('[SignIn] User already signed in, redirecting to home');
      nav('/', { replace: true });
    }
  }, [user, authLoading, mode, nav]);

  // Check for password reset on page load
  useEffect(() => {
    const checkPasswordReset = async () => {
      console.log('SignIn page loaded, checking for password reset...');
      console.log('Current URL:', window.location.href);
      console.log('Search params:', window.location.search);
      console.log('Hash:', window.location.hash);
      
      // Check URL parameters for recovery type
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      
      const isRecovery = urlParams.get('type') === 'recovery' || 
                        hashParams.get('type') === 'recovery' ||
                        window.location.search.includes('type=recovery') ||
                        window.location.hash.includes('type=recovery');
      
      console.log('Is recovery detected:', isRecovery);
      
      if (isRecovery) {
        console.log('Setting password reset mode');
        setMode('password-reset');
        return;
      }
      
      // Check if user is already signed in via password reset
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session:', session);
      
      // If user is signed in and we're on the auth page, check if this is a password reset
      if (session?.user) {
        // Check URL parameters again in case they're still there
        if (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery')) {
          console.log('Session-based recovery detected');
          setMode('password-reset');
          return;
        }
        
        // Check if this is a password reset by looking at the session's recovery metadata
        // Supabase sets recovery metadata when password reset is used
        if (session.user.app_metadata?.provider === 'email' && 
            (session.user.app_metadata?.providers?.includes('email') || 
             window.location.href.includes('recovery') ||
             window.location.href.includes('reset'))) {
          console.log('Password reset session detected');
          setMode('password-reset');
          return;
        }
      }
    };
    checkPasswordReset();
  }, []);

  async function updatePassword() {
    if (newPassword !== confirmPassword) {
      setErr('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setErr('Password must be at least 6 characters');
      return;
    }

    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setPasswordResetSuccess(true);
      setTimeout(() => {
        nav('/');
      }, 2000);
    } catch (e: any) {
      setErr(e.message || 'Failed to update password');
    } finally {
      setBusy(false);
    }
  }

  async function upsertProfile(userId: string, name?: string) {
    if (!userId) return;
    if (name && name.trim()) {
      await supabase.from('users').upsert({ id: userId, name: name.trim() });
    } else {
      // ensure a row exists even if name is empty
      await supabase.from('users').upsert({ id: userId });
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setErr('Please enter your email address');
      return;
    }
    
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setResetEmailSent(true);
    } catch (e: any) {
      setErr(e?.message || 'Failed to send reset email');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
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

        const user = data.user ?? (await supabase.auth.getUser()).data.user;
        if (user) await upsertProfile(user.id, displayName);
        
        // Show email confirmation message instead of navigating away
        setShowEmailMessage(true);
      } else {
        console.log('[SignIn] Attempting sign in with email:', email.trim());
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          console.error('[SignIn] Sign in error:', error);
          throw error;
        }
        console.log('[SignIn] Sign in successful, data:', data);
        const user = data.user ?? data.session?.user;
        console.log('[SignIn] User:', user?.id);
        console.log('[SignIn] Session:', data.session ? 'has session' : 'no session');
        
        // Force refresh the auth state by getting the session
        if (data.session) {
          console.log('[SignIn] Session available, storing and refreshing auth state');
          // The session should be automatically stored by Supabase, but let's verify
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            console.log('[SignIn] Verified session after sign-in:', sessionData.session ? 'OK' : 'missing');
          } catch (e) {
            console.error('[SignIn] Error verifying session:', e);
          }
        }
        
        if (user) {
          try {
            const metaName = (user.user_metadata as any)?.display_name as string | undefined;
            console.log('[SignIn] Upserting profile for user:', user.id, 'name:', metaName);
            await upsertProfile(user.id, metaName);
            console.log('[SignIn] Profile upserted successfully');
          } catch (profileError) {
            console.error('[SignIn] Error upserting profile (non-fatal):', profileError);
            // Don't throw - profile upsert failure shouldn't block sign-in
          }
        }
        console.log('[SignIn] Navigating to home page...');
        nav('/', { replace: true });
        console.log('[SignIn] Navigation called');
      }
    } catch (e:any) {
      setErr(e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (showEmailMessage) {
    return (
      <div className="min-h-screen flex items-start justify-center bg-gray-50 p-6 pt-20">
        <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow space-y-4">
          <h1 className="text-xl font-bold text-center">Check Your Email</h1>
          <div className="text-center space-y-3">
            <p className="text-slate-600">
              We've sent you a confirmation link at <strong>{email}</strong>
            </p>
            <p className="text-sm text-slate-500">
              Click the link in your email to activate your account and start playing TOTL!
            </p>
            <button
              onClick={() => setShowEmailMessage(false)}
              className="mt-4 px-4 py-2 text-sm text-emerald-600 hover:text-emerald-700 underline"
            >
              Back to signup
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (resetEmailSent) {
    return (
      <div className="min-h-screen flex items-start justify-center bg-gray-50 p-6 pt-20">
        <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow space-y-4">
          <h1 className="text-xl font-bold text-center">Check Your Email</h1>
          <div className="text-center space-y-3">
            <p className="text-slate-600">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
            <p className="text-sm text-slate-500">
              Click the link in your email to reset your password.
            </p>
            <button
              onClick={() => {
                setResetEmailSent(false);
                setMode('signin');
              }}
              className="mt-4 px-4 py-2 text-sm text-emerald-600 hover:text-emerald-700 underline"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (passwordResetSuccess) {
    return (
      <div className="min-h-screen flex items-start justify-center bg-gray-50 p-6 pt-20">
        <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow space-y-4">
          <h1 className="text-xl font-bold text-center text-green-600">Password Updated!</h1>
          <div className="text-center space-y-3">
            <p className="text-slate-600">
              Your password has been successfully updated.
            </p>
            <p className="text-sm text-slate-500">
              Redirecting to home page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'password-reset') {
    return (
      <div className="min-h-screen flex items-start justify-center bg-gray-50 p-6 pt-20">
        <form onSubmit={(e) => { e.preventDefault(); updatePassword(); }} className="w-full max-w-md rounded-2xl border bg-white p-6 shadow space-y-4">
          <h1 className="text-xl font-bold">Set New Password</h1>
          
          <div>
            <label className="block text-sm font-medium">New Password</label>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Confirm Password</label>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              required
            />
          </div>

          {err && <div className="text-sm text-red-600">{err}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl px-4 py-2 font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50 p-6 pt-20">
      <form onSubmit={mode === 'reset' ? (e) => { e.preventDefault(); resetPassword(); } : onSubmit} className="w-full max-w-md rounded-2xl border bg-white p-6 shadow space-y-4">
        <h1 className="text-xl font-bold">
          {mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Sign in'}
        </h1>

        {mode === 'signup' && (
          <div>
            <label className="block text-sm font-medium">Display name</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Thomas B"
              required
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        {mode !== 'reset' && (
          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
            />
          </div>
        )}

        {err && <div className="text-sm text-red-600">{err}</div>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl px-4 py-2 font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? (
            mode === 'signup' ? 'Creating…' : mode === 'reset' ? 'Sending…' : 'Signing in…'
          ) : (
            mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'
          )}
        </button>

        <div className="text-xs text-slate-500">
          {mode === 'signup' ? (
            <>Already have an account?{' '}
              <button type="button" onClick={() => setMode('signin')} className="underline">Sign in</button>
            </>
          ) : mode === 'reset' ? (
            <>Remember your password?{' '}
              <button type="button" onClick={() => setMode('signin')} className="underline">Sign in</button>
            </>
          ) : (
            <>
              <div className="mb-2">
                New here?{' '}
                <button type="button" onClick={() => setMode('signup')} className="underline">Create an account</button>
              </div>
              <div>
                Forgot your password?{' '}
                <button type="button" onClick={() => setMode('reset')} className="underline">Reset it</button>
              </div>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
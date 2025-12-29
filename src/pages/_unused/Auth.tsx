import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthPage() {
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if this is a password reset session
    const checkPasswordReset = async () => {
      console.log('Auth page loaded, checking for password reset...');
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
        setIsPasswordReset(true);
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
          setIsPasswordReset(true);
          return;
        }
        
        // Check if this is a password reset by looking at the session's recovery metadata
        // Supabase sets recovery metadata when password reset is used
        if (session.user.app_metadata?.provider === 'email' && 
            (session.user.app_metadata?.providers?.includes('email') || 
             window.location.href.includes('recovery') ||
             window.location.href.includes('reset'))) {
          console.log('Password reset session detected');
          setIsPasswordReset(true);
          return;
        }
      }
    };
    checkPasswordReset();
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (isPasswordReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow">
          {success ? (
            <div className="text-center space-y-4">
              <h1 className="text-xl font-bold text-green-600">Password Updated!</h1>
              <p className="text-slate-600">Your password has been successfully updated.</p>
              <p className="text-sm text-slate-500">Redirecting to home page...</p>
            </div>
          ) : (
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
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

              {error && <div className="text-sm text-red-600">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl px-4 py-2 font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow">
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          magicLink
          redirectTo={window.location.origin}
        />
      </div>
    </div>
  );
}

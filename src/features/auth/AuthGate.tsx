/**
 * AuthGate - Session check + redirect logic
 * Renders nothing while checking, redirects authed users, shows AuthFlow for guests
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from './useSupabaseAuth';
import AuthFlow from './AuthFlow';
import { verifySignupToken } from './useSupabaseAuth';

export default function AuthGate() {
  const navigate = useNavigate();
  const { status, user } = useSupabaseAuth();
  const [signupVerifyLoading, setSignupVerifyLoading] = useState(false);

  function detectRecoveryFromUrl(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    return (
      urlParams.get('type') === 'recovery' ||
      hashParams.get('type') === 'recovery' ||
      window.location.search.includes('type=recovery') ||
      window.location.hash.includes('type=recovery')
    );
  }

  const isRecovery = detectRecoveryFromUrl();

  const signupParams = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const isSignup =
      urlParams.get('type') === 'signup' ||
      hashParams.get('type') === 'signup' ||
      window.location.search.includes('type=signup') ||
      window.location.hash.includes('type=signup');
    if (!isSignup) return null;
    const tokenHash = urlParams.get('token_hash') || '';
    const email = urlParams.get('email') || '';
    return { tokenHash, email };
  }, []);

  // If we opened an email confirmation universal link, verify it immediately.
  // This prevents the onboarding carousel from showing on a fresh launch.
  useEffect(() => {
    if (!signupParams?.tokenHash || !signupParams?.email) return;
    if (status !== 'guest') return;
    setSignupVerifyLoading(true);
    verifySignupToken(signupParams.tokenHash, signupParams.email)
      .then(() => {
        // Strip sensitive params from the URL and go home.
        window.history.replaceState(null, '', '/');
        navigate('/', { replace: true });
      })
      .catch(() => {
        // Invalid/expired confirmation link: take them to sign in (not onboarding).
        window.history.replaceState(null, '', '/auth?confirm=expired');
        navigate('/auth?confirm=expired', { replace: true });
      })
      .finally(() => setSignupVerifyLoading(false));
  }, [navigate, signupParams?.email, signupParams?.tokenHash, status]);

  // Redirect authed users to home
  useEffect(() => {
    if (status === 'authed' && user) {
      // Check if this is a password reset flow - don't redirect
      if (!isRecovery) {
        console.log('[AuthGate] User is authed, redirecting to home');
        navigate('/', { replace: true });
      }
    }
  }, [status, user, navigate, isRecovery]);

  // Handle successful auth - navigate to home
  const handleAuthSuccess = () => {
    console.log('[AuthGate] Auth success, redirecting to home');
    navigate('/', { replace: true });
  };

  // While checking session, render nothing (avoids flash of auth UI)
  if (status === 'checking') {
    return null;
  }
  if (signupVerifyLoading) return null;

  // If authed, render nothing (redirect will happen via useEffect).
  // Exception: during password recovery, keep showing the reset UI even though Supabase creates a session.
  if (status === 'authed') {
    if (isRecovery) {
      return <AuthFlow initialStep="reset" onAuthSuccess={handleAuthSuccess} />;
    }
    return null;
  }

  // Guest user - show auth flow
  return <AuthFlow initialStep={isRecovery ? 'reset' : 'onboarding'} onAuthSuccess={handleAuthSuccess} />;
}

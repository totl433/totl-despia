/**
 * AuthGate - Session check + redirect logic
 * Renders nothing while checking, redirects authed users, shows AuthFlow for guests
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from './useSupabaseAuth';
import AuthFlow from './AuthFlow';

export default function AuthGate() {
  const navigate = useNavigate();
  const { status, user } = useSupabaseAuth();

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

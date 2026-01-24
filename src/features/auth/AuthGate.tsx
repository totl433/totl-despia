/**
 * AuthGate - Session check + redirect logic
 * Renders nothing while checking, redirects authed users, shows AuthFlow for guests
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from './useSupabaseAuth';
import AuthFlow from './AuthFlow';
import type { GuestStep } from './AuthFlow';

export default function AuthGate() {
  const navigate = useNavigate();
  const { status, user } = useSupabaseAuth();
  const [initialStep, setInitialStep] = useState<GuestStep>('onboarding');

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

  // Check for password reset recovery on mount
  useEffect(() => {
    const isRecovery = detectRecoveryFromUrl();
    if (isRecovery) {
      setInitialStep('reset');
    }
  }, []);

  // Redirect authed users to home
  useEffect(() => {
    if (status === 'authed' && user) {
      // Check if this is a password reset flow - don't redirect
      const isRecovery = detectRecoveryFromUrl();
      if (!isRecovery) {
        console.log('[AuthGate] User is authed, redirecting to home');
        navigate('/', { replace: true });
      }
    }
  }, [status, user, navigate]);

  // Handle successful auth - navigate to home
  const handleAuthSuccess = () => {
    console.log('[AuthGate] Auth success, redirecting to home');
    navigate('/', { replace: true });
  };

  // While checking session, render nothing (avoids flash of auth UI)
  if (status === 'checking') {
    return null;
  }

  // If authed, render nothing (redirect will happen via useEffect)
  if (status === 'authed') {
    return null;
  }

  // Guest user - show auth flow
  return <AuthFlow initialStep={initialStep} onAuthSuccess={handleAuthSuccess} />;
}

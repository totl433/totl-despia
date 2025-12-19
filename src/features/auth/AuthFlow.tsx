/**
 * AuthFlow - State machine for the logged-out flow
 * Manages transitions between onboarding, sign in, sign up, reset, and loading
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import OnboardingCarousel from './OnboardingCarousel';
import SignInForm from './SignInForm';
import SignUpForm from './SignUpForm';
import ResetPasswordForm from './ResetPasswordForm';
import EmailConfirmation from './EmailConfirmation';

export type GuestStep = 'onboarding' | 'signIn' | 'signUp' | 'reset' | 'emailConfirmation';

// Persist step in sessionStorage to survive re-renders
const STEP_STORAGE_KEY = 'totl_auth_step';

function getStoredStep(): GuestStep | null {
  try {
    const stored = sessionStorage.getItem(STEP_STORAGE_KEY);
    if (stored && ['signIn', 'signUp', 'reset'].includes(stored)) {
      return stored as GuestStep;
    }
  } catch (e) {
    // Ignore storage errors
  }
  return null;
}

function setStoredStep(step: GuestStep | null) {
  try {
    if (step && ['signIn', 'signUp', 'reset'].includes(step)) {
      sessionStorage.setItem(STEP_STORAGE_KEY, step);
    } else {
      sessionStorage.removeItem(STEP_STORAGE_KEY);
    }
  } catch (e) {
    // Ignore storage errors
  }
}

interface AuthFlowProps {
  initialStep?: GuestStep;
  onAuthSuccess: () => void;
}

export default function AuthFlow({ initialStep = 'onboarding', onAuthSuccess }: AuthFlowProps) {
  // Check for persisted step (survives parent re-renders)
  const storedStep = getStoredStep();
  const effectiveInitialStep = storedStep || initialStep;
  
  const [guestStep, setGuestStep] = useState<GuestStep>(effectiveInitialStep);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  
  // Track the last form step (not loading/onboarding)
  const lastFormStepRef = useRef<GuestStep>(
    ['signIn', 'signUp', 'reset'].includes(effectiveInitialStep) 
      ? effectiveInitialStep 
      : 'signIn'
  );

  // Update stored step when navigating to a form
  useEffect(() => {
    if (['signIn', 'signUp', 'reset'].includes(guestStep)) {
      lastFormStepRef.current = guestStep;
      setStoredStep(guestStep);
    } else if (guestStep === 'onboarding') {
      // Clear stored step when back at onboarding
      setStoredStep(null);
    }
  }, [guestStep]);

  // Handle successful auth - clear stored step
  const handleAuthSuccess = useCallback(() => {
    setStoredStep(null);
    onAuthSuccess();
  }, [onAuthSuccess]);

  // Handle email confirmation needed after signup
  const handleEmailConfirmationNeeded = useCallback((email: string) => {
    setConfirmationEmail(email);
    setGuestStep('emailConfirmation');
  }, []);

  // Navigation handlers
  const goToSignIn = useCallback(() => setGuestStep('signIn'), []);
  const goToSignUp = useCallback(() => setGuestStep('signUp'), []);
  const goToReset = useCallback(() => setGuestStep('reset'), []);

  // Render based on current step
  switch (guestStep) {
    case 'onboarding':
      return (
        <OnboardingCarousel 
          onSkip={goToSignIn}
          onComplete={goToSignIn}
        />
      );

    case 'signIn':
      return (
        <SignInForm
          onSwitchToSignUp={goToSignUp}
          onSwitchToReset={goToReset}
          onSuccess={handleAuthSuccess}
        />
      );

    case 'signUp':
      return (
        <SignUpForm
          onSwitchToSignIn={goToSignIn}
          onSuccess={handleAuthSuccess}
          onEmailConfirmationNeeded={handleEmailConfirmationNeeded}
        />
      );

    case 'reset':
      return (
        <ResetPasswordForm
          onSwitchToSignIn={goToSignIn}
          onSuccess={handleAuthSuccess}
        />
      );

    case 'emailConfirmation':
      return (
        <EmailConfirmation
          email={confirmationEmail}
          onBackToSignUp={goToSignUp}
        />
      );

    default:
      // Fallback to sign in
      return (
        <SignInForm
          onSwitchToSignUp={goToSignUp}
          onSwitchToReset={goToReset}
          onSuccess={handleAuthSuccess}
        />
      );
  }
}

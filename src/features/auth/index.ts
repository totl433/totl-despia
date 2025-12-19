/**
 * Auth feature module exports
 */
export { default as AuthGate } from './AuthGate';
export { default as AuthFlow } from './AuthFlow';
export { default as AuthLoading } from './AuthLoading';
export { default as OnboardingCarousel } from './OnboardingCarousel';
export { default as OnboardingSlide } from './OnboardingSlide';
export { default as SignInForm } from './SignInForm';
export { default as SignUpForm } from './SignUpForm';
export { default as ResetPasswordForm } from './ResetPasswordForm';
export { default as EmailConfirmation } from './EmailConfirmation';

export { useSupabaseAuth } from './useSupabaseAuth';
export { useSwipe } from './useSwipe';

export type { GuestStep } from './AuthFlow';

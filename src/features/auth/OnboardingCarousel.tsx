import { useState, useCallback, useMemo, useEffect } from 'react';
import OnboardingSlide from './OnboardingSlide';
import { useSwipe } from './useSwipe';
import {
  getPrivacyAccepted,
  setPrivacyAccepted,
} from './consentStorage';
import { isNativeApp } from '../../lib/platform';

type Slide =
  | {
      type: 'info';
      title: string;
      description: string;
      imageUrl: string;
    }
  | { type: 'privacy' }
  | { type: 'push' };

const BASE_SLIDES: Slide[] = [
  {
    type: 'info',
    title: 'Welcome to TOTL',
    description:
      "The group chat's ultimate football game is here. Predict what you think will happen each Premier League gameweek, join Mini Leagues with friends, and see who comes out on top. No hassle — just predict and play. Gamify your gamedays.",
    imageUrl: '/assets/onboarding-0.png',
  },
  {
    type: 'info',
    title: 'Predict every gameweek',
    description:
      "Ten fixtures. Three outcomes. Score out of 10 depending on how often you're right, or confidently wrong.",
    imageUrl: '/assets/onboarding-1.png',
  },
  {
    type: 'info',
    title: 'Climb the global leaderboard',
    description:
      'Every correct prediction adds up. Follow your gut, stay consistent and work from beginner to actual menace.',
    imageUrl: '/assets/onboarding-2.png',
  },
  {
    type: 'info',
    title: 'Mini leagues get personal',
    description:
      'Create leagues with 2–8 friends. Each week is head-to-head. Highest score wins. Group chats take a hit.',
    imageUrl: '/assets/onboarding-3.png',
  },
  {
    type: 'info',
    title: 'Start anytime and still compete',
    description:
      'Joined late? Fear not. Your form tracks the last 5 and 10 weeks, so every gameweek is a chance to push on.',
    imageUrl: '/assets/onboarding-4.png',
  },
  { type: 'privacy' },
];

const ONBOARDING_HEADING_CLASSES = 'text-4xl font-normal text-[#1C8376] leading-[1.2] mt-4';

interface OnboardingCarouselProps {
  onSkip: () => void;
  onComplete: () => void;
}

export default function OnboardingCarousel({ onSkip, onComplete }: OnboardingCarouselProps) {
  const [nativeDetected, setNativeDetected] = useState(() => isNativeApp());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [textFading, setTextFading] = useState(false);
  const [displayedIndex, setDisplayedIndex] = useState(0);
  const [privacyChecked, setPrivacyChecked] = useState(getPrivacyAccepted());

  const slides = useMemo(() => {
    return BASE_SLIDES;
  }, [nativeDetected]);

  // Native detection can become available slightly after boot (Despia injects globals).
  // Poll briefly so we can remove the cookie prompt and default to essential-only.
  useEffect(() => {
    if (nativeDetected) return;
    let attempts = 0;
    const maxAttempts = 20; // 10s total
    const interval = setInterval(() => {
      attempts += 1;
      if (isNativeApp()) {
        setNativeDetected(true);
        clearInterval(interval);
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [nativeDetected]);

  useEffect(() => {
    if (currentIndex !== displayedIndex) {
      setTextFading(true);

      const timeout = setTimeout(() => {
        setDisplayedIndex(currentIndex);
        setTextFading(false);
      }, 200);

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, displayedIndex]);

  const persistPrivacy = useCallback(() => {
    setPrivacyAccepted(true);
    setPrivacyChecked(true);
  }, []);

  const goToNext = useCallback(
    () => {
      if (isAnimating) return;
      const slide = slides[currentIndex];

      if (slide.type === 'privacy' && !privacyChecked) return;

      if (currentIndex < slides.length - 1) {
        setIsAnimating(true);
        setCurrentIndex((prev) => prev + 1);
        setTimeout(() => setIsAnimating(false), 300);
      } else {
        onComplete();
      }
    },
    [currentIndex, isAnimating, onComplete, privacyChecked, slides]
  );

  const goToPrev = useCallback(() => {
    if (isAnimating || currentIndex === 0) return;

    setIsAnimating(true);
    setCurrentIndex((prev) => prev - 1);
    setTimeout(() => setIsAnimating(false), 300);
  }, [currentIndex, isAnimating]);

  const swipeHandlers = useSwipe({
    onSwipeLeft: goToNext,
    onSwipeRight: goToPrev,
  });

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const transitionStyle = prefersReducedMotion ? {} : { transition: 'transform 300ms ease-out' };

  const currentSlide = slides[currentIndex];
  const isPrivacyPending = !privacyChecked;
  const firstPendingRequiredIndex = useMemo(() => {
    if (isPrivacyPending) {
      return slides.findIndex((s) => s.type === 'privacy');
    }
    return -1;
  }, [isPrivacyPending, slides]);

  const handleSkip = useCallback(() => {
    if (isPrivacyPending) {
      if (firstPendingRequiredIndex >= 0) {
        setCurrentIndex(firstPendingRequiredIndex);
      }
      return;
    }
    onSkip();
  }, [firstPendingRequiredIndex, isPrivacyPending, onSkip]);

  const handlePrivacyContinue = () => {
    if (!privacyChecked) return;
    persistPrivacy();
    goToNext();
  };

  const renderContent = () => {
    switch (currentSlide.type) {
      case 'info': {
        const infoSlides = slides.filter((s) => s.type === 'info') as Extract<Slide, { type: 'info' }>[];
        const infoSlide = infoSlides[currentIndex] as Extract<Slide, { type: 'info' }>;
        return (
          <>
            <div className="flex-1 relative overflow-hidden min-h-0">
              <div
                className="flex h-full"
                style={{ transform: `translateX(-${currentIndex * 100}%)`, ...transitionStyle }}
              >
                {infoSlides.map((slide, index) => (
                  <div key={index} className="w-full h-full flex-shrink-0">
                    <OnboardingSlide title={slide.title} imageUrl={slide.imageUrl} />
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 pt-10 pb-8">
              <p
                className="text-base text-slate-500 text-center leading-relaxed mb-12 pb-6"
                style={{
                  opacity: textFading ? 0 : 1,
                  transform: textFading ? 'translateY(4px)' : 'translateY(0)',
                  transition:
                    'opacity 400ms cubic-bezier(0.4, 0, 0.2, 1), transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {infoSlide?.description}
              </p>
              <div className="flex justify-center gap-2">
                {infoSlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (!isAnimating) {
                        setIsAnimating(true);
                        setCurrentIndex(index);
                        setTimeout(() => setIsAnimating(false), 300);
                      }
                    }}
                    className={`w-2 h-2 rounded-full ${
                      index === currentIndex ? 'bg-[#1C8376]' : 'bg-slate-300'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                    aria-current={index === currentIndex ? 'true' : 'false'}
                  />
                ))}
              </div>
            </div>
          </>
        );
      }
      case 'privacy':
        return (
          <div className="flex-1 flex flex-col px-6 gap-6">
            <h1 className={ONBOARDING_HEADING_CLASSES}>Before you get started</h1>
            <p className="text-base text-slate-700">
              Please read and accept our Privacy Policy. We only use your data to run the game, improve the app, and
              communicate game updates.
            </p>
            <a
              href="https://playtotl.com/privacy"
              target="_blank"
              rel="noreferrer"
              className="text-[#1C8376] underline font-medium"
            >
              View Privacy Policy
            </a>
            <label className="flex items-center justify-between gap-3 mt-2">
              <span className="text-slate-700">I agree to TOTL&apos;s Privacy Policy.</span>
              <span className="relative inline-flex h-7 w-12 flex-shrink-0 items-center">
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked={privacyChecked}
                  checked={privacyChecked}
                  onChange={(e) => setPrivacyChecked(e.target.checked)}
                  className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors duration-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#1C8376] peer-checked:bg-[#1C8376]" />
                <span
                  className="absolute left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out peer-checked:translate-x-5"
                  aria-hidden="true"
                />
                <span
                  className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
                  aria-hidden="true"
                />
              </span>
            </label>
            <div className="mt-auto flex flex-col gap-3 pb-8">
              <button
                onClick={handlePrivacyContinue}
                disabled={!privacyChecked}
                className={`w-full rounded-lg py-3 text-white font-semibold ${
                  privacyChecked ? 'bg-[#1C8376]' : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                Continue
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const canShowSkip = currentSlide.type === 'info';

  return (
    <div
      className="fixed inset-0 bg-white flex flex-col overflow-hidden"
      {...swipeHandlers}
      style={{ touchAction: 'pan-y' }}
      tabIndex={0}
      role="region"
      aria-label="Onboarding carousel"
    >
      <div className="w-full max-w-[1024px] mx-auto flex flex-col h-full">
        <div className="flex justify-end px-6 pt-8 pb-4">
          {canShowSkip && (
            <button onClick={handleSkip} className="text-sm text-slate-500 py-2 px-3">
              Skip
            </button>
          )}
        </div>

        {renderContent()}
      </div>
    </div>
  );
}

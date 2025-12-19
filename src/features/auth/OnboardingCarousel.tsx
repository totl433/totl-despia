/**
 * Onboarding carousel with swipe navigation
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import OnboardingSlide from './OnboardingSlide';
import { useSwipe } from './useSwipe';

const ONBOARDING_SLIDES = [
  {
    title: 'Predict every gameweek',
    description: 'Ten fixtures. Three outcomes. Score out of 10 depending on how often you\'re right, or confidently wrong.',
  },
  {
    title: 'Climb the global leaderboard',
    description: 'Every correct prediction adds up. Follow your gut, stay consistent and work from beginner to actual menace.',
  },
  {
    title: 'Mini leagues get personal',
    description: 'Create leagues with 2–8 friends. Each week is head-to-head. Highest score wins. Group chats take a hit.',
  },
  {
    title: 'Start anytime and still compete',
    description: 'Joined late? Fear not. Your form tracks the last 5 and 10 weeks, so every gameweek is a chance to push on.',
  },
];

interface OnboardingCarouselProps {
  onSkip: () => void;
  onComplete: () => void;
}

export default function OnboardingCarousel({ onSkip, onComplete }: OnboardingCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [textFading, setTextFading] = useState(false);
  const [displayedIndex, setDisplayedIndex] = useState(0);

  // Handle text fade animation when index changes
  useEffect(() => {
    if (currentIndex !== displayedIndex) {
      // Start fade out
      setTextFading(true);
      
      // After fade out, update displayed text and fade back in
      const timeout = setTimeout(() => {
        setDisplayedIndex(currentIndex);
        setTextFading(false);
      }, 200); // Smooth crossfade timing
      
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, displayedIndex]);

  const goToNext = useCallback(() => {
    if (isAnimating) return;
    
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      setIsAnimating(true);
      setCurrentIndex(prev => prev + 1);
      setTimeout(() => setIsAnimating(false), 300);
    } else {
      // Last slide - go to sign in
      onComplete();
    }
  }, [currentIndex, isAnimating, onComplete]);

  const goToPrev = useCallback(() => {
    if (isAnimating || currentIndex === 0) return;
    
    setIsAnimating(true);
    setCurrentIndex(prev => prev - 1);
    setTimeout(() => setIsAnimating(false), 300);
  }, [currentIndex, isAnimating]);

  const swipeHandlers = useSwipe({
    onSwipeLeft: goToNext,
    onSwipeRight: goToPrev,
  });

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const transitionStyle = prefersReducedMotion 
    ? {} 
    : { transition: 'transform 300ms ease-out' };

  return (
    <div 
      className="fixed inset-0 bg-white flex flex-col overflow-hidden"
      {...swipeHandlers}
      style={{ touchAction: 'pan-y' }}
      tabIndex={0}
      role="region"
      aria-label="Onboarding carousel"
    >
      {/* Skip button row - above the title */}
      <div className="flex justify-end px-6 pt-20 pb-4">
        <button 
          onClick={onSkip}
          className="text-sm text-slate-500 hover:text-slate-700 py-2 px-3"
        >
          Skip
        </button>
      </div>

      {/* Slides container - flex-1 grows to fill available space */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <div 
          className="flex h-full"
          style={{ 
            transform: `translateX(-${currentIndex * 100}%)`,
            ...transitionStyle,
          }}
        >
          {ONBOARDING_SLIDES.map((slide, index) => (
            <div key={index} className="w-full h-full flex-shrink-0">
              <OnboardingSlide
                title={slide.title}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Footer with description and pagination */}
      {/* 40px gap from image, 48px between description and dots */}
      <div className="px-6 pt-10 pb-8">
        {/* Description text with elegant fade animation */}
        <p 
          className="text-base text-slate-500 text-center leading-relaxed mb-12 pb-6"
          style={{ 
            opacity: textFading ? 0 : 1,
            transform: textFading ? 'translateY(4px)' : 'translateY(0)',
            transition: 'opacity 400ms cubic-bezier(0.4, 0, 0.2, 1), transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {ONBOARDING_SLIDES[displayedIndex].description}
        </p>
        
        {/* Pagination dots */}
        <div className="flex justify-center gap-2">
          {ONBOARDING_SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                if (!isAnimating) {
                  setIsAnimating(true);
                  setCurrentIndex(index);
                  setTimeout(() => setIsAnimating(false), 300);
                }
              }}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex 
                  ? 'bg-[#1C8376]' 
                  : 'bg-slate-300'
              }`}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === currentIndex ? 'true' : 'false'}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

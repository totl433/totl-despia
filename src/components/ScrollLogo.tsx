import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../hooks/useTheme';
import { getAppScrollTop, onAppScroll, scrollAppToTop } from '../lib/appScroll';

export default function ScrollLogo() {
  const { isDark } = useTheme();
  const [hasLoaded, setHasLoaded] = useState(false);
  const logoRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Ignore restored scroll until we’ve forced top after a link-open. */
  const scrollReady = useRef(false);

  // Force top, then allow the entrance spin (never start mid-scroll from a link)
  useEffect(() => {
    scrollAppToTop();
    const readyId = window.setTimeout(() => {
      scrollAppToTop();
      scrollReady.current = true;
      setHasLoaded(true);
    }, 80);
    return () => window.clearTimeout(readyId);
  }, []);

  // Handle scroll for logo animation using requestAnimationFrame
  useEffect(() => {
    let rafId: number;

    const resetLogo = () => {
      if (!containerRef.current || !logoRef.current) return;
      containerRef.current.style.transform = 'scaleY(1)';
      logoRef.current.style.opacity = '1';
      logoRef.current.style.transform = 'perspective(1000px) rotateY(0deg) scale(1)';
      const frontFace = logoRef.current.querySelector('[data-face="front"]') as HTMLElement | null;
      const backFace = logoRef.current.querySelector('[data-face="back"]') as HTMLElement | null;
      if (frontFace) {
        frontFace.style.opacity = '1';
        frontFace.style.visibility = 'visible';
      }
      if (backFace) {
        backFace.style.opacity = '0';
        backFace.style.visibility = 'hidden';
      }
    };

    const handleScroll = () => {
      rafId = requestAnimationFrame(() => {
        if (!scrollReady.current) {
          scrollAppToTop();
          resetLogo();
          return;
        }

        const scrollY = getAppScrollTop();

        if (containerRef.current && logoRef.current) {
          const flipProgress = Math.min(1, scrollY / 150);
          const rotateY = flipProgress * 720;
          const logoOpacity = Math.max(0, 1 - scrollY / 250);
          const logoScale = Math.max(0.4, 1 - scrollY / 400);
          const collapseProgress = Math.min(1, Math.max(0, (scrollY - 350) / 50));
          const scaleY = 1 - collapseProgress;

          containerRef.current.style.transform = `scaleY(${scaleY})`;
          containerRef.current.style.transformOrigin = 'top';

          const normalizedAngle = ((rotateY % 360) + 360) % 360;
          const showBackFace = normalizedAngle > 80 && normalizedAngle < 280;
          const frontFace = logoRef.current.querySelector('[data-face="front"]') as HTMLElement | null;
          const backFace = logoRef.current.querySelector('[data-face="back"]') as HTMLElement | null;

          if (scrollY > 0) {
            logoRef.current.style.opacity = logoOpacity.toString();
            logoRef.current.style.transform = `perspective(1000px) rotateY(${rotateY}deg) scale(${logoScale})`;
            logoRef.current.style.transition = 'opacity 0.1s ease-out, transform 0.1s ease-out';

            if (frontFace) {
              frontFace.style.transition = 'opacity 0s, visibility 0s';
              frontFace.style.opacity = showBackFace ? '0' : '1';
              frontFace.style.visibility = showBackFace ? 'hidden' : 'visible';
              frontFace.style.pointerEvents = showBackFace ? 'none' : 'auto';
            }
            if (backFace) {
              backFace.style.transition = 'opacity 0s, visibility 0s';
              backFace.style.opacity = showBackFace ? '1' : '0';
              backFace.style.visibility = showBackFace ? 'visible' : 'hidden';
              backFace.style.pointerEvents = showBackFace ? 'auto' : 'none';
            }
          } else {
            resetLogo();
            logoRef.current.style.transition =
              'opacity 0.6s ease-out, transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
            if (frontFace) {
              frontFace.style.transition = 'opacity 0s, visibility 0s';
              frontFace.style.pointerEvents = 'auto';
            }
            if (backFace) {
              backFace.style.transition = 'opacity 0s, visibility 0s';
              backFace.style.pointerEvents = 'none';
            }
          }
        }
      });
    };

    // Clear any restored scroll before listening
    scrollAppToTop();
    resetLogo();

    const removeScroll = onAppScroll(handleScroll, { passive: true });
    return () => {
      removeScroll();
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Entrance spin only after scroll is known to be at top
  const initialSpin = hasLoaded ? 0 : -360;
  
  return (
    <>
      <style>{`
        @keyframes logo-shimmer {
          0% {
            transform: translateX(-100%) skewX(-15deg);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateX(100%) skewX(-15deg);
            opacity: 0;
          }
        }
      `}</style>
      <div 
        ref={containerRef}
        className="w-full flex justify-center items-center"
        style={{ 
          height: '130px', // Keep height constant to prevent layout shift
          overflow: 'hidden',
          paddingTop: '0px',
          paddingBottom: '0px',
          perspective: '1000px', // Enable 3D perspective
          transition: 'transform 0.3s ease-out', // Smooth scale transition
          transform: 'scaleY(1)', // Initial scale
          transformOrigin: 'top', // Scale from top
        }}
      >
      <div
        ref={logoRef}
        style={{ 
          opacity: hasLoaded ? 1 : 0, 
          transform: `perspective(1000px) rotateY(${initialSpin}deg) scale(1)`, 
          transformStyle: 'preserve-3d',
          transition: 'opacity 0.6s ease-out, transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          willChange: 'transform, opacity', // Hint to browser for optimization
          position: 'relative',
          width: '123px',
          height: '110px',
        }}
      >
        {/* Front face - black logo */}
        <div
          data-face="front"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '123px',
            height: '110px',
            backfaceVisibility: 'visible',
            WebkitBackfaceVisibility: 'visible',
            transform: 'rotateY(0deg) translateZ(1px)',
            transformStyle: 'preserve-3d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            opacity: 1,
            visibility: 'visible',
            transition: 'opacity 0s, visibility 0s',
          }}
        >
          <img 
            src="/assets/badges/totl-logo1.svg" 
            alt="TOTL" 
            className="h-[88px] sm:h-[110px]"
            style={{ filter: isDark ? 'brightness(0) invert(1)' : 'brightness(0)', display: 'block' }}
          />
        </div>
        
        {/* Back face - shiny gradient */}
        <div
          data-face="back"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '123px',
            height: '110px',
            backfaceVisibility: 'visible',
            WebkitBackfaceVisibility: 'visible',
            transform: 'rotateY(180deg) translateZ(-1px)',
            transformStyle: 'preserve-3d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            opacity: 0,
            visibility: 'hidden',
            transition: 'opacity 0s, visibility 0s',
          }}
        >
          {/* Shiny gradient with logo mask - using regular mask, mirror via wrapper */}
          <div
            style={{
              width: '123px',
              height: '110px',
              transform: 'scaleX(-1)', // Mirror the entire content
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '123px',
                height: '110px',
                background: 'linear-gradient(to bottom right, #facc15 0%, #f97316 25%, #ec4899 50%, #9333ea 100%)',
                backgroundSize: '200% 200%',
                position: 'relative',
                overflow: 'hidden',
                WebkitMaskImage: 'url(/assets/badges/totl-logo1.svg)',
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskImage: 'url(/assets/badges/totl-logo1.svg)',
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
              }}
            >
            {/* Shimmer effect overlay - synchronized animations */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
                animation: 'logo-shimmer 1.2s linear infinite',
                willChange: 'transform, opacity',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to right, transparent 0%, rgba(254,240,138,0.5) 50%, transparent 100%)',
                animation: 'logo-shimmer 1.8s linear infinite 0.4s',
                willChange: 'transform, opacity',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            />
          </div>
        </div>
      </div>
      </div>
    </div>
    </>
  );
}
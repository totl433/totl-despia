import { useState, useEffect, useRef } from 'react';

export default function ScrollLogo() {
  const [hasLoaded, setHasLoaded] = useState(false);
  const logoRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Handle initial load animation
  useEffect(() => {
    // Trigger spin-in animation after component mounts
    const timer = setTimeout(() => {
      setHasLoaded(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);
  
  // Handle scroll for logo animation using requestAnimationFrame
  useEffect(() => {
    let rafId: number;
    
    const handleScroll = () => {
      rafId = requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        
        if (containerRef.current && logoRef.current) {
          // Calculate styles directly without state updates
          const flipProgress = Math.min(1, scrollY / 300);
          const rotateY = flipProgress * 180;
          const logoOpacity = Math.max(0, 1 - scrollY / 250);
          const logoScale = Math.max(0.4, 1 - scrollY / 400);
          const logoVisible = scrollY < 400;
          
          // Update container height
          containerRef.current.style.height = logoVisible ? '110px' : '0px';
          
          // Update logo transform and opacity
          if (scrollY > 0) {
            logoRef.current.style.opacity = logoOpacity.toString();
            logoRef.current.style.transform = `perspective(1000px) rotateY(${rotateY}deg) scale(${logoScale})`;
            logoRef.current.style.transition = 'opacity 0.1s ease-out, transform 0.1s ease-out';
          } else {
            // Reset to initial state
            logoRef.current.style.opacity = '1';
            logoRef.current.style.transform = `perspective(1000px) rotateY(0deg) scale(1)`;
            logoRef.current.style.transition = 'opacity 0.6s ease-out, transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
          }
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, []); // No dependencies needed as we use refs

  // Initial spin-in animation (only on first load)
  const initialSpin = hasLoaded ? 0 : -360;
  
  return (
    <div 
      ref={containerRef}
      className="w-full flex justify-center items-start transition-all duration-200"
      style={{ 
        height: '110px', // Default height
        overflow: 'hidden',
        paddingTop: '16px',
        paddingBottom: '4px',
        perspective: '1000px', // Enable 3D perspective
      }}
    >
      <div
        ref={logoRef}
        style={{ 
          opacity: hasLoaded ? 1 : 0, 
          transform: `perspective(1000px) rotateY(${initialSpin}deg) scale(1)`, 
          transformStyle: 'preserve-3d',
          transition: 'opacity 0.6s ease-out, transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          willChange: 'transform, opacity' // Hint to browser for optimization
        }}
      >
        <img 
          src="/assets/badges/totl-logo1.svg" 
          alt="TOTL" 
          className="h-[74px] sm:h-[92px]"
          style={{ filter: 'brightness(0)', backfaceVisibility: 'hidden' }}
        />
      </div>
    </div>
  );
}
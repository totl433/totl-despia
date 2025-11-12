import { useState, useEffect } from 'react';

export default function ScrollLogo() {
  const [scrollY, setScrollY] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  // Handle initial load animation
  useEffect(() => {
    // Trigger spin-in animation after component mounts
    const timer = setTimeout(() => {
      setHasLoaded(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);
  
  // Handle scroll for logo animation
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate flip progress (0 to 1)
  const flipProgress = Math.min(1, scrollY / 300); // Complete flip over 300px
  
  // 3D flip rotation (0 to 180 degrees)
  const rotateY = flipProgress * 180; // Flips from 0° to 180°
  
  // Fade out as it flips
  const logoOpacity = Math.max(0, 1 - scrollY / 250); // Fade out over 250px
  
  // Slight scale down during flip
  const logoScale = Math.max(0.4, 1 - scrollY / 400); // Shrink slightly
  
  const logoVisible = scrollY < 400; // Hide completely after 400px

  // Initial spin-in animation (only on first load)
  const initialSpin = hasLoaded ? 0 : -360; // Start rotated -360deg, then spin to 0deg
  
  return (
    <div 
      className="w-full flex justify-center items-start transition-all duration-200"
      style={{ 
        height: logoVisible ? '110px' : '0px',
        overflow: 'hidden',
        paddingTop: '16px',
        paddingBottom: '4px',
        perspective: '1000px', // Enable 3D perspective
      }}
    >
      <div
        style={{ 
          opacity: scrollY === 0 ? (hasLoaded ? 1 : 0) : logoOpacity, // Fade in on load, then use scroll opacity
          transform: scrollY === 0 
            ? `perspective(1000px) rotateY(${initialSpin}deg) scale(1)` // Spin in on load
            : `perspective(1000px) rotateY(${rotateY}deg) scale(${logoScale})`, // Scroll flip effect
          transformStyle: 'preserve-3d',
          transition: scrollY === 0 
            ? 'opacity 0.6s ease-out, transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' // Smooth spin-in
            : 'opacity 0.2s ease-out, transform 0.2s ease-out', // Scroll transitions
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


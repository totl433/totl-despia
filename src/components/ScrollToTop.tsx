import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop component - ensures page always loads at the top on navigation
 * This is critical for React Router apps where scroll position can persist.
 * Works for both eagerly and lazily loaded pages.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready (especially for lazy-loaded pages)
    // This runs after the browser has painted, ensuring the scroll happens at the right time
    const scrollToTop = () => {
      // Scroll window to top immediately (no animation)
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      
      // Also ensure document and html elements are at top (for edge cases and browser compatibility)
      if (document.documentElement) {
        document.documentElement.scrollTop = 0;
      }
      if (document.body) {
        document.body.scrollTop = 0;
      }
      
      // For iOS Safari and other mobile browsers, also check pageYOffset
      if (window.pageYOffset !== 0) {
        window.scrollTo(0, 0);
      }
    };
    
    // Run immediately
    scrollToTop();
    
    // Also run after a frame to catch any lazy-loaded content that might shift the page
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToTop);
    });
    
    // Final check after a short delay for lazy-loaded pages
    const timeoutId = setTimeout(scrollToTop, 100);
    
    return () => clearTimeout(timeoutId);
  }, [pathname]);

  return null;
}


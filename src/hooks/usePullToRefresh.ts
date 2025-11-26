import { useEffect, useRef, useState, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  enabled?: boolean;
  threshold?: number; // Distance in pixels to trigger refresh
  maxPullDistance?: number; // Maximum pull distance
  enableMouse?: boolean; // Enable mouse drag for testing in desktop browsers
}

interface PullToRefreshState {
  isPulling: boolean;
  pullDistance: number;
  isRefreshing: boolean;
}

export function usePullToRefresh({
  onRefresh,
  enabled = true,
  threshold = 80,
  maxPullDistance = 120,
  enableMouse = false, // Disabled by default - only for testing
}: UsePullToRefreshOptions) {
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    pullDistance: 0,
    isRefreshing: false,
  });

  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const scrollTopRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isRefreshingRef = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    
    isRefreshingRef.current = true;
    setState(prev => ({ ...prev, isRefreshing: true, pullDistance: 0 }));
    
    try {
      await onRefresh();
    } finally {
      // Small delay to show completion state
      setTimeout(() => {
        isRefreshingRef.current = false;
        setState(prev => ({ ...prev, isRefreshing: false, isPulling: false, pullDistance: 0 }));
      }, 300);
    }
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) {
      // Container not ready yet, try again on next render
      return;
    }

    const getScrollTop = () => {
      // For Despia native apps, scrolling is typically on window/document
      // Check multiple sources to be robust
      if (typeof window !== 'undefined') {
        return window.pageYOffset || 
               document.documentElement.scrollTop || 
               document.body.scrollTop || 
               container.scrollTop || 
               0;
      }
      return container.scrollTop || 0;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current) return;
      if (e.touches.length !== 1) return; // Only handle single touch
      
      // Don't interfere with clicks on links, buttons, or other interactive elements
      const target = e.target as HTMLElement;
      if (target) {
        // Check if target is a link, button, or inside a link/button
        const isInteractive = target.closest('a, button, [role="button"], [onClick]');
        if (isInteractive) {
          return; // Let the click/tap go through
        }
      }
      
      scrollTopRef.current = getScrollTop();
      
      // Only start pull if at the top of the scroll (with small tolerance for native apps)
      // Check if touch is within container or allow from anywhere if at top
      const targetNode = e.target as Node;
      const isInContainer = container.contains(targetNode) || container === targetNode;
      
      if (scrollTopRef.current <= 5 && isInContainer) {
        touchStartY.current = e.touches[0].clientY;
        touchStartX.current = e.touches[0].clientX;
        setState(prev => ({ ...prev, isPulling: true }));
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshingRef.current || touchStartY.current === null) return;
      if (e.touches.length !== 1) return; // Only handle single touch
      
      // Don't interfere with clicks on links, buttons, or other interactive elements
      const target = e.target as HTMLElement;
      if (target) {
        const isInteractive = target.closest('a, button, [role="button"], [onClick]');
        if (isInteractive) {
          // Reset pull state and let the interaction go through
          touchStartY.current = null;
          touchStartX.current = null;
          setState(prev => ({ ...prev, isPulling: false, pullDistance: 0 }));
          return;
        }
      }
      
      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - touchStartY.current;
      const deltaX = touchStartX.current !== null ? Math.abs(currentX - touchStartX.current) : 0;
      
      // Update scroll position (check continuously for native apps)
      scrollTopRef.current = getScrollTop();
      
      // Only allow downward pull when at top (with tolerance)
      // Allow pull even if there's some horizontal movement (for horizontal scroll areas)
      if (scrollTopRef.current <= 5 && deltaY > 0 && deltaY > Math.abs(deltaX) * 0.5) {
        // Prevent default scrolling while pulling (but allow horizontal scroll if needed)
        if (deltaY > 10) { // Only prevent after some vertical movement
          e.preventDefault();
          e.stopPropagation();
        }
        
        // Calculate pull distance with resistance (easing)
        const rawDistance = deltaY;
        const resistance = 0.5; // Makes it harder to pull further
        const distance = Math.min(
          rawDistance * resistance,
          maxPullDistance
        );
        
        setState(prev => ({ ...prev, pullDistance: distance }));
      } else if (deltaY <= 0 || scrollTopRef.current > 5) {
        // User scrolled back up or page scrolled, reset
        touchStartY.current = null;
      touchStartX.current = null;
        setState(prev => ({ ...prev, isPulling: false, pullDistance: 0 }));
      }
    };

    const handleTouchEnd = () => {
      if (isRefreshingRef.current) return;
      
      if (touchStartY.current !== null && state.pullDistance >= threshold) {
        handleRefresh();
      } else {
        // Reset if didn't reach threshold
        setState(prev => ({ ...prev, isPulling: false, pullDistance: 0 }));
      }
      
      touchStartY.current = null;
      touchStartX.current = null;
    };

    // Add touch event listeners
    // For Despia native apps, we need to listen on document/window level
    // but still check if the touch started within our container
    const handleTouchStartWrapper = (e: TouchEvent) => {
      // Check if touch is within container or its children
      const target = e.target as Node;
      if (container.contains(target) || container === target) {
        handleTouchStart(e);
      }
    };

    const handleTouchMoveWrapper = (e: TouchEvent) => {
      // Always handle move if we're in a pull state (for native apps)
      if (touchStartY.current !== null) {
        handleTouchMove(e);
      }
    };

    // Mouse handlers for desktop testing (only if enabled)
    const handleMouseDown = (e: MouseEvent) => {
      if (!enableMouse) return;
      if (container.contains(e.target as Node) || container === e.target) {
        scrollTopRef.current = getScrollTop();
        if (scrollTopRef.current <= 0) {
          touchStartY.current = e.clientY;
          setState(prev => ({ ...prev, isPulling: true }));
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!enableMouse || touchStartY.current === null) return;
      const currentY = e.clientY;
      const deltaY = currentY - touchStartY.current;
      scrollTopRef.current = getScrollTop();
      
      if (scrollTopRef.current <= 0 && deltaY > 0) {
        e.preventDefault();
        const rawDistance = deltaY;
        const resistance = 0.5;
        const distance = Math.min(rawDistance * resistance, maxPullDistance);
        setState(prev => ({ ...prev, pullDistance: distance }));
      } else if (deltaY <= 0 || scrollTopRef.current > 0) {
        touchStartY.current = null;
      touchStartX.current = null;
        setState(prev => ({ ...prev, isPulling: false, pullDistance: 0 }));
      }
    };

    const handleMouseUp = () => {
      if (!enableMouse) return;
      if (touchStartY.current !== null && state.pullDistance >= threshold) {
        handleRefresh();
      } else {
        setState(prev => ({ ...prev, isPulling: false, pullDistance: 0 }));
      }
      touchStartY.current = null;
      touchStartX.current = null;
    };

    // For Despia native apps, attach to document for better touch handling
    // This ensures we catch touches even when scrolling happens at window level
    const useDocumentEvents = typeof window !== 'undefined' && 
                              (window.navigator?.userAgent?.includes('Mobile') || 
                               !!(window as any).despia || 
                               !!(window as any).__DESPIA__); // Detect Despia or mobile
    
    if (useDocumentEvents) {
      // Native app or mobile - use document level events
      document.addEventListener('touchstart', handleTouchStartWrapper, { passive: false });
      document.addEventListener('touchmove', handleTouchMoveWrapper, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, { passive: true });
      document.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    } else {
      // Web browser - use container level events
      container.addEventListener('touchstart', handleTouchStartWrapper, { passive: false });
      container.addEventListener('touchmove', handleTouchMoveWrapper, { passive: false });
      container.addEventListener('touchend', handleTouchEnd, { passive: true });
      container.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    }

    if (enableMouse) {
      container.addEventListener('mousedown', handleMouseDown);
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('mouseleave', handleMouseUp);
    }

    return () => {
      const useDocumentEvents = typeof window !== 'undefined' && 
                                (window.navigator?.userAgent?.includes('Mobile') || 
                                 !!(window as any).despia || 
                                 !!(window as any).__DESPIA__);
      
      if (useDocumentEvents) {
        document.removeEventListener('touchstart', handleTouchStartWrapper);
        document.removeEventListener('touchmove', handleTouchMoveWrapper);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', handleTouchEnd);
      } else {
        container.removeEventListener('touchstart', handleTouchStartWrapper);
        container.removeEventListener('touchmove', handleTouchMoveWrapper);
        container.removeEventListener('touchend', handleTouchEnd);
        container.removeEventListener('touchcancel', handleTouchEnd);
      }
      
      if (enableMouse) {
        container.removeEventListener('mousedown', handleMouseDown);
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('mouseleave', handleMouseUp);
      }
    };
  }, [enabled, state.pullDistance, threshold, maxPullDistance, handleRefresh]);

  // Calculate rotation and opacity for spinner
  const pullProgress = Math.min(state.pullDistance / threshold, 1);
  const spinnerRotation = pullProgress * 360;
  const spinnerOpacity = Math.min(pullProgress * 2, 1); // Fade in faster

  return {
    containerRef,
    pullDistance: state.pullDistance,
    isPulling: state.isPulling,
    isRefreshing: state.isRefreshing,
    pullProgress,
    spinnerRotation,
    spinnerOpacity,
    shouldShowIndicator: state.pullDistance > 10, // Show indicator after 10px pull
  };
}


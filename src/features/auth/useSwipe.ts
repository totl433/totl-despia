/**
 * Swipe gesture hook for touch + pointer events
 * Supports horizontal swipe with threshold detection
 */
import { useRef, useCallback } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  isDragging: boolean;
}

const SWIPE_THRESHOLD = 40; // Minimum px to commit swipe
const ANGLE_THRESHOLD = 0.5; // Max ratio of vertical to horizontal movement

export function useSwipe(handlers: SwipeHandlers) {
  const stateRef = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    isDragging: false,
  });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    stateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      isDragging: true,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!stateRef.current.isDragging) return;
    stateRef.current.currentX = e.clientX;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!stateRef.current.isDragging) return;
    
    const { startX, startY } = stateRef.current;
    const endX = e.clientX;
    const endY = e.clientY;
    
    const deltaX = endX - startX;
    const deltaY = Math.abs(endY - startY);
    
    // Check if movement is mostly horizontal
    if (deltaY / Math.abs(deltaX) > ANGLE_THRESHOLD) {
      stateRef.current.isDragging = false;
      return;
    }
    
    // Check threshold
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
      if (deltaX < 0 && handlers.onSwipeLeft) {
        handlers.onSwipeLeft();
      } else if (deltaX > 0 && handlers.onSwipeRight) {
        handlers.onSwipeRight();
      }
    }
    
    stateRef.current.isDragging = false;
  }, [handlers]);

  const onPointerCancel = useCallback(() => {
    stateRef.current.isDragging = false;
  }, []);

  // Keyboard support for accessibility
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && handlers.onSwipeRight) {
      handlers.onSwipeRight();
    } else if (e.key === 'ArrowRight' && handlers.onSwipeLeft) {
      handlers.onSwipeLeft();
    }
  }, [handlers]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onKeyDown,
    // For touch-specific handling
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      stateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        isDragging: true,
      };
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (!stateRef.current.isDragging) return;
      stateRef.current.currentX = e.touches[0].clientX;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!stateRef.current.isDragging) return;
      
      const { startX, startY } = stateRef.current;
      const touch = e.changedTouches[0];
      const endX = touch.clientX;
      const endY = touch.clientY;
      
      const deltaX = endX - startX;
      const deltaY = Math.abs(endY - startY);
      
      if (deltaY / Math.abs(deltaX) > ANGLE_THRESHOLD) {
        stateRef.current.isDragging = false;
        return;
      }
      
      if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
        if (deltaX < 0 && handlers.onSwipeLeft) {
          handlers.onSwipeLeft();
        } else if (deltaX > 0 && handlers.onSwipeRight) {
          handlers.onSwipeRight();
        }
      }
      
      stateRef.current.isDragging = false;
    },
  };
}

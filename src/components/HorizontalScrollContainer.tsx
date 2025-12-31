import type { ReactNode } from 'react';

interface HorizontalScrollContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Reusable horizontal scroll container with hidden scrollbar
 * Used for leaderboards and mini leagues sections
 */
export function HorizontalScrollContainer({ children, className = '' }: HorizontalScrollContainerProps) {
  return (
    <div 
      className={`overflow-x-auto overflow-y-visible scrollbar-hide ${className}`}
      style={{ 
        scrollbarWidth: 'none', 
        msOverflowStyle: 'none', 
        WebkitOverflowScrolling: 'touch', 
        overscrollBehaviorX: 'contain',
        overscrollBehaviorY: 'auto',
        touchAction: 'pan-x pan-y pinch-zoom',
        marginLeft: '-1rem',
        marginRight: '-1rem',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        paddingTop: '0.5rem', // Add top padding to prevent header clipping
        paddingBottom: '0.5rem', // Add bottom padding for consistency
        width: 'calc(100% + 2rem)'
      }}
    >
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
      <div className="flex gap-2" style={{ width: 'max-content', minWidth: '100%' }}>
        {children}
      </div>
    </div>
  );
}


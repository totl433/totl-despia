import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export type FirstVisitInfoBannerProps = {
  /** Unique key for localStorage tracking (e.g., 'leaderboardFirstVisit') */
  storageKey: string;
  /** Main message text */
  message: string;
  /** Callback when banner is dismissed (either temporarily or permanently) */
  onDismiss?: () => void;
  /** Custom className for styling */
  className?: string;
  /** Custom image source. Defaults to Volley-Tool-Tip.png */
  imageSrc?: string;
};

/**
 * Reusable overlay popup component that shows on first visit to a page/feature.
 * Uses localStorage to track if the banner has been permanently dismissed.
 * 
 * Features:
 * - Close button (X): Dismisses for current session only
 * - "Don't show again": Permanently dismisses using localStorage
 * - Overlay backdrop that can be clicked to dismiss
 * - Escape key to dismiss
 */
export default function FirstVisitInfoBanner({
  storageKey,
  message,
  onDismiss,
  className = '',
  imageSrc = '/assets/Volley/Volley-Tool-Tip.png',
}: FirstVisitInfoBannerProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has permanently dismissed this banner
    const hasDismissedPermanently = localStorage.getItem(storageKey);
    if (!hasDismissedPermanently) {
      setIsVisible(true);
    }
  }, [storageKey]);

  // Close on escape key
  useEffect(() => {
    if (!isVisible) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVisible]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  const handleClose = () => {
    // Hide for this session only (don't set permanent flag)
    setIsVisible(false);
    onDismiss?.();
  };

  const handleDontShowAgain = () => {
    // Hide permanently
    localStorage.setItem(storageKey, 'true');
    setIsVisible(false);
    onDismiss?.();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking the backdrop itself, not the popup content
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isVisible) return null;

  const content = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
        style={{
          animation: 'fadeIn 200ms ease-out',
          zIndex: 999999,
        }}
      />
      
      {/* Popup */}
      <div
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl max-w-md w-[90%] mx-auto ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-visit-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'popIn 300ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          zIndex: 1000000,
        }}
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes popIn {
            0% {
              transform: translate(-50%, -50%) scale(0.8);
              opacity: 0;
            }
            50% {
              transform: translate(-50%, -50%) scale(1.05);
            }
            100% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
          }
        `}</style>

        {/* Content */}
        <div className="px-6 pt-3 pb-6">
          <div className="flex items-start gap-4">
            {/* Message */}
            <div className="flex-1 min-w-0">
              <div className="flex items-end gap-3 mb-6 mt-2">
                {/* Icon Image - bigger, inline with content */}
                <img 
                  src={imageSrc} 
                  alt="" 
                  className="w-32 h-32 object-contain flex-shrink-0"
                  style={{ imageRendering: 'pixelated' }}
                  onError={(e) => {
                    console.error('[FirstVisitInfoBanner] Failed to load image:', imageSrc);
                    // Fallback to default if custom image fails
                    if (imageSrc !== '/assets/Volley/Volley-Tool-Tip.png') {
                      (e.currentTarget as HTMLImageElement).src = '/assets/Volley/Volley-Tool-Tip.png';
                    }
                  }}
                />
                <p id="first-visit-title" className="text-sm text-slate-700 leading-relaxed">
                  <span className="font-semibold text-slate-900">Quick tip:</span> {message}
                </p>
              </div>
              
              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleClose}
                  className="w-full px-4 py-2.5 bg-[#1C8376] text-white rounded-lg font-medium hover:bg-[#1C8376]/90 transition-colors"
                >
                  Got it
                </button>
                
                <button
                  onClick={handleDontShowAgain}
                  className="text-sm text-slate-600 hover:text-slate-800 underline transition-colors text-center"
                >
                  Don't show this again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // Render to document.body using portal to ensure it's above everything
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }
  
  return content;
}


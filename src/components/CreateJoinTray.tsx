import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

export type CreateJoinTrayProps = {
  isOpen: boolean;
  onClose: () => void;
  joinCode: string;
  setJoinCode: (code: string) => void;
  onJoin: () => void;
  joinError?: string;
};

export default function CreateJoinTray({
  isOpen,
  onClose,
  joinCode,
  setJoinCode,
  onJoin,
  joinError,
}: CreateJoinTrayProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Handle backdrop clicks using React's synthetic events (avoids passive listener warnings)
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'CreateJoinTray.tsx:backdrop-click',
        message: 'Backdrop clicked',
        data: {
          target: (e.target as HTMLElement)?.tagName,
          currentTarget: (e.currentTarget as HTMLElement)?.tagName,
          targetId: (e.target as HTMLElement)?.id,
          targetClassName: (e.target as HTMLElement)?.className,
          isBackdrop: e.target === e.currentTarget,
          sheetContains: sheetRef.current?.contains(e.target as Node)
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'F'
      })
    }).catch(() => {});
    // #endregion
    
    // Only close if clicking directly on backdrop, not on sheet or its children
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/50"
        onClick={handleBackdropClick}
        aria-hidden="true"
        style={{
          animation: 'fadeIn 200ms ease-out',
          zIndex: 999999,
          touchAction: 'manipulation',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-join-tray-title"
        onClick={(e) => {
          // Only stop propagation if clicking on the sheet itself, not on interactive elements
          const target = e.target as HTMLElement;
          const isInteractive = target.tagName === 'BUTTON' || 
                               target.tagName === 'A' || 
                               target.tagName === 'INPUT' ||
                               target.closest('button') !== null ||
                               target.closest('a') !== null ||
                               target.closest('input') !== null;
          
          // Only stop propagation if clicking on non-interactive parts of the sheet
          if (!isInteractive) {
            e.stopPropagation();
          }
        }}
        style={{
          animation: 'slideUp 300ms ease-out',
          zIndex: 1000000,
          touchAction: 'manipulation',
        }}
      >
        {/* Top handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4">
          <h2
            id="create-join-tray-title"
            className="text-lg font-medium text-slate-900 uppercase tracking-wide"
            style={{ fontFamily: '"Gramatika", sans-serif', fontWeight: 700 }}
          >
            Create or Join
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full touch-manipulation"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-8 max-h-[70vh] overflow-y-auto">
          <div className="space-y-6">
            {/* Create Section */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 mb-3">Create a league</h3>
              <Link
                to="/create-league"
                onClick={() => {
                  onClose();
                }}
                className="block w-full px-4 py-3 bg-[#1C8376] text-white font-semibold rounded-lg text-center no-underline hover:bg-[#156b60] transition-colors touch-manipulation"
              >
                Create League
              </Link>
            </div>

            {/* Join Section */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 mb-3">Join with code</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  className="border rounded-lg px-3 py-2 w-full uppercase tracking-widest bg-white"
                  placeholder="ABCDE"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && joinCode.trim()) {
                      onJoin();
                    }
                  }}
                  maxLength={5}
                />
                {joinError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                    {joinError}
                  </div>
                )}
                <button
                  onClick={onJoin}
                  disabled={!joinCode.trim()}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors touch-manipulation"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom handle */}
        <div className="flex justify-center pb-3">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
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


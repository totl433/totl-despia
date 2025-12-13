import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export type InfoSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
};

export default function InfoSheet({ isOpen, onClose, title, description }: InfoSheetProps) {
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
        style={{
          animation: 'fadeIn 200ms ease-out',
          zIndex: 100000,
        }}
      />
      
      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-sheet-title"
        aria-describedby="info-sheet-description"
        style={{
          animation: 'slideUp 300ms ease-out',
          zIndex: 100001,
        }}
      >
        {/* Top handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4">
          <h2 id="info-sheet-title" className="text-lg font-medium text-slate-900 uppercase tracking-wide" style={{ fontFamily: '"Gramatika", sans-serif', fontWeight: 700 }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
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
          <div id="info-sheet-description" className="text-slate-600 leading-relaxed">
            {(() => {
              // Split on newlines and filter empty lines
              const paragraphs = description
                .split(/\n+/)
                .map(line => line.trim())
                .filter(line => line.length > 0);
              
              return paragraphs.map((paragraph, index) => {
                // Check if paragraph contains "How To Play →"
                if (paragraph.includes('How To Play →')) {
                  const parts = paragraph.split('How To Play →');
                  return (
                    <p key={index} className={index === 0 ? '' : 'mt-4'}>
                      {parts[0]}
                      <Link
                        to="/how-to-play"
                        onClick={onClose}
                        className="text-[#1C8376] font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        How To Play →
                      </Link>
                    </p>
                  );
                }
                return (
                  <p key={index} className={index === 0 ? '' : 'mt-4'}>
                    {paragraph}
                  </p>
                );
              });
            })()}
          </div>
        </div>

        {/* Bottom handle */}
        <div className="flex justify-center pb-3">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
        </div>
      </div>
    </>
  );
}

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  fileName: string;
  gw: number;
  userName: string;
}

export default function ShareSheet({
  isOpen,
  onClose,
  imageUrl,
  fileName,
  gw,
  userName,
}: ShareSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

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

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  // Handle share - opens generic iOS share sheet with image
  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const shareText = `Check out my Gameweek ${gw} predictions! ${userName}`;
      
      // Load image into Image element to ensure proper format for iOS thumbnail
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Wait for image to load
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });
      
      // Create canvas and draw image to ensure proper format
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      // Draw image to canvas
      ctx.drawImage(img, 0, 0);
      
      // Convert canvas to blob with proper PNG format
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        }, 'image/png', 1.0);
      });
      
      // Create File with proper metadata - iOS will generate thumbnail from properly formatted PNG
      const file = new File([blob], fileName, { 
        type: 'image/png',
        lastModified: Date.now()
      });
      
      // Use Web Share API with image file - opens share sheet with image included and thumbnail
      const nav = navigator as Navigator & { 
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data: { files?: File[] }) => boolean;
      };
      
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({
            title: `${userName}'s Predictions - TOTL Gameweek ${gw}`,
            text: shareText,
            files: [file],
          });
          onClose();
          return;
        } catch (shareError: any) {
          if (shareError.name === 'AbortError') {
            return; // User cancelled
          }
          // Fall through to download
        }
      }
      
      // Fallback: download image
      handleDownload();
    } catch (error: any) {
      console.error('Share failed:', error);
      handleDownload();
    }
  };


  // Handle download
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onClose();
  };

  if (!isOpen) return null;

  const content = (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[999998]"
        onClick={handleBackdropClick}
        style={{
          animation: 'fadeIn 200ms ease-out',
        }}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-[999999] rounded-t-3xl shadow-2xl"
        style={{
          backgroundColor: '#f5f7f6',
          animation: 'slideUp 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Handle bar with close button */}
        <div className="flex items-center justify-between pt-3 pb-2 px-4 flex-shrink-0">
          <div className="flex-1 flex justify-center">
            <div className="w-12 h-1 bg-slate-300 rounded-full" />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 active:bg-slate-300 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Generated image preview - flex to fill available space */}
        <div className="px-4 flex-1 min-h-0 flex items-center justify-center overflow-visible" style={{ position: 'relative' }}>
          <img
            src={imageUrl}
            alt={`Gameweek ${gw} predictions`}
            className="rounded-2xl"
            style={{ 
              maxHeight: 'calc(90vh - 250px)',
              maxWidth: '100%',
              height: 'auto',
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            }}
          />
        </div>

        {/* Share button - always at bottom */}
        <div className="px-4 flex-shrink-0" style={{ paddingTop: '1rem', paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}>
          <button
            onClick={handleShare}
            className="w-full bg-[#1C8376] text-white font-semibold py-3 px-6 rounded-xl hover:bg-emerald-700 active:bg-emerald-800 transition-colors touch-manipulation flex items-center justify-center gap-2"
            style={{ 
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label="Share"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span>Share</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );

  // Render to document.body using portal
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }

  return content;
}


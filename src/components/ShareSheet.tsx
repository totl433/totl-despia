import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { openWhatsApp } from '../lib/whatsappShare';

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

  // Handle WhatsApp share - try Web Share API with image first, then fallback to deep link
  const handleWhatsAppShare = async () => {
    try {
      // First try Web Share API with image file (works in Despia if supported)
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      
      const nav = navigator as Navigator & { 
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data: { files?: File[] }) => boolean;
      };
      
      // Try sharing with image file if supported
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({
            title: `TOTL Gameweek ${gw} - ${userName}`,
            text: `Check out my Gameweek ${gw} predictions!`,
            files: [file],
          });
          onClose();
          return;
        } catch (shareError: any) {
          if (shareError.name === 'AbortError') {
            return; // User cancelled
          }
          // Fall through to deep link if file sharing fails
          console.log('[Share] Web Share API with file failed, trying WhatsApp deep link');
        }
      }
      
      // Fallback: Use WhatsApp deep link with text (image will download for manual attach)
      const shareText = `Check out my Gameweek ${gw} predictions! ${userName}`;
      openWhatsApp(shareText);
      // Download image so user can attach it manually
      setTimeout(() => {
        handleDownload();
      }, 500);
      onClose();
    } catch (error) {
      console.error('WhatsApp share failed:', error);
      handleDownload();
    }
  };

  // Handle share via Web Share API (for Messages, Instagram, More) - try with image file first
  const handleWebShare = async () => {
    try {
      // First try Web Share API with image file (works in Despia if supported)
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      
      const nav = navigator as Navigator & { 
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data: { files?: File[] }) => boolean;
      };
      
      // Try sharing with image file if supported
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({
            title: `TOTL Gameweek ${gw} - ${userName}`,
            text: `Check out my Gameweek ${gw} predictions!`,
            files: [file],
          });
          onClose();
          return;
        } catch (shareError: any) {
          if (shareError.name === 'AbortError') {
            return; // User cancelled
          }
          // Fall through to text-only share if file sharing fails
          console.log('[Share] Web Share API with file failed, trying text-only');
        }
      }
      
      // Fallback: Try Web Share API with text only
      if (nav.share) {
        try {
          await nav.share({ 
            title: `TOTL Gameweek ${gw} - ${userName}`, 
            text: `Check out my Gameweek ${gw} predictions!` 
          });
          // Download image so user can attach manually
          handleDownload();
          onClose();
          return;
        } catch (shareError: any) {
          if (shareError.name === 'AbortError') {
            return; // User cancelled
          }
          // Fall through to download
        }
      }
      
      // Final fallback: download
      handleDownload();
    } catch (error: any) {
      console.error('Share failed:', error);
      handleDownload();
    }
  };

  // Handle copy image
  const handleCopyImage = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      // Try modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.write) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob,
            }),
          ]);
          onClose();
          return;
        } catch (clipError) {
          // Fall through to download if clipboard API fails
        }
      }
      
      // Fallback: Download the image
      handleDownload();
    } catch (error) {
      console.error('Failed to copy image:', error);
      // Fallback to download
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

        {/* Share options - always at bottom */}
        <div className="px-4 flex-shrink-0" style={{ paddingTop: '1rem', paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}>
          <div className="text-sm font-semibold text-slate-700 mb-3">Share to</div>
          <div className="grid grid-cols-5 gap-2">
            {/* WhatsApp */}
            <button
              onClick={handleWhatsAppShare}
              className="flex flex-col items-center justify-start gap-1 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors touch-manipulation"
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                padding: '8px 4px 16px 4px',
                minHeight: 'auto',
              }}
              aria-label="Share via WhatsApp"
            >
              <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0 mb-1">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
              <span className="text-[11px] text-slate-600 font-medium text-center leading-tight" style={{ whiteSpace: 'nowrap', display: 'block' }}>WhatsApp</span>
            </button>

            {/* Messages */}
            <button
              onClick={handleWebShare}
              className="flex flex-col items-center justify-start gap-1 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors touch-manipulation"
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                padding: '8px 4px 16px 4px',
                minHeight: 'auto',
              }}
              aria-label="Share via Messages"
            >
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mb-1">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="text-[11px] text-slate-600 font-medium text-center leading-tight" style={{ whiteSpace: 'nowrap', display: 'block' }}>Message</span>
            </button>

            {/* Instagram */}
            <button
              onClick={handleWebShare}
              className="flex flex-col items-center justify-start gap-1 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors touch-manipulation"
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                padding: '8px 4px 16px 4px',
                minHeight: 'auto',
              }}
              aria-label="Share via Instagram"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center flex-shrink-0 mb-1">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.439-1.439-1.439z"/>
                </svg>
              </div>
              <span className="text-[11px] text-slate-600 font-medium text-center leading-tight" style={{ whiteSpace: 'nowrap', display: 'block' }}>Instagram</span>
            </button>

            {/* Copy Link */}
            <button
              onClick={handleCopyImage}
              className="flex flex-col items-center justify-start gap-1 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors touch-manipulation"
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                padding: '8px 4px 16px 4px',
                minHeight: 'auto',
              }}
              aria-label="Copy image"
            >
              <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0 mb-1">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-[11px] text-slate-600 font-medium text-center leading-tight" style={{ whiteSpace: 'nowrap', display: 'block' }}>Copy</span>
            </button>

            {/* More options */}
            <button
              onClick={handleWebShare}
              className="flex flex-col items-center justify-start gap-1 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors touch-manipulation"
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                padding: '8px 4px 16px 4px',
                minHeight: 'auto',
              }}
              aria-label="More share options"
            >
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mb-1">
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </div>
              <span className="text-[11px] text-slate-600 font-medium text-center leading-tight" style={{ whiteSpace: 'nowrap', display: 'block' }}>More</span>
            </button>
          </div>
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


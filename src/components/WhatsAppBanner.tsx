import { useState, useEffect } from 'react';

export default function WhatsAppBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showFirstMessage, setShowFirstMessage] = useState(false);
  const [showSecondMessage, setShowSecondMessage] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [showFooterLinks, setShowFooterLinks] = useState(false);
  
  useEffect(() => {
    // Check if user has dismissed the banner permanently
    const hasSeenBanner = localStorage.getItem('whatsappBannerSeen');
    if (!hasSeenBanner) {
      setIsVisible(true);
    }
  }, []);

  // Message pop-up effects
  useEffect(() => {
    if (!isVisible) return;
    
    // Show first message immediately
    setShowFirstMessage(true);
    
    // Show second message after delay
    const delay1 = setTimeout(() => {
      setShowSecondMessage(true);
    }, 400);

    // Show button after both messages
    const delay2 = setTimeout(() => {
      setShowButton(true);
    }, 800);

    // Show footer links after button
    const delay3 = setTimeout(() => {
      setShowFooterLinks(true);
    }, 2000);

    return () => {
      clearTimeout(delay1);
      clearTimeout(delay2);
      clearTimeout(delay3);
    };
  }, [isVisible]);

  const handleJoin = () => {
    // Open WhatsApp link
    window.open('https://chat.whatsapp.com/G2siRAr22kR2tOAcYAkLTp', '_blank');
    // Mark as seen so it doesn't show again
    localStorage.setItem('whatsappBannerSeen', 'true');
    setIsVisible(false);
  };

  const handleMaybeLater = () => {
    // Hide for this session only (don't set permanent flag)
    setIsVisible(false);
  };

  const handleDontShowAgain = () => {
    // Hide permanently
    localStorage.setItem('whatsappBannerSeen', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <>
      <style>{`
        @keyframes bounceIn {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
          70% {
            transform: scale(0.9);
            opacity: 0.9;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-bounce-in {
          animation: bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) both;
        }
        .animate-bounce-in-delayed {
          animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.4s both;
        }
        .animate-bounce-in-button {
          animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.8s both;
        }
      `}</style>
      <div className="p-4 mb-4 rounded-lg shadow-lg h-[220px]" style={{backgroundColor: '#1C8376'}}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 min-h-[60px]">
            <div className="flex justify-start">
              {showFirstMessage && (
                <div className="bg-white rounded-2xl rounded-bl-md px-4 py-2 shadow-sm max-w-xs animate-bounce-in">
                  <h3 className="text-gray-800 font-medium text-sm">
                    🎉 We're on WhatsApp! 💬 ⚽
                  </h3>
                </div>
              )}
            </div>
            
            <div className="flex justify-end">
              {showSecondMessage && (
                <div className="bg-white rounded-2xl rounded-br-md px-4 py-2 shadow-sm animate-bounce-in-delayed">
                  <h3 className="text-gray-800 font-medium text-sm">
                    Never miss a Gameweek - join for<br className="sm:hidden" /> instant alerts 🔔 📢 🎯
                  </h3>
                </div>
              )}
            </div>
          </div>
          
          {showButton && (
            <div className="flex justify-center animate-bounce-in-button">
              <button
                onClick={handleJoin}
                className="bg-white hover:bg-gray-100 px-6 py-3 rounded-full text-sm font-semibold transition-colors shadow-md flex items-center gap-2"
                style={{color: '#1C8376'}}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" fill="#25D366"/>
                </svg>
                Get Alerts
              </button>
            </div>
          )}
          
          {showFooterLinks && (
            <div className="flex items-center justify-center gap-4 pb-4">
              <button
                onClick={handleMaybeLater}
                className="text-white/80 hover:text-white text-xs transition-colors underline"
              >
                Maybe Later
              </button>
              <button
                onClick={handleDontShowAgain}
                className="text-white/80 hover:text-white text-xs transition-colors underline"
                title="Don't show again"
              >
                Don't show again
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
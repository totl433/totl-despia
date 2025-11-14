import { useNavigate, useLocation } from 'react-router-dom';
import { useRef, useEffect, useState } from 'react';

const navItems = [
    {
      name: 'Home',
      path: '/',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-7 h-7">
          <g>
            <path fill="currentColor" d="M10.7876 3.66609c0.7159 -0.54548 1.7088 -0.54542 2.4248 0l9.0537 6.89841c0.4392 0.3347 0.524 0.9621 0.1895 1.4014 -0.3347 0.4391 -0.9622 0.524 -1.4014 0.1894l-1.0537 -0.8037v7.6485c0 1.1045 -0.8955 1.9999 -2 2h-4.001c-0.5521 -0.0002 -1 -0.4479 -1 -1v-5h-2v5c0 0.5522 -0.4478 0.9999 -0.99999 1H6.00049c-1.10455 0 -1.99996 -0.8955 -2 -2v-7.6485l-1.05371 0.8037c-0.4393 0.3346 -1.06768 0.2498 -1.40235 -0.1894 -0.3343 -0.4391 -0.24936 -1.0667 0.18946 -1.4014zM6.00049 9.8282v9.1719h2.99902v-5c0 -0.5522 0.44789 -0.9998 1 -1h3.99999c0.5522 0.0001 1 0.4477 1 1v5h3.001V9.8282l-6 -4.57129z" strokeWidth="1"></path>
          </g>
        </svg>
      )
    },
    {
      name: 'Predictions',
      path: '/new-predictions',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-7 h-7">
          <g>
            <path fill="currentColor" d="M12 2c5.5228 0 10 4.47715 10 10 0 5.5228 -4.4772 10 -10 10 -5.52285 0 -10 -4.4772 -10 -10C2 6.47715 6.47715 2 12 2m1 3c0 0.55228 -0.4477 1 -1 1s-1 -0.44772 -1 -1v-0.93652C7.38148 4.51479 4.51582 7.3815 4.06445 11H5c0.55228 0 1 0.4477 1 1s-0.44772 1 -1 1h-0.93555C4.51581 16.6185 7.38154 19.4842 11 19.9355V19c0 -0.5523 0.4477 -1 1 -1s1 0.4477 1 1v0.9355c3.6185 -0.4513 6.4842 -3.317 6.9355 -6.9355H19c-0.5523 0 -1 -0.4477 -1 -1s0.4477 -1 1 -1h0.9355C19.4842 7.3815 16.6185 4.51479 13 4.06348zm-1 3c0.5523 0 1 0.44772 1 1v2h2c0.5523 0 1 0.4477 1 1s-0.4477 1 -1 1h-2v2c0 0.5523 -0.4477 1 -1 1s-1 -0.4477 -1 -1v-2H9l-0.10254 -0.0049C8.39333 12.9438 8 12.5177 8 12s0.39333 -0.9438 0.89746 -0.9951L9 11h2V9c0 -0.55228 0.4477 -1 1 -1" strokeWidth="1"></path>
          </g>
        </svg>
      )
    },
    {
      name: 'Mini Leagues',
      path: '/tables',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-7 h-7">
          <g>
            <path fill="currentColor" d="M19.7832 15.2832c0.539 -0.1195 1.0736 0.2208 1.1934 0.7598 0.1193 0.5388 -0.2211 1.0734 -0.7598 1.1933 -1.0253 0.2278 -2.7648 0.5291 -5.2168 0.6758V20.5c0 0.5522 -0.4479 0.9998 -1 1h-4c-0.55215 -0.0002 -1 -0.4478 -1 -1v-2.5879c-2.45196 -0.1467 -4.19154 -0.448 -5.2168 -0.6758 -0.53879 -0.1198 -0.87909 -0.6545 -0.75976 -1.1933 0.11981 -0.539 0.65438 -0.8794 1.19336 -0.7598 1.26394 0.2809 3.85843 0.7178 7.7832 0.7178 3.9247 0 6.5193 -0.4369 7.7832 -0.7178M12 11c1.1044 0.0002 2 0.8955 2 2s-0.8956 1.9998 -2 2c-1.1044 -0.0002 -2 -0.8955 -2 -2s0.8956 -1.9998 2 -2M3.5 9c0.82843 0 1.5 0.67157 1.5 1.5 0 0.8284 -0.67157 1.5 -1.5 1.5S2 11.3284 2 10.5C2 9.67157 2.67157 9 3.5 9m17 0c0.8284 0 1.5 0.67157 1.5 1.5 0 0.8284 -0.6716 1.5 -1.5 1.5s-1.5 -0.6716 -1.5 -1.5c0 -0.82843 0.6716 -1.5 1.5 -1.5m-14 -4.5C7.32843 4.5 8 5.17157 8 6s-0.67157 1.5 -1.5 1.5S5 6.82843 5 6s0.67157 -1.5 1.5 -1.5m11 0c0.8284 0 1.5 0.67157 1.5 1.5s-0.6716 1.5 -1.5 1.5S16 6.82843 16 6s0.6716 -1.5 1.5 -1.5m-5.5 -2c0.8284 0 1.5 0.67157 1.5 1.5s-0.6716 1.5 -1.5 1.5 -1.5 -0.67157 -1.5 -1.5 0.6716 -1.5 1.5 -1.5" strokeWidth="1"></path>
          </g>
        </svg>
      )
    },
    {
      name: 'Leaderboard',
      path: '/global',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-7 h-7">
          <g>
            <path fill="currentColor" d="M16 3c1.1046 0 2 0.89543 2 2h2c1.1046 0 2 0.89543 2 2v1c0 2.695 -2.1323 4.89 -4.8018 4.9941 -0.8777 1.5207 -2.4019 2.6195 -4.1982 2.9209V19h3c0.5523 0 1 0.4477 1 1s-0.4477 1 -1 1H8c-0.55228 0 -1 -0.4477 -1 -1s0.44772 -1 1 -1h3v-3.085c-1.7965 -0.3015 -3.32148 -1.4 -4.19922 -2.9209C4.13175 12.8895 2 10.6947 2 8V7c0 -1.10457 0.89543 -2 2 -2h2c0 -1.10457 0.89543 -2 2 -2zm-8 7c0 2.2091 1.79086 4 4 4 2.2091 0 4 -1.7909 4 -4V5H8zM4 8c0 1.32848 0.86419 2.4532 2.06055 2.8477C6.02137 10.5707 6 10.2878 6 10V7H4zm14 2c0 0.2878 -0.0223 0.5706 -0.0615 0.8477C19.1353 10.4535 20 9.32881 20 8V7h-2z" strokeWidth="1"></path>
          </g>
        </svg>
      )
    }
  ];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<{ width: number; left: number; top: number; borderRadius: number } | null>(null);

  useEffect(() => {
    const updateIndicator = () => {
      const activeIndex = navItems.findIndex(item => location.pathname === item.path);
      if (activeIndex >= 0 && buttonRefs.current[activeIndex] && containerRef.current) {
        const button = buttonRefs.current[activeIndex];
        const container = containerRef.current;
        const buttonRect = button.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Use button's height as the indicator size for perfect alignment
        const buttonHeight = buttonRect.height;
        const indicatorSize = buttonHeight;
        
        // Calculate button center X position relative to container
        const buttonCenterX = buttonRect.left + buttonRect.width / 2;
        const indicatorLeft = buttonCenterX - containerRect.left - indicatorSize / 2;
        
        // Calculate button center Y position relative to container
        const buttonCenterY = buttonRect.top + buttonRect.height / 2;
        const indicatorTop = buttonCenterY - containerRect.top - indicatorSize / 2;
        
        setIndicatorStyle({
          width: indicatorSize,
          left: indicatorLeft,
          top: indicatorTop,
          borderRadius: indicatorSize / 2,
        });
      }
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(updateIndicator, 0);
    window.addEventListener('resize', updateIndicator);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [location.pathname]);

  return (
    <>
      <style>{`
        .bottom-nav-absolute {
          position: fixed !important;
          bottom: 0px !important;
          left: 0px !important;
          right: 0px !important;
          width: 100vw !important;
          max-width: 100vw !important;
          z-index: 9999 !important;
          transform: translate3d(0, 0, 0) !important;
          -webkit-transform: translate3d(0, 0, 0) !important;
          will-change: transform !important;
          contain: layout style paint !important;
        }
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .bottom-nav-absolute {
            padding-bottom: env(safe-area-inset-bottom) !important;
          }
        }
        @media (max-height: 800px) {
          .bottom-nav-absolute {
            position: fixed !important;
            bottom: 0px !important;
          }
        }
      `}</style>
      <div className="bottom-nav-absolute flex items-center justify-center px-4 pb-8">
        <div ref={containerRef} className="bg-[#1C8376] border border-[#178f72] rounded-full shadow-2xl flex items-center max-w-md w-full px-2 py-2 mb-4 relative" style={{ boxShadow: '0 15px 35px -5px rgba(0, 0, 0, 0.5), 0 10px 15px -5px rgba(0, 0, 0, 0.4)' }}>
          {/* Sliding background indicator */}
          {indicatorStyle && (
            <div 
              className="absolute bg-[#178f72]"
              style={{
                width: `${indicatorStyle.width}px`,
                height: `${indicatorStyle.width}px`,
                left: `${indicatorStyle.left}px`,
                top: `${indicatorStyle.top}px`,
                borderRadius: `${indicatorStyle.borderRadius}px`,
                transition: 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
              }}
            />
          )}
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.name}
                ref={(el) => { buttonRefs.current[index] = el; }}
                onClick={() => navigate(item.path)}
                className={`relative z-10 flex-1 flex items-center justify-center py-3 px-4 rounded-full transition-all duration-300 ${
                  isActive 
                    ? 'text-white' 
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <div className={`relative transition-all duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}>
                  {item.icon}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}


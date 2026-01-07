import { useNavigate, useLocation } from 'react-router-dom';
import { useRef, useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useGameweekState } from '../hooks/useGameweekState';
import { useLeagues } from '../hooks/useLeagues';

  const navItems = [
    {
      name: 'Home',
      path: '/',
      icon: (
      <svg width="24" height="21" viewBox="0 0 24 21" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.00586 10.7812C0.380859 10.7812 0 10.3516 0 9.84375C0 9.57031 0.126953 9.28711 0.380859 9.07227L10.5566 0.527344C10.9863 0.175781 11.4551 0 11.9238 0C12.3926 0 12.8613 0.175781 13.291 0.527344L18.1152 4.58984V2.85156C18.1152 2.42188 18.4082 2.13867 18.8477 2.13867H20.166C20.5957 2.13867 20.8789 2.42188 20.8789 2.85156V6.9043L23.4668 9.07227C23.7207 9.28711 23.8477 9.57031 23.8477 9.84375C23.8477 10.3516 23.4668 10.7812 22.8516 10.7812C22.5488 10.7812 22.2754 10.625 22.041 10.4199L20.8789 9.45312V18.623C20.8789 20.0684 20.0098 20.918 18.5352 20.918H5.32227C3.83789 20.918 2.96875 20.0684 2.96875 18.623V9.45312L1.80664 10.4199C1.57227 10.625 1.30859 10.7812 1.00586 10.7812ZM14.7461 13.3301V19.0039H18.0273C18.6328 19.0039 18.9648 18.6621 18.9648 18.0469V7.8418L12.3438 2.28516C12.207 2.16797 12.0605 2.11914 11.9238 2.11914C11.7871 2.11914 11.6406 2.16797 11.5137 2.28516L4.88281 7.8418V18.0469C4.88281 18.6621 5.21484 19.0039 5.82031 19.0039H9.10156V13.3301C9.10156 12.8711 9.4043 12.5781 9.86328 12.5781H13.9941C14.4531 12.5781 14.7461 12.8711 14.7461 13.3301Z" fill="currentColor"/>
        </svg>
    ),
    },
    {
      name: 'Predictions',
      path: '/predictions',
      icon: (
      <svg width="41" height="22" viewBox="0 0 41 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M29.5 0C35.3447 0 40.0928 4.74805 40.0928 10.5928C40.0925 16.4373 35.3446 21.1846 29.5 21.1846C23.6554 21.1846 18.9085 16.4373 18.9082 10.5928C18.9082 4.74805 23.6553 0 29.5 0ZM18 17.9961C18.5523 17.9961 19 18.4438 19 18.9961C19 19.5484 18.5523 19.9961 18 19.9961H8C7.44772 19.9961 7 19.5484 7 18.9961C7 18.4438 7.44772 17.9961 8 17.9961H18ZM26.3008 16.1504L27.0088 19.1855C27.7982 19.4213 28.6389 19.5439 29.5 19.5439C30.3613 19.5439 31.2026 19.4214 31.9922 19.1855L32.6895 16.1914L31.3359 14.4688H27.6133L26.3008 16.1504ZM33.2432 10.3057L32.207 13.5254L33.6631 15.4014L37.0166 15.4531C37.9189 14.0483 38.4521 12.3867 38.4521 10.6025L35.96 9.20801L33.2432 10.3057ZM20.5488 10.6025C20.5591 12.3765 21.0718 14.0278 21.9639 15.4121L25.3271 15.3604L26.7832 13.4844L25.7578 10.3057L23.04 9.20801L20.5488 10.6025ZM12.1025 9.00098C12.6067 9.05231 13 9.47842 13 9.99609C13 10.5138 12.6067 10.9399 12.1025 10.9912L12 10.9961H1C0.447715 10.9961 0 10.5484 0 9.99609C0 9.44381 0.447715 8.99609 1 8.99609H12L12.1025 9.00098ZM26.3525 2.21484C24.8556 2.76852 23.5532 3.72228 22.5586 4.94238L23.502 8.03906L26.1064 9.0957L28.875 6.96289V4.24512L26.3525 2.21484ZM30.126 4.22461V6.96289L32.8945 9.0957L35.499 8.03906L36.4424 4.94238C35.4479 3.72233 34.135 2.76907 32.6279 2.20508L30.126 4.22461ZM18 0.996094C18.5523 0.996094 19 1.44381 19 1.99609C19 2.54838 18.5523 2.99609 18 2.99609H8C7.44772 2.99609 7 2.54838 7 1.99609C7 1.44381 7.44772 0.996094 8 0.996094H18Z" fill="currentColor"/>
        </svg>
    ),
    },
    {
      name: 'Mini Leagues',
      path: '/tables',
      icon: (
      <svg width="29" height="23" viewBox="0 0 29 23" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15.0586 18.9746C13.0664 18.9746 11.709 18.2031 11.0938 16.7871L7.7832 19.707C7.11914 20.3027 6.70898 20.5664 6.16211 20.5664C5.38086 20.5664 4.92188 20.0195 4.92188 19.1602V16.748H4.52148C1.68945 16.748 0 15.0684 0 12.1582V4.58984C0 1.67969 1.65039 0 4.58984 0H17.041C19.9805 0 21.6309 1.68945 21.6309 4.58984V4.87305H24.2676C27.0801 4.87305 28.6133 6.43555 28.6133 9.18945V14.7168C28.6133 17.4414 27.0996 18.9746 24.3262 18.9746H24.1504V21.2109C24.1504 22.0605 23.6914 22.6074 22.9199 22.6074C22.3926 22.6074 21.9434 22.3145 21.3086 21.7578L18.0566 18.9746H15.0586ZM6.64062 15.6348V18.418L9.73633 15.3516C10.0684 15.0098 10.3223 14.8828 10.7129 14.8438C10.7129 14.8047 10.7031 14.7656 10.7031 14.7266V9.18945C10.7031 6.43555 12.2461 4.87305 15.0586 4.87305H19.7168V4.64844C19.7168 2.85156 18.8281 1.91406 16.9824 1.91406H4.63867C2.79297 1.91406 1.91406 2.85156 1.91406 4.64844V12.0996C1.91406 13.8965 2.79297 14.834 4.63867 14.834H5.83984C6.39648 14.834 6.64062 15.0488 6.64062 15.6348ZM15.2051 17.0996H18.0176C18.4668 17.0996 18.8477 17.2559 19.2188 17.6074L22.4316 20.5176V17.9785C22.4316 17.3926 22.793 17.0996 23.2715 17.0996H24.1211C25.9082 17.0996 26.7188 16.2207 26.7188 14.5117V9.33594C26.7188 7.62695 25.9082 6.74805 24.1211 6.74805H15.2051C13.418 6.74805 12.6074 7.62695 12.6074 9.33594V14.5117C12.6074 16.2207 13.418 17.0996 15.2051 17.0996ZM16.3184 10.9961C15.8691 10.9961 15.5469 10.6445 15.5469 10.2148C15.5469 9.76562 15.8691 9.43359 16.3184 9.43359H23.0566C23.5059 9.43359 23.8379 9.76562 23.8379 10.2148C23.8379 10.6445 23.5059 10.9961 23.0566 10.9961H16.3184ZM16.3184 14.5605C15.8691 14.5605 15.5469 14.2285 15.5469 13.7891C15.5469 13.3496 15.8691 12.998 16.3184 12.998H21.2109C21.6504 12.998 21.9922 13.3496 21.9922 13.7891C21.9922 14.2285 21.6504 14.5605 21.2109 14.5605H16.3184Z" fill="currentColor"/>
        </svg>
    ),
    },
    {
    name: 'Leaderboards',
      path: '/global',
      icon: (
      <svg width="20" height="22" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 3.36914C0 2.28516 0.693359 1.61133 1.82617 1.61133H3.68164C3.88672 0.595703 4.63867 0 5.84961 0H13.7012C14.9219 0 15.6738 0.605469 15.8691 1.61133H17.7246C18.8574 1.61133 19.5508 2.28516 19.5508 3.36914C19.5508 7.34375 17.5879 9.90234 13.7109 11.1133C13.2031 11.7676 12.6172 12.2949 12.0605 12.6855V16.6309H13.2031C14.5996 16.6309 15.3613 17.4609 15.3613 18.7891V20.8496C15.3613 21.3672 14.9609 21.7188 14.4727 21.7188H5.07812C4.58984 21.7188 4.18945 21.3672 4.18945 20.8496V18.7891C4.18945 17.4609 4.95117 16.6309 6.34766 16.6309H7.49023V12.6758C6.93359 12.2949 6.35742 11.7676 5.84961 11.1133C1.96289 9.90234 0 7.34375 0 3.36914ZM5.35156 5.40039C5.35156 8.84766 8.49609 11.8555 9.77539 11.8555C11.0547 11.8555 14.1992 8.84766 14.1992 5.40039V2.32422C14.1992 1.98242 13.9648 1.75781 13.623 1.75781H5.92773C5.58594 1.75781 5.35156 1.98242 5.35156 2.32422V5.40039ZM1.63086 3.59375C1.63086 6.09375 2.60742 7.85156 4.47266 8.84766C3.93555 7.75391 3.60352 6.48438 3.60352 5.12695V3.33008H1.9043C1.73828 3.33008 1.63086 3.4375 1.63086 3.59375ZM15.0781 8.84766C16.9434 7.85156 17.9199 6.09375 17.9199 3.59375C17.9199 3.4375 17.8125 3.33008 17.6465 3.33008H15.9473V5.12695C15.9473 6.48438 15.6152 7.75391 15.0781 8.84766ZM9.16016 16.6309H10.3906V13.5059C10.1758 13.5645 9.9707 13.5938 9.77539 13.5938C9.58008 13.5938 9.375 13.5645 9.16016 13.5059V16.6309ZM5.9375 19.9707H13.6133V18.9355C13.6133 18.6035 13.3887 18.3887 13.0566 18.3887H6.49414C6.16211 18.3887 5.9375 18.6035 5.9375 18.9355V19.9707Z" fill="currentColor"/>
        </svg>
    ),
  },
  ];

export default function BottomNav({ shouldHide = false }: { shouldHide?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<{ 
    width: number; 
    height: number; 
    left: number; 
    borderRadius: number;
    borderTopLeftRadius: number;
    borderBottomLeftRadius: number;
    borderTopRightRadius: number;
    borderBottomRightRadius: number;
    activeIndex: number;
  } | null>(null);
  const [hasPredictionsToDo, setHasPredictionsToDo] = useState(false);
  
  // Get unread chat message counts
  const { unreadByLeague } = useLeagues({ pageName: 'bottomNav', skipInitialFetch: false });
  
  // Calculate total unread count across all leagues
  const totalUnreadCount = useMemo(() => {
    if (!unreadByLeague) return 0;
    return Object.values(unreadByLeague).reduce((sum, count) => sum + count, 0);
  }, [unreadByLeague]);
  
  const badgeCount = totalUnreadCount > 0 ? Math.min(totalUnreadCount, 99) : 0;

  useEffect(() => {
    const updateIndicator = () => {
      const activeIndex = navItems.findIndex(item => location.pathname === item.path);
      if (activeIndex >= 0 && containerRef.current) {
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        
        // Indicator is exactly 25% of the pill width
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        const indicatorWidth = containerWidth * 0.25; // Exactly 25%
        const indicatorHeight = containerHeight;
        
        // Position based on index: 0%, 25%, 50%, 75% of container width
        const indicatorLeft = activeIndex * indicatorWidth;
        
        const isFirstItem = activeIndex === 0;
        const isLastItem = activeIndex === navItems.length - 1;
        
        // Border radius must match container exactly (60px) at edges
        const containerBorderRadius = 60;
        const activeBorderRadius = 72;
        
        // Left border radius: match container (60px) exactly when at left edge
        const borderTopLeftRadius = isFirstItem ? containerBorderRadius : activeBorderRadius;
        const borderBottomLeftRadius = isFirstItem ? containerBorderRadius : activeBorderRadius;
        
        // Right border radius: match container (60px) exactly when at right edge
        const borderTopRightRadius = isLastItem ? containerBorderRadius : activeBorderRadius;
        const borderBottomRightRadius = isLastItem ? containerBorderRadius : activeBorderRadius;
        
        setIndicatorStyle({
          width: indicatorWidth,
          height: indicatorHeight,
          left: indicatorLeft,
          borderRadius: containerBorderRadius,
          borderTopLeftRadius: borderTopLeftRadius,
          borderBottomLeftRadius: borderBottomLeftRadius,
          borderTopRightRadius: borderTopRightRadius,
          borderBottomRightRadius: borderBottomRightRadius,
          activeIndex: activeIndex,
        });
      }
    };

    const timeoutId = setTimeout(updateIndicator, 0);
    window.addEventListener('resize', updateIndicator);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [location.pathname]);

  const [viewingGw, setViewingGw] = useState<number | null>(null);

  // Get user's viewing GW (respects current_viewing_gw from GAME_STATE.md)
  useEffect(() => {
    let alive = true;

    const loadViewingGw = async () => {
      if (!user?.id) {
        setViewingGw(null);
        return;
      }

      try {
        // Get app_meta.current_gw (published GW)
        const { data: meta, error: metaError } = await supabase
          .from("app_meta")
          .select("current_gw")
          .eq("id", 1)
          .maybeSingle();
        
        if (!alive || metaError) return;
        
        const dbCurrentGw = meta?.current_gw ?? 1;

        // Get user's current_viewing_gw (which GW they're actually viewing)
        const { data: prefs } = await supabase
          .from("user_notification_preferences")
          .select("current_viewing_gw")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (!alive) return;
        
        // Use current_viewing_gw if set, otherwise default to currentGw - 1 (previous GW)
        // This ensures users stay on previous GW results when a new GW is published
        const userViewingGw = prefs?.current_viewing_gw ?? (dbCurrentGw > 1 ? dbCurrentGw - 1 : dbCurrentGw);
        
        // Determine which GW to display
        // If user hasn't transitioned to new GW, show their viewing GW (previous GW)
        // Otherwise show the current GW
        const gwToDisplay = userViewingGw < dbCurrentGw ? userViewingGw : dbCurrentGw;
        
        if (alive) {
          setViewingGw(gwToDisplay);
        }
      } catch (error) {
        console.error('[BottomNav] Error loading viewing GW:', error);
      }
    };

    loadViewingGw();
    
    return () => { alive = false; };
  }, [user?.id]);

  // Get game state for the viewing GW
  const { state: viewingGwState } = useGameweekState(viewingGw, user?.id);

  // Check if user has predictions to do (only for GW_OPEN state)
  useEffect(() => {
    let alive = true;

    const checkPredictions = async () => {
      if (!user?.id || !viewingGw) {
        setHasPredictionsToDo(false);
        return;
      }

      // Only show shiny icon if viewing GW is in GW_OPEN state
      if (viewingGwState !== 'GW_OPEN') {
        if (alive) setHasPredictionsToDo(false);
        return;
      }

      try {
        // Check if user has submitted predictions for the viewing GW
        const { data: submission } = await supabase
          .from("app_gw_submissions")
          .select("submitted_at")
          .eq("user_id", user.id)
          .eq("gw", viewingGw)
          .maybeSingle();
        
        if (!alive) return;

        const hasSubmitted = submission?.submitted_at !== null && submission?.submitted_at !== undefined;
        setHasPredictionsToDo(!hasSubmitted);
      } catch (error) {
        console.error('[BottomNav] Error checking predictions:', error);
        if (alive) setHasPredictionsToDo(false);
      }
    };

    checkPredictions();

    // Listen for prediction submission events
    const handleSubmission = () => {
      checkPredictions();
    };

    window.addEventListener('predictionsSubmitted', handleSubmission);
    
    return () => {
      alive = false;
      window.removeEventListener('predictionsSubmitted', handleSubmission);
    };
  }, [user?.id, viewingGw, viewingGwState]);

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
          z-index: 99999 !important;
          transform: translate3d(0, 0, 0) !important;
          -webkit-transform: translate3d(0, 0, 0) !important;
          will-change: transform !important;
          contain: layout style paint !important;
          pointer-events: auto !important;
          transition: transform 0.3s ease-in-out !important;
        }
        .bottom-nav-slide-out {
          transform: translate3d(0, 100%, 0) !important;
          -webkit-transform: translate3d(0, 100%, 0) !important;
        }
        .bottom-nav-slide-in {
          transform: translate3d(0, 0, 0) !important;
          -webkit-transform: translate3d(0, 0, 0) !important;
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
        @keyframes shimmer {
          0% {
            transform: translateX(-100%) skewX(-15deg);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateX(100%) skewX(-15deg);
            opacity: 0;
          }
        }
        .predictions-shiny {
          animation: shiny-gradient 3s ease-in-out infinite;
        }
        @keyframes shiny-gradient {
          0%, 100% {
            color: #facc15; /* yellow-400 */
          }
          25% {
            color: #f97316; /* orange-500 */
          }
          50% {
            color: #ec4899; /* pink-500 */
          }
          75% {
            color: #9333ea; /* purple-600 */
          }
        }
        .predictions-shiny svg {
          position: relative;
          z-index: 2;
          overflow: visible;
        }
        .predictions-shiny svg path {
          fill: currentColor;
        }
        .predictions-shiny-icon-wrapper {
          position: relative;
          display: inline-flex;
          width: 41px;
          height: 22px;
          overflow: hidden;
        }
        .predictions-shiny-icon-wrapper svg {
          position: relative;
          z-index: 2;
        }
        .predictions-shiny-icon-wrapper::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            transparent 40%,
            rgba(255, 255, 255, 0.7) 50%,
            transparent 60%,
            transparent 100%
          );
          animation: shimmer 1.2s ease-in-out infinite;
          pointer-events: none;
          z-index: 3;
          mix-blend-mode: overlay;
        }
        .predictions-shiny-icon-wrapper::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            transparent 40%,
            rgba(254, 240, 138, 0.5) 50%,
            transparent 60%,
            transparent 100%
          );
          animation: shimmer 1.8s ease-in-out infinite 0.4s;
          pointer-events: none;
          z-index: 3;
          mix-blend-mode: overlay;
        }
        .predictions-shiny-text {
          position: relative;
          z-index: 2;
        }
      `}</style>
      <div className={`bottom-nav-absolute lg:hidden flex items-center justify-center px-4 pb-8 ${shouldHide ? 'bottom-nav-slide-out' : 'bottom-nav-slide-in'}`}>
        <div ref={containerRef} className="bg-white dark:bg-slate-800 border border-[#E5E7EB] dark:border-slate-700 flex items-center relative overflow-hidden" style={{ width: '360px', height: '70px', borderRadius: '60px', marginBottom: '1.5rem' }}>
          {/* Active state indicator */}
          {indicatorStyle && (
            <div 
              className="absolute"
              style={{
                width: `${indicatorStyle.width}px`,
                height: `${indicatorStyle.height}px`,
                left: `${indicatorStyle.left}px`,
                top: '0',
                backgroundColor: 'rgba(28, 131, 118, 0.1)',
                borderTopLeftRadius: `${indicatorStyle.borderTopLeftRadius}px`,
                borderBottomLeftRadius: `${indicatorStyle.borderBottomLeftRadius}px`,
                borderTopRightRadius: `${indicatorStyle.borderTopRightRadius}px`,
                borderBottomRightRadius: `${indicatorStyle.borderBottomRightRadius}px`,
                transition: 'all 0.3s ease',
                zIndex: 0,
              }}
            />
          )}
          {navItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          const isPredictions = item.name === 'Predictions';
          const isMiniLeagues = item.name === 'Mini Leagues';
          const shouldShine = isPredictions && hasPredictionsToDo && !isActive;
          const hasUnreadMessages = isMiniLeagues && badgeCount > 0 && !isActive;
          return (
            <button
              key={item.name}
                ref={(el) => { buttonRefs.current[index] = el; }}
              onClick={() => navigate(item.path)}
                className="relative z-10 flex flex-col items-center justify-center transition-all duration-300"
                style={{ width: '25%', height: '70px', padding: '0', gap: '4px', flexShrink: 0 }}
            >
                <div 
                  className={`flex items-center justify-center w-full ${shouldShine ? 'predictions-shiny' : ''}`}
                  style={{ 
                    height: '26px',
                    padding: '4px',
                    ...(shouldShine ? {} : { color: isActive ? '#1C8376' : document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#353536' }),
                  }}
                >
                  <div className={`flex items-center justify-center ${shouldShine ? 'predictions-shiny-icon-wrapper' : ''}`} style={{ height: '21px', width: 'auto', position: 'relative' }}>
                {item.icon}
                {hasUnreadMessages && (
                  <span className="absolute -top-1 -right-2 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#1C8376] text-white text-[9px] font-bold leading-none">
                    {badgeCount}
                  </span>
                )}
              </div>
                </div>
                <div 
                  className={`flex items-center justify-center w-full ${shouldShine ? 'predictions-shiny' : ''}`}
                  style={{ 
                    height: '10px',
                    padding: '0px 2px',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <span 
                    className={`relative z-10 font-medium whitespace-nowrap text-[8px] ${shouldShine ? 'predictions-shiny-text' : ''}`}
                    style={{ 
                      lineHeight: '10px',
                      color: isActive ? '#1C8376' : document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#353536',
                      textAlign: 'center',
                      maxWidth: '100%',
                    }}
                  >
                    {item.name}
                  </span>
                </div>
            </button>
          );
        })}
        </div>
      </div>
    </>
  );
}


// src/main.tsx
import "./index.css";
import "react-chat-elements/dist/main.css";
import React, { Suspense, lazy, useState, useEffect, useLayoutEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";

// Eagerly load BottomNav pages for instant navigation (no Suspense delay)
import HomePage from "./pages/Home";
import TablesPage from "./pages/Tables";
import GlobalPage from "./pages/Global";
import PredictionsPage from "./pages/Predictions";

// Lazy load other pages
const LeaguePage = lazy(() => import("./pages/League"));
const AdminPage = lazy(() => import("./pages/Admin"));
const AdminDataPage = lazy(() => import("./pages/AdminData"));
const TempGlobalPage = lazy(() => import("./pages/TempGlobal"));
const CreateLeaguePage = lazy(() => import("./pages/CreateLeague"));
const HowToPlayPage = lazy(() => import("./pages/HowToPlay"));
const ApiAdmin = lazy(() => import("./pages/ApiAdmin"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const NotificationCentrePage = lazy(() => import("./pages/NotificationCentre"));
const EmailPreferencesPage = lazy(() => import("./pages/EmailPreferences"));
const StatsPage = lazy(() => import("./pages/Stats"));
const SwipeCardPreview = lazy(() => import("./pages/SwipeCardPreview"));
const CookiePolicyPage = lazy(() => import("./pages/CookiePolicy"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicy"));
const TermsAndConditionsPage = lazy(() => import("./pages/TermsAndConditions"));

// New onboarding + auth flow
import { AuthGate } from "./features/auth";

import { AuthProvider, useAuth } from "./context/AuthContext";
import PredictionsBanner from "./components/PredictionsBanner";
import BottomNav from "./components/BottomNav";
import FloatingProfile from "./components/FloatingProfile";
import DesktopNav from "./components/DesktopNav";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAppLifecycle } from "./hooks/useAppLifecycle";
import LoadingScreen from "./components/LoadingScreen";
import ScrollToTop from "./components/ScrollToTop";
// import { isLoadEverythingFirstEnabled } from "./lib/featureFlags"; // Unused - feature flag checked inline
import { loadInitialData } from "./services/initialDataLoader";
import { bootLog } from "./lib/logEvent";
import { supabase } from "./lib/supabase";

// Loading Fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C8376]"></div>
  </div>
);

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading…</div>;
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

function AppShell() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showWelcome, dismissWelcome, user, loading: authLoading } = useAuth();
  const [initialDataLoading, setInitialDataLoading] = useState(false);
  
  // Check for deep link IMMEDIATELY on mount using useLayoutEffect (runs synchronously before paint)
  // This prevents the home page from rendering if we have a notification deep link
  useLayoutEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const leagueCodeParam = searchParams.get('leagueCode');
    const currentPath = window.location.pathname;
    
    // If we have leagueCode in URL but aren't on league page, navigate immediately
    if (leagueCodeParam && !currentPath.startsWith('/league/')) {
      const leagueUrl = `/league/${leagueCodeParam}?tab=chat`;
      navigate(leagueUrl, { replace: true });
    }
  }, [navigate]);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [maxLoadingTimeout, setMaxLoadingTimeout] = useState(false);
  const [isSwipeMode, setIsSwipeMode] = useState(false);
  const [hasSubmittedPredictions, setHasSubmittedPredictions] = useState<boolean | null>(null);
  
  // Preload Volley images for Despia - ensure they're available when needed
  useEffect(() => {
    const volleyImages = [
      '/assets/Volley/volley-with-ball.png',
      '/assets/Animation/Volley-Keepy-Uppies.gif',
      '/assets/Animation/Volley-Pointing.gif',
      '/assets/Volley/Volley-Tool-Tip.png',
      '/assets/Volley/Volley-Coach.png',
    ];
    
    console.log('[App] Preloading Volley images for Despia...');
    volleyImages.forEach((src) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        console.log(`[App] Preloaded Volley image: ${src}`);
      };
      img.onerror = (error) => {
        console.warn(`[App] Failed to preload Volley image: ${src}`, error);
      };
    });
  }, []);
  
  // Pre-loading is enabled by default (can be disabled via localStorage)
  const [loadEverythingFirst, setLoadEverythingFirst] = useState(() => {
    // Default to true, but check localStorage to see if user disabled it
    const stored = localStorage.getItem("feature:loadEverythingFirst");
    return stored === null ? true : stored === 'true'; // null = default to true
  });
  
  // Listen for localStorage changes to update the flag
  useEffect(() => {
    const checkFlag = () => {
      // Default to true if not set in localStorage
      const stored = localStorage.getItem("feature:loadEverythingFirst");
      const newValue = stored === null ? true : stored === 'true';
      if (newValue !== loadEverythingFirst) {
        console.log(`[Pre-loading] Flag changed: ${loadEverythingFirst} -> ${newValue}`);
        setLoadEverythingFirst(newValue);
      }
    };
    
    // Check on mount and when storage changes
    checkFlag();
    window.addEventListener('storage', checkFlag);
    
    // Also check periodically (in case localStorage is changed in same tab)
    const interval = setInterval(checkFlag, 1000);
    
    return () => {
      window.removeEventListener('storage', checkFlag);
      clearInterval(interval);
    };
  }, [loadEverythingFirst]);
  
  // Log if pre-loading is enabled (for debugging)
  useEffect(() => {
    if (loadEverythingFirst) {
      console.log('[Pre-loading] Load everything first mode is ENABLED');
      console.log('[Pre-loading] To disable, run: localStorage.setItem("feature:loadEverythingFirst", "false")');
    }
  }, [loadEverythingFirst]);
  
  // Load initial data if feature flag is enabled
  useEffect(() => {
    console.log(`[Pre-loading] Effect triggered - flag: ${loadEverythingFirst}, authLoading: ${authLoading}, userId: ${user?.id || 'null'}, loaded: ${initialDataLoaded}`);
    
    if (!loadEverythingFirst || authLoading || !user?.id) {
      // If feature flag is off, or auth is still loading, or no user, skip
      if (!authLoading && user) {
        console.log('[Pre-loading] Skipping pre-load (flag off or no user), setting loaded=true');
        setInitialDataLoaded(true);
      }
      return;
    }
    
    // If we've already loaded, don't load again
    if (initialDataLoaded) {
      console.log('[Pre-loading] Already loaded, skipping');
      return;
    }
    
    // Check if this is a fresh install (no cache exists for this user)
    // If fresh install, skip blocking preload and let pages load their own data
    const cacheKey = `home:basic:${user.id}`;
    const hasExistingCache = localStorage.getItem(`despia:cache:${cacheKey}`) !== null;
    
    if (!hasExistingCache) {
      console.log('[Pre-loading] Fresh install detected (no cache), skipping blocking preload');
      // Start loading in background (non-blocking) so cache is ready for next time
      loadInitialData(user.id)
        .then(() => console.log('[Pre-loading] Background preload complete'))
        .catch((e) => console.warn('[Pre-loading] Background preload failed:', e));
      setInitialDataLoaded(true);
      return;
    }
    
    // Start loading (blocking - we have cache, so user expects instant experience)
    console.log('[Pre-loading] Starting initial data load for user:', user.id);
    bootLog.initialDataStart(user.id);
    const startTime = Date.now();
    setInitialDataLoading(true);
    
    // Set a timeout to prevent infinite loading (10 seconds max)
    const timeoutId = setTimeout(() => {
      console.warn('[Pre-loading] Initial data loading timed out after 10 seconds, showing app anyway');
      bootLog.initialDataTimeout();
      setInitialDataLoaded(true);
      setInitialDataLoading(false);
    }, 10000);
    
    // Load all data
    console.log('[Pre-loading] Calling loadInitialData...');
    loadInitialData(user.id)
      .then(() => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        console.log('[Pre-loading] Initial data loaded successfully');
        bootLog.initialDataSuccess(duration);
        setInitialDataLoaded(true);
        setInitialDataLoading(false);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error('[Pre-loading] Failed to load initial data:', error);
        bootLog.initialDataError(error?.message || 'Unknown error');
        // Even if loading fails, show the app (graceful degradation)
        setInitialDataLoaded(true);
        setInitialDataLoading(false);
      });
    
    // Cleanup timeout on unmount
    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadEverythingFirst, authLoading, user?.id, initialDataLoaded]);
  
  // Prefetch data when app comes to foreground
  // (hook will check feature flag internally)
  useAppLifecycle();
  
  // Track swipe mode from body data attribute (for BottomNav visibility)
  useEffect(() => {
    const checkSwipeMode = () => {
      const isSwipe = document.body.getAttribute('data-swipe-mode') === 'true';
      setIsSwipeMode(isSwipe);
    };
    
    // Check initially and on location change
    checkSwipeMode();
    
    // Watch for changes using MutationObserver
    const observer = new MutationObserver(checkSwipeMode);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-swipe-mode']
    });
    
    // Also check periodically to catch any timing issues
    const interval = setInterval(checkSwipeMode, 200);
    
    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [location.pathname]);

  // Listen for GW transition event and trigger shimmer animation
  useEffect(() => {
    const handleGwTransition = (_event: CustomEvent<{ newGw: number }>) => {
      console.log('[App] GW transition event received, triggering shimmer animation');
      
      // Find all main content elements (cards, sections, etc.)
      const contentElements = document.querySelectorAll(
        'section, .rounded-xl, .bg-white, [class*="card"], [class*="Card"]'
      );
      
      // Add shimmer class to each element with staggered delay
      contentElements.forEach((el, index) => {
        if (el instanceof HTMLElement) {
          el.classList.add('shimmer-box');
          el.style.animationDelay = `${index * 100}ms`;
        }
      });
      
      // Remove shimmer class after animation completes
      setTimeout(() => {
        contentElements.forEach((el) => {
          if (el instanceof HTMLElement) {
            el.classList.remove('shimmer-box');
            el.style.animationDelay = '';
          }
        });
      }, 1200);
    };
    
    window.addEventListener('gwTransition', handleGwTransition as EventListener);
    
    return () => {
      window.removeEventListener('gwTransition', handleGwTransition as EventListener);
    };
  }, []);
  
  // Check if user has submitted predictions for viewing GW (respects current_viewing_gw)
  // Only hide nav when in GW_OPEN state and user hasn't submitted
  useEffect(() => {
    let alive = true;

    const checkSubmission = async () => {
      if (!user?.id || location.pathname !== '/predictions') {
        setHasSubmittedPredictions(null);
        return;
      }

      try {
        // Get app_meta.current_gw (published GW)
        const { data: meta, error: metaError } = await supabase
          .from("app_meta")
          .select("current_gw")
          .eq("id", 1)
          .maybeSingle();
        
        if (!alive || metaError) {
          setHasSubmittedPredictions(null);
          return;
        }
        
        const dbCurrentGw = meta?.current_gw ?? null;
        if (!dbCurrentGw) {
          setHasSubmittedPredictions(null);
          return;
        }

        // Get user's current_viewing_gw (which GW they're actually viewing)
        const { data: prefs } = await supabase
          .from("user_notification_preferences")
          .select("current_viewing_gw")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (!alive) return;
        
        // Use current_viewing_gw if set, otherwise default to currentGw - 1 (previous GW)
        const userViewingGw = prefs?.current_viewing_gw ?? (dbCurrentGw > 1 ? dbCurrentGw - 1 : dbCurrentGw);
        
        // Determine which GW to check
        const gwToCheck = userViewingGw < dbCurrentGw ? userViewingGw : dbCurrentGw;

        // Check game state for the viewing GW - only hide nav if in GW_OPEN state
        // Import useGameweekState hook result would require restructuring, so we'll check state via query
        // For now, check if results exist - if results exist, we're in RESULTS state, so show nav
        const { count: resultsCount } = await supabase
          .from("app_gw_results")
          .select("gw", { count: "exact", head: true })
          .eq("gw", gwToCheck);
        
        const hasResults = (resultsCount ?? 0) > 0;
        
        // If we're viewing results, always show nav (don't hide)
        if (hasResults) {
          if (alive) setHasSubmittedPredictions(true); // Set to true so nav shows
          return;
        }

        // No results yet - check if user has submitted predictions for the viewing GW
        const { data: submission } = await supabase
          .from("app_gw_submissions")
          .select("submitted_at")
          .eq("user_id", user.id)
          .eq("gw", gwToCheck)
          .maybeSingle();
        
        if (!alive) return;

        const hasSubmitted = submission?.submitted_at !== null && submission?.submitted_at !== undefined;
        setHasSubmittedPredictions(hasSubmitted);
      } catch (error) {
        console.error('[AppContent] Error checking predictions submission:', error);
        if (alive) setHasSubmittedPredictions(null);
      }
    };

    checkSubmission();

    // Listen for prediction submission events
    const handleSubmission = () => {
      checkSubmission();
    };

    window.addEventListener('predictionsSubmitted', handleSubmission);
    
    return () => {
      alive = false;
      window.removeEventListener('predictionsSubmitted', handleSubmission);
    };
  }, [user?.id, location.pathname]);
  
  // Hide header/banner for full-screen pages
  const isFullScreenPage = false;

  // Handle deep links from notifications (iOS native)
  // Check IMMEDIATELY on mount to avoid showing home page first
  // Run synchronous checks first, then async checks
  useEffect(() => {
    // IMMEDIATE synchronous check - no waiting for user or delays
    const currentPath = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    
    // Method 1: Check if URL is already in window.location (fastest path)
    if (currentPath.startsWith('/league/')) {
      const tab = searchParams.get('tab');
      if (tab !== 'chat') {
        // Navigate to chat tab immediately
        navigate(`${currentPath}?tab=chat`, { replace: true });
      }
      return; // Already on league page, no need for further checks
    }
    
    // Method 2: Check hash-based URLs (synchronous)
    if (hash && hash.startsWith('#/')) {
      const path = hash.slice(1);
      if (path.startsWith('/league/')) {
        navigate(path, { replace: true });
        return;
      }
    }
    
    // Method 3: Check query params for leagueCode (synchronous - fastest for notifications)
    const leagueCodeParam = searchParams.get('leagueCode');
    if (leagueCodeParam) {
      const leagueUrl = `/league/${leagueCodeParam}?tab=chat`;
      navigate(leagueUrl, { replace: true });
      return;
    }
    
    // If we get here, no immediate deep link found
    // Continue with async checks below (but only if user is loaded)
    if (!user) return;
    
    const handleAsyncNotificationDeepLink = () => {
      const fullUrl = window.location.href;
      
      // Store debug info in localStorage for debugging (can't access console in Despia)
      const debugInfo = {
        pathname: currentPath,
        search: window.location.search,
        hash: hash,
        fullUrl: fullUrl,
        href: window.location.href,
        timestamp: new Date().toISOString()
      };
      try {
        localStorage.setItem('deepLink_debug', JSON.stringify(debugInfo));
      } catch (e) {
        // Ignore storage errors
      }
      
      console.log('[DeepLink] Checking for async notification deep link...', debugInfo);
      
      // Method 4: Check localStorage/sessionStorage for OneSignal notification data
      // OneSignal might store notification data here on iOS native
      try {
        // Check various possible storage keys
        const storageKeys = [
          'onesignal_notification_opened',
          'onesignal_notification_data',
          'onesignal_last_notification',
          'OneSignal_notificationOpened',
          'onesignal_notification',
        ];
        
        for (const key of storageKeys) {
          const stored = localStorage.getItem(key) || sessionStorage.getItem(key);
          if (stored) {
            try {
              const data = JSON.parse(stored);
              console.log('[DeepLink] Found notification data in storage:', key, data);
              
              // Extract leagueCode from various possible locations in the data
              const leagueCode = data?.leagueCode || 
                                data?.additionalData?.leagueCode || 
                                data?.data?.leagueCode ||
                                data?.notification?.additionalData?.leagueCode ||
                                data?.payload?.additionalData?.leagueCode ||
                                data?.notification?.payload?.additionalData?.leagueCode;
              
              if (leagueCode) {
                const leagueUrl = `/league/${leagueCode}?tab=chat`;
                console.log('[DeepLink] Extracted leagueCode from storage, navigating:', leagueUrl);
                
                // Store success in localStorage
                try {
                  localStorage.setItem('deepLink_result', JSON.stringify({
                    success: true,
                    method: 'storage',
                    storageKey: key,
                    leagueCode: leagueCode,
                    url: leagueUrl,
                    timestamp: new Date().toISOString()
                  }));
                } catch (e) {}
                
                navigate(leagueUrl, { replace: true });
                // Clear the storage after using it
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
                return true;
              }
            } catch (e) {
              console.warn('[DeepLink] Error parsing stored notification data:', e);
            }
          }
        }
      } catch (e) {
        console.warn('[DeepLink] Error checking storage:', e);
      }
      
      // Method 5: Fallback - if we're on home page and no deep link found,
      // check if there's a recent unread chat message and navigate to that league
      // This handles the case where OneSignal doesn't set URL but we know a notification was just received
      if ((currentPath === '/' || currentPath === '') && user?.id) {
        // Only do this check once per session to avoid interfering with normal app usage
        const lastFallbackCheck = sessionStorage.getItem('deepLink_fallback_checked');
        if (!lastFallbackCheck) {
          sessionStorage.setItem('deepLink_fallback_checked', 'true');
          // Reduced delay - check immediately, then again after short delay
          // First check immediately (no delay)
          (async () => {
            try {
              // Get user's league IDs
              const { data: leagueMembers } = await supabase
                .from('league_members')
                .select('league_id')
                .eq('user_id', user.id);
              
              if (leagueMembers && leagueMembers.length > 0) {
                const leagueIds = leagueMembers.map((lm: any) => lm.league_id).filter(Boolean);
                if (leagueIds.length > 0) {
                  // Get most recent message from user's leagues
                  const { data: recentMessage } = await supabase
                    .from('league_messages')
                    .select('league_id, leagues!inner(code)')
                    .in('league_id', leagueIds)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  
                  if (recentMessage) {
                    const leagueData = (recentMessage as any).leagues;
                    if (leagueData && typeof leagueData === 'object' && 'code' in leagueData) {
                      const leagueCode = leagueData.code;
                      const leagueUrl = `/league/${leagueCode}?tab=chat`;
                      console.log('[DeepLink] Fallback: Navigating to league with recent message:', leagueUrl);
                      navigate(leagueUrl, { replace: true });
                      return; // Found it, no need for delayed check
                    }
                  }
                }
              }
            } catch (e) {
              console.warn('[DeepLink] Fallback check failed:', e);
            }
          })();
          
          // Also check again after short delay in case first check was too fast
          setTimeout(async () => {
            try {
              // Get user's league IDs
              const { data: leagueMembers } = await supabase
                .from('league_members')
                .select('league_id')
                .eq('user_id', user.id);
              
              if (leagueMembers && leagueMembers.length > 0) {
                const leagueIds = leagueMembers.map((lm: any) => lm.league_id).filter(Boolean);
                if (leagueIds.length > 0) {
                  // Get most recent message from user's leagues
                  const { data: recentMessage } = await supabase
                    .from('league_messages')
                    .select('league_id, leagues!inner(code)')
                    .in('league_id', leagueIds)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  
                  if (recentMessage) {
                    const leagueData = (recentMessage as any).leagues;
                    if (leagueData && typeof leagueData === 'object' && 'code' in leagueData) {
                      const leagueCode = leagueData.code;
                      const leagueUrl = `/league/${leagueCode}?tab=chat`;
                      console.log('[DeepLink] Fallback: Navigating to league with recent message:', leagueUrl);
                      navigate(leagueUrl, { replace: true });
                    }
                  }
                }
              }
            } catch (e) {
              console.warn('[DeepLink] Fallback check failed:', e);
            }
          }, 2000); // Wait 2 seconds for leagues to load
        }
      }
      
      console.log('[DeepLink] No notification deep link found');
      
      // Store failure in localStorage
      try {
        localStorage.setItem('deepLink_result', JSON.stringify({
          success: false,
          reason: 'no_deep_link_found',
          debugInfo: debugInfo,
          timestamp: new Date().toISOString()
        }));
      } catch (e) {}
      
      return false;
    };
    
    // Run async checks (only if user is loaded)
    if (user) {
      // Check immediately for async sources
      handleAsyncNotificationDeepLink();
      
      // Check again after a delay (OneSignal might set URL/data asynchronously)
      const timeoutId1 = setTimeout(() => {
        console.log('[DeepLink] Re-checking async sources after 500ms delay...');
        handleAsyncNotificationDeepLink();
      }, 500);
      
      // Check again after longer delay (in case OneSignal is very slow)
      const timeoutId2 = setTimeout(() => {
        console.log('[DeepLink] Re-checking async sources after 2s delay...');
        handleAsyncNotificationDeepLink();
      }, 2000);
      
      // Also check when app becomes visible (notification tapped while backgrounded)
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          console.log('[DeepLink] App became visible, checking for notification...');
          setTimeout(() => {
            handleAsyncNotificationDeepLink();
          }, 100);
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        clearTimeout(timeoutId1);
        clearTimeout(timeoutId2);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [navigate, user, location.pathname]);
  
  // Add a maximum timeout to prevent infinite loading (15 seconds total including auth)
  useEffect(() => {
    if (loadEverythingFirst) {
      const timeout = setTimeout(() => {
        console.warn('[Pre-loading] Maximum loading timeout reached (15s), forcing app to show');
        setMaxLoadingTimeout(true);
      }, 15000);
      return () => clearTimeout(timeout);
    }
  }, [loadEverythingFirst]);
  
  // Show loading screen if "load everything first" is enabled and data is still loading
  // But allow logged out users through (don't block auth flow)
  const isLoggedOut = !authLoading && !user;
  if (loadEverythingFirst && !maxLoadingTimeout && !isLoggedOut && (authLoading || initialDataLoading || !initialDataLoaded)) {
    return <LoadingScreen />;
  }
  
  const showDesktopNav = location.pathname !== '/auth' && 
    location.pathname !== '/api-admin' && 
    location.pathname !== '/swipe-card-preview';

  return (
    <>
      {/* Desktop Navigation Sidebar - only on desktop (1024px+) */}
      {showDesktopNav && (
        <ErrorBoundary fallback={null}>
          <div className="hidden lg:block">
            <DesktopNav />
          </div>
        </ErrorBoundary>
      )}

      {/* Main Content Area */}
      <div>
        {/* Scroll to top on route change - must be inside Router */}
        <ScrollToTop />
        
        {/* Logo is now rendered in Home.tsx component */}
        
        {/* Floating Profile Icon - only on Home Page and mobile */}
        {location.pathname === '/' && (
          <div className="lg:hidden">
            <FloatingProfile />
          </div>
        )}

        {/* Global Predictions Banner - hide on auth page and full-screen pages */}
        {!isFullScreenPage && location.pathname !== '/auth' && !location.pathname.startsWith('/league/') && location.pathname !== '/predictions' && location.pathname !== '/global' && (
          <ErrorBoundary fallback={null}>
            <PredictionsBanner />
          </ErrorBoundary>
        )}

        {/* Welcome Message */}
        {showWelcome && (
          <div className="fixed top-40 left-1/2 transform -translate-x-1/2 z-50 bg-[#1C8376] text-white px-8 py-5 rounded-lg shadow-lg w-11/12 max-w-4xl">
            <div className="relative">
              <div className="text-center pr-10">
                <div className="font-bold text-xl">Welcome to TOTL!</div>
                <div className="text-sm text-[#1C8376]/80 mt-1">Your account is now active. Start making predictions!</div>
              </div>
              <button
                onClick={dismissWelcome}
                className="absolute top-0 right-0 text-[#1C8376]/60 hover:text-white text-2xl font-bold"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Routes */}
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/auth" element={<AuthGate />} />
              <Route path="/api-admin" element={<RequireAuth><ApiAdmin /></RequireAuth>} />
              <Route path="/swipe-card-preview" element={<RequireAuth><SwipeCardPreview /></RequireAuth>} />
              <Route path="/" element={<RequireAuth><ErrorBoundary><HomePage /></ErrorBoundary></RequireAuth>} />
              <Route path="/tables" element={<RequireAuth><TablesPage /></RequireAuth>} />
              <Route path="/league/:code" element={<RequireAuth><LeaguePage /></RequireAuth>} />
              <Route path="/predictions" element={<RequireAuth><PredictionsPage /></RequireAuth>} />
              <Route path="/global" element={<RequireAuth><GlobalPage /></RequireAuth>} />
              <Route path="/temp-global" element={<RequireAuth><TempGlobalPage /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
              <Route path="/profile/notifications" element={<RequireAuth><NotificationCentrePage /></RequireAuth>} />
              <Route path="/profile/email-preferences" element={<RequireAuth><EmailPreferencesPage /></RequireAuth>} />
              <Route path="/profile/stats" element={<RequireAuth><StatsPage /></RequireAuth>} />
              <Route path="/how-to-play" element={<RequireAuth><HowToPlayPage /></RequireAuth>} />
              <Route path="/create-league" element={<RequireAuth><CreateLeaguePage /></RequireAuth>} />
              <Route path="/cookie-policy" element={<RequireAuth><CookiePolicyPage /></RequireAuth>} />
              <Route path="/privacy-policy" element={<RequireAuth><PrivacyPolicyPage /></RequireAuth>} />
              <Route path="/terms-and-conditions" element={<RequireAuth><TermsAndConditionsPage /></RequireAuth>} />
              <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
              <Route path="/admin-data" element={<RequireAuth><AdminDataPage /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>

        {/* Bottom Navigation - hide on auth page, swipe predictions, and when making predictions or viewing league pages */}
        {/* Only hide completely on specific swipe routes, otherwise use shouldHide prop */}
        {/* Also hide on desktop (lg+) */}
        {location.pathname !== '/auth' && 
         location.pathname !== '/predictions/swipe' && 
         location.pathname !== '/swipe-card-preview' &&
         <div className="lg:hidden">
           <BottomNav shouldHide={
             (location.pathname === '/predictions' && isSwipeMode) ||
             (location.pathname === '/predictions' && hasSubmittedPredictions === false) ||
             location.pathname.startsWith('/league/')
           } />
         </div>}
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  </React.StrictMode>
);
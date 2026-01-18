// src/main.tsx
import "./output.css";
import "react-chat-elements/dist/main.css";
import React, { Suspense, lazy, useState, useEffect, useLayoutEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";

// Suppress Termly-related network errors (410 Gone) that occur when Termly account is inactive
// These errors are non-critical and don't affect app functionality
// Termly uses Axios (XMLHttpRequest) and fetch, so we intercept both
// Also suppress verbose UserAvatar debug logs
if (typeof window !== 'undefined') {
  // Intercept console.log to suppress verbose UserAvatar debug logs and Termly warnings
  const originalConsoleLog = console.log;
  console.log = (...args: any[]) => {
    // Check all arguments for messages to suppress
    const shouldSuppress = args.some(arg => {
      if (!arg) return false;
      const str = typeof arg === 'string' ? arg : arg.toString();
      
      // Suppress UserAvatar debug logs (too verbose)
      if (str.includes('[UserAvatar]') && 
          (str.includes('Detected src->data-src') || str.includes('restoring src'))) {
        return true;
      }
      
      // Suppress Termly warnings (non-critical)
      if (str.includes('[Termly]')) {
        // Suppress outdated script warnings
        if (str.includes('outdated') || 
            str.includes('CMP script') ||
            str.includes('update instructions') ||
            str.includes('ResourceBlocker') ||
            str.includes('not the first script')) {
          return true;
        }
      }
      
      return false;
    });
    
    // Suppress if matched
    if (shouldSuppress) {
      return;
    }
    
    // Call original console.log for all other logs
    originalConsoleLog.apply(console, args);
  };

  // Intercept console.error to suppress Termly-related errors
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    // Check all arguments for Termly-related content
    const hasTermlyError = args.some(arg => {
      if (!arg) return false;
      
      // Check string messages
      const str = typeof arg === 'string' ? arg : arg.toString();
      if (str.toLowerCase().includes('termly') || 
          str.includes('ERR_BAD_REQUEST') || 
          str.includes('Request failed with status code 410') ||
          str.includes('error fetching configuration')) {
        return true;
      }
      
      // Check error objects
      if (arg.message) {
        const msg = arg.message.toString().toLowerCase();
        if (msg.includes('termly') || 
            msg.includes('410') || 
            msg.includes('err_bad_request') ||
            msg.includes('error fetching configuration')) {
          return true;
        }
      }
      
      // Check for AxiosError with 410 status
      if (arg.name === 'AxiosError' && arg.response?.status === 410) {
        return true;
      }
      
      // Check for 410 status in response
      if (arg.status === 410 || arg.response?.status === 410) {
        return true;
      }
      
      // Check URL in request objects
      if (arg.request?.responseURL?.includes('termly.io') || 
          arg.config?.url?.includes('termly.io')) {
        return true;
      }
      
      return false;
    });
    
    // Suppress Termly-related errors
    if (hasTermlyError) {
      // Silently ignore - this is expected if Termly account is inactive
      return;
    }
    
    // Call original console.error for all other errors
    originalConsoleError.apply(console, args);
  };

  // Intercept fetch to catch and suppress Termly consent script errors and debug telemetry
  const originalFetch = window.fetch;
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    // Extract URL from various argument types (string, Request object, etc.)
    let url = '';
    const firstArg = args[0];
    if (typeof firstArg === 'string') {
      url = firstArg;
    } else if (firstArg instanceof Request) {
      url = firstArg.url;
    } else if (firstArg instanceof URL) {
      url = firstArg.href;
    } else if (firstArg && typeof firstArg === 'object' && 'url' in firstArg) {
      url = String((firstArg as { url: string }).url);
    }
    
  // Suppress debug telemetry calls to localhost:7242 (old debug code)
  // Debug override: allow telemetry when `localStorage.debug:telemetry === 'true'`.
  const allowDebugTelemetry = (() => {
    try {
      return localStorage.getItem('debug:telemetry') === 'true';
    } catch {
      return false;
    }
  })();
  if (!allowDebugTelemetry && (url.includes('127.0.0.1:7242') || url.includes('localhost:7242') || url.includes('ingest/8bc20b5f'))) {
    // Silently ignore - these are old debug telemetry calls
    return new Response(null, { status: 200, statusText: 'OK' });
  }
    
    // If this is a Termly request, catch and suppress 410 errors
    if (url.includes('termly.io')) {
      try {
        const response = await originalFetch(...args);
        // If we get a 410, it's expected - don't log as error
        if (response.status === 410) {
          // Silently handle - already suppressed via console.error interceptor
        }
        return response;
      } catch (error) {
        // Suppress network errors for Termly requests
        // Return a mock 410 response to prevent further errors
        return new Response(null, { status: 410, statusText: 'Gone' });
      }
    }
    
    // For all other requests, use original fetch
    return originalFetch(...args);
  };

  // Intercept XMLHttpRequest to catch Axios requests (Termly uses Axios)
  const OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    
    xhr.open = function(method: string, url: string | URL, async: boolean = true, username?: string | null, password?: string | null) {
      // Store the URL for later checking
      (this as any)._url = url.toString();
      return originalOpen.call(this, method, url, async, username, password);
    };
    
    xhr.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
      const url = (this as any)._url || '';
      
      // Suppress debug telemetry calls to localhost:7242 (old debug code)
      // Debug override: allow telemetry when `localStorage.debug:telemetry === 'true'`.
      const allowDebugTelemetry = (() => {
        try {
          return localStorage.getItem('debug:telemetry') === 'true';
        } catch {
          return false;
        }
      })();
      if (!allowDebugTelemetry && (url.includes('127.0.0.1:7242') || url.includes('localhost:7242') || url.includes('ingest/8bc20b5f'))) {
        // Silently ignore - these are old debug telemetry calls
        // Return immediately without making the request
        return;
      }
      
      // If this is a Termly request, suppress 410 errors
      if (url.includes('termly.io')) {
        const originalOnReadyStateChange = this.onreadystatechange;
        
        this.onerror = function() {
          // Suppress Termly-related errors
          // Don't call originalOnError to prevent error logging
        };
        
        this.onreadystatechange = function(event: Event) {
          // If we get a 410 response, suppress it
          if (this.readyState === 4 && this.status === 410) {
            // Silently handle - already suppressed via console.error interceptor
          }
          // Still call original handler for other cases
          if (originalOnReadyStateChange) {
            originalOnReadyStateChange.call(this, event);
          }
        };
      }
      
      return originalSend.call(this, body);
    };
    
    return xhr;
  } as any;
}

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
const EditAvatarPage = lazy(() => import("./pages/EditAvatar"));
const NotificationCentrePage = lazy(() => import("./pages/NotificationCentre"));
const EmailPreferencesPage = lazy(() => import("./pages/EmailPreferences"));
const StatsPage = lazy(() => import("./pages/Stats"));
const SwipeCardPreview = lazy(() => import("./pages/SwipeCardPreview"));
const CookiePolicyPage = lazy(() => import("./pages/CookiePolicy"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicy"));
const TermsAndConditionsPage = lazy(() => import("./pages/TermsAndConditions"));
const HomeExperimental = lazy(() => import("./pages/HomeExperimental"));
const SupportPage = lazy(() => import("./pages/Support"));

// New onboarding + auth flow
import { AuthGate } from "./features/auth";

import { AuthProvider, useAuth } from "./context/AuthContext";
import PredictionsBanner from "./components/PredictionsBanner";
import BottomNav from "./components/BottomNav";
import FloatingProfile from "./components/FloatingProfile";
import DesktopNav from "./components/DesktopNav";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAppLifecycle } from "./hooks/useAppLifecycle";
import { useTheme } from "./hooks/useTheme";
import LoadingScreen from "./components/LoadingScreen";
import { PageLoader } from "./components/PageLoader";
import ScrollToTop from "./components/ScrollToTop";
// import { isLoadEverythingFirstEnabled } from "./lib/featureFlags"; // Unused - feature flag checked inline
import { loadInitialData } from "./services/initialDataLoader";
import { bootLog } from "./lib/logEvent";
import { isDespiaAvailable } from "./lib/platform";
import { supabase } from "./lib/supabase";

function maybeLoadGoogleAnalytics() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  // GA/GTM should not load in Despia native app (can cause DNS errors/noise and isn't used there).
  if (isDespiaAvailable()) return;
  const GA_ID = "G-5HWWJWTRRD";
  const existing = document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${GA_ID}"]`);
  if (existing) return;

  // Equivalent to the removed index.html snippet.
  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).gtag = function gtag(...args: any[]) {
    (window as any).dataLayer.push(args);
  };
  (window as any).gtag("js", new Date());
  (window as any).gtag("config", GA_ID);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading…</div>;
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

function AppShell() {
  // Check for deep link SYNCHRONOUSLY before React Router renders
  // This prevents the home page from ever rendering if we have a notification deep link
  const searchParams = new URLSearchParams(window.location.search);
  const leagueCode = searchParams.get('leagueCode');
  const rawTab = searchParams.get('tab');
  const tab = rawTab === 'gw' || rawTab === 'mlt' || rawTab === 'gwr' || rawTab === 'chat' ? rawTab : 'chat';
  
  // Handle legacy format: ?leagueCode=ABC12 (convert to /league/:code?tab=chat by default)
  // Also supports: ?leagueCode=ABC12&tab=gw (convert to /league/:code?tab=gw)
  if (leagueCode && !window.location.pathname.startsWith('/league/')) {
    const targetUrl = `/league/${leagueCode}?tab=${tab}`;
    window.history.replaceState(null, '', targetUrl);
  }
  
  // Also handle direct league URLs with tab=chat (from OneSignal web_url)
  // Ensure the URL is preserved correctly
  const pathMatch = window.location.pathname.match(/^\/league\/([^/]+)$/);
  if (pathMatch) {
    const tab = searchParams.get('tab');
    if (tab === 'chat') {
      // URL is already correct, just ensure it stays that way
      // React Router will handle it
    }
  }
  
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
  // Ensure theme is applied globally; useTheme now forces light on desktop.
  useTheme();
  const [initialDataLoading, setInitialDataLoading] = useState(false);
  const isNativeApp = isDespiaAvailable();
  
  // Load Google Analytics only on web (not Despia).
  useEffect(() => {
    maybeLoadGoogleAnalytics();
  }, []);
  
  // Handle deep links from notifications (iOS native)
  // Check URL immediately - AppShell already updated window.location, but ensure React Router sees it
  useLayoutEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const leagueCode = searchParams.get('leagueCode');
    const rawTab = searchParams.get('tab');
    const tab = rawTab === 'gw' || rawTab === 'mlt' || rawTab === 'gwr' || rawTab === 'chat' ? rawTab : 'chat';
    
    // Handle legacy format: ?leagueCode=ABC12 (convert to /league/:code?tab=chat by default)
    // Also supports: ?leagueCode=ABC12&tab=gw (convert to /league/:code?tab=gw)
    if (leagueCode && !location.pathname.startsWith('/league/')) {
      navigate(`/league/${leagueCode}?tab=${tab}`, { replace: true });
      return;
    }
    
    // For direct URLs like /league/ABC12?tab=chat from OneSignal web_url
    // If we're not already on that exact path, navigate to it
    if (location.pathname.startsWith('/league/')) {
      if (tab === 'chat') {
        // Already on the correct path with tab=chat
        // League page will handle opening the chat tab
        // No navigation needed - React Router already matched the route
      }
    }
  }, [navigate, location.pathname, location.search]);
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
    
    if (import.meta.env.DEV) {
    console.log('[App] Preloading Volley images for Despia...');
    }
    volleyImages.forEach((src) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        if (import.meta.env.DEV) {
        console.log(`[App] Preloaded Volley image: ${src}`);
        }
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
    if (loadEverythingFirst && import.meta.env.DEV) {
      console.log('[Pre-loading] Load everything first mode is ENABLED');
      console.log('[Pre-loading] To disable, run: localStorage.setItem("feature:loadEverythingFirst", "false")');
    }
  }, [loadEverythingFirst]);
  
  // Load initial data if feature flag is enabled
  useEffect(() => {
    if (import.meta.env.DEV) {
    console.log(`[Pre-loading] Effect triggered - flag: ${loadEverythingFirst}, authLoading: ${authLoading}, userId: ${user?.id || 'null'}, loaded: ${initialDataLoaded}`);
    }
    
    if (!loadEverythingFirst || authLoading || !user?.id) {
      // If feature flag is off, or auth is still loading, or no user, skip
      if (!authLoading && user && import.meta.env.DEV) {
        console.log('[Pre-loading] Skipping pre-load (flag off or no user), setting loaded=true');
      }
      if (!authLoading && user) {
        setInitialDataLoaded(true);
      }
      return;
    }
    
    // If we've already loaded, don't load again
    if (initialDataLoaded) {
      if (import.meta.env.DEV) {
      console.log('[Pre-loading] Already loaded, skipping');
      }
      return;
    }
    
    // ALWAYS block and pre-load ALL data before showing page
    // This ensures all data is ready instantly
    if (import.meta.env.DEV) {
    console.log('[Pre-loading] Starting initial data load for user:', user.id);
    }
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
    if (import.meta.env.DEV) {
    console.log('[Pre-loading] Calling loadInitialData...');
    }
    loadInitialData(user.id)
      .then(() => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        if (import.meta.env.DEV) {
        console.log('[Pre-loading] Initial data loaded successfully');
        }
        bootLog.initialDataSuccess(duration);
        setInitialDataLoaded(true);
        setInitialDataLoading(false);
        // Mark pre-load as complete so HomePage knows cache is ready
        sessionStorage.setItem('preload:complete', 'true');
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
        
        // Use current_viewing_gw only if explicitly set.
        // New users (null) should default to current published GW.
        const userViewingGw = prefs?.current_viewing_gw ?? null;
        
        // Determine which GW to check
        const gwToCheck = userViewingGw !== null && userViewingGw < dbCurrentGw ? userViewingGw : dbCurrentGw;

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

  // Fallback: If OneSignal didn't set URL, check for very recent messages (last 30 seconds)
  // This only runs once per session and only if we're not already on a league page
  useEffect(() => {
    // Skip if already on league page or no user
    if (location.pathname.startsWith('/league/') || !user?.id) return;
    
    // Only check once per session
    const checked = sessionStorage.getItem('deepLink_fallback_checked');
    if (checked) return;
    sessionStorage.setItem('deepLink_fallback_checked', 'true');
    
    // Check for very recent message (within last 30 seconds)
    (async () => {
      try {
        const { data: leagueMembers } = await supabase
          .from('league_members')
          .select('league_id')
          .eq('user_id', user.id);
        
        if (!leagueMembers?.length) return;
        
        const leagueIds = leagueMembers.map((lm: any) => lm.league_id).filter(Boolean);
        const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
        
        const { data: recentMessage } = await supabase
          .from('league_messages')
          .select('leagues!inner(code)')
          .in('league_id', leagueIds)
          .gte('created_at', thirtySecondsAgo)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const leagueData = recentMessage?.leagues as { code: string } | undefined;
        if (leagueData?.code) {
          const targetUrl = `/league/${leagueData.code}?tab=chat`;
          navigate(targetUrl, { replace: true });
          
          // Store debug info for fallback navigation
          try {
            localStorage.setItem('deepLink_debug', JSON.stringify({
              method: 'fallback_recent_message',
              originalPath: location.pathname,
              leagueCode: leagueData.code,
              targetUrl,
              timestamp: new Date().toISOString()
            }));
            localStorage.setItem('deepLink_result', JSON.stringify({
              success: true,
              method: 'fallback_recent_message',
              leagueCode: leagueData.code,
              targetUrl,
              timestamp: new Date().toISOString()
            }));
          } catch (e) {
            // Ignore storage errors
          }
        } else {
          // Store failure if no recent message found
          try {
            localStorage.setItem('deepLink_result', JSON.stringify({
              success: false,
              method: 'fallback_recent_message',
              reason: 'no_recent_message_found',
              timestamp: new Date().toISOString()
            }));
          } catch (e) {
            // Ignore storage errors
          }
        }
      } catch (e) {
        console.warn('[DeepLink] Fallback check failed:', e);
      }
    })();
  }, [user?.id, location.pathname, navigate]);
  
  // Add a maximum timeout to prevent infinite loading (15 seconds total including auth)
  useEffect(() => {
    if (loadEverythingFirst) {
      const timeout = setTimeout(() => {
        // Only show timeout warning if data hasn't loaded yet
        if (!initialDataLoaded) {
        console.warn('[Pre-loading] Maximum loading timeout reached (15s), forcing app to show');
        }
        setMaxLoadingTimeout(true);
      }, 15000);
      return () => clearTimeout(timeout);
    }
  }, [loadEverythingFirst, initialDataLoaded]);
  
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
        {isNativeApp && <div style={{ height: "var(--safe-area-top)" }} />}
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
        {!isFullScreenPage && location.pathname !== '/auth' && location.pathname !== '/support' && !location.pathname.startsWith('/league/') && location.pathname !== '/predictions' && location.pathname !== '/global' && (
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
                className="absolute top-0 right-0 text-[#1C8376]/60 text-2xl font-bold"
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
              <Route path="/support" element={<SupportPage />} />
              <Route path="/api-admin" element={<RequireAuth><ApiAdmin /></RequireAuth>} />
              <Route path="/swipe-card-preview" element={<RequireAuth><SwipeCardPreview /></RequireAuth>} />
              <Route path="/" element={<RequireAuth><ErrorBoundary><HomePage /></ErrorBoundary></RequireAuth>} />
              <Route path="/tables" element={<RequireAuth><TablesPage /></RequireAuth>} />
              <Route path="/league/:code" element={<RequireAuth><LeaguePage /></RequireAuth>} />
              <Route path="/predictions" element={<RequireAuth><PredictionsPage /></RequireAuth>} />
              <Route path="/global" element={<RequireAuth><GlobalPage /></RequireAuth>} />
              <Route path="/temp-global" element={<RequireAuth><TempGlobalPage /></RequireAuth>} />
              <Route path="/home-experimental" element={<RequireAuth><ErrorBoundary><HomeExperimental /></ErrorBoundary></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
              <Route path="/profile/edit-avatar" element={<RequireAuth><EditAvatarPage /></RequireAuth>} />
              <Route path="/profile/notifications" element={<RequireAuth><NotificationCentrePage /></RequireAuth>} />
              <Route path="/profile/email-preferences" element={<RequireAuth><EmailPreferencesPage /></RequireAuth>} />
              <Route path="/profile/stats" element={<RequireAuth><StatsPage /></RequireAuth>} />
              <Route path="/how-to-play" element={<RequireAuth><HowToPlayPage /></RequireAuth>} />
              <Route path="/create-league" element={<RequireAuth><CreateLeaguePage /></RequireAuth>} />
              <Route path="/cookie-policy" element={<RequireAuth><CookiePolicyPage /></RequireAuth>} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
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
         location.pathname !== '/support' &&
         location.pathname !== '/predictions/swipe' && 
         location.pathname !== '/swipe-card-preview' &&
         <div className="lg:hidden">
           <BottomNav shouldHide={
             (location.pathname === '/predictions' && isSwipeMode) ||
             (location.pathname === '/predictions' && hasSubmittedPredictions === false) ||
             location.pathname.startsWith('/league/')
           } />
         </div>}
        {isNativeApp && <div style={{ height: "var(--safe-area-bottom)" }} />}
      </div>
    </>
  );
}

// Note: Termly may show console errors (410 Gone) if the Termly account is inactive.
// This is expected and non-critical - the policy pages will still function.
// The error comes from Termly's script trying to fetch a consent script endpoint.
// To suppress these errors, you can filter them in browser DevTools console filters.

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  </React.StrictMode>
);
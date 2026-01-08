// src/main.tsx
import "./index.css";
import "react-chat-elements/dist/main.css";
import React, { Suspense, lazy, useState, useEffect, useLayoutEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";

// Removed addEventListener interceptor - it was breaking all button clicks

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
import { PageLoader } from "./components/PageLoader";
import ScrollToTop from "./components/ScrollToTop";
// import { isLoadEverythingFirstEnabled } from "./lib/featureFlags"; // Unused - feature flag checked inline
import { loadInitialData } from "./services/initialDataLoader";
import { bootLog } from "./lib/logEvent";
import { supabase } from "./lib/supabase";
import { useTheme } from "./hooks/useTheme";

// Helper function to log deep link attempts to history
function logDeepLinkAttempt(entry: {
  success: boolean;
  method: string;
  originalPath?: string;
  leagueCode?: string;
  targetUrl?: string;
  reason?: string;
  [key: string]: any;
}) {
  try {
    const historyKey = 'deepLink_history';
    const existingHistory = localStorage.getItem(historyKey);
    const history = existingHistory ? JSON.parse(existingHistory) : [];
    
    const logEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };
    
    history.push(logEntry);
    // Keep only last 50 attempts
    const trimmedHistory = history.slice(-50);
    localStorage.setItem(historyKey, JSON.stringify(trimmedHistory));
    
    // Also update last check/result for backward compatibility
    if (entry.success && entry.targetUrl) {
      localStorage.setItem('deepLink_debug', JSON.stringify({
        method: entry.method,
        originalPath: entry.originalPath,
        leagueCode: entry.leagueCode,
        targetUrl: entry.targetUrl,
        timestamp: logEntry.timestamp
      }));
      localStorage.setItem('deepLink_result', JSON.stringify(logEntry));
    } else if (!entry.success) {
      localStorage.setItem('deepLink_result', JSON.stringify(logEntry));
    }
  } catch (e) {
    // Ignore storage errors
    console.warn('[DeepLink] Failed to log attempt:', e);
  }
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
  const tab = searchParams.get('tab');
  const currentPath = window.location.pathname;
  const currentSearch = window.location.search;
  const currentHref = window.location.href;
  
  // Handle legacy format: ?leagueCode=ABC12 (convert to /league/:code?tab=chat)
  if (leagueCode && !window.location.pathname.startsWith('/league/')) {
    const targetUrl = `/league/${leagueCode}?tab=chat`;
    window.history.replaceState(null, '', targetUrl);
  }
  
  // Also handle direct league URLs with tab=chat (from OneSignal web_url)
  // Ensure the URL is preserved correctly
  const pathMatch = window.location.pathname.match(/^\/league\/([^/]+)$/);
  if (pathMatch) {
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
  const [initialDataLoading, setInitialDataLoading] = useState(false);
  
  // Initialize theme on app load
  useTheme();
  
  // Track previous location to detect changes
  const prevLocationRef = useRef<{ pathname: string; search: string } | null>(null);
  // Track if we've already processed deep link for current league page (prevents remount loops)
  const processedLeaguePageRef = useRef<string | null>(null);
  // Track navigate function reference to detect if it's changing
  const prevNavigateRef = useRef<typeof navigate | null>(null);
  
  // Handle deep links from notifications (iOS native)
  // Check URL immediately - AppShell already updated window.location, but ensure React Router sees it
  useLayoutEffect(() => {
    // CRITICAL: If we're already on a league page and pathname hasn't changed, skip entirely
    // This prevents the effect from running when React Router remounts the route component
    const isOnLeaguePage = location.pathname.startsWith('/league/');
    const hasPrevLocation = prevLocationRef.current !== null;
    const prevPathname = prevLocationRef.current?.pathname;
    const currentPathname = location.pathname;
    const pathnameChanged = hasPrevLocation && prevPathname !== currentPathname;
    
    // Log skip check for debugging
    if (isOnLeaguePage) {
      try {
        const existingLogs = localStorage.getItem('message_subscription_logs');
        const logs = existingLogs ? JSON.parse(existingLogs) : [];
        const skipCheckLog = {
          timestamp: Date.now(),
          leagueId: null,
          status: 'DEEP_LINK_SKIP_CHECK',
          channel: 'main.tsx',
          isOnLeaguePage: true,
          hasPrevLocation,
          pathnameChanged,
          prevPathname,
          currentPathname,
          willSkip: isOnLeaguePage && hasPrevLocation && !pathnameChanged,
          reason: `Skip check: isOnLeaguePage=${isOnLeaguePage}, hasPrevLocation=${hasPrevLocation}, pathnameChanged=${pathnameChanged}`,
        };
        logs.push(skipCheckLog);
        const recentLogs = logs.slice(-50);
        localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
      } catch (e) {
        console.error('[AppContent] Failed to log skip check:', e);
      }
    }
    
    // Skip effect if we're on a league page and pathname hasn't changed
    // This prevents remount loops - we check multiple cases:
    // 1. If we have a previous location and pathname hasn't changed (normal case)
    // 2. If we're on a league page and there's no leagueCode in the URL (already navigated, no deep link)
    // 3. If we're on a league page and only have ?tab=chat (already navigated, just tab param)
    const searchParamsForSkip = new URLSearchParams(window.location.search);
    const hasLeagueCode = searchParamsForSkip.get('leagueCode');
    const hasTab = searchParamsForSkip.get('tab');
    const shouldSkip = isOnLeaguePage && (
      (hasPrevLocation && !pathnameChanged) || // Normal case: pathname unchanged
      (!hasLeagueCode && (hasTab === 'chat' || !hasTab)) // Already on league page, no deep link params (or just tab=chat)
    );
    
    if (shouldSkip) {
      // Already on league page and pathname hasn't changed - skip effect entirely
      // This prevents remount loops when League.tsx clears search params
      try {
        const existingLogs = localStorage.getItem('message_subscription_logs');
        const logs = existingLogs ? JSON.parse(existingLogs) : [];
        logs.push({
          timestamp: Date.now(),
          leagueId: null,
          status: 'DEEP_LINK_SKIP_ON_LEAGUE',
          channel: 'main.tsx',
          pathname: location.pathname,
          prevPathname: prevLocationRef.current?.pathname,
          hasPrevLocation,
          pathnameChanged,
          hasLeagueCode: !!hasLeagueCode,
          hasTab: !!hasTab,
          reason: 'Already on league page and pathname unchanged - skipping effect to prevent remount',
        });
        const recentLogs = logs.slice(-50);
        localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
      } catch (e) {
        console.error('[AppContent] Failed to log skip:', e);
      }
      // Update prevLocationRef before returning to track that we've seen this location
      prevLocationRef.current = { pathname: location.pathname, search: location.search };
      return; // Skip effect entirely
    }
    
    // Log what triggered the effect
    const navigateChanged = prevNavigateRef.current !== navigate;
    const actualPathnameChanged = hasPrevLocation && prevLocationRef.current?.pathname !== location.pathname;
    
    if (navigateChanged || actualPathnameChanged) {
      try {
        const existingLogs = localStorage.getItem('message_subscription_logs');
        const logs = existingLogs ? JSON.parse(existingLogs) : [];
        const triggerLog = {
          timestamp: Date.now(),
          leagueId: null,
          status: 'DEEP_LINK_EFFECT_TRIGGER',
          channel: 'main.tsx',
          trigger: {
            navigateChanged,
            pathnameChanged: actualPathnameChanged,
            hasPrevLocation,
            prevPathname: prevLocationRef.current?.pathname,
            currentPathname: location.pathname,
          },
          reason: `Effect triggered: navigateChanged=${navigateChanged}, pathnameChanged=${actualPathnameChanged}, hasPrevLocation=${hasPrevLocation}`,
        };
        logs.push(triggerLog);
        const recentLogs = logs.slice(-50);
        localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
      } catch (e) {
        console.error('[AppContent] Failed to log trigger:', e);
      }
    }
    
    prevNavigateRef.current = navigate;
    const searchParams = new URLSearchParams(window.location.search);
    const leagueCode = searchParams.get('leagueCode');
    const tab = searchParams.get('tab');
    const windowPath = window.location.pathname;
    const windowSearch = window.location.search;
    const windowHref = window.location.href;
    
    // Detect what changed
    const prevLocation = prevLocationRef.current;
    let changedFields: string[] = [];
    if (prevLocation) {
      if (prevLocation.pathname !== location.pathname) changedFields.push(`pathname: "${prevLocation.pathname}" → "${location.pathname}"`);
      if (prevLocation.search !== location.search) changedFields.push(`search: "${prevLocation.search}" → "${location.search}"`);
    } else {
      changedFields.push('initial run');
    }
    prevLocationRef.current = { pathname: location.pathname, search: location.search };
    
    // Log to subscription logs for visibility
    try {
      const existingLogs = localStorage.getItem('message_subscription_logs');
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push({
        timestamp: Date.now(),
        leagueId: null,
        status: 'DEEP_LINK_EFFECT_RUN',
        channel: 'main.tsx',
        changedFields,
        location: {
          pathname: location.pathname,
          search: location.search,
          windowPath,
          windowSearch,
        },
        leagueCode,
        tab,
        reason: changedFields.length > 0 ? `Deep link effect ran - changed: ${changedFields.join(', ')}` : 'Deep link effect ran',
      });
      const recentLogs = logs.slice(-50);
      localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
    } catch (e) {
      console.error('[AppContent] Failed to log deep link effect:', e);
    }
    
    // Handle legacy format: ?leagueCode=ABC12 (convert to /league/:code?tab=chat)
    if (leagueCode && !location.pathname.startsWith('/league/')) {
      const targetPath = `/league/${leagueCode}?tab=chat`;
      
      // Log navigation attempt
      try {
        const existingLogs = localStorage.getItem('message_subscription_logs');
        const logs = existingLogs ? JSON.parse(existingLogs) : [];
        logs.push({
          timestamp: Date.now(),
          leagueId: null,
          status: 'NAVIGATE_CALLED',
          channel: 'main.tsx',
          from: location.pathname + location.search,
          to: targetPath,
          reason: 'Legacy leagueCode format - navigating',
        });
        const recentLogs = logs.slice(-50);
        localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
      } catch (e) {
        console.error('[AppContent] Failed to log navigate:', e);
      }
      
      navigate(targetPath, { replace: true });
      
      // Log successful deep link
      logDeepLinkAttempt({
        success: true,
        method: 'legacy_leagueCode_param',
        originalPath: location.pathname,
        leagueCode,
        targetUrl: targetPath
      });
      return;
    }
    
    // For direct URLs like /league/ABC12?tab=chat from OneSignal web_url
    // Ensure we're on the correct path - if we're on home page but URL has league path, navigate
    if (tab === 'chat' && location.pathname === '/' && window.location.pathname.startsWith('/league/')) {
      // Extract league code from window.location (not React Router location yet)
      const pathMatch = window.location.pathname.match(/^\/league\/([^/]+)$/);
      if (pathMatch) {
        const targetPath = window.location.pathname + window.location.search;
        
        // Log navigation attempt
        try {
          const existingLogs = localStorage.getItem('message_subscription_logs');
          const logs = existingLogs ? JSON.parse(existingLogs) : [];
          logs.push({
            timestamp: Date.now(),
            leagueId: null,
            status: 'NAVIGATE_CALLED',
            channel: 'main.tsx',
            from: location.pathname + location.search,
            to: targetPath,
            reason: 'Direct URL from window.location - navigating',
          });
          const recentLogs = logs.slice(-50);
          localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
        } catch (e) {
          console.error('[AppContent] Failed to log navigate:', e);
        }
        
        navigate(targetPath, { replace: true });
        
        // Log successful deep link
        logDeepLinkAttempt({
          success: true,
          method: 'direct_url_onesignal',
          originalPath: location.pathname,
          leagueCode: pathMatch[1],
          targetUrl: targetPath
        });
        return;
      }
    }
    
    // If we're on league page, check if we've already processed it
    // This prevents the effect from re-running when League page clears ?tab=chat
    if (location.pathname.startsWith('/league/')) {
      const currentLeaguePath = location.pathname;
      
      // If we've already processed this league page and only search changed, skip entirely
      if (processedLeaguePageRef.current === currentLeaguePath && changedFields.some(f => f.includes('search'))) {
        // Only search changed on a league page we've already processed - ignore it
        // This prevents remount loops when League page clears ?tab=chat
        try {
          const existingLogs = localStorage.getItem('message_subscription_logs');
          const logs = existingLogs ? JSON.parse(existingLogs) : [];
          logs.push({
            timestamp: Date.now(),
            leagueId: null,
            status: 'DEEP_LINK_SKIP_SEARCH_CHANGE',
            channel: 'main.tsx',
            pathname: location.pathname,
            search: location.search,
            changedFields,
            reason: 'Already processed league page - ignoring search param change to prevent remount',
          });
          const recentLogs = logs.slice(-50);
          localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
        } catch (e) {
          console.error('[AppContent] Failed to log skip:', e);
        }
        return; // Skip entirely - don't even log or do anything
      }
      
      // First time on this league page OR pathname changed - mark as processed
      processedLeaguePageRef.current = currentLeaguePath;
      
      // Already on league page - let League page handle tab opening
      // No navigation needed - React Router already matched the route
      
      // Log early return
      try {
        const existingLogs = localStorage.getItem('message_subscription_logs');
        const logs = existingLogs ? JSON.parse(existingLogs) : [];
        logs.push({
          timestamp: Date.now(),
          leagueId: null,
          status: 'DEEP_LINK_EARLY_RETURN',
          channel: 'main.tsx',
          pathname: location.pathname,
          search: location.search,
          changedFields,
          reason: 'Already on league page - exiting early to prevent remount',
        });
        const recentLogs = logs.slice(-50);
        localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
      } catch (e) {
        console.error('[AppContent] Failed to log early return:', e);
      }
      return; // CRITICAL: Exit early to prevent any navigation when already on league page
    }
    
    // Not on league page - clear the processed ref
    processedLeaguePageRef.current = null;
  }, [location.pathname]); // Removed navigate and location.search - only pathname changes should trigger effect
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
        
        // Dispatch event so components can react immediately (no polling delay)
        window.dispatchEvent(new CustomEvent('preloadComplete', {
          detail: { userId: user.id }
        }));
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
          
          // Store debug info for fallback navigation (with history)
          logDeepLinkAttempt({
            success: true,
            method: 'fallback_recent_message',
            originalPath: location.pathname,
            leagueCode: leagueData.code,
            targetUrl
          });
        } else {
          // Store failure if no recent message found (with history)
          logDeepLinkAttempt({
            success: false,
            method: 'fallback_recent_message',
            reason: 'no_recent_message_found',
            originalPath: location.pathname
          });
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

// Global error handlers - set up BEFORE React renders to catch all crashes
// These save crashes to localStorage immediately so logs persist even if app crashes completely
if (typeof window !== 'undefined') {
  // Catch unhandled JavaScript errors
  window.addEventListener('error', (event) => {
    try {
      const crashLog = {
        timestamp: Date.now(),
        errorMessage: event.message || 'Unknown error',
        errorStack: event.error?.stack || 'No stack trace',
        filename: event.filename || 'Unknown',
        lineno: event.lineno || 0,
        colno: event.colno || 0,
        url: window.location.href,
        userAgent: navigator.userAgent,
        source: 'window.onerror',
      };
      
      const existingCrashes = localStorage.getItem('app_crashes');
      const crashes = existingCrashes ? JSON.parse(existingCrashes) : [];
      crashes.push(crashLog);
      
      // Keep only last 50 crashes
      const recentCrashes = crashes.slice(-50);
      localStorage.setItem('app_crashes', JSON.stringify(recentCrashes));
    } catch (e) {
      console.error('[Global Error Handler] Failed to store crash:', e);
    }
  });
  
  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    try {
      const crashLog = {
        timestamp: Date.now(),
        errorMessage: event.reason?.message || String(event.reason) || 'Unhandled promise rejection',
        errorStack: event.reason?.stack || 'No stack trace',
        url: window.location.href,
        userAgent: navigator.userAgent,
        source: 'unhandledrejection',
        reason: event.reason?.toString() || 'Unknown',
      };
      
      const existingCrashes = localStorage.getItem('app_crashes');
      const crashes = existingCrashes ? JSON.parse(existingCrashes) : [];
      crashes.push(crashLog);
      
      // Keep only last 50 crashes
      const recentCrashes = crashes.slice(-50);
      localStorage.setItem('app_crashes', JSON.stringify(recentCrashes));
    } catch (e) {
      console.error('[Global Error Handler] Failed to store promise rejection:', e);
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  </React.StrictMode>
);
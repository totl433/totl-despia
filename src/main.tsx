// src/main.tsx
import "./index.css";
import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";

// Lazy load pages
const TablesPage = lazy(() => import("./pages/Tables"));
const LeaguePage = lazy(() => import("./pages/League"));
const PredictionsPage = lazy(() => import("./pages/Predictions"));
const AdminPage = lazy(() => import("./pages/Admin"));
const HomePage = lazy(() => import("./pages/Home"));
const GlobalPage = lazy(() => import("./pages/Global"));
const TempGlobalPage = lazy(() => import("./pages/TempGlobal"));
const CreateLeaguePage = lazy(() => import("./pages/CreateLeague"));
const HowToPlayPage = lazy(() => import("./pages/HowToPlay"));
const NewPredictionsCentre = lazy(() => import("./pages/NewPredictionsCentre"));
const TestApiPredictions = lazy(() => import("./pages/TestApiPredictions"));
const TestAdminApi = lazy(() => import("./pages/TestAdminApi"));
const TestDespia = lazy(() => import("./pages/TestDespia"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const SignIn = lazy(() => import("./pages/SignIn"));

import { AuthProvider, useAuth } from "./context/AuthContext";
import PredictionsBanner from "./components/PredictionsBanner";
import BottomNav from "./components/BottomNav";
import FloatingProfile from "./components/FloatingProfile";
import { ErrorBoundary } from "./components/ErrorBoundary";

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
  const { showWelcome, dismissWelcome } = useAuth();
  
  // Prefetch data when app comes to foreground
  useAppLifecycle();
  
  // Hide header/banner for full-screen pages
  const isFullScreenPage = false;

  // Handle notification opens - navigate to league when notification is clicked
  React.useEffect(() => {
    // Check if OneSignal is available (for web)
    const OneSignal = (globalThis as any)?.OneSignal || (typeof window !== 'undefined' ? (window as any)?.OneSignal : null);
    
    if (OneSignal && typeof OneSignal.on === 'function') {
      // Listen for notification opened event
      OneSignal.on('notificationDisplay', (event: any) => {
        console.log('[Notification] Notification displayed:', event);
      });

      OneSignal.on('notificationClick', (event: any) => {
        console.log('[Notification] Notification clicked:', event);
        const data = event?.notification?.additionalData || event?.data;
        if (data?.url) {
          console.log('[Notification] Navigating to:', data.url);
          navigate(data.url);
        } else if (data?.leagueCode) {
          console.log('[Notification] Navigating to league:', data.leagueCode);
          navigate(`/league/${data.leagueCode}`);
        }
      });
    }

    // Also handle URL-based navigation (for when app opens from notification)
    // Check if there's a URL parameter or hash that indicates a notification open
    const handleNotificationUrl = () => {
      // OneSignal may set a URL in the notification that opens the app
      // Check for URL in hash or query params
      const hash = window.location.hash;
      const searchParams = new URLSearchParams(window.location.search);
      
      // If URL is in hash (e.g., #/league/code)
      if (hash && hash.startsWith('#/')) {
        const path = hash.slice(1); // Remove #
        if (path.startsWith('/league/')) {
          navigate(path);
        }
      }
      
      // If leagueCode is in query params
      const leagueCode = searchParams.get('leagueCode');
      if (leagueCode) {
        navigate(`/league/${leagueCode}`);
      }
    };

    handleNotificationUrl();
  }, [navigate]);
  
  return (
    <>
      {/* Logo is now rendered in Home.tsx component */}
      
      {/* Floating Profile Icon - only on Home Page */}
      {location.pathname === '/' && <FloatingProfile />}

      {/* Global Predictions Banner - hide on auth page and full-screen pages */}
      {!isFullScreenPage && location.pathname !== '/auth' && !location.pathname.startsWith('/league/') && location.pathname !== '/test-api-predictions' && <PredictionsBanner />}

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
            <Route path="/auth" element={<SignIn />} />
            <Route path="/new-predictions" element={<RequireAuth><NewPredictionsCentre /></RequireAuth>} />
            <Route path="/test-api-predictions" element={<RequireAuth><TestApiPredictions /></RequireAuth>} />
            <Route path="/test-admin-api" element={<RequireAuth><TestAdminApi /></RequireAuth>} />
            <Route path="/test-despia" element={<RequireAuth><TestDespia /></RequireAuth>} />
            <Route path="/" element={<RequireAuth><ErrorBoundary><HomePage /></ErrorBoundary></RequireAuth>} />
            <Route path="/tables" element={<RequireAuth><TablesPage /></RequireAuth>} />
            <Route path="/league/:code" element={<RequireAuth><LeaguePage /></RequireAuth>} />
            <Route path="/predictions" element={<RequireAuth><PredictionsPage /></RequireAuth>} />
            <Route path="/global" element={<RequireAuth><GlobalPage /></RequireAuth>} />
            <Route path="/temp-global" element={<RequireAuth><TempGlobalPage /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
            <Route path="/how-to-play" element={<RequireAuth><HowToPlayPage /></RequireAuth>} />
            <Route path="/create-league" element={<RequireAuth><CreateLeaguePage /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>

      {/* Bottom Navigation - hide on auth page, league pages, and swipe prediction page */}
      {location.pathname !== '/auth' && !location.pathname.startsWith('/league/') && location.pathname !== '/predictions/swipe' && <BottomNav />}
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
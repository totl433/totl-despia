// src/main.tsx
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useNavigate } from "react-router-dom";

import TablesPage from "./pages/Tables";
import LeaguePage from "./pages/League";
import PredictionsPage from "./pages/Predictions";
import AdminPage from "./pages/Admin";
import HomePage from "./pages/Home";
import GlobalPage from "./pages/Global";
import CreateLeaguePage from "./pages/CreateLeague";
import HowToPlayPage from "./pages/HowToPlay";
import SwipePredictions from "./pages/SwipePredictions";
import ProfilePage from "./pages/Profile";
import { AuthProvider, useAuth } from "./context/AuthContext";
import PredictionsBanner from "./components/PredictionsBanner";
import BottomNav from "./components/BottomNav";
import SignIn from "./pages/SignIn";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading…</div>;
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

function AppShell() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  
  return (
    <BrowserRouter>
      <AppContent menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
    </BrowserRouter>
  );
}

function AppContent({ menuOpen, setMenuOpen }: { 
  menuOpen: boolean; 
  setMenuOpen: (value: boolean | ((prev: boolean) => boolean)) => void; 
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, showWelcome, dismissWelcome, signOut } = useAuth();
  
  // Admin user IDs (Jof and ThomasJamesBird)
  const isAdmin = user?.id === '4542c037-5b38-40d0-b189-847b8f17c222' || user?.id === '36f31625-6d6c-4aa4-815a-1493a812841b';
  
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

      {/* Site Header */}
      {!isFullScreenPage && <header className="sticky top-0 z-50 text-white shadow">
        <div className="bg-[#1C8376]">
          <div className="max-w-6xl mx-auto px-4 h-20 sm:h-24 flex items-center gap-6">
                 <Link to="/" className="flex items-center no-underline gap-3">
                   <img src="/assets/badges/totl-logo1.svg" alt="TOTL" className="h-14 sm:h-18 w-auto" />
                   <span className="bg-white/20 text-white text-xs font-bold px-2 py-1 rounded">BETA V1.1</span>
                 </Link>

            {/* Desktop nav */}
            <div className="ml-auto hidden sm:flex items-center gap-6">
              <Link to="/how-to-play" className="text-white no-underline hover:opacity-90 text-xl font-bold">How To Play</Link>
              {isAdmin && <Link to="/admin" className="text-white no-underline hover:opacity-90 text-xl font-bold">Admin</Link>}
            </div>

            {/* User info and logout - desktop only */}
            <div className="ml-auto hidden sm:flex items-center gap-4">
              <div className="text-white/90 text-sm">
                {user?.user_metadata?.display_name || user?.email || 'User'}
              </div>
              <button
                onClick={async () => {
                  await signOut();
                }}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md text-white text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>

            {/* Hamburger menu */}
            <div className="ml-auto sm:ml-4 flex items-center gap-2">
              <button
                className="sm:hidden inline-flex items-center justify-center rounded-md p-2 focus:outline-none focus:ring-0"
                aria-label="Toggle menu"
                onClick={() => setMenuOpen(v => !v)}
              >
                {/* icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 font-bold">
                  <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div className="sm:hidden border-t border-white/20">
              <div className="max-w-6xl mx-auto px-4 py-3 pb-6 flex flex-col gap-4 text-white">
                {/* User info for mobile */}
                <div className="pb-2 border-b border-white/20 mb-2">
                  <div className="text-sm text-white/70">Logged in as:</div>
                  <div className="font-medium text-white">
                    {user?.user_metadata?.display_name || user?.email || 'User'}
                  </div>
                </div>
                
                <Link
                  to="/profile"
                  className="text-white no-underline hover:opacity-90 text-xl font-bold"
                  onClick={() => setMenuOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  to="/how-to-play"
                  className="text-white no-underline hover:opacity-90 text-xl font-bold"
                  onClick={() => setMenuOpen(false)}
                >
                  How To Play
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="text-white no-underline hover:opacity-90 text-xl font-bold"
                    onClick={() => setMenuOpen(false)}
                  >
                    Admin
                  </Link>
                )}
                
                {/* Mobile logout */}
                <button
                  onClick={async () => {
                    await signOut();
                    setMenuOpen(false);
                  }}
                  className="text-left text-white hover:opacity-90 text-xl font-bold"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>}

      {/* Global Predictions Banner - hide on auth page and full-screen pages */}
      {!isFullScreenPage && location.pathname !== '/auth' && <PredictionsBanner />}

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
      <Routes>
        <Route path="/auth" element={<SignIn />} />
        <Route path="/new-predictions" element={<RequireAuth><SwipePredictions /></RequireAuth>} />
        <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/tables" element={<RequireAuth><TablesPage /></RequireAuth>} />
        <Route path="/league/:code" element={<RequireAuth><LeaguePage /></RequireAuth>} />
        <Route path="/predictions" element={<RequireAuth><PredictionsPage /></RequireAuth>} />
        <Route path="/global" element={<RequireAuth><GlobalPage /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/how-to-play" element={<RequireAuth><HowToPlayPage /></RequireAuth>} />
        <Route path="/create-league" element={<RequireAuth><CreateLeaguePage /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Bottom Navigation - hide on auth page and league pages */}
      {location.pathname !== '/auth' && !location.pathname.startsWith('/league/') && <BottomNav />}
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
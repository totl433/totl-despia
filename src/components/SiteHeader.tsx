import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * SiteHeader – gradient header bar with brand, current user, and hamburger menu on mobile.
 * - Desktop: inline nav links
 * - Mobile: hamburger toggles a slide-down menu
 */
export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  
  // Admin user IDs (Jof and ThomasJamesBird)
  const isAdmin = user?.id === '4542c037-5b38-40d0-b189-847b8f17c222' || user?.id === '36f31625-6d6c-4aa4-815a-1493a812841b';

  const Item = ({ to, children }: { to: string; children: React.ReactNode }) => (
    <NavLink
      to={to}
      onClick={() => setMenuOpen(false)}
      className={({ isActive }) =>
        `px-3 py-2 rounded ` +
        (isActive ? "text-white" : "text-white/80")
      }
    >
      {children}
    </NavLink>
  );

  return (
    <header className="relative">
      {/* Gradient bar */}
      <div className="bg-gradient-to-r from-violet-700 via-fuchsia-600 to-red-500 text-white">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand */}
          <Link to="/" className="font-bold tracking-wide text-lg sm:text-xl select-none flex-shrink-0">TOTL</Link>

          {/* Desktop nav - shows on sm to lg (640px to 1023px) */}
          <nav className="hidden sm:flex lg:hidden items-center gap-1 flex-1 justify-center">
            <Item to="/tables">Mini Leagues</Item>
            <Item to="/predictions">Predictions</Item>
            <Item to="/global">Global</Item>
            {isAdmin && <Item to="/admin">Admin</Item>}
          </nav>

          {/* User info and controls */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* User name - desktop only */}
            <div className="hidden sm:block text-white/90 text-sm">
              {user?.user_metadata?.display_name || user?.email || 'User'}
            </div>
            
            {/* Logout button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[SiteHeader] Sign out button clicked - forcing immediate logout');
                // Call signOut but don't wait - force redirect immediately
                signOut().catch(() => {
                  // If signOut fails, still redirect
                  window.location.href = '/auth';
                });
                // Also set a backup redirect in case signOut hangs
                setTimeout(() => {
                  console.log('[SiteHeader] Backup redirect triggered');
                  window.location.href = '/auth';
                }, 500);
              }}
              className="px-3 py-1 bg-white/20 rounded-md text-white text-sm font-medium"
            >
              Sign Out
            </button>
            
            {/* Hamburger menu - mobile only */}
            <button
              className="sm:hidden inline-flex items-center justify-center h-8 w-8 rounded-md"
              aria-label="Menu"
              onClick={() => setMenuOpen(o => !o)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu (slide-down) */}
      {menuOpen && (
        <div className="sm:hidden bg-white shadow-sm border-b">
          <div className="max-w-6xl mx-auto px-3 py-2 flex flex-col">
            {/* User info for mobile */}
            <div className="px-3 py-2 border-b border-gray-100 mb-2">
              <div className="text-sm text-gray-600">Logged in as:</div>
              <div className="font-medium text-gray-900">
                {user?.user_metadata?.display_name || user?.email || 'User'}
              </div>
            </div>
            
            <a
              href="https://chat.whatsapp.com/G2siRAr22kR2tOAcYAkLTp"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2 rounded text-emerald-600 flex items-center gap-2"
            >
              <span>📱</span>
              Join WhatsApp Community
            </a>
            <Item to="/leagues">Mini Leagues</Item>
            <Item to="/predictions">Predictions</Item>
            <Item to="/global">Global</Item>
            {isAdmin && <Item to="/admin">Admin</Item>}
            
            {/* Mobile logout */}
            <button
              onClick={async () => {
                await signOut();
                setMenuOpen(false);
              }}
              className="px-3 py-2 text-left text-red-600 border-t border-gray-100 mt-2"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
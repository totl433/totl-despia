import { useEffect } from 'react';
import { isWebBrowser } from '../lib/platform';

/**
 * Cookie Consent Banner Component
 * 
 * Loads Termly cookie consent banner for web users only (not in native app).
 * Termly handles GDPR/CCPA compliance automatically.
 * 
 * Note: You'll need to get your Termly website UUID from Termly dashboard
 * and replace 'YOUR_TERMLY_UUID' below, or configure it via Termly's dashboard.
 * 
 * Usage: Add to main app component (main.tsx)
 */
export default function CookieConsent() {
  useEffect(() => {
    // Only load cookie consent on web browsers (not in native app)
    if (!isWebBrowser()) {
      return;
    }

    // Check if Termly cookie consent script is already loaded
    const existingScript = document.getElementById('termly-consent-script');
    if (existingScript) {
      return; // Already loaded
    }

    // Check if Termly is already available (from other pages like CookiePolicy)
    if ((window as any).Termly) {
      // Termly is already loaded - it should handle cookie consent automatically
      // But we may need to initialize the consent banner specifically
      console.log('[CookieConsent] Termly already available');
      return;
    }

    // Load Termly cookie consent script
    // Note: Termly's embed.min.js script handles cookie consent automatically
    // You may need to configure it in Termly dashboard or add data-website-uuid attribute
    const script = document.createElement('script');
    script.id = 'termly-consent-script';
    script.src = 'https://app.termly.io/embed.min.js';
    script.async = true;
    script.setAttribute('data-auto-block', 'on');
    // TODO: Add your Termly website UUID here if required
    // script.setAttribute('data-website-uuid', 'your-termly-uuid-here');
    
    script.onload = () => {
      console.log('[CookieConsent] Termly cookie consent script loaded');
    };
    
    script.onerror = () => {
      console.error('[CookieConsent] Failed to load Termly cookie consent script');
    };
    
    // Insert script in head (Termly recommendation)
    document.head.appendChild(script);

    // No cleanup needed - cookie consent should persist
  }, []);

  // Don't render anything - Termly will inject the banner automatically
  return null;
}

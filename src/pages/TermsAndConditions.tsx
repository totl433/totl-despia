import { useEffect, useRef } from 'react';
import { isWebBrowser } from '../lib/platform';

/**
 * Terms and Conditions page displaying Termly-embedded terms and conditions
 * Route: /terms-and-conditions
 */
export default function TermsAndConditions() {
  const embedRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    // Apple review compliance: do not load Termly (cookie-setting) scripts inside the native app WebView.
    if (!isWebBrowser()) {
      return;
    }

    // Load Termly script dynamically to ensure it runs after React renders the div
    const loadTermlyScript = () => {
      // Check if Termly is already available (script loaded and initialized)
      if ((window as any).Termly) {
        console.log('[TermsAndConditions] Termly is already available');
        return;
      }

      // Check if script element exists but hasn't loaded yet
      const existingScript = document.getElementById('termly-jssdk');
      if (existingScript && !scriptLoadedRef.current) {
        console.log('[TermsAndConditions] Script element exists but Termly not available yet, waiting...');
        // Wait for script to load
        const checkTermly = setInterval(() => {
          if ((window as any).Termly) {
            console.log('[TermsAndConditions] Termly is now available');
            clearInterval(checkTermly);
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkTermly);
          if (!(window as any).Termly) {
            console.warn('[TermsAndConditions] Termly did not load after 5s, removing old script and retrying...');
            existingScript.remove();
            scriptLoadedRef.current = false;
            loadTermlyScript(); // Retry
          }
        }, 5000);
        return;
      }

      if (scriptLoadedRef.current) {
        return;
      }

      scriptLoadedRef.current = true;
      console.log('[TermsAndConditions] Loading Termly script...');
      
      const script = document.createElement('script');
      script.id = 'termly-jssdk';
      script.src = 'https://app.termly.io/embed-policy.min.js';
      script.async = true;
      
      script.onload = () => {
        console.log('[TermsAndConditions] Termly script loaded successfully');
        // Termly will automatically find and populate divs with name="termly-embed"
        // Give it a moment to initialize
        setTimeout(() => {
          if ((window as any).Termly) {
            console.log('[TermsAndConditions] Termly initialized, should populate div');
          } else {
            console.warn('[TermsAndConditions] Termly script loaded but Termly object not available');
          }
        }, 1000);
      };
      
      script.onerror = () => {
        console.error('[TermsAndConditions] Failed to load Termly script');
        scriptLoadedRef.current = false;
      };
      
      // Insert script at the end of body
      document.body.appendChild(script);
    };

    // Load script after component mounts (small delay to ensure DOM is ready)
    const timeoutId = setTimeout(loadTermlyScript, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);

  if (!isWebBrowser()) {
    return (
      <div className="min-h-screen bg-[#f5f7f6] dark:bg-slate-900 p-4">
        <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <h1 className="text-2xl font-bold text-[#1C8376] dark:text-emerald-400">Terms and Conditions</h1>
          <p className="text-slate-700 dark:text-slate-200">
            For Apple compliance, the iOS app does not load third-party policy embeds that may set cookies.
          </p>
          <p className="text-slate-700 dark:text-slate-200">
            View the terms here:{' '}
            <a
              className="text-[#1C8376] dark:text-emerald-400 underline"
              href="https://playtotl.com/terms-and-conditions"
            >
              https://playtotl.com/terms-and-conditions
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7f6] dark:bg-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-[#1C8376] dark:text-emerald-400">Terms and Conditions</h1>
        
        {/* Termly embed - this div will be populated by Termly's script */}
        <div 
          ref={embedRef}
          {...({ name: 'termly-embed' } as any)}
          data-id="0f0acfaf-b38e-4b95-a69f-e65904264f60"
          className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm min-h-[200px]"
        />
      </div>
    </div>
  );
}


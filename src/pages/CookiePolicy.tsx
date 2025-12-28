import { useEffect, useRef } from 'react';

/**
 * Cookie Policy page displaying Termly-embedded cookie policy
 * Route: /cookie-policy
 */
export default function CookiePolicy() {
  const embedRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    // Load Termly script dynamically to ensure it runs after React renders the div
    const loadTermlyScript = () => {
      // Check if Termly is already available (script loaded and initialized)
      if ((window as any).Termly) {
        console.log('[CookiePolicy] Termly is already available');
        return;
      }

      // Check if script element exists but hasn't loaded yet
      const existingScript = document.getElementById('termly-jssdk');
      if (existingScript && !scriptLoadedRef.current) {
        console.log('[CookiePolicy] Script element exists but Termly not available yet, waiting...');
        // Wait for script to load
        const checkTermly = setInterval(() => {
          if ((window as any).Termly) {
            console.log('[CookiePolicy] Termly is now available');
            clearInterval(checkTermly);
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkTermly);
          if (!(window as any).Termly) {
            console.warn('[CookiePolicy] Termly did not load after 5s, removing old script and retrying...');
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
      console.log('[CookiePolicy] Loading Termly script...');
      
      const script = document.createElement('script');
      script.id = 'termly-jssdk';
      script.src = 'https://app.termly.io/embed-policy.min.js';
      script.async = true;
      
      script.onload = () => {
        console.log('[CookiePolicy] Termly script loaded successfully');
        // Termly will automatically find and populate divs with name="termly-embed"
        // Give it a moment to initialize
        setTimeout(() => {
          if ((window as any).Termly) {
            console.log('[CookiePolicy] Termly initialized, should populate div');
          } else {
            console.warn('[CookiePolicy] Termly script loaded but Termly object not available');
          }
        }, 1000);
      };
      
      script.onerror = () => {
        console.error('[CookiePolicy] Failed to load Termly script');
        scriptLoadedRef.current = false;
      };
      
      // Insert script at the end of body
      document.body.appendChild(script);
    };

    // Load script after component mounts (small delay to ensure DOM is ready)
    const timeoutId = setTimeout(loadTermlyScript, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f7f6] p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-[#1C8376]">Cookie Policy</h1>
        
        {/* Termly embed - this div will be populated by Termly's script */}
        <div 
          ref={embedRef}
          name="termly-embed" 
          data-id="006d16a3-069f-425a-9e1d-2faa395510ac"
          className="bg-white rounded-xl p-6 shadow-sm min-h-[200px]"
        />
      </div>
    </div>
  );
}


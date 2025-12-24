import { isDespiaAvailable } from './pushNotificationsV2';

/**
 * Open WhatsApp with a pre-filled message
 * In Despia (native app), uses native deep links (whatsapp://)
 * In regular browsers, uses web links (wa.me)
 */
export function openWhatsApp(message: string): void {
  const isDespia = isDespiaAvailable();
  const encodedMessage = encodeURIComponent(message);
  
  // Temporary debug mode - set to true to see alerts instead of console logs
  const DEBUG_MODE = false; // Set to true to enable visual debugging
  
  if (DEBUG_MODE) {
    alert(`[DEBUG] Opening WhatsApp\nisDespia: ${isDespia}\nMessage length: ${message.length}`);
  }
  
  console.log('[WhatsApp] Opening WhatsApp, isDespia:', isDespia);
  
  if (isDespia) {
    // In Despia native app, use native deep links
    // Both iOS and Android support whatsapp://send?text=
    const whatsappUrl = `whatsapp://send?text=${encodedMessage}`;
    console.log('[WhatsApp] Attempting to open deep link:', whatsappUrl);
    
    if (DEBUG_MODE) {
      alert(`[DEBUG] Deep link URL:\n${whatsappUrl.substring(0, 100)}...`);
    }
    
    // Try multiple methods - different webviews prefer different approaches
    let method1Success = false;
    let method2Success = false;
    let method3Success = false;
    
    try {
      // Method 1: Create anchor and click (most reliable in webviews)
      if (DEBUG_MODE) alert('[DEBUG] Trying Method 1: Anchor element');
      const link = document.createElement('a');
      link.href = whatsappUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      method1Success = true;
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 100);
      if (DEBUG_MODE) alert('[DEBUG] Method 1: Anchor clicked');
    } catch (e) {
      console.log('[WhatsApp] Anchor method failed:', e);
      if (DEBUG_MODE) alert(`[DEBUG] Method 1 failed: ${e}`);
    }
    
    // Method 2: Try window.open without _blank (some webviews prefer this for deep links)
    if (!method1Success) {
      try {
        if (DEBUG_MODE) alert('[DEBUG] Trying Method 2: window.open');
        window.open(whatsappUrl);
        method2Success = true;
        if (DEBUG_MODE) alert('[DEBUG] Method 2: window.open called');
      } catch (e) {
        console.log('[WhatsApp] window.open failed:', e);
        if (DEBUG_MODE) alert(`[DEBUG] Method 2 failed: ${e}`);
      }
    }
    
    // Method 3: Try window.location.href as last resort
    if (!method1Success && !method2Success) {
      try {
        if (DEBUG_MODE) alert('[DEBUG] Trying Method 3: window.location.href');
        window.location.href = whatsappUrl;
        method3Success = true;
        if (DEBUG_MODE) alert('[DEBUG] Method 3: location.href set');
      } catch (e) {
        console.log('[WhatsApp] window.location.href failed:', e);
        if (DEBUG_MODE) alert(`[DEBUG] Method 3 failed: ${e}\nFalling back to web version`);
        // If all deep link methods fail, fallback to web version
        window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
      }
    }
  } else {
    // In regular browsers, use web link
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    try {
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(message).then(() => {
        alert('Message copied to clipboard! You can now paste it in WhatsApp or Messages.');
      }).catch(() => {
        alert('Unable to open WhatsApp. Please copy this message manually:\n\n' + message);
      });
    }
  }
}


import { isDespiaAvailable } from './pushNotificationsV2';

/**
 * Open WhatsApp with a pre-filled message
 * In Despia (native app), uses native deep links (whatsapp://)
 * In regular browsers, uses web links (wa.me)
 */
export function openWhatsApp(message: string): void {
  const isDespia = isDespiaAvailable();
  const encodedMessage = encodeURIComponent(message);
  
  // Debug mode only in development
  const DEBUG_MODE = import.meta.env.DEV;
  
  if (DEBUG_MODE) {
    console.log('[WhatsApp] Opening WhatsApp, isDespia:', isDespia, 'Message length:', message.length);
  }
  
  if (isDespia) {
    // In Despia native app, use native deep links
    // Both iOS and Android support whatsapp://send?text=
    const whatsappUrl = `whatsapp://send?text=${encodedMessage}`;
    
    if (DEBUG_MODE) {
      console.log('[WhatsApp] Attempting to open deep link:', whatsappUrl);
    }
    
    // Try multiple methods - different webviews prefer different approaches
    let method1Success = false;
    let method2Success = false;
    
    try {
      // Method 1: Create anchor and click (most reliable in webviews)
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
    } catch (e) {
      if (DEBUG_MODE) {
        console.log('[WhatsApp] Anchor method failed:', e);
      }
    }
    
    // Method 2: Try window.open without _blank (some webviews prefer this for deep links)
    if (!method1Success) {
      try {
        window.open(whatsappUrl);
        method2Success = true;
      } catch (e) {
        if (DEBUG_MODE) {
          console.log('[WhatsApp] window.open failed:', e);
        }
      }
    }
    
    // Method 3: Try window.location.href as last resort
    if (!method1Success && !method2Success) {
      try {
        window.location.href = whatsappUrl;
      } catch (e) {
        if (DEBUG_MODE) {
          console.log('[WhatsApp] window.location.href failed:', e);
        }
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


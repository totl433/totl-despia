import { isDespiaAvailable } from './pushNotificationsV2';

/**
 * Open WhatsApp with a pre-filled message
 * In Despia (native app), uses native deep links (whatsapp://)
 * In regular browsers, uses web links (wa.me)
 */
export function openWhatsApp(message: string): void {
  const isDespia = isDespiaAvailable();
  const encodedMessage = encodeURIComponent(message);
  
  console.log('[WhatsApp] Opening WhatsApp, isDespia:', isDespia);
  
  if (isDespia) {
    // In Despia native app, use native deep links
    // Both iOS and Android support whatsapp://send?text=
    const whatsappUrl = `whatsapp://send?text=${encodedMessage}`;
    console.log('[WhatsApp] Attempting to open deep link:', whatsappUrl);
    
    // Try multiple methods - different webviews prefer different approaches
    try {
      // Method 1: Create anchor and click (most reliable in webviews)
      const link = document.createElement('a');
      link.href = whatsappUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 100);
    } catch (e) {
      console.log('[WhatsApp] Anchor method failed:', e);
    }
    
    // Method 2: Try window.open without _blank (some webviews prefer this for deep links)
    try {
      window.open(whatsappUrl);
    } catch (e) {
      console.log('[WhatsApp] window.open failed:', e);
    }
    
    // Method 3: Try window.location.href as last resort
    try {
      window.location.href = whatsappUrl;
    } catch (e) {
      console.log('[WhatsApp] window.location.href failed:', e);
      // If all deep link methods fail, fallback to web version
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
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


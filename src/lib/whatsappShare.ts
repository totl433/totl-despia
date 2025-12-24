import { isDespiaAvailable } from './pushNotificationsV2';

/**
 * Open WhatsApp with a pre-filled message
 * In Despia (native app), uses native deep links (whatsapp://)
 * In regular browsers, uses web links (wa.me)
 */
export function openWhatsApp(message: string): void {
  const isDespia = isDespiaAvailable();
  const encodedMessage = encodeURIComponent(message);
  
  if (isDespia) {
    // In Despia native app, use native deep links
    // Both iOS and Android support whatsapp://send?text=
    // Use location.href for native deep links in webviews (more reliable than window.open)
    const whatsappUrl = `whatsapp://send?text=${encodedMessage}`;
    try {
      // In webviews, location.href is the standard way to open deep links
      window.location.href = whatsappUrl;
    } catch (error) {
      // Fallback to web version if deep link fails
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


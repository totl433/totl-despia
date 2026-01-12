/**
 * Platform Detection Utilities
 * 
 * Detects whether the app is running in:
 * - Native app (Despia wrapper) - has access to native APIs
 * - Web browser - standard web environment
 * 
 * Detection is API-based (checks for Despia APIs), not domain-based,
 * so it works correctly on playtotl.com for both web and native app users.
 */

/**
 * Check if Despia native app APIs are available
 * This indicates the app is running within the Despia native wrapper
 * 
 * @returns true if running in native app, false if in web browser
 */
export function isNativeApp(): boolean {
  // Check for Despia object (injected by native wrapper)
  const despia = (globalThis as any)?.despia || (typeof window !== 'undefined' ? (window as any)?.despia : null);
  
  // Check for OneSignal Player ID (injected by Despia/OneSignal)
  const directPlayerId = (globalThis as any)?.onesignalplayerid || (typeof window !== 'undefined' ? (window as any)?.onesignalplayerid : null);
  
  // If either exists, we're in the native app
  return !!despia || !!directPlayerId;
}

/**
 * Check if running in a web browser (not native app)
 * 
 * @returns true if running in web browser, false if in native app
 */
export function isWebBrowser(): boolean {
  return !isNativeApp();
}

/**
 * Legacy function name - kept for backward compatibility
 * @deprecated Use isNativeApp() instead
 */
export function isDespiaAvailable(): boolean {
  return isNativeApp();
}

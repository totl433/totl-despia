/**
 * Feature flags system
 * Stores flags in localStorage for persistence across sessions
 */

const FEATURE_FLAGS = {
  LOAD_EVERYTHING_FIRST: 'loadEverythingFirst',
} as const;

type FeatureFlag = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS];

/**
 * Get a feature flag value
 */
export function getFeatureFlag(flag: FeatureFlag): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const value = localStorage.getItem(`feature:${flag}`);
    return value === 'true';
  } catch (error) {
    return false;
  }
}

/**
 * Set a feature flag value
 */
export function setFeatureFlag(flag: FeatureFlag, value: boolean): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(`feature:${flag}`, value ? 'true' : 'false');
  } catch (error) {
    console.error(`Failed to set feature flag ${flag}:`, error);
  }
}

/**
 * Check if "load everything first" mode is enabled
 */
export function isLoadEverythingFirstEnabled(): boolean {
  return getFeatureFlag(FEATURE_FLAGS.LOAD_EVERYTHING_FIRST);
}

/**
 * Enable or disable "load everything first" mode
 */
export function setLoadEverythingFirst(enabled: boolean): void {
  setFeatureFlag(FEATURE_FLAGS.LOAD_EVERYTHING_FIRST, enabled);
}
















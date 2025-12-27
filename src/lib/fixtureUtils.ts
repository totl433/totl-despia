/**
 * Format minute display for live matches
 * @param status - Match status (FINISHED, PAUSED, IN_PLAY, etc.)
 * @param minute - Current minute of the match
 * @param isTestApi - If true, always shows actual minutes instead of "First Half"/"Second Half"
 * @returns Formatted string (e.g., "FT", "HT", "45+", "First Half", "Second Half", "LIVE")
 */
export function formatMinuteDisplay(
  status: string, 
  minute: number | null | undefined, 
  isTestApi: boolean = false
): string {
  if (status === 'FINISHED') {
    return 'FT';
  }
  if (status === 'PAUSED') {
    return 'HT';
  }
  if (status === 'IN_PLAY') {
    if (minute === null || minute === undefined) {
      return 'LIVE';
    }
    // For test API, always show actual minutes
    if (isTestApi) {
      return `${minute}'`;
    }
    // First half: 1-45 minutes
    if (minute >= 1 && minute <= 45) {
      return 'First Half';
    }
    // Stoppage time in first half: > 45 but before halftime (typically 45-50)
    // Show "45+" until status becomes PAUSED (halftime)
    if (minute > 45 && minute <= 50) {
      return '45+';
    }
    // Second half: after halftime, typically minute > 50
    if (minute > 50) {
      return 'Second Half';
    }
  }
  // Fallback
  return 'LIVE';
}































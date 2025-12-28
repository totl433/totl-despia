/**
 * Formats a rank percentage to show "Top X%" or "Bottom X%" based on the value.
 * The percentage represents the rank percentile: (rank / total) * 100
 * 
 * Rules:
 * - If rankPercent > 50: show "Bottom X%" where X = rankPercent
 *   Example: rankPercent = 68% → "Bottom 68%" (68% of players are above you)
 * 
 * - If rankPercent <= 50: show "Top X%" where X = rankPercent (NOT the opposite!)
 *   Example: rankPercent = 5% → "Top 5%" (95% of players are below you)
 *   Example: rankPercent = 1% → "Top 1%" (99% of players are below you)
 * 
 * @param rankPercent - The rank percentage (0-100), representing (rank / total) * 100
 * @returns An object with the formatted text and whether it's a top or bottom percentage
 */
export function formatPercentage(rankPercent: number | null | undefined): {
  text: string;
  isTop: boolean;
} | null {
  if (rankPercent === null || rankPercent === undefined) {
    return null;
  }

  if (rankPercent > 50) {
    // More than 50% of players are above you, show "Bottom X%" where X = 100 - rankPercent (opposite)
    // Example: rankPercent = 68% → "Bottom 32%" (because 68% above = bottom 32%)
    const bottomPercent = Math.round(100 - rankPercent);
    return {
      text: `Bottom ${bottomPercent}%`,
      isTop: false,
    };
  } else {
    // 50% or less of players are above you, show "Top X%" where X = rankPercent
    // Example: rankPercent = 5% → "Top 5%" (95% below you)
    return {
      text: `Top ${Math.round(rankPercent)}%`,
      isTop: true,
    };
  }
}

/**
 * Formats a percentage for display in a pill/badge (just the label part, e.g., "top" or "bottom")
 * The percentage represents the % of people who scored BETTER than you.
 */
export function formatPercentageLabel(rankPercent: number | null | undefined): string {
  if (rankPercent === null || rankPercent === undefined) {
    return 'top';
  }
  // If rankPercent > 50, you're in the bottom, otherwise top
  return rankPercent > 50 ? 'bottom' : 'top';
}


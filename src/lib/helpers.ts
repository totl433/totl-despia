/**
 * Helper function to convert number to ordinal (1st, 2nd, 3rd, etc.)
 */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Helper function to get initials from name
 */
export function initials(name: string): string {
  const parts = (name || "?").trim().split(/\s+/);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Helper function to convert Set or Array to Set
 */
export function toStringSet(value?: Set<string> | string[] | undefined): Set<string> {
  if (!value) return new Set<string>();
  return value instanceof Set ? value : new Set(value);
}

















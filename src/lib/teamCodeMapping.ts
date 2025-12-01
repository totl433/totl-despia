/**
 * Team code normalization for matching Web fixtures to App fixtures
 * Maps variations of team codes to a standard form
 */
const TEAM_CODE_ALIASES: Record<string, string> = {
  'NFO': 'NOT', // Nottingham Forest - Web uses NFO, App uses NOT
  'NOT': 'NOT', // Ensure NOT maps to itself
};

/**
 * Normalize team code for matching
 * @param code - Team code to normalize
 * @returns Normalized team code
 */
export function normalizeTeamCode(code: string | null | undefined): string {
  if (!code) return '';
  const upperCode = code.toUpperCase();
  return TEAM_CODE_ALIASES[upperCode] || upperCode;
}

/**
 * Match two team codes, accounting for aliases
 * @param code1 - First team code
 * @param code2 - Second team code
 * @returns True if codes match (after normalization)
 */
export function matchTeamCodes(
  code1: string | null | undefined,
  code2: string | null | undefined
): boolean {
  return normalizeTeamCode(code1) === normalizeTeamCode(code2);
}


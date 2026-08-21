export function buildOneSignalAuthorization(apiKey: string): string {
  const normalized = apiKey.trim();
  const scheme = normalized.startsWith('os_v2_') ? 'Key' : 'Basic';
  return `${scheme} ${normalized}`;
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveMemberJoinName(input: {
  profileName?: unknown;
  authMetadata?: Record<string, unknown> | null;
  email?: unknown;
  suppliedName?: unknown;
}): string {
  const metadata = input.authMetadata ?? {};
  const candidates = [
    input.profileName,
    metadata.display_name,
    metadata.name,
    metadata.full_name,
    metadata.username,
    input.suppliedName,
  ];

  for (const candidate of candidates) {
    const value = clean(candidate);
    if (value && value.toLowerCase() !== 'someone') return value;
  }

  const email = clean(input.email);
  const emailName = email.includes('@') ? email.split('@')[0].trim() : '';
  return emailName || 'A player';
}

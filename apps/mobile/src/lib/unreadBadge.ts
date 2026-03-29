export function capUnreadCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(99, Math.floor(count));
}

export function formatUnreadBadge(count: number): string | null {
  const capped = capUnreadCount(count);
  if (capped <= 0) return null;
  return String(capped);
}


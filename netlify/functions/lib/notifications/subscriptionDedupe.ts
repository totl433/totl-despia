export interface DeviceSubscriptionRecord {
  id?: string;
  user_id: string;
  player_id: string;
  platform?: string | null;
  updated_at?: string | null;
  os_payload?: Record<string, unknown> | null;
}

function deviceModel(subscription: DeviceSubscriptionRecord): string | null {
  const value = subscription.os_payload?.device_model;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function deviceGroupKey(subscription: DeviceSubscriptionRecord): string | null {
  const model = deviceModel(subscription);
  if (!model) return null;
  return `${subscription.user_id}:${subscription.platform ?? 'unknown'}:${model}`;
}

/**
 * Keeps the most recently updated subscription for each known physical-device
 * group. Records without a device model are preserved because they cannot be
 * safely identified as duplicates.
 */
export function dedupeSubscriptionsByDevice<T extends DeviceSubscriptionRecord>(
  subscriptions: T[]
): T[] {
  const ordered = [...subscriptions].sort((left, right) =>
    String(right.updated_at ?? '').localeCompare(String(left.updated_at ?? ''))
  );
  const seenGroups = new Set<string>();

  return ordered.filter((subscription) => {
    const groupKey = deviceGroupKey(subscription);
    if (!groupKey) return true;
    if (seenGroups.has(groupKey)) return false;
    seenGroups.add(groupKey);
    return true;
  });
}

export function staleSubscriptionIdsForCurrentDevice(
  subscriptions: DeviceSubscriptionRecord[],
  current: DeviceSubscriptionRecord
): string[] {
  const currentGroup = deviceGroupKey(current);
  if (!currentGroup) return [];

  return subscriptions
    .filter(
      (subscription) =>
        subscription.player_id !== current.player_id &&
        deviceGroupKey(subscription) === currentGroup &&
        typeof subscription.id === 'string'
    )
    .map((subscription) => String(subscription.id));
}

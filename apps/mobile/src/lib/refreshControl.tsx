import React from 'react';
import { RefreshControl } from 'react-native';
import { useTokens } from '@totl/ui';

export function TotlRefreshControl({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const t = useTokens();
  const isDark = t.color.background === '#0F172A';
  const spinnerColor = isDark ? '#FFFFFF' : '#1C8376';

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={spinnerColor}
      colors={[spinnerColor]}
    />
  );
}

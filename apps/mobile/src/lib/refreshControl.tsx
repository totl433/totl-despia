import React from 'react';
import { RefreshControl } from 'react-native';

/**
 * High-contrast RefreshControl for TOTL dark theme.
 * The default iOS/Android spinner can look grey-on-dark; this forces a bright spinner
 * without changing background styling.
 */
export function TotlRefreshControl({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  // Keep this very bright for visibility on the dark background.
  const spinnerColor = '#FFFFFF';

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={spinnerColor} // iOS
      colors={[spinnerColor]} // Android
    />
  );
}


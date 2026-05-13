import React from 'react';
import { ActivityIndicator, View, type ViewStyle } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

/**
 * Small, centered loading spinner for initial/empty loads.
 * Uses a short delay to avoid flicker on fast responses.
 */
export default function CenteredSpinner({
  loading,
  delayMs = 200,
  label,
  style,
}: {
  loading: boolean;
  delayMs?: number;
  label?: string;
  style?: ViewStyle;
}) {
  const t = useTokens();
  const brand = ((t as any)?.color?.brand as string | undefined) ?? '#1C8376';
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!loading) {
      setVisible(false);
      return;
    }

    const id = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs, loading]);

  if (!loading || !visible) return null;

  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, style]}>
      <ActivityIndicator size="small" color={brand} />
      {label ? (
        <TotlText variant="muted" style={{ marginTop: 12, fontSize: 14, fontWeight: '700' }}>
          {label}
        </TotlText>
      ) : null}
    </View>
  );
}


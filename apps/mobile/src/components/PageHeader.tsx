import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

/**
 * Standard iOS-style page header used across top-level screens.
 *
 * Typography matches the provided spec:
 * - Gramatika Medium, 24px, lineHeight 36, letterSpacing 0.4
 * - Uses theme text color (dark mode friendly)
 */
export default function PageHeader({
  title,
  subtitle,
  rightAction,
  style,
}: {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}) {
  const t = useTokens();

  return (
    <View
      style={[
        {
          paddingHorizontal: t.space[4],
          paddingTop: t.space[2],
          paddingBottom: subtitle ? 10 : 12,
          flexDirection: 'row',
          alignItems: subtitle ? 'flex-start' : 'center',
          justifyContent: 'space-between',
        },
        style,
      ]}
    >
      <View style={{ flex: 1, paddingRight: rightAction ? 12 : 0 }}>
        <TotlText
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            color: t.color.text,
            fontFamily: 'Gramatika-Medium',
            fontSize: 32,
            lineHeight: 36,
            letterSpacing: 0.4,
          }}
        >
          {title}
        </TotlText>

        {subtitle ? (
          <TotlText variant="sectionSubtitle" style={{ marginTop: 2 }}>
            {subtitle}
          </TotlText>
        ) : null}
      </View>

      {rightAction ? (
        <View style={{ paddingTop: subtitle ? 2 : 0 }}>
          {/* TS workaround: monorepo sometimes resolves duplicate React type defs (ReactNode incompatibility). */}
          {rightAction as any}
        </View>
      ) : null}
    </View>
  );
}


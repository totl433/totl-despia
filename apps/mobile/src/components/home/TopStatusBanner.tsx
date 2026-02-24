import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TotlText, useTokens } from '@totl/ui';

type BannerIcon = 'info' | 'flash';

export default function TopStatusBanner({
  title,
  icon = 'info',
  actionLabel,
  actionAccessibilityLabel,
  onActionPress,
  actionDisabled = false,
}: {
  title: string;
  icon?: BannerIcon;
  actionLabel?: string;
  actionAccessibilityLabel?: string;
  onActionPress?: () => void;
  actionDisabled?: boolean;
}) {
  const t = useTokens();
  const iconName = icon === 'flash' ? 'flash' : 'information-circle';

  return (
    <View
      style={{
        backgroundColor: '#e9f0ef',
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#1C8376',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}
        >
          <Ionicons name={iconName} size={12} color="#FFFFFF" />
        </View>
        <TotlText style={{ fontFamily: 'Gramatika-Bold', fontWeight: '700', fontSize: 16, lineHeight: 18 }}>
          {title}
        </TotlText>
      </View>

      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          disabled={actionDisabled}
          onPress={onActionPress}
          style={({ pressed }) => ({
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: t.radius.pill,
            backgroundColor: '#1C8376',
            opacity: actionDisabled ? 0.7 : pressed ? 0.9 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            transform: [{ scale: pressed ? 0.99 : 1 }],
          })}
        >
          <TotlText
            style={{
              color: '#FFFFFF',
              fontFamily: 'Gramatika-Medium',
              fontWeight: '500',
              fontSize: 14,
              lineHeight: 14,
            }}
          >
            {actionLabel}
          </TotlText>
          <View style={{ width: 6 }} />
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
}

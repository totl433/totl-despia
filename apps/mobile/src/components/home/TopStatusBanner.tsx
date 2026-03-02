import React from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  gradientBackground = false,
}: {
  title: string;
  icon?: BannerIcon;
  actionLabel?: string;
  actionAccessibilityLabel?: string;
  onActionPress?: () => void;
  actionDisabled?: boolean;
  gradientBackground?: boolean;
}) {
  const t = useTokens();
  const iconName = icon === 'flash' ? 'flash' : 'information-circle';

  const containerStyle = {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 16,
    marginBottom: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  };

  const content = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
        <Ionicons
          name={iconName}
          size={20}
          color={gradientBackground ? '#FFFFFF' : t.color.muted}
          style={{ marginRight: 10 }}
        />
        <TotlText style={{ fontFamily: t.font.medium, fontSize: 16, lineHeight: 18, color: gradientBackground ? '#FFFFFF' : t.color.text }}>
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
            backgroundColor: gradientBackground ? 'rgba(255,255,255,0.3)' : '#1C8376',
            opacity: actionDisabled ? 0.7 : pressed ? 0.9 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            transform: [{ scale: pressed ? 0.99 : 1 }],
          })}
        >
          <TotlText
            style={{
              color: '#FFFFFF',
              fontFamily: t.font.medium,
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
    </>
  );

  if (gradientBackground) {
    return (
      <LinearGradient
        colors={['#2D9D8B', '#1C8376', '#157A6E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={containerStyle}
      >
        {content}
      </LinearGradient>
    );
  }

  return <View style={[containerStyle, { backgroundColor: t.color.surface }]}>{content}</View>;
}

import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

export default function LeagueHeader({
  title,
  subtitle,
  avatarUri,
  onPressBack,
  onPressMenu,
}: {
  title: string;
  subtitle: string;
  avatarUri: string | null;
  onPressBack: () => void;
  onPressMenu: () => void;
}) {
  const t = useTokens();
  const AVATAR = 54;

  return (
    <View style={{ paddingHorizontal: t.space[4], paddingTop: t.space[3], paddingBottom: t.space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          onPress={onPressBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
            marginRight: 10,
          })}
        >
          <TotlText style={{ color: t.color.muted, fontWeight: '900', fontSize: 22, lineHeight: 22 }}>‹</TotlText>
        </Pressable>

        <View
          style={{
            width: AVATAR,
            height: AVATAR,
            borderRadius: 999,
            backgroundColor: t.color.surface2,
            borderWidth: 1,
            borderColor: t.color.border,
            overflow: 'hidden',
            marginRight: 12,
          }}
        >
          {avatarUri ? <Image source={{ uri: avatarUri }} style={{ width: AVATAR, height: AVATAR }} /> : null}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <TotlText variant="body" numberOfLines={1} style={{ fontWeight: '900' }}>
            {title}
          </TotlText>
          <TotlText variant="caption" style={{ marginTop: 2, color: t.color.muted, fontWeight: '800' }}>
            {subtitle}
          </TotlText>
        </View>

        <Pressable
          onPress={onPressMenu}
          accessibilityRole="button"
          accessibilityLabel="Menu"
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
            marginLeft: 10,
          })}
        >
          <TotlText style={{ color: t.color.muted, fontWeight: '900', fontSize: 22, lineHeight: 22 }}>⋯</TotlText>
        </Pressable>
      </View>
    </View>
  );
}


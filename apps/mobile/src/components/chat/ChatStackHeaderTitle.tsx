import React from 'react';
import { Image, View } from 'react-native';

import { TotlText, useTokens } from '@totl/ui';

export default function ChatStackHeaderTitle({
  title,
  subtitle,
  avatarUri,
}: {
  title: string;
  subtitle: string;
  avatarUri: string | null;
}) {
  const t = useTokens();
  const AVATAR = 34;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          width: AVATAR,
          height: AVATAR,
          borderRadius: 999,
          backgroundColor: t.color.surface2,
          borderWidth: 1,
          borderColor: t.color.border,
          overflow: 'hidden',
          marginRight: 10,
        }}
      >
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={{ width: AVATAR, height: AVATAR }}
            onError={(e) => {
              console.error('[ChatStackHeaderTitle] Avatar failed to load:', { uri: avatarUri, error: e.nativeEvent });
            }}
          />
        ) : null}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <TotlText numberOfLines={1} style={{ fontWeight: '900' }}>
          {title}
        </TotlText>
        <TotlText
          numberOfLines={1}
          variant="caption"
          style={{ marginTop: 1, color: t.color.muted, fontWeight: '700', fontSize: 12, lineHeight: 14 }}
        >
          {subtitle}
        </TotlText>
      </View>
    </View>
  );
}


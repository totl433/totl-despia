import React from 'react';
import { Image, View, useWindowDimensions } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

type Props = {
  imageUrl: string | null;
  displayName: string;
};

export default function BrandedLeaderboardHeader({ imageUrl, displayName }: Props) {
  const t = useTokens();
  const { width } = useWindowDimensions();
  const imageHeight = Math.round(width / 3);

  return (
    <View>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width, height: imageHeight, backgroundColor: t.color.surface2 }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width,
            height: imageHeight,
            backgroundColor: t.color.surface2,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TotlText style={{ color: t.color.muted, fontSize: 24, fontWeight: '700' }}>
            {displayName}
          </TotlText>
        </View>
      )}
    </View>
  );
}

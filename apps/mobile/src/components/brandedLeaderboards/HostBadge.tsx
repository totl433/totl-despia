import React from 'react';
import { View } from 'react-native';
import { TotlText } from '@totl/ui';

export default function HostBadge() {
  return (
    <View
      style={{
        backgroundColor: '#158D57',
        paddingHorizontal: 9,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TotlText
        style={{
          color: '#FFFFFF',
          fontFamily: 'Gramatika-Bold',
          fontSize: 12,
          lineHeight: 22,
          letterSpacing: -0.24,
        }}
      >
        HOST
      </TotlText>
    </View>
  );
}

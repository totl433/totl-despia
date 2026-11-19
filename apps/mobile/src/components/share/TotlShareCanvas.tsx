import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';
import { TotlText } from '@totl/ui';

const TOTL_LOGO = Asset.fromModule(require('../../../../../public/assets/badges/totl-logo1-black.svg')).uri;

/**
 * The TOTL share image: mint background, the TOTL logo, the card slightly tilted with a shadow,
 * and playtotl.com / @playtotl underneath. Give it a `height` to space the three out over a fixed
 * canvas; leave it out and the canvas fits the card.
 */
export function TotlShareCanvas({
  width,
  height,
  children,
}: {
  width: number;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <View
      collapsable={false}
      style={{
        width,
        ...(height != null ? { height, justifyContent: 'space-between' as const } : { gap: 28 }),
        backgroundColor: '#EEF3F2',
        alignItems: 'center',
        paddingTop: 42,
        paddingBottom: 34,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 78,
          left: -118,
          width: 210,
          height: 210,
          borderRadius: 105,
          backgroundColor: 'rgba(28,131,118,0.09)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: -72,
          bottom: 36,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: 'rgba(28,131,118,0.075)',
        }}
      />

      <View style={{ alignItems: 'center' }}>
        <SvgUri uri={TOTL_LOGO} width={180} height={87} />
      </View>

      {children as any}

      <View style={{ alignItems: 'center' }}>
        <TotlText style={{ color: '#0F172A', fontFamily: 'Gramatika-Bold', fontWeight: '900', fontSize: 18, lineHeight: 20 }}>
          playtotl.com
        </TotlText>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <Ionicons name="logo-instagram" size={17} color="#1C8376" />
          <TotlText style={{ marginLeft: 6, color: '#1C8376', fontFamily: 'Gramatika-Medium', fontWeight: '700', fontSize: 14, lineHeight: 16 }}>
            @playtotl
          </TotlText>
        </View>
      </View>
    </View>
  );
}

/** A card on the share image: tilted a touch, with the deep shadow. */
export function TotlShareCardTilt({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        shadowColor: '#0F172A',
        shadowOpacity: 0.24,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 18 },
        elevation: 14,
        transform: [{ rotateZ: '-1.1deg' }],
      }}
    >
      {children as any}
    </View>
  );
}

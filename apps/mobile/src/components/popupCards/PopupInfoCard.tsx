import React from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TotlText } from '@totl/ui';

export default function PopupInfoCard({
  title,
  isTopCard,
  onClose,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  title: string;
  isTopCard: boolean;
  onClose?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 22,
        justifyContent: 'space-between',
      }}
    >
      <View style={{ minHeight: 36, alignItems: 'flex-end' }}>
        {isTopCard && onClose ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close popup"
            hitSlop={12}
            onPress={onClose}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(15,23,42,0.05)',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons name="close" size={20} color="#0F172A" />
          </Pressable>
        ) : null}
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <TotlText
          style={{
            color: '#0F172A',
            fontFamily: 'Gramatika-Bold',
            fontWeight: '900',
            fontSize: 30,
            lineHeight: 34,
            textAlign: 'center',
          }}
        >
          {title}
        </TotlText>
      </View>

      <View style={{ minHeight: 26, alignItems: 'center', justifyContent: 'flex-end' }}>
        {isTopCard && secondaryActionLabel && onSecondaryAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={secondaryActionLabel}
            onPress={onSecondaryAction}
            style={({ pressed }) => ({
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <TotlText
              style={{
                color: '#1C8376',
                fontFamily: 'Gramatika-Medium',
                fontWeight: '700',
                fontSize: 14,
                lineHeight: 18,
              }}
            >
              {secondaryActionLabel}
            </TotlText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

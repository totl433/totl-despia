import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TotlText, useTokens } from '@totl/ui';

type ShareTarget = 'instagram' | 'whatsapp' | 'more';

export default function ShareActionsFooter({
  disabled = false,
  onShare,
}: {
  disabled?: boolean;
  onShare: (target: ShareTarget) => void;
}) {
  const t = useTokens();

  const renderButton = ({
    target,
    label,
    accessibilityLabel,
    icon,
  }: {
    target: ShareTarget;
    label: string;
    accessibilityLabel: string;
    icon: React.JSX.Element;
  }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => onShare(target)}
      style={({ pressed }) => ({
        width: 84,
        alignItems: 'center',
        justifyContent: 'flex-start',
        opacity: disabled ? 0.5 : pressed ? 0.86 : 1,
      })}
    >
      {icon}
      <TotlText style={{ marginTop: 8, fontSize: 12, lineHeight: 12, fontFamily: 'Gramatika-Medium', fontWeight: '600' }}>
        {label}
      </TotlText>
    </Pressable>
  );

  return (
    <View style={{ width: '100%', alignSelf: 'center', maxWidth: 420 }}>
      <TotlText style={{ color: t.color.muted, marginBottom: 10 }}>Share to</TotlText>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        {renderButton({
          target: 'instagram',
          label: 'Instagram',
          accessibilityLabel: 'Share to Instagram',
          icon: (
            <LinearGradient
              colors={['#F59E0B', '#EC4899', '#9333EA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="logo-instagram" size={24} color="#FFFFFF" />
            </LinearGradient>
          ),
        })}

        {renderButton({
          target: 'whatsapp',
          label: 'WhatsApp',
          accessibilityLabel: 'Share to WhatsApp',
          icon: (
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#25D366',
              }}
            >
              <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
            </View>
          ),
        })}

        {renderButton({
          target: 'more',
          label: 'More',
          accessibilityLabel: 'More share options',
          icon: (
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#DFEBE9',
              }}
            >
              <Ionicons name="share-social-outline" size={24} color="#111827" />
            </View>
          ),
        })}
      </View>
    </View>
  );
}

export type { ShareTarget };

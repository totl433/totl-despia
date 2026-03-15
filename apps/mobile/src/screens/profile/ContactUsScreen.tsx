import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';

import PageHeader from '../../components/PageHeader';

export default function ContactUsScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();

  const openEmail = React.useCallback(async () => {
    const url = 'mailto:hello@playtotl.com';
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) return;
      await Linking.openURL(url);
    } catch {
      // ignore
    }
  }, []);

  return (
    <Screen fullBleed>
      <PageHeader
        title="Contact Us"
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={24} color={t.color.text} />
          </Pressable>
        }
      />

      <View style={{ flex: 1, paddingHorizontal: t.space[4], paddingTop: t.space[4] }}>
        <Card style={{ padding: 16 }}>
          <TotlText style={{ fontWeight: '900', marginBottom: 8 }}>Contact Us</TotlText>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Email support at hello@playtotl.com"
            onPress={() => void openEmail()}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            <TotlText style={{ color: t.color.brand, textDecorationLine: 'underline' }}>hello@playtotl.com</TotlText>
          </Pressable>
        </Card>
      </View>
    </Screen>
  );
}

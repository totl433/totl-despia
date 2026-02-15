import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { Card, Screen, TotlText } from '@totl/ui';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import ShareResultsTray from '../components/results/ShareResultsTray';

const meta: Meta<typeof ShareResultsTray> = {
  title: 'results/ShareResultsTray',
  component: ShareResultsTray,
};

export default meta;
type Story = StoryObj<typeof ShareResultsTray>;

export const Default: Story = {
  render: () => (
    <Screen fullBleed>
      <ShareResultsTray
        topGapPx={72}
        footerReserved={132}
        footerBottomInset={16}
        onClose={() => {}}
        footer={
          <View style={{ width: '100%', alignSelf: 'center', maxWidth: 420 }}>
            <TotlText style={{ marginBottom: 10 }}>Share to</TotlText>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <Pressable style={{ width: 84, alignItems: 'center' }}>
                <LinearGradient
                  colors={['#F59E0B', '#EC4899', '#9333EA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="logo-instagram" size={24} color="#FFFFFF" />
                </LinearGradient>
                <TotlText style={{ marginTop: 8 }}>Insta</TotlText>
              </Pressable>
              <Pressable style={{ width: 84, alignItems: 'center' }}>
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
                <TotlText style={{ marginTop: 8 }}>WhatsApp</TotlText>
              </Pressable>
              <Pressable style={{ width: 84, alignItems: 'center' }}>
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
                <TotlText style={{ marginTop: 8 }}>More</TotlText>
              </Pressable>
            </View>
          </View>
        }
      >
        <Card style={{ width: 300, height: 420, alignSelf: 'center', justifyContent: 'center', alignItems: 'center' }}>
          <TotlText variant="heading">Share Card Preview</TotlText>
        </Card>
      </ShareResultsTray>
    </Screen>
  ),
};

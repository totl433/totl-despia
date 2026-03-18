import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';
import { Pressable, View } from 'react-native';
import { Screen, TotlText } from '@totl/ui';

import PopupCardStack from '../components/popupCards/PopupCardStack';
import { createMainPopupStack, createWelcomePopupStack } from '../components/popupCards/popupCardsCatalog';
import type { PopupCardDescriptor } from '../components/popupCards/types';

function StackPreview({ initialCards }: { initialCards: PopupCardDescriptor[] }) {
  const [cards, setCards] = React.useState<PopupCardDescriptor[]>(initialCards);

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Pressable
          onPress={() => setCards(initialCards)}
          style={({ pressed }) => ({
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: '#1C8376',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <TotlText style={{ color: '#FFFFFF', fontWeight: '800' }}>Reset Stack</TotlText>
        </Pressable>
      </View>

      <PopupCardStack
        cards={cards}
        visible={cards.length > 0}
        onDismissTop={() => setCards((current) => current.slice(1))}
        onCloseAll={() => setCards([])}
      />
    </Screen>
  );
}

const meta: Meta<typeof StackPreview> = {
  title: 'App/PopupCards/PopupCardStack',
  component: StackPreview,
};

export default meta;

type Story = StoryObj<typeof StackPreview>;

export const MainStack: Story = {
  args: {
    initialCards: createMainPopupStack({
      resultsGw: 27,
      newGameweekGw: 28,
      includeResults: true,
      includeWinners: true,
      includeNewGameweek: true,
    }),
  },
};

export const WelcomeStack: Story = {
  args: {
    initialCards: createWelcomePopupStack('storybook-user'),
  },
};

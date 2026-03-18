import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { Screen } from '@totl/ui';

import PopupInfoCard from '../components/popupCards/PopupInfoCard';

const meta: Meta<typeof PopupInfoCard> = {
  title: 'App/PopupCards/PopupInfoCard',
  component: PopupInfoCard,
};

export default meta;

type Story = StoryObj<typeof PopupInfoCard>;

function Preview(args: React.ComponentProps<typeof PopupInfoCard>) {
  return (
    <Screen>
      <View
        style={{
          width: 320,
          height: 470,
          alignSelf: 'center',
          marginTop: 24,
          shadowColor: '#000000',
          shadowOpacity: 0.2,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 12 },
          elevation: 10,
        }}
      >
        <PopupInfoCard {...args} />
      </View>
    </Screen>
  );
}

export const Results: Story = {
  render: (args) => <Preview {...args} />,
  args: {
    title: 'Results',
    isTopCard: true,
    onClose: () => {},
  },
};

export const Welcome: Story = {
  render: (args) => <Preview {...args} />,
  args: {
    title: 'Welcome 1',
    isTopCard: true,
    onClose: () => {},
  },
};

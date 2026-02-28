import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { Screen } from '@totl/ui';
import CenteredSpinner from '../components/CenteredSpinner';

const meta: Meta<typeof CenteredSpinner> = {
  title: 'App/CenteredSpinner',
  component: CenteredSpinner,
};

export default meta;
type Story = StoryObj<typeof CenteredSpinner>;

export const Loading: Story = {
  render: () => (
    <Screen>
      <CenteredSpinner loading delayMs={0} />
    </Screen>
  ),
};

export const NotLoading: Story = {
  render: () => (
    <Screen>
      <CenteredSpinner loading={false} />
    </Screen>
  ),
};

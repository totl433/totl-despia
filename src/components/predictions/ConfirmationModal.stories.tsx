import type { Meta, StoryObj } from '@storybook/react';
import ConfirmationModal from './ConfirmationModal';

const meta: Meta<typeof ConfirmationModal> = {
  title: 'Predictions/ConfirmationModal',
  component: ConfirmationModal,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof ConfirmationModal>;

export const Success: Story = {
  args: {
    success: true,
    message: 'Your predictions are locked in. Good luck!',
    onClose: () => console.log('Closed'),
  },
};

export const Error: Story = {
  args: {
    success: false,
    message: 'Please make sure you have selected all fixtures before confirming.',
    onClose: () => console.log('Closed'),
  },
};

export const WithoutClose: Story = {
  args: {
    success: true,
    message: 'Your predictions are locked in. Good luck!',
  },
};


import type { Meta, StoryObj } from '@storybook/react';
import FirstVisitInfoBanner from './FirstVisitInfoBanner';

const meta: Meta<typeof FirstVisitInfoBanner> = {
  title: 'Components/FirstVisitInfoBanner',
  component: FirstVisitInfoBanner,
  parameters: {
    docs: {
      description: {
        component:
          'A reusable overlay popup component that shows on first visit to a page/feature. Features a backdrop overlay, close button (session-only dismiss), "Don\'t show again" option (permanent dismiss), and escape key support.',
      },
    },
    layout: 'fullscreen', // Fullscreen layout for overlay components
  },
};

export default meta;

type Story = StoryObj<typeof FirstVisitInfoBanner>;

export const LeaderboardFirstVisit: Story = {
  args: {
    storageKey: 'leaderboardFirstVisit',
    message:
      'After the deadline, you can tap a player to view their predictions.',
    icon: '💡',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Example for leaderboard page - shows how to view user predictions. Click X, backdrop, or "Got it" to dismiss for session. Click "Don\'t show again" to permanently dismiss. Press Escape key to dismiss.',
      },
    },
  },
};

export const CustomMessage: Story = {
  args: {
    storageKey: 'customFeatureFirstVisit',
    message:
      'This is a custom message explaining a new feature. The overlay appears centered on the screen with a backdrop. Click anywhere outside the popup, press Escape, or click the close button to dismiss for this session.',
    icon: '✨',
  },
};

export const LongMessage: Story = {
  args: {
    storageKey: 'longMessageFirstVisit',
    message:
      'This banner supports longer messages that wrap nicely. You can include multiple sentences and the text will flow naturally within the banner container. The close button stays in the top right corner, and the "Don\'t show again" link appears below the message.',
    icon: '📝',
  },
};

export const DifferentIcon: Story = {
  args: {
    storageKey: 'differentIconFirstVisit',
    message: 'You can use any emoji or icon as the visual indicator.',
    icon: '🎯',
  },
};

// Helper story to test behavior
export const TestBehavior: Story = {
  args: {
    storageKey: 'testBehavior',
    message:
      'Test the behavior: Click X to dismiss for this session (will reappear on page refresh). Click "Don\'t show again" to permanently dismiss. To reset, clear localStorage: localStorage.removeItem("testBehavior")',
    icon: '🧪',
  },
};


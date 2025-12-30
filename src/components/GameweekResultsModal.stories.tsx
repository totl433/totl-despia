import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import GameweekResultsModal from './GameweekResultsModal';

const meta: Meta<typeof GameweekResultsModal> = {
  title: 'Components/GameweekResultsModal',
  component: GameweekResultsModal,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof GameweekResultsModal>;

// Wrapper to handle modal state
function ModalWrapper({ args }: { args: any }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="m-4 px-4 py-2 bg-emerald-600 text-white rounded-lg"
      >
        Open Results Modal
      </button>
      <GameweekResultsModal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export const Default: Story = {
  render: (args) => <ModalWrapper args={args} />,
  args: {
    gw: 18,
    nextGw: 19,
    mockResults: {
      score: 6,
      totalFixtures: 10,
      gwRank: 45,
      gwRankTotal: 512,
      trophies: {
        gw: false,
        form5: false,
        form10: false,
        overall: false,
      },
      mlVictories: 2,
      leaderboardChanges: {
        overall: { before: 47, after: 45, change: 2 },
        form5: { before: 52, after: 48, change: 4 },
        form10: { before: 38, after: 35, change: 3 },
      },
    },
  },
};

export const WithTrophies: Story = {
  render: (args) => <ModalWrapper args={args} />,
  args: {
    gw: 18,
    nextGw: 19,
    mockResults: {
      score: 10,
      totalFixtures: 10,
      gwRank: 1,
      gwRankTotal: 512,
      trophies: {
        gw: true,
        form5: true,
        form10: false,
        overall: false,
      },
      mlVictories: 3,
      leaderboardChanges: {
        overall: { before: 5, after: 3, change: 2 },
        form5: { before: 2, after: 1, change: 1 },
        form10: { before: 4, after: 2, change: 2 },
      },
    },
  },
};

export const NoNextGw: Story = {
  render: (args) => <ModalWrapper args={args} />,
  args: {
    gw: 18,
    nextGw: null,
    mockResults: {
      score: 6,
      totalFixtures: 10,
      gwRank: 45,
      gwRankTotal: 512,
      trophies: {
        gw: false,
        form5: false,
        form10: false,
        overall: false,
      },
      mlVictories: 2,
      leaderboardChanges: {
        overall: { before: 47, after: 45, change: 2 },
        form5: { before: 52, after: 48, change: 4 },
        form10: { before: 38, after: 35, change: 3 },
      },
    },
  },
};

export const NoTrophies: Story = {
  render: (args) => <ModalWrapper args={args} />,
  args: {
    gw: 18,
    nextGw: 19,
    mockResults: {
      score: 4,
      totalFixtures: 10,
      gwRank: 234,
      gwRankTotal: 512,
      trophies: {
        gw: false,
        form5: false,
        form10: false,
        overall: false,
      },
      mlVictories: 0,
      leaderboardChanges: {
        overall: { before: 230, after: 234, change: -4 },
        form5: { before: 245, after: 250, change: -5 },
        form10: { before: 220, after: 225, change: -5 },
      },
    },
  },
};


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
      mlVictoryData: [
        { id: 'ml-1', name: 'Prem Predictions', avatar: null },
        { id: 'ml-2', name: 'Work League', avatar: null },
      ],
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
      mlVictoryData: [
        { id: 'ml-1', name: 'Prem Predictions', avatar: null },
        { id: 'ml-2', name: 'Work League', avatar: null },
        { id: 'ml-3', name: 'Family League', avatar: null },
      ],
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
      mlVictoryData: [
        { id: 'ml-1', name: 'Prem Predictions', avatar: null },
        { id: 'ml-2', name: 'Work League', avatar: null },
      ],
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

// Story to show the capture element (share card)
export const ShareCard: Story = {
  render: (args) => {
    const [showCapture, setShowCapture] = useState(true);
    return (
      <div className="p-8 bg-slate-100 min-h-screen">
        <button
          onClick={() => setShowCapture(!showCapture)}
          className="mb-4 px-4 py-2 bg-emerald-600 text-white rounded-lg"
        >
          {showCapture ? 'Hide' : 'Show'} Capture Element
        </button>
        {showCapture && (
          <div
            style={{
              position: 'relative',
              maxWidth: '512px',
              width: '100%',
              margin: '0 auto',
            }}
            className="bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Green Header */}
            <div style={{ 
              backgroundColor: '#1C8376', 
              paddingTop: '6px', 
              paddingBottom: '6px',
              paddingLeft: '16px',
              paddingRight: '16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              minHeight: '50px'
            }}>
              <img 
                src="/assets/badges/totl-logo1.svg" 
                alt="TOTL" 
                style={{ 
                  width: '40px', 
                  height: '40px',
                  filter: 'brightness(0) invert(1)',
                  display: 'block',
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              />
            </div>

            {/* Content - matching the share card structure */}
            <div className="p-6 sm:p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-1">
                  Gameweek {args.gw} Results
                </h2>
              </div>

              <div className="relative mb-6">
                <div className="text-center">
                  <div className="mb-2 flex items-center justify-center gap-1">
                    <img
                      src="/assets/Volley/Volley-playing.png"
                      alt="Volley"
                      className="w-20 h-20 sm:w-24 sm:h-24 object-contain"
                    />
                    <div className="text-5xl sm:text-6xl font-bold text-emerald-600">
                      {args.mockResults?.score}/{args.mockResults?.totalFixtures}
                    </div>
                  </div>
                </div>
              </div>

              {args.mockResults?.gwRank && args.mockResults?.gwRankTotal && (
                <div className="flex gap-3 mb-6">
                  <div className="flex-1 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl">
                    <div className="text-center">
                      <span className="text-emerald-700 font-semibold text-sm mb-2 block">Gameweek Leaderboard</span>
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-emerald-800 font-bold text-2xl">
                          {args.mockResults.gwRank}
                        </span>
                        <span className="text-emerald-600 text-sm">of {args.mockResults.gwRankTotal}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
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
      mlVictoryData: [
        { id: 'ml-1', name: 'Prem Predictions', avatar: null },
        { id: 'ml-2', name: 'Work League', avatar: null },
      ],
      leaderboardChanges: {
        overall: { before: 47, after: 45, change: 2 },
        form5: { before: 52, after: 48, change: 4 },
        form10: { before: 38, after: 35, change: 3 },
      },
    },
  },
};


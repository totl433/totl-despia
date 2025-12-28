import type { Meta, StoryObj } from '@storybook/react';
import { useState, useRef } from 'react';
import GameweekFixturesCardList from './GameweekFixturesCardList';
import GameweekFixturesCardListForCapture from './GameweekFixturesCardListForCapture';
import type { Fixture, LiveScore } from './FixtureCard';
import html2canvas from 'html2canvas';

const meta: Meta<typeof GameweekFixturesCardList> = {
  title: 'Components/GameweekFixturesCardList',
  component: GameweekFixturesCardList,
  parameters: {
    layout: 'padded',
    viewport: {
      defaultViewport: 'desktop',
    },
  },
};

export default meta;
type Story = StoryObj<typeof GameweekFixturesCardList>;

// Sample fixtures for GW14 (reusing from grid version)
const sampleFixtures: Fixture[] = [
  {
    id: '1',
    gw: 14,
    fixture_index: 0,
    home_code: 'ARS',
    away_code: 'CHE',
    home_team: 'Arsenal',
    away_team: 'Chelsea',
    home_name: 'Arsenal',
    away_name: 'Chelsea',
    kickoff_time: '2024-12-15T12:30:00Z',
  },
  {
    id: '2',
    gw: 14,
    fixture_index: 1,
    home_code: 'MCI',
    away_code: 'LIV',
    home_team: 'Man City',
    away_team: 'Liverpool',
    home_name: 'Man City',
    away_name: 'Liverpool',
    kickoff_time: '2024-12-15T15:00:00Z',
  },
  {
    id: '3',
    gw: 14,
    fixture_index: 2,
    home_code: 'MUN',
    away_code: 'TOT',
    home_team: 'Man United',
    away_team: 'Spurs',
    home_name: 'Man United',
    away_name: 'Spurs',
    kickoff_time: '2024-12-15T17:30:00Z',
  },
  {
    id: '4',
    gw: 14,
    fixture_index: 3,
    home_code: 'NEW',
    away_code: 'BHA',
    home_team: 'Newcastle',
    away_team: 'Brighton',
    home_name: 'Newcastle',
    away_name: 'Brighton',
    kickoff_time: '2024-12-16T15:00:00Z',
  },
  {
    id: '5',
    gw: 14,
    fixture_index: 4,
    home_code: 'AVL',
    away_code: 'WHU',
    home_team: 'Villa',
    away_team: 'West Ham',
    home_name: 'Villa',
    away_name: 'West Ham',
    kickoff_time: '2024-12-16T17:30:00Z',
  },
  {
    id: '6',
    gw: 14,
    fixture_index: 5,
    home_code: 'EVE',
    away_code: 'CRY',
    home_team: 'Everton',
    away_team: 'Palace',
    home_name: 'Everton',
    away_name: 'Palace',
    kickoff_time: '2024-12-17T15:00:00Z',
  },
  {
    id: '7',
    gw: 14,
    fixture_index: 6,
    home_code: 'FUL',
    away_code: 'WOL',
    home_team: 'Fulham',
    away_team: 'Wolves',
    home_name: 'Fulham',
    away_name: 'Wolves',
    kickoff_time: '2024-12-17T15:00:00Z',
  },
  {
    id: '8',
    gw: 14,
    fixture_index: 7,
    home_code: 'BRE',
    away_code: 'BOU',
    home_team: 'Brentford',
    away_team: 'Bournemouth',
    home_name: 'Brentford',
    away_name: 'Bournemouth',
    kickoff_time: '2024-12-17T15:00:00Z',
  },
  {
    id: '9',
    gw: 14,
    fixture_index: 8,
    home_code: 'NFO',
    away_code: 'BUR',
    home_team: 'Forest',
    away_team: 'Burnley',
    home_name: 'Forest',
    away_name: 'Burnley',
    kickoff_time: '2024-12-17T15:00:00Z',
  },
  {
    id: '10',
    gw: 14,
    fixture_index: 9,
    home_code: 'LEE',
    away_code: 'AVL',
    home_team: 'Leeds',
    away_team: 'Villa',
    home_name: 'Leeds',
    away_name: 'Villa',
    kickoff_time: '2024-12-17T17:30:00Z',
  },
];

// Sample picks
const samplePicks: Record<number, "H" | "D" | "A"> = {
  0: 'H', // Arsenal vs Chelsea - Home
  1: 'D', // Man City vs Liverpool - Draw
  2: 'A', // Man United vs Spurs - Away
  3: 'H', // Newcastle vs Brighton - Home
  4: 'H', // Villa vs West Ham - Home
  5: 'D', // Everton vs Palace - Draw
  6: 'A', // Fulham vs Wolves - Away
  7: 'H', // Bournemouth vs Brentford - Home
  8: 'H', // Forest vs Burnley - Home
  9: 'A', // Leeds vs Villa - Away
};

// Sample live scores
const sampleLiveScores = new Map<number, LiveScore>([
  [0, {
    status: 'FINISHED',
    minute: 90,
    homeScore: 2,
    awayScore: 1,
    home_team: 'Arsenal',
    away_team: 'Chelsea',
    goals: [
      { team: 'Arsenal', scorer: 'Saka', minute: 15 },
    ],
  }],
  [1, {
    status: 'FINISHED',
    minute: 90,
    homeScore: 2,
    awayScore: 1,
    home_team: 'Man City',
    away_team: 'Liverpool',
    goals: [
      { team: 'Man City', scorer: 'Haaland', minute: 12 },
      { team: 'Liverpool', scorer: 'Salah', minute: 28 },
    ],
  }],
  [2, {
    status: 'IN_PLAY',
    minute: 18,
    homeScore: 0,
    awayScore: 1,
    home_team: 'Man United',
    away_team: 'Spurs',
    goals: [
      { team: 'Spurs', scorer: 'Son', minute: 8 },
    ],
  }],
]);

export const Default: Story = {
  args: {
    gw: 14,
    fixtures: sampleFixtures,
    picks: samplePicks,
    liveScores: sampleLiveScores,
    userName: 'Phil Bolton',
    globalRank: 42,
    gwRankPercent: 24,
  },
};

export const WithPicks: Story = {
  args: {
    gw: 14,
    fixtures: sampleFixtures,
    picks: samplePicks,
    liveScores: new Map(),
    userName: 'Phil Bolton',
  },
};

export const WithLiveScores: Story = {
  args: {
    gw: 14,
    fixtures: sampleFixtures,
    picks: samplePicks,
    liveScores: sampleLiveScores,
    userName: 'Phil Bolton',
    gwRankPercent: 24,
  },
};

export const Empty: Story = {
  args: {
    gw: 16,
    fixtures: [],
    picks: {},
    liveScores: new Map(),
  },
};

export const Html2CanvasCapture: Story = {
  render: (args) => {
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const captureRef = useRef<HTMLDivElement>(null);

    const handleCapture = async () => {
      if (!captureRef.current || isCapturing) return;
      
      setIsCapturing(true);
      try {
        // Render in exact same structure as leaderboard modal
        const canvas = await html2canvas(captureRef.current, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
        });

        const imageUrl = canvas.toDataURL('image/png', 0.95);
        setCapturedImage(imageUrl);
      } catch (error) {
        console.error('Capture error:', error);
      } finally {
        setIsCapturing(false);
      }
    };

    return (
      <div className="p-5">
        <button
          onClick={handleCapture}
          disabled={isCapturing}
          className="mb-5 px-5 py-2.5 bg-[#1C8376] text-white border-none rounded-lg disabled:cursor-not-allowed cursor-pointer"
        >
          {isCapturing ? 'Capturing...' : 'Capture with html2canvas'}
        </button>

        {/* Render in EXACT same structure as leaderboard modal */}
        <div
          ref={captureRef}
          className="max-w-[672px] w-full mx-auto"
        >
          <div className="relative max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="max-h-[90vh] overflow-y-auto">
              <GameweekFixturesCardListForCapture
                {...args}
              />
            </div>
          </div>
        </div>

        {/* Show captured image - scaled for easier comparison */}
        {capturedImage && (
          <div className="mt-10 p-5 bg-slate-100 rounded-lg">
            <h3 className="mb-5">Captured Image (what html2canvas sees):</h3>
            <div className="flex justify-center items-center">
              <img
                src={capturedImage}
                alt="Captured"
                className="max-w-[672px] w-full h-auto border-2 border-slate-300 rounded-lg"
              />
            </div>
            <div className="mt-2.5 text-xs text-slate-600">
              This is what html2canvas captured. Compare it to the component above.
            </div>
          </div>
        )}
      </div>
    );
  },
  args: {
    gw: 14,
    fixtures: sampleFixtures,
    picks: samplePicks,
    liveScores: sampleLiveScores,
    userName: 'Phil Bolton',
    globalRank: 42,
    gwRankPercent: 24,
  },
};


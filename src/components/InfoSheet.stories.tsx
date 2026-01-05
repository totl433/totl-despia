import type { Meta, StoryObj } from'@storybook/react';
import { useState } from'react';
import InfoSheet from'./InfoSheet';

const meta: Meta<typeof InfoSheet> = {
 title:'Components/InfoSheet',
 component: InfoSheet,
 parameters: {
 layout:'fullscreen',
 backgrounds: {
 default:'slate',
 values: [
 { name:'slate', value:'#f1f5f9' },
 { name:'white', value:'#ffffff' },
 ],
 },
 },
};

export default meta;
type Story = StoryObj<typeof InfoSheet>;

// Interactive wrapper for stories
function InfoSheetWrapper({ title, description }: { title: string; description: string }) {
 const [isOpen, setIsOpen] = useState(false);

 return (
 <div className="p-8">
 <button
 onClick={() => setIsOpen(true)}
     className="px-4 py-2 bg-blue-600 text-white rounded-lg"
     >
     Open Info Sheet
 </button>
 <InfoSheet
 isOpen={isOpen}
 onClose={() => setIsOpen(false)}
 title={title}
 description={description}
 />
 </div>);
}

export const MiniLeagues: Story = {
 render: () => (
 <InfoSheetWrapper
 title="Mini leagues"
 description="Mini leagues are where you compete with your friends. Access your mini league chat, table, and see your friends predictions."
 />),
};

export const Predictions: Story = {
 render: () => (
 <InfoSheetWrapper
 title="Predictions"
 description="Make your predictions for each game before kickoff. Once the first match starts, your predictions are locked. Each correct prediction adds 1 to your Overall Correct Predictions (OCP) score."
 />),
};

export const Leaderboards: Story = {
 render: () => (
 <InfoSheetWrapper
 title="Leaderboards"
 description="See how you rank against all players. The leaderboard shows your Overall Correct Predictions (OCP) and your position in the global rankings. Climb the table by making accurate predictions each gameweek."
 />),
};

export const LongContent: Story = {
 render: () => (
 <InfoSheetWrapper
 title="Gameweek Rules"
 description="Each gameweek, you make predictions for all Premier League matches. Predictions must be submitted before the first match kicks off. Once submitted, your predictions are locked and cannot be changed. Each correct prediction earns you 1 point towards your Overall Correct Predictions (OCP) total. The player with the most correct predictions at the end of the season wins. In mini-leagues, you compete with your friends. The player with the most correct predictions each week wins 3 points, a draw earns 1 point, and a loss earns 0 points. If there's a tie, the player with the most unicorns wins."
 />),
};

import type { Meta, StoryObj } from "@storybook/react";
import MessageBubble from "./MessageBubble";

const meta: Meta<typeof MessageBubble> = {
  title: "Chat/MessageBubble",
  component: MessageBubble,
  args: {
    author: "Jof",
    text: "I typing can be weird a slow so I’ll see what can be done",
    time: "13:44",
  },
  decorators: [
    (Story) => (
      <div className="bg-[#f5f6fb] min-h-[200px] p-6 flex justify-start">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MessageBubble>;

export const Incoming: Story = {};

export const Outgoing: Story = {
  args: {
    author: "",
    text: "Check check",
    time: "23:59",
    isOwnMessage: true,
  },
};

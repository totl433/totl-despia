import type { Meta, StoryObj } from "@storybook/react";
import ChatBubble from "./ChatBubble";

const meta: Meta<typeof ChatBubble> = {
  title: "Chat/ChatBubble",
  component: ChatBubble,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    message: "Me and cursor are best friends 4eva",
    timestamp: "16:33",
  },
};

export default meta;
type Story = StoryObj<typeof ChatBubble>;

export const Incoming: Story = {
  args: {
    author: "Jof",
    message: "I typing can be weird a slow so I’ll see what can be done",
    timestamp: "13:44",
    avatarInitials: "J",
  },
};

export const Outgoing: Story = {
  args: {
    variant: "outgoing",
    message: "Check check",
    timestamp: "23:59",
    showAvatar: false,
  },
};

export const Transcript: Story = {
  render: () => (
    <div className="min-h-screen bg-[#f5f6fb] p-6 space-y-4">
      <ChatBubble
        author="Jof"
        message="I typing can be weird a slow so I’ll see what can be done"
        timestamp="13:44"
        avatarInitials="J"
      />
      <ChatBubble
        author="Jof"
        message="Can you check username length across the platform bendy"
        timestamp="13:45"
        avatarInitials="J"
      />
      <ChatBubble
        author="Jof"
        message="Me and cursor are best friends 4eva"
        timestamp="16:33"
        avatarInitials="J"
      />
      <ChatBubble
        variant="outgoing"
        message="Check check"
        timestamp="23:59"
        showAvatar={false}
      />
    </div>
  ),
};

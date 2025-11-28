import type { Meta, StoryObj } from "@storybook/react";
import MessageStack from "./MessageStack";

const meta: Meta<typeof MessageStack> = {
  title: "Chat/MessageStack",
  component: MessageStack,
  args: {
    author: "Jof",
    avatarInitials: "J",
    messages: [
      { id: "1", text: "I typing can be weird a slow so I’ll see what can be done", time: "13:44" },
      { id: "2", text: "Can you check username length across the platform bendy", time: "13:45" },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof MessageStack>;

export const Incoming: Story = {};

export const Outgoing: Story = {
  args: {
    author: "",
    avatarInitials: "",
    isOwnMessage: true,
    messages: [
      { id: "1", text: "Check check", time: "23:59" },
    ],
  },
};

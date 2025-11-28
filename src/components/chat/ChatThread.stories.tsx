import type { Meta, StoryObj } from "@storybook/react";
import ChatThread from "./ChatThread";

const meta: Meta<typeof ChatThread> = {
  title: "Chat/ChatThread",
  component: ChatThread,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof ChatThread>;

export const Transcript: Story = {
  args: {
    groups: [
      {
        id: "grp-1",
        author: "Jof",
        avatarInitials: "J",
        messages: [
          { id: "m1", text: "I typing can be weird a slow so I’ll see what can be done", time: "13:44" },
          { id: "m2", text: "Can you check username length across the platform bendy", time: "13:45" },
          { id: "m3", text: "Me and cursor are best friends 4eva", time: "16:33" },
        ],
      },
      {
        id: "grp-2",
        author: "",
        isOwnMessage: true,
        messages: [{ id: "m4", text: "Check check", time: "23:59" }],
      },
    ],
  },
};

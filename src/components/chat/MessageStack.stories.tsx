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
      { id: "3", text: "Me and cursor are best friends 4eva", time: "16:33" },
    ],
  },
  decorators: [
    (Story) => (
      <div className="bg-[#f5f6fb] min-h-[300px] p-6 flex justify-center">
        <div className="w-full max-w-[420px]">
          <Story />
        </div>
      </div>
    ),
  ],
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
      { id: "4", text: "Check check", time: "23:57" },
      { id: "5", text: "Is anyone there?", time: "23:58" },
      { id: "6", text: "Hello hello hello", time: "23:59" },
    ],
  },
};

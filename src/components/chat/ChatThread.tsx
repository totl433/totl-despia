import type { ReactNode } from "react";
import MessageStack from "./MessageStack";

type ChatThreadMessage = {
  id: string;
  text: ReactNode;
  time: string;
  status?: "sending" | "error";
};

type ChatThreadGroup = {
  id: string;
  author: string;
  avatarInitials?: string;
  isOwnMessage?: boolean;
  dayLabel?: string;
  messages: ChatThreadMessage[];
};

export type ChatThreadProps = {
  groups: ChatThreadGroup[];
  reactions?: Record<string, Array<{ emoji: string; count: number; hasUserReacted: boolean }>>;
  onReactionClick?: (messageId: string, emoji: string) => void;
};

export function ChatThread({ groups, reactions, onReactionClick }: ChatThreadProps) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-3">
          {group.dayLabel && (
            <div className="text-center text-xs uppercase tracking-wide text-slate-400">
              {group.dayLabel}
            </div>
          )}
          <MessageStack
            author={group.author}
            avatarInitials={group.avatarInitials}
            isOwnMessage={group.isOwnMessage}
            messages={group.messages}
            reactions={reactions}
            onReactionClick={onReactionClick}
          />
        </div>
      ))}
    </div>
  );
}

export default ChatThread;

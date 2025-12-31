import type { ReactNode } from "react";
import MessageStack from "./MessageStack";

type ChatThreadMessage = {
  id: string;
  text: ReactNode;
  time: string;
  status?: "sending" | "error";
  messageId?: string;
  replyTo?: {
    id: string;
    content: string;
    authorName?: string;
  } | null;
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
  onMessageClick?: (messageId: string, content: string, authorName?: string) => void;
};

export function ChatThread({ groups, reactions, onReactionClick, onMessageClick }: ChatThreadProps) {
  // CRITICAL DEBUG: Log what author values we're passing to MessageStack
  const unknownGroups = groups.filter(g => g.author === "Unknown");
  if (unknownGroups.length > 0) {
    console.error('[ChatThread] RENDERING with', unknownGroups.length, 'groups with "Unknown" author!');
    unknownGroups.forEach((g, idx) => {
      console.error(`[ChatThread] Group ${idx}: id="${g.id}", author="${g.author}", messages=${g.messages.length}`);
    });
  }
  
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group, index) => (
        <div key={`${group.id}-${group.author}-${index}`} className="flex flex-col gap-3">
          {group.dayLabel && (
            <div className="text-center text-xs uppercase tracking-wide text-slate-400">
              {group.dayLabel}
            </div>
          )}
          <MessageStack
            key={`${group.id}-${group.author}-${index}`}
            author={group.author}
            avatarInitials={group.avatarInitials}
            isOwnMessage={group.isOwnMessage}
            messages={group.messages}
            reactions={reactions}
            onReactionClick={onReactionClick}
            onMessageClick={onMessageClick}
          />
        </div>
      ))}
    </div>
  );
}

export default ChatThread;

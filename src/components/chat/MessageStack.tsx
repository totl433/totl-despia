import type { ReactNode } from "react";
import MessageBubble from "./MessageBubble";

type Message = {
  id: string;
  text: ReactNode;
  time: string;
  status?: "sending" | "error";
  replyTo?: {
    id: string;
    content: string;
    authorName?: string;
  } | null;
};

export type MessageStackProps = {
  author: string;
  messages: Message[];
  isOwnMessage?: boolean;
  avatarInitials?: string;
  reactions?: Record<string, Array<{ emoji: string; count: number; hasUserReacted: boolean }>>;
  onReactionClick?: (messageId: string, emoji: string) => void;
  onMessageClick?: (messageId: string, content: string, authorName?: string) => void;
};

export function MessageStack({
  author,
  messages,
  isOwnMessage,
  avatarInitials,
  reactions,
  onReactionClick,
  onMessageClick,
}: MessageStackProps) {
  // CRITICAL DEBUG: Log what author we're receiving
  if (author === "Unknown") {
    console.error('[MessageStack] Received "Unknown" as author prop!', 'isOwnMessage:', isOwnMessage, 'messages:', messages.length);
  }
  const alignment = isOwnMessage ? "justify-end" : "justify-start";

  return (
    <div className={`flex items-end gap-3 w-full ${alignment}`}>
      {!isOwnMessage ? (
        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[13px] font-semibold text-slate-500 flex-shrink-0">
            {(avatarInitials || author.charAt(0)).toUpperCase()}
        </div>
      ) : (
        <div className="w-8 flex-shrink-0" />
      )}

      <div className="flex flex-col gap-1 flex-1">
        {messages.map((message, index) => {
          const shape: "single" | "top" | "middle" | "bottom" =
            messages.length === 1
              ? "single"
              : index === 0
              ? "top"
              : index === messages.length - 1
              ? "bottom"
              : "middle";

          const messageId = (message as any).messageId || message.id;
          // Extract text content for reply - handle ReactNode
          let messageContent = '';
          if (typeof message.text === 'string') {
            messageContent = message.text;
          } else if (typeof message.text === 'object' && message.text !== null) {
            const textContent = (message.text as any)?.props?.children || String(message.text);
            messageContent = typeof textContent === 'string' ? textContent : String(textContent);
          } else {
            messageContent = String(message.text);
          }
          return (
            <div key={message.id} className={`flex flex-col w-full ${isOwnMessage ? "items-end" : "items-start"}`}>
              <div className={`flex w-full ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                <MessageBubble
                  author={!isOwnMessage && index === 0 ? author : undefined}
                  text={message.text}
                  time={message.time}
                  isOwnMessage={isOwnMessage}
                  shape={shape}
                  messageId={messageId}
                  reactions={reactions?.[messageId] || []}
                  onReactionClick={onReactionClick}
                  replyTo={message.replyTo}
                  onMessageClick={onMessageClick ? () => onMessageClick(messageId, messageContent, !isOwnMessage && index === 0 ? author : undefined) : undefined}
                />
                {message.status && (
                  <div
                    className={`text-[11px] ml-2 ${
                      message.status === "error" ? "text-red-500" : "text-slate-400"
                    }`}
                  >
                    {message.status === "error" ? "Failed" : "Sending…"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MessageStack;

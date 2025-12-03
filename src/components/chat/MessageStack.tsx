import type { ReactNode } from "react";
import MessageBubble from "./MessageBubble";

type Message = {
  id: string;
  text: ReactNode;
  time: string;
  status?: "sending" | "error";
};

export type MessageStackProps = {
  author: string;
  messages: Message[];
  isOwnMessage?: boolean;
  avatarInitials?: string;
};

export function MessageStack({
  author,
  messages,
  isOwnMessage,
  avatarInitials,
}: MessageStackProps) {
  const alignment = isOwnMessage ? "justify-end" : "justify-start";

  return (
    <div className={`flex items-end gap-3 w-full ${alignment}`}>
      {!isOwnMessage ? (
        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[13px] font-semibold text-slate-500 flex-shrink-0">
            {(avatarInitials || author.charAt(0)).toUpperCase()}
        </div>
      ) : (
        <div className="w-8" />
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

          return (
            <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
              <div className={`flex flex-col gap-1 ${isOwnMessage ? "items-end" : "items-start"}`}>
                <MessageBubble
                  author={!isOwnMessage && index === 0 ? author : undefined}
                  text={message.text}
                  time={message.time}
                  isOwnMessage={isOwnMessage}
                  shape={shape}
                />
                {message.status && (
                  <div
                    className={`text-[11px] ${
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

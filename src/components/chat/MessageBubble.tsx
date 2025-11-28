import type { ReactNode } from "react";

type MessageBubbleProps = {
  author: string;
  text: ReactNode;
  time: string;
  isOwnMessage?: boolean;
};

export function MessageBubble({ author, text, time, isOwnMessage }: MessageBubbleProps) {
  const alignment = isOwnMessage ? "items-end text-right" : "items-start text-left";
  const bubbleColors = isOwnMessage
    ? "bg-[#1C8376] text-white"
    : "bg-white text-slate-900";
  const timeColor = isOwnMessage ? "text-white/70" : "text-slate-400";

  return (
    <div className={`flex flex-col gap-1 ${alignment} max-w-full`}
    >
      {author && (
        <div className={`text-xs font-semibold ${isOwnMessage ? "text-white/80" : "text-slate-500"}`}>
          {author}
        </div>
      )}
      <div
        className={`rounded-[22px] px-4 py-3 text-[15px] leading-snug shadow-sm ${bubbleColors}`}
      >
        {text}
      </div>
      {time && <div className={`text-xs ${timeColor}`}>{time}</div>}
    </div>
  );
}

export default MessageBubble;

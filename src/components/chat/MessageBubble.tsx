import type { ReactNode } from "react";

type MessageBubbleProps = {
  author?: string;
  text: ReactNode;
  time: string;
  isOwnMessage?: boolean;
};

export function MessageBubble({ author, text, time, isOwnMessage }: MessageBubbleProps) {
  const alignment = isOwnMessage ? "items-end text-right" : "items-start text-left";
  const bubbleClasses = isOwnMessage
    ? "bg-[#1C8376] text-white border border-[#16826f]"
    : "bg-white text-slate-900 border border-slate-100";
  const timeColor = isOwnMessage ? "text-white/80" : "text-slate-400";

  return (
    <div className={`flex flex-col gap-2 ${alignment} max-w-full`}>
      {author && !isOwnMessage && (
        <div className="text-sm font-semibold text-slate-600">{author}</div>
      )}
      <div className={`rounded-[18px] px-4 py-3 text-[15px] leading-snug ${bubbleClasses}`}>
        {text}
      </div>
      <div className={`text-xs ${timeColor}`}>{time}</div>
    </div>
  );
}

export default MessageBubble;

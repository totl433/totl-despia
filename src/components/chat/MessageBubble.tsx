import type { ReactNode } from "react";

type BubbleShape = "single" | "top" | "middle" | "bottom";

const shapeClasses: Record<BubbleShape, string> = {
  single: "rounded-[22px]",
  top: "rounded-t-[22px] rounded-b-[12px]",
  middle: "rounded-[12px]",
  bottom: "rounded-b-[22px] rounded-t-[12px]",
};

type MessageBubbleProps = {
  author?: string;
  text: ReactNode;
  time: string;
  isOwnMessage?: boolean;
  shape?: BubbleShape;
};

export function MessageBubble({
  author,
  text,
  time,
  isOwnMessage,
  shape = "single",
}: MessageBubbleProps) {
  const alignment = isOwnMessage ? "items-end text-right" : "items-start text-left";
  const bubbleClasses = isOwnMessage ? "bg-[#1C8376] text-white" : "bg-white text-slate-900";
  const timeColor = isOwnMessage ? "text-white/70" : "text-slate-400";

  return (
    <div className={`flex flex-col gap-1 ${alignment} max-w-full`}>
      {author && !isOwnMessage && (
        <div className="text-sm font-semibold text-slate-600">{author}</div>
      )}
      <div
        className={`px-4 py-3 text-[15px] leading-snug shadow-sm ${bubbleClasses} ${shapeClasses[shape]}`}
      >
        {text}
      </div>
      <div className={`text-xs ${timeColor}`}>{time}</div>
    </div>
  );
}

export default MessageBubble;

import type { ReactNode } from "react";

type BubbleShape = "single" | "top" | "middle" | "bottom";

const incomingShape: Record<BubbleShape, string> = {
  single: "rounded-tl-[12px] rounded-tr-[12px] rounded-br-[12px] rounded-bl-[12px]",
  top: "rounded-tl-[12px] rounded-tr-[12px] rounded-br-[12px] rounded-bl-[4px]",
  middle: "rounded-tl-[4px] rounded-tr-[12px] rounded-br-[12px] rounded-bl-[4px]",
  bottom: "rounded-tl-[4px] rounded-tr-[12px] rounded-br-[12px] rounded-bl-[12px]",
};

const outgoingShape: Record<BubbleShape, string> = {
  single: "rounded-tl-[12px] rounded-tr-[12px] rounded-br-[12px] rounded-bl-[12px]",
  top: "rounded-tl-[12px] rounded-tr-[12px] rounded-br-[4px] rounded-bl-[12px]",
  middle: "rounded-tl-[12px] rounded-tr-[4px] rounded-br-[4px] rounded-bl-[12px]",
  bottom: "rounded-tl-[12px] rounded-tr-[4px] rounded-br-[12px] rounded-bl-[12px]",
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
  const shapeClasses = isOwnMessage ? outgoingShape : incomingShape;

  return (
    <div className={`flex flex-col gap-1 ${alignment} max-w-full`}>
      {author && !isOwnMessage && (
        <div className="text-sm font-semibold text-slate-600">{author}</div>
      )}
      <div
        className={`px-4 pb-5 pt-3 text-[15px] leading-snug shadow-sm ${bubbleClasses} ${shapeClasses[shape]}`}
      >
        <div>{text}</div>
        <div className={`mt-2 text-xs ${timeColor}`}>{time}</div>
      </div>
    </div>
  );
}

export default MessageBubble;

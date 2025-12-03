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
  const shapeClasses = isOwnMessage ? outgoingShape : incomingShape;
  const maxWidth = "max-w-[72%]";

  return (
    <div
      className={`inline-flex w-fit px-3 py-2 text-sm leading-snug shadow-sm ${maxWidth} whitespace-normal break-words ${bubbleClasses} ${shapeClasses[shape]}`}
    >
      <div className={`flex flex-col gap-1 ${alignment}`}>
        {author && !isOwnMessage && (
          <div className="text-[11px] font-semibold text-slate-600">{author}</div>
        )}
        <div className="whitespace-normal break-words">{text}</div>
        <div className="text-[11px] text-[#DCDCDD]">{time}</div>
      </div>
    </div>
  );
}

export default MessageBubble;

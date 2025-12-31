import type { ReactNode } from "react";
import { useState } from "react";

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

type Reaction = {
  emoji: string;
  count: number;
  hasUserReacted: boolean;
};

type MessageBubbleProps = {
  author?: string;
  text: ReactNode;
  time: string;
  isOwnMessage?: boolean;
  shape?: BubbleShape;
  messageId?: string;
  reactions?: Reaction[];
  onReactionClick?: (messageId: string, emoji: string) => void;
  userId?: string;
};

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉'];

export function MessageBubble({
  author,
  text,
  time,
  isOwnMessage,
  shape = "single",
  messageId,
  reactions = [],
  onReactionClick,
  userId,
}: MessageBubbleProps) {
  const textAlignment = isOwnMessage ? "text-right" : "text-left";
  const bubbleClasses = isOwnMessage ? "bg-[#1C8376] text-white" : "bg-white text-slate-900";
  const shapeClasses = isOwnMessage ? outgoingShape : incomingShape;
  const maxWidth = "max-w-[70%]";
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const handleReactionClick = (emoji: string) => {
    if (messageId && onReactionClick) {
      onReactionClick(messageId, emoji);
    }
    setShowReactionPicker(false);
  };

  return (
    <div className={`inline-block w-fit ${maxWidth}`}>
      <div
        className={`px-3 py-2 text-sm leading-snug shadow-sm whitespace-normal break-words ${textAlignment} ${bubbleClasses} ${shapeClasses[shape]}`}
      >
        {author && !isOwnMessage && (
          <div className="text-[11px] font-semibold text-slate-600 mb-1">{author}</div>
        )}
        <div>{text}</div>
        <div className="text-[11px] text-[#DCDCDD] mt-1">{time}</div>
      </div>
      {/* Reactions */}
      {(reactions.length > 0 || messageId) && (
        <div className={`mt-1 flex items-center gap-1 flex-wrap ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
          {reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              onClick={() => handleReactionClick(reaction.emoji)}
              className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-colors ${
                reaction.hasUserReacted
                  ? 'bg-[#1C8376] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{reaction.emoji}</span>
              <span>{reaction.count}</span>
            </button>
          ))}
          {messageId && (
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >
              <span className="text-[10px]">+</span>
            </button>
          )}
        </div>
      )}
      {/* Quick reaction picker */}
      {showReactionPicker && messageId && (
        <div className={`mt-1 flex items-center gap-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReactionClick(emoji)}
              className="w-8 h-8 rounded-full bg-white border border-slate-300 flex items-center justify-center text-lg hover:bg-slate-50 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default MessageBubble;

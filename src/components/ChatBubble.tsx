import type { ReactNode } from "react";

type ChatBubbleProps = {
  author?: string;
  message: ReactNode;
  timestamp: string;
  variant?: "incoming" | "outgoing";
  avatarInitials?: string;
  showAvatar?: boolean;
  showAuthor?: boolean;
  className?: string;
};

const baseBubble =
  "rounded-[22px] px-4 py-3 text-[15px] leading-snug max-w-full sm:max-w-xl";

export function ChatBubble({
  author,
  message,
  timestamp,
  variant = "incoming",
  avatarInitials,
  showAvatar = true,
  showAuthor,
  className = "",
}: ChatBubbleProps) {
  const isIncoming = variant === "incoming";
  const shouldShowAuthor =
    typeof showAuthor === "boolean" ? showAuthor : isIncoming;

  return (
    <div
      className={`flex gap-2 ${
        isIncoming ? "items-start justify-start" : "items-end justify-end"
      } ${className}`}
    >
      {isIncoming && showAvatar ? (
        <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[13px] font-semibold text-slate-500 shrink-0">
          {avatarInitials?.slice(0, 2).toUpperCase() ?? "?"}
        </div>
      ) : (
        <div className="w-9 shrink-0" />
      )}

      <div
        className={`flex flex-col gap-1 max-w-full ${
          isIncoming ? "items-start" : "items-end"
        }`}
      >
        <div
          className={`${baseBubble} ${
            isIncoming
              ? "bg-white text-slate-900"
              : "bg-[#1C8376] text-white shadow-sm"
          }`}
        >
          {shouldShowAuthor && author && (
            <div
              className={`text-xs font-semibold ${
                isIncoming ? "text-slate-500 mb-1" : "text-white/70 mb-1"
              }`}
            >
              {author}
            </div>
          )}
          <div>{message}</div>
          <div
            className={`mt-1 text-[12px] ${
              isIncoming ? "text-slate-400" : "text-white/80 text-right"
            }`}
          >
            {timestamp}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatBubble;

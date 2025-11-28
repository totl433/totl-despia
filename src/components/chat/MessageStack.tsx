import MessageBubble from "./MessageBubble";

type Message = {
  id: string;
  text: string;
  time: string;
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
    <div className={`flex gap-3 ${alignment}`}>
      {!isOwnMessage ? (
        <div className="flex flex-col items-center w-8">
          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[13px] font-semibold text-slate-500">
            {(avatarInitials || author.charAt(0)).toUpperCase()}
          </div>
          <div className="flex-1 w-px bg-slate-200 mt-1" />
        </div>
      ) : (
        <div className="w-8" />
      )}

      <div className={`flex flex-col gap-2 ${isOwnMessage ? "items-end" : "items-start"}`}>
        {!isOwnMessage && (
          <div className="text-sm font-semibold text-slate-600 -mb-1">{author}</div>
        )}
        {messages.map((message, index) => {
          const shape =
            messages.length === 1
              ? "single"
              : index === 0
              ? "top"
              : index === messages.length - 1
              ? "bottom"
              : "middle";

          return (
            <MessageBubble
              key={message.id}
              text={message.text}
              time={message.time}
              isOwnMessage={isOwnMessage}
              shape={shape}
            />
          );
        })}
      </div>
    </div>
  );
}

export default MessageStack;

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
  const alignment = isOwnMessage
    ? "justify-end items-end"
    : "justify-start items-start";

  return (
    <div className={`flex gap-2 ${alignment}`}>
      {!isOwnMessage ? (
        <div className="w-9">
          <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[13px] font-semibold text-slate-500">
            {(avatarInitials || author.charAt(0)).toUpperCase()}
          </div>
        </div>
      ) : (
        <div className="w-9" />
      )}

      <div className={`flex flex-col gap-2 ${isOwnMessage ? "items-end" : "items-start"}`}>
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            author={index === 0 ? author : ""}
            text={message.text}
            time={message.time}
            isOwnMessage={isOwnMessage}
          />
        ))}
      </div>
    </div>
  );
}

export default MessageStack;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useMiniLeagueChat } from "../hooks/useMiniLeagueChat";

type MemberNames = Map<string, string> | Record<string, string> | undefined;

type MiniLeagueChatBetaProps = {
  miniLeagueId?: string | null;
  memberNames?: MemberNames;
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const initials = (text?: string) => {
  if (!text) return "?";
  const parts = text.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return `${parts[0][0]?.toUpperCase() ?? ""}${parts[parts.length - 1][0]?.toUpperCase() ?? ""}`;
};

const resolveName = (id: string, memberNames?: MemberNames) => {
  if (!memberNames) return "";
  if (memberNames instanceof Map) return memberNames.get(id) ?? "";
  return memberNames[id] ?? "";
};


const getBubbleRadius = (isSelf: boolean, msg: { isSingle: boolean; isTop: boolean; isMiddle: boolean; isBottom: boolean }) => {
  if (msg.isSingle) return '12px';
  if (msg.isTop) return isSelf ? '12px 12px 4px 12px' : '12px 12px 12px 4px';
  if (msg.isMiddle) return isSelf ? '12px 4px 4px 12px' : '4px 12px 12px 4px';
  if (msg.isBottom) return isSelf ? '12px 4px 12px 12px' : '4px 12px 12px 12px';
  return '12px';
};

function MiniLeagueChatBeta({ miniLeagueId, memberNames }: MiniLeagueChatBetaProps) {
  const { user } = useAuth();
  const {
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    sendMessage,
  } = useMiniLeagueChat(miniLeagueId, {
    userId: user?.id,
    enabled: Boolean(miniLeagueId),
  });

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const enrichedMessages = useMemo(() => {
    return messages.map((msg, index) => {
      const prev = messages[index - 1];
      const next = messages[index + 1];
      const sameAsPrev = prev?.user_id === msg.user_id;
      const sameAsNext = next?.user_id === msg.user_id;
      const startsRun = !sameAsPrev;
      const endsRun = !sameAsNext;
      const isSingle = !sameAsPrev && !sameAsNext;
      const isTop = startsRun && sameAsNext;
      const isMiddle = sameAsPrev && sameAsNext;
      const isBottom = sameAsPrev && endsRun;
      return {
        ...msg,
        isSelf: msg.user_id === user?.id,
        startsRun,
        endsRun,
        isSingle,
        isTop,
        isMiddle,
        isBottom,
      };
    });
  }, [messages, user?.id]);

  const notifyRecipients = useCallback(
    async (text: string) => {
      if (!miniLeagueId || !user?.id) return;

      const isLocal =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      if (isLocal) return;

      const senderName =
        (user.user_metadata?.display_name as string | undefined) ||
        (user.user_metadata?.full_name as string | undefined) ||
        user.email ||
        "User";

      try {
        await fetch("/.netlify/functions/notifyLeagueMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leagueId: miniLeagueId,
            senderId: user.id,
            senderName,
            content: text,
          }),
        });
      } catch (err) {
        console.error("[MiniLeagueChatBeta] notifyLeagueMessage failed:", err);
      }
    },
    [miniLeagueId, user?.id]
  );

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!miniLeagueId || !text || sending) return;
    try {
      setSending(true);
      await sendMessage(text);
      await notifyRecipients(text);
      setDraft("");
    } catch (err) {
      console.error("[MiniLeagueChatBeta] Failed to send message", err);
    } finally {
      setSending(false);
    }
  }, [draft, miniLeagueId, notifyRecipients, sendMessage, sending]);


  return (
    <div className="h-full flex flex-col bg-[#f5f6fb]">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-5"
      >
        {hasMore && miniLeagueId && (
          <button
            className="mx-auto mb-2 text-xs font-semibold text-[#1C8376] bg-white px-3 py-1 rounded-full shadow disabled:opacity-40"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading earlier…" : "Load earlier messages"}
          </button>
        )}

        {enrichedMessages.length === 0 && !loading ? (
          <div className="text-center text-sm text-slate-500 mt-8">
            Say hi to kick off this chat!
          </div>
        ) : (
          enrichedMessages.map((msg) => {
            const displayName = resolveName(msg.user_id, memberNames) || "Unknown";
            const showAvatar = !msg.isSelf && (msg.isSingle || msg.isBottom);
            const rowClasses = msg.isSelf ? "flex justify-end" : "flex items-end gap-2";
            const bubbleWrapperClasses = [
              "flex flex-col",
              msg.isSelf ? "items-end ml-auto" : "items-start",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={msg.id}
                className={rowClasses}
                style={{ marginTop: msg.startsRun ? 24 : 4 }}
              >
                {!msg.isSelf && (
                  <div className="flex-shrink-0 w-8 h-8 flex justify-center self-end">
                    {showAvatar ? (
                      <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-500">
                        {initials(displayName)}
                      </div>
                    ) : (
                      <div className="w-8 h-8" />
                    )}
                  </div>
                )}
                <div className={bubbleWrapperClasses} style={{ maxWidth: "72%" }}>
                  <div
                    className={`w-full px-3 py-2 text-sm leading-snug ${
                      msg.isSelf ? "bg-[#1C8376] text-white" : "bg-white text-slate-800"
                    }`}
                    style={{ borderRadius: getBubbleRadius(msg.isSelf, msg) }}
                  >
                    <div className={`flex flex-col gap-1 ${msg.isSelf ? "items-end text-right" : "items-start text-left"}`}>
                      {msg.startsRun && !msg.isSelf && (
                        <div className={`text-[11px] font-semibold ${msg.isSelf ? "text-white/80" : "text-slate-600"}`}>
                          {displayName}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      <div className="text-[11px] text-[#DCDCDD]">
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                  {(msg.status === "sending" || msg.status === "error") && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1">
                      {msg.status === "sending" && <span>Sending…</span>}
                      {msg.status === "error" && <span className="text-red-500">Failed</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-3">
        <div className="flex items-end gap-3 bg-slate-100 rounded-2xl px-3 py-2">
          <textarea
            className="flex-1 bg-transparent resize-none focus:outline-none text-sm text-slate-800 placeholder:text-slate-400 h-10"
            rows={1}
            value={draft}
            disabled={!miniLeagueId || sending}
            placeholder={
              miniLeagueId ? "Start typing a message…" : "Join this league to chat"
            }
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={!miniLeagueId || sending || !draft.trim()}
            className="w-10 h-10 rounded-full bg-[#1C8376] text-white flex items-center justify-center disabled:opacity-40"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {error && (
          <div className="text-xs text-red-500 mt-2 text-center">
            {error} — try again or switch to the classic chat tab.
          </div>
        )}
      </div>
    </div>
  );
}

export default MiniLeagueChatBeta;

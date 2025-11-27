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
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollRef.current || !autoScroll) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, autoScroll]);

  const enrichedMessages = useMemo(
    () =>
      messages.map((msg) => ({
        ...msg,
        isSelf: msg.user_id === user?.id,
      })),
    [messages, user?.id]
  );

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!miniLeagueId || !text || sending) return;
    try {
      setSending(true);
      await sendMessage(text);
      setDraft("");
      setAutoScroll(true);
    } catch (err) {
      console.error("[MiniLeagueChatBeta] Failed to send message", err);
    } finally {
      setSending(false);
    }
  }, [draft, miniLeagueId, sendMessage, sending]);

  return (
    <div className="h-full flex flex-col bg-[#f5f6fb]">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-5 space-y-3"
        onScroll={(event) => {
          const el = event.currentTarget;
          const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          setAutoScroll(nearBottom);
        }}
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
          enrichedMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${msg.isSelf ? "justify-end" : "justify-start"}`}
            >
              {!msg.isSelf && (
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-500">
                  {initials(resolveName(msg.user_id, memberNames) || msg.user_id)}
                </div>
              )}
              <div className={`flex flex-col ${msg.isSelf ? "items-end" : "items-start"} gap-1`}>
                <div
                  className={`relative max-w-[75vw] rounded-3xl px-4 pb-4 pt-2 text-sm leading-snug shadow ${
                    msg.isSelf
                      ? "bg-[#1C8376] text-white rounded-br-md"
                      : "bg-white text-slate-800 rounded-bl-md"
                  } ${msg.status === "error" ? "border border-red-400" : ""}`}
                >
                  <span className="block mb-1">{msg.content}</span>
                  <span
                    className={`absolute bottom-1 ${msg.isSelf ? "right-4 text-white/80" : "left-4 text-slate-400"}`}
                    style={{ fontSize: "0.65rem" }}
                  >
                    {formatTime(msg.created_at)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  {msg.status === "sending" && <span>Sending…</span>}
                  {msg.status === "error" && <span className="text-red-500">Failed</span>}
                </div>
              </div>
            </div>
          ))
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
            onFocus={() => setAutoScroll(true)}
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

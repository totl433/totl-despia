import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useMiniLeagueChat } from "../hooks/useMiniLeagueChat";
import ChatThread, { type ChatThreadProps } from "./chat/ChatThread";

type MemberNames = Map<string, string> | Record<string, string> | undefined;

type MiniLeagueChatBetaProps = {
  miniLeagueId?: string | null;
  memberNames?: MemberNames;
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatDayLabel = (value: string) =>
  new Date(value).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

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
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputAreaRef = useRef<HTMLDivElement | null>(null);
  const [inputBottom, setInputBottom] = useState(0);

  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, []);

  const scrollToBottomWithRetries = useCallback(
    (delays: number[] = [0, 100, 300, 500, 700]) => {
      requestAnimationFrame(() => {
        delays.forEach((delay) => {
          setTimeout(() => scrollToBottom(), delay);
        });
      });
    },
    [scrollToBottom]
  );

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottomWithRetries([0, 150, 300]);
    }
  }, [messages.length, scrollToBottomWithRetries]);

  useEffect(() => {
    if (!draft && inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = "42px";
    }
  }, [draft]);

  const applyKeyboardLayout = useCallback(
    (keyboardHeight: number, scrollDelays: number[] = [0, 100, 300, 500, 700]) => {
      if (keyboardHeight > 0) {
        setInputBottom(keyboardHeight);
        if (listRef.current) {
          const padding = Math.max(
            keyboardHeight + (inputRef.current?.offsetHeight || 0) + 16,
            80
          );
          listRef.current.style.paddingBottom = `${padding}px`;
        }
      } else {
        setInputBottom(0);
        if (listRef.current) {
          listRef.current.style.paddingBottom = "";
        }
      }

      scrollToBottomWithRetries(scrollDelays);
    },
    [scrollToBottomWithRetries]
  );

  useEffect(() => {
    const visualViewport = (window as any).visualViewport;
    if (!visualViewport) return;

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastKeyboardHeight = 0;

    const updateLayout = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
        resizeTimeout = null;
      }

      resizeTimeout = setTimeout(() => {
        const windowHeight = window.innerHeight;
        const viewportHeight = visualViewport.height;
        const viewportBottom = visualViewport.offsetTop + viewportHeight;
        const keyboardHeight = windowHeight - viewportBottom;

        if (Math.abs(keyboardHeight - lastKeyboardHeight) < 10 && keyboardHeight > 0) {
          return;
        }
        lastKeyboardHeight = keyboardHeight;

        applyKeyboardLayout(keyboardHeight);
      }, 50);
    };

    visualViewport.addEventListener("resize", updateLayout);
    visualViewport.addEventListener("scroll", updateLayout);

    const handleFocus = () => {
      setTimeout(updateLayout, 100);
      setTimeout(updateLayout, 300);
    };

    const focusTimeout = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.addEventListener("focus", handleFocus);
      }
    }, 100);

    updateLayout();

    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      clearTimeout(focusTimeout);
      visualViewport.removeEventListener("resize", updateLayout);
      visualViewport.removeEventListener("scroll", updateLayout);
      if (inputRef.current) {
        inputRef.current.removeEventListener("focus", handleFocus);
      }
    };
  }, [applyKeyboardLayout]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const baseHeight = window.innerHeight;
    const handleResize = () => {
      const diff = baseHeight - window.innerHeight;
      applyKeyboardLayout(diff > 0 ? diff : 0);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [applyKeyboardLayout]);

  useEffect(() => {
    if (!listRef.current || !inputAreaRef.current) return;
    const composerHeight = inputAreaRef.current.offsetHeight ?? 72;
    listRef.current.style.paddingBottom = `${composerHeight + 24}px`;
  }, []);

  const handleInputFocus = () => {
    const visualViewport = (window as any).visualViewport;
    if (visualViewport) {
      setTimeout(() => {
        const windowHeight = window.innerHeight;
        const viewportHeight = visualViewport.height;
        const viewportBottom = visualViewport.offsetTop + viewportHeight;
        const keyboardHeight = windowHeight - viewportBottom;

        applyKeyboardLayout(keyboardHeight, [0, 200, 400, 600, 800]);
      }, 100);
    }

    scrollToBottomWithRetries([200, 400, 600]);
  };

  const handleMessagesClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const isInteractive =
      target.tagName === "A" || target.tagName === "BUTTON" || target.closest("a, button");

    if (!isInteractive && inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.blur();
    }
  };

  const currentUserDisplayName = useMemo(() => {
    if (!user) return "";
    const metadata = user.user_metadata ?? {};
    return (
      (metadata.display_name as string | undefined) ||
      (metadata.full_name as string | undefined) ||
      user.email ||
      ""
    );
  }, [user]);

  const chatGroups = useMemo<ChatThreadProps["groups"]>(() => {
    if (!messages.length) return [];
    const groups: ChatThreadProps["groups"] = [];
    let lastDayKey: string | null = null;

    messages.forEach((msg) => {
      const isOwnMessage = msg.user_id === user?.id;
      const resolvedName = resolveName(msg.user_id, memberNames);
      const authorName = resolvedName || (isOwnMessage ? currentUserDisplayName : "");
      const fallbackName = authorName || (isOwnMessage ? "You" : "Unknown");
      const avatarInitials = !isOwnMessage ? initials(fallbackName) : undefined;

      const createdDate = new Date(msg.created_at);
      const dayKey = createdDate.toDateString();
      const shouldLabelDay = dayKey !== lastDayKey;
      if (shouldLabelDay) {
        lastDayKey = dayKey;
      }

      const messagePayload = {
        id: msg.id,
        text: msg.content,
        time: formatTime(msg.created_at),
        status: msg.status && msg.status !== "sent" ? msg.status : undefined,
      };

      const lastGroup = groups[groups.length - 1];
      const canAppendToLast =
        lastGroup &&
        !shouldLabelDay &&
        lastGroup.isOwnMessage === isOwnMessage &&
        lastGroup.author === fallbackName;

      if (canAppendToLast) {
        lastGroup.messages.push(messagePayload);
      } else {
        groups.push({
          id: msg.id,
          author: fallbackName,
          avatarInitials,
          isOwnMessage,
          dayLabel: shouldLabelDay ? formatDayLabel(msg.created_at) : undefined,
          messages: [messagePayload],
        });
      }
    });

    return groups;
  }, [currentUserDisplayName, memberNames, messages, user?.id]);

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
      scrollToBottomWithRetries([0, 150, 300]);
    } catch (err) {
      console.error("[MiniLeagueChatBeta] Failed to send message", err);
    } finally {
      setSending(false);
    }
  }, [draft, miniLeagueId, notifyRecipients, scrollToBottomWithRetries, sendMessage, sending]);


  return (
    <div className="flex flex-col h-full bg-[#f5f6fb]">
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-5"
        onClick={handleMessagesClick}
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          marginBottom: inputBottom > 0 ? "0" : "auto",
          cursor: "pointer",
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

        {chatGroups.length === 0 && !loading ? (
          <div className="text-center text-sm text-slate-500 mt-8">
            Say hi to kick off this chat!
          </div>
        ) : (
          <ChatThread groups={chatGroups} />
        )}
      </div>

      <div
        ref={inputAreaRef}
        className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-3"
        style={{
          paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))`,
          position: inputBottom > 0 ? "fixed" : "relative",
          bottom: inputBottom > 0 ? `${inputBottom}px` : "auto",
          left: inputBottom > 0 ? 0 : "auto",
          right: inputBottom > 0 ? 0 : "auto",
          width: inputBottom > 0 ? "100%" : "auto",
          zIndex: inputBottom > 0 ? 1000 : "auto",
        }}
      >
        <div className="flex items-end gap-3 bg-slate-100 rounded-2xl px-3 py-2">
          <textarea
            ref={inputRef}
            className="flex-1 bg-transparent resize-none focus:outline-none text-sm text-slate-800 placeholder:text-slate-400"
            rows={1}
            value={draft}
            disabled={!miniLeagueId || sending}
            placeholder={
              miniLeagueId ? "Start typing a message…" : "Join this league to chat"
            }
            onChange={(event) => {
              setDraft(event.target.value);
              if (inputRef.current) {
                inputRef.current.style.height = "auto";
                inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
              }
            }}
            onFocus={handleInputFocus}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            style={{
              minHeight: "42px",
              maxHeight: "120px",
              lineHeight: "1.5",
            }}
          />
          <button
            type="button"
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

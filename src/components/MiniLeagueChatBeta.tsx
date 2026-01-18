import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useMiniLeagueChat } from "../hooks/useMiniLeagueChat";
import { useMarkMessagesRead } from "../hooks/useMarkMessagesRead";
import { useChatPresence } from "../hooks/useChatPresence";
import { useChatGroups } from "../hooks/useChatGroups";
import { useChatReactions } from "../hooks/useChatReactions";
import { useChatAuthorNames, type MemberNames } from "../hooks/useChatAuthorNames";
import { useKeyboardBottomInset } from "../hooks/useKeyboardBottomInset";
import ChatThread from "./chat/ChatThread";

type MiniLeagueChatBetaProps = {
  miniLeagueId?: string | null;
  memberNames?: MemberNames;
  deepLinkError?: string | null;
  /** Whether the chat tab is actively visible (controls presence + notif suppression). */
  isChatActive?: boolean;
};

function MiniLeagueChatBeta({ miniLeagueId, memberNames, deepLinkError, isChatActive = true }: MiniLeagueChatBetaProps) {
  const { user } = useAuth();
  
  const {
    messages,
    error,
    sendMessage,
  } = useMiniLeagueChat(miniLeagueId, {
    userId: user?.id,
    enabled: Boolean(miniLeagueId),
  });

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; authorName?: string } | null>(null);
  const [uiErrors, setUiErrors] = useState<Array<{ id: string; message: string; timestamp: number }>>([]);
  
  const { hasAnyNames, getName } = useChatAuthorNames({
    messages,
    memberNames,
    currentUserId: user?.id ?? null,
  });
  
  const listRef = useRef<HTMLDivElement | null>(null);
  
  // Scroll to show newest messages (for new messages after initial load)
  // With normal column, newest messages are at bottom, so scroll to max
  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      const maxScrollTop = listRef.current.scrollHeight - listRef.current.clientHeight;
      listRef.current.scrollTop = maxScrollTop;
    }
  }, []);
  
  // Mark messages as read when they're visible
  // CRITICAL: This hook marks messages as read when the chat container is visible
  // and dispatches an event to refresh badge counts
  // NOTE: listRef must be declared BEFORE useMarkMessagesRead
  const { markAsRead } = useMarkMessagesRead({
    leagueId: miniLeagueId ?? null,
    userId: user?.id ?? null,
    enabled: Boolean(miniLeagueId && user?.id),
    containerRef: listRef,
  });
  
  // Immediately mark messages as read when component mounts and has messages
  // This ensures badge updates immediately when visiting the league page
  useEffect(() => {
    if (miniLeagueId && user?.id && messages.length > 0) {
      // Mark as read immediately (don't wait for IntersectionObserver)
      markAsRead();
    }
  }, [miniLeagueId, user?.id, messages.length, markAsRead]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputAreaRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledRef = useRef<boolean>(false);
  const { inputBottom, applyKeyboardLayout, handleInputFocus } = useKeyboardBottomInset({
    inputAreaRef,
    listRef,
    scrollToBottom,
  });

  useChatPresence({
    leagueId: miniLeagueId ?? null,
    userId: user?.id ?? null,
    enabled: Boolean(isChatActive && miniLeagueId && user?.id),
  });

  // Ref callback: set scroll position IMMEDIATELY when node is available
  // This happens synchronously before React finishes rendering, eliminating timing issues
  // Reset scroll when league changes
  useEffect(() => {
    hasScrolledRef.current = false;
  }, [miniLeagueId]);
  
  const messageIds = useMemo(
    () => messages.map((m) => m.id).filter((id) => !id.startsWith('optimistic-')),
    [messages]
  );

  const { reactions, onReactionClick } = useChatReactions({
    leagueId: miniLeagueId ?? null,
    messageIds,
    userId: user?.id ?? null,
    onError: (message) => {
      setUiErrors((prev) => [
        ...prev,
        { id: `reactions-${Date.now()}`, message, timestamp: Date.now() },
      ]);
    },
  });

  // Auto-resize textarea
  useEffect(() => {
    if (!draft && inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = "42px";
    }
  }, [draft]);

  const onInputFocus = useCallback(() => handleInputFocus(inputRef), [handleInputFocus]);

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

  const { groups: chatGroups, key: chatThreadKey } = useChatGroups({
    messages,
    currentUserId: user?.id ?? null,
    currentUserDisplayName,
    hasAnyNames,
    getName,
  });
  
  // Simple ref callback: just store the ref and check scrollability
  // No scroll logic needed - CSS column-reverse handles positioning
  const setListRef = useCallback((node: HTMLDivElement | null) => {
    listRef.current = node;
    
    // Set padding immediately to prevent layout shift
    // Use a default value that matches typical input area height
    if (node) {
      // Measure input area first if available, otherwise use default
      if (inputAreaRef.current) {
        const inputAreaHeight = inputAreaRef.current.offsetHeight || 72;
        const correctPadding = `${inputAreaHeight + 8}px`;
        node.style.paddingBottom = correctPadding;
        
      } else {
        // Set to 91px default (matches typical iPhone input area height)
        node.style.paddingBottom = '91px';
        
      }
      
      // Check if content is scrollable after layout
      // Use double RAF to ensure content is fully rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (node && messages.length > 0 && chatGroups.length > 0) {
            // Content scrollability check (currently unused)
          }
        });
      });
    }
  }, [messages.length, chatGroups.length]);
  
  // Reset when league changes
  useEffect(() => {
    hasScrolledRef.current = false;
  }, [miniLeagueId]);


  // Auto-scroll when new messages arrive (after initial load)
  // With normal column, newest messages are at bottom, so scroll to max
  useEffect(() => {
    if (messages.length > 0 && listRef.current) {
      // Mark as scrolled after first message load
      if (!hasScrolledRef.current) {
        hasScrolledRef.current = true;
      }
      // With normal column, newest messages are at bottom, so scroll to max
      requestAnimationFrame(() => {
        if (listRef.current) {
          const scrollHeight = listRef.current.scrollHeight;
          const clientHeight = listRef.current.clientHeight;
          const maxScrollTop = scrollHeight - clientHeight;
          const isScrollable = scrollHeight > clientHeight;
          
          
          // Only scroll if content is scrollable (long threads)
          // Short threads will naturally be at top with flex-start
          if (isScrollable) {
            listRef.current.scrollTop = maxScrollTop;
          }
        }
      });
    }
  }, [messages.length, messages]);

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
        // Best-effort notifications: never block the chat UI on this.
        // Some devices/networks can hang the request; we hard-timeout it.
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 3000);
        try {
          await fetch("/.netlify/functions/notifyLeagueMessageV2", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              leagueId: miniLeagueId,
              senderId: user.id,
              senderName,
              content: text,
              activeUserIds: [user.id],
            }),
          });
        } finally {
          clearTimeout(timeout);
        }
      } catch (err) {
        // Silently fail - notifications are best effort
      }
    },
    [miniLeagueId, user?.id]
  );

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!miniLeagueId || !text || sending) return;
    try {
      setSending(true);
      setDraft("");
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = "42px";
      }
      await sendMessage(text, replyingTo?.id || null);
      // Don't block UI on notifications; they can be slow/hang on some networks.
      notifyRecipients(text).catch(() => {});
      setReplyingTo(null);
      scrollToBottom();
    } catch (err: any) {
      setUiErrors(prev => [...prev, { 
        id: `send-${Date.now()}`, 
        message: `Failed to send message: ${err?.message || String(err)}`, 
        timestamp: Date.now() 
      }]);
      setDraft(text);
    } finally {
      setSending(false);
    }
  }, [draft, miniLeagueId, notifyRecipients, scrollToBottom, sendMessage, sending, replyingTo]);

  // Add deep link error if present
  useEffect(() => {
    if (deepLinkError) {
      setUiErrors(prev => {
        if (prev.some(e => e.message.includes('Deep Link'))) return prev;
        return [...prev, { 
          id: `deeplink-${Date.now()}`, 
          message: `Deep Link Error: ${deepLinkError}`, 
          timestamp: Date.now() 
        }];
      });
    }
  }, [deepLinkError]);

  // Auto-dismiss errors after 5 seconds
  useEffect(() => {
    if (uiErrors.length === 0) return;
    const timer = setTimeout(() => {
      setUiErrors(prev => prev.filter(e => Date.now() - e.timestamp < 5000));
    }, 5000);
    return () => clearTimeout(timer);
  }, [uiErrors]);

  const hasContent = messages.length > 0 && chatGroups.length > 0;

  return (
      <div className="flex flex-col h-full w-full" style={{ position: 'relative', zIndex: 1, overflowX: 'hidden' }}>
      {/* Error display */}
      {uiErrors.length > 0 && (
        <div className="px-4 pt-2 space-y-2">
          {uiErrors.map(err => (
            <div
              key={err.id}
              className="bg-red-50 border border-red-200 text-red-800 text-xs px-3 py-2 rounded-lg flex items-start justify-between gap-2"
            >
              <span className="flex-1">{err.message}</span>
              <button
                onClick={() => setUiErrors(prev => prev.filter(e => e.id !== err.id))}
                className="text-red-600 flex-shrink-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div
        ref={setListRef}
        className="flex-1 overflow-y-auto px-4 py-5"
        onClick={handleMessagesClick}
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          backgroundColor: 'transparent',
          cursor: "pointer",
          overflowX: 'hidden',
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column', // Normal column - newest at bottom
          // Allow children (ChatThread -> MessageStack) to use full available width so
          // "own" messages can justify-end all the way to the right edge on desktop.
          alignItems: 'stretch',
          justifyContent: 'flex-start', // Always flex-start - short threads at top, long threads scrollable
          paddingBottom: '91px', // Default padding to match typical input area height (83px + 8px), refined in ref callback
        }}
      >
        {hasContent ? (
          <>
          <ChatThread 
            key={chatThreadKey}
            groups={chatGroups}
            reactions={reactions}
            onReactionClick={onReactionClick}
            onMessageClick={(messageId, content, authorName) => {
              const message = messages.find(m => m.id === messageId);
              if (message) {
                let messageContent = '';
                if (typeof content === 'string') {
                  messageContent = content;
                } else if (typeof content === 'object' && content !== null) {
                  const textContent = (content as any)?.props?.children || String(content);
                  messageContent = typeof textContent === 'string' ? textContent : String(textContent);
                } else {
                  messageContent = String(content);
                }
                
                setReplyingTo({
                  id: messageId,
                  content: messageContent || message.content,
                  authorName: authorName,
                });
                setTimeout(() => {
                  inputRef.current?.focus();
                }, 100);
              }
            }}
          />
          </>
        ) : null}
      </div>

      <div
        ref={inputAreaRef}
        className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3"
        style={{
          paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))`,
          position: inputBottom > 0 ? "fixed" : "relative",
          bottom: inputBottom > 0 ? `${inputBottom}px` : "0",
          left: inputBottom > 0 ? 0 : "auto",
          right: inputBottom > 0 ? 0 : "auto",
          width: "100%",
          maxWidth: inputBottom > 0 ? "440px" : "100%",
          marginLeft: inputBottom > 0 ? "auto" : undefined,
          marginRight: inputBottom > 0 ? "auto" : undefined,
          zIndex: inputBottom > 0 ? 100 : "auto",
          boxShadow: inputBottom > 0 ? "0 -2px 8px rgba(0, 0, 0, 0.1)" : "none",
          overflowX: "hidden",
          pointerEvents: "auto",
        }}
      >
        {/* Reply preview */}
        {replyingTo && (
          <div className="mb-2 px-3 py-2 bg-slate-50 border-l-2 border-[#1C8376] rounded-lg flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#1C8376] mb-0.5">
                Replying to {replyingTo.authorName || "Unknown"}
              </div>
              <div className="text-xs text-slate-600 line-clamp-2 truncate">
                {replyingTo.content}
              </div>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-slate-500"
              title="Cancel reply"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex items-end gap-3 bg-slate-100 dark:bg-slate-700 rounded-2xl px-3 py-2 relative">
          <textarea
            ref={inputRef}
            className="flex-1 bg-transparent resize-none focus:outline-none text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            rows={1}
            value={draft}
            disabled={!miniLeagueId || sending}
            placeholder={
              miniLeagueId ? "Start typing a message…" : "Join this league to chat"
            }
            autoComplete="off"
            autoCorrect="on"
            autoCapitalize="sentences"
            spellCheck={true}
            inputMode="text"
            {...({ enterKeyHint: "send" } as any)}
            data-1p-ignore="true"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && replyingTo) {
                setReplyingTo(null);
                e.preventDefault();
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            onChange={(event) => {
              setDraft(event.target.value);
              if (inputRef.current) {
                inputRef.current.style.height = "auto";
                inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
              }
              requestAnimationFrame(() => {
                const visualViewport = (window as any).visualViewport;
                if (visualViewport) {
                  const windowHeight = window.innerHeight;
                  const viewportHeight = visualViewport.height;
                  const viewportBottom = visualViewport.offsetTop + viewportHeight;
                  const keyboardHeight = windowHeight - viewportBottom;
                  applyKeyboardLayout(keyboardHeight);
                }
              });
            }}
            onFocus={onInputFocus}
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

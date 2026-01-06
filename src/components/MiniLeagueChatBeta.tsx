import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useMiniLeagueChat } from "../hooks/useMiniLeagueChat";
import ChatThread, { type ChatThreadProps } from "./chat/ChatThread";
import { supabase } from "../lib/supabase";

type MemberNames = Map<string, string> | Record<string, string> | undefined;

type MiniLeagueChatBetaProps = {
  miniLeagueId?: string | null;
  memberNames?: MemberNames;
  deepLinkError?: string | null;
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
  if (memberNames instanceof Map) {
    return memberNames.get(id) ?? "";
  }
  return memberNames[id] ?? "";
};

function MiniLeagueChatBeta({ miniLeagueId, memberNames, deepLinkError }: MiniLeagueChatBetaProps) {
  const { user } = useAuth();
  
  const {
    messages,
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
  const [reactions, setReactions] = useState<Record<string, Array<{ emoji: string; count: number; hasUserReacted: boolean }>>>({});
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; authorName?: string } | null>(null);
  const [uiErrors, setUiErrors] = useState<Array<{ id: string; message: string; timestamp: number }>>([]);
  
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputAreaRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledRef = useRef<boolean>(false);
  const [inputBottom, setInputBottom] = useState(0);
  
  // Track presence: mark user as active in chat to suppress notifications
  useEffect(() => {
    if (!miniLeagueId || !user?.id) return;
    
    const updatePresence = async () => {
      try {
        await supabase
          .from('chat_presence')
          .upsert({
            league_id: miniLeagueId,
            user_id: user.id,
            last_seen: new Date().toISOString(),
          }, {
            onConflict: 'league_id,user_id'
          });
      } catch (err) {
        // Silently fail - presence is best effort
      }
    };
    
    updatePresence();
    const interval = setInterval(updatePresence, 10000);
    return () => clearInterval(interval);
  }, [miniLeagueId, user?.id]);

  // Ref callback: set scroll position IMMEDIATELY when node is available
  // This happens synchronously before React finishes rendering, eliminating timing issues
  // Reset scroll when league changes
  useEffect(() => {
    hasScrolledRef.current = false;
  }, [miniLeagueId]);
  
  // Scroll to show newest messages (for new messages after initial load)
  // With normal column, newest messages are at bottom, so scroll to max
  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      const maxScrollTop = listRef.current.scrollHeight - listRef.current.clientHeight;
      listRef.current.scrollTop = maxScrollTop;
    }
  }, []);

  // Load reactions for all messages
  useEffect(() => {
    if (messages.length === 0 || !user?.id) return;
    
    const messageIds = messages
      .map(m => m.id)
      .filter(id => !id.startsWith('optimistic-'));
    if (messageIds.length === 0) return;
    
    const loadReactions = async () => {
      try {
        const { data, error } = await supabase
          .from('league_message_reactions')
          .select('message_id, emoji, user_id')
          .in('message_id', messageIds);
        
        if (error) {
          setUiErrors(prev => [...prev, { 
            id: `reactions-${Date.now()}`, 
            message: `Failed to load reactions: ${error.message}`, 
            timestamp: Date.now() 
          }]);
          return;
        }
        
        // Group reactions by message_id and emoji
        const reactionsByMessage: Record<string, Record<string, { count: number; hasUserReacted: boolean }>> = {};
        
        (data || []).forEach((reaction: any) => {
          if (!reactionsByMessage[reaction.message_id]) {
            reactionsByMessage[reaction.message_id] = {};
          }
          if (!reactionsByMessage[reaction.message_id][reaction.emoji]) {
            reactionsByMessage[reaction.message_id][reaction.emoji] = { count: 0, hasUserReacted: false };
          }
          reactionsByMessage[reaction.message_id][reaction.emoji].count++;
          if (reaction.user_id === user.id) {
            reactionsByMessage[reaction.message_id][reaction.emoji].hasUserReacted = true;
          }
        });
        
        // Convert to array format
        const formattedReactions: Record<string, Array<{ emoji: string; count: number; hasUserReacted: boolean }>> = {};
        Object.keys(reactionsByMessage).forEach(messageId => {
          formattedReactions[messageId] = Object.entries(reactionsByMessage[messageId]).map(([emoji, data]) => ({
            emoji,
            count: data.count,
            hasUserReacted: data.hasUserReacted,
          }));
        });
        
        setReactions(formattedReactions);
      } catch (err: any) {
        setUiErrors(prev => [...prev, { 
          id: `reactions-load-${Date.now()}`, 
          message: `Error loading reactions: ${err?.message || String(err)}`, 
          timestamp: Date.now() 
        }]);
      }
    };
    
    loadReactions();
  }, [messages, user?.id]);

  // Subscribe to reaction changes
  useEffect(() => {
    if (messages.length === 0 || !user?.id) return;
    
    const messageIds = messages
      .map(m => m.id)
      .filter(id => !id.startsWith('optimistic-'));
    if (messageIds.length === 0) return;
    
    const channel = supabase
      .channel('message-reactions-mlcb')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'league_message_reactions',
        },
        async () => {
          // Reload reactions when they change
            try {
              const { data, error } = await supabase
                .from('league_message_reactions')
                .select('message_id, emoji, user_id')
                .in('message_id', messageIds);
              
            if (error) return;
              
              const reactionsByMessage: Record<string, Record<string, { count: number; hasUserReacted: boolean }>> = {};
              
              (data || []).forEach((reaction: any) => {
                if (!reactionsByMessage[reaction.message_id]) {
                  reactionsByMessage[reaction.message_id] = {};
                }
                if (!reactionsByMessage[reaction.message_id][reaction.emoji]) {
                  reactionsByMessage[reaction.message_id][reaction.emoji] = { count: 0, hasUserReacted: false };
                }
                reactionsByMessage[reaction.message_id][reaction.emoji].count++;
                if (reaction.user_id === user.id) {
                  reactionsByMessage[reaction.message_id][reaction.emoji].hasUserReacted = true;
                }
              });
              
              const formattedReactions: Record<string, Array<{ emoji: string; count: number; hasUserReacted: boolean }>> = {};
              Object.keys(reactionsByMessage).forEach(messageId => {
                formattedReactions[messageId] = Object.entries(reactionsByMessage[messageId]).map(([emoji, data]) => ({
                  emoji,
                  count: data.count,
                  hasUserReacted: data.hasUserReacted,
                }));
              });
              
              setReactions(formattedReactions);
          } catch (err) {
            // Silently fail
            }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [messages, user?.id]);

  // Handle reaction click
  const handleReactionClick = useCallback(async (messageId: string, emoji: string) => {
    if (!user?.id) return;
    
    const messageReactions = reactions[messageId] || [];
    const existingReaction = messageReactions.find(r => r.emoji === emoji && r.hasUserReacted);
    
    // Optimistically update local state
    setReactions((prev) => {
      const newReactions = { ...prev };
      const currentReactions = newReactions[messageId] || [];
      
      if (existingReaction) {
        // Remove reaction
        const updatedReactions = currentReactions.map(r => {
          if (r.emoji === emoji) {
            return {
              ...r,
              count: Math.max(0, r.count - 1),
              hasUserReacted: false,
            };
          }
          return r;
        }).filter(r => r.count > 0 || r.emoji !== emoji);
        
        if (updatedReactions.length === 0) {
          delete newReactions[messageId];
        } else {
          newReactions[messageId] = updatedReactions;
        }
      } else {
        // Add reaction
        const existingEmojiReaction = currentReactions.find(r => r.emoji === emoji);
        if (existingEmojiReaction) {
          newReactions[messageId] = currentReactions.map(r => 
            r.emoji === emoji 
              ? { ...r, count: r.count + 1, hasUserReacted: true }
              : r
          );
        } else {
          newReactions[messageId] = [...currentReactions, { emoji, count: 1, hasUserReacted: true }];
        }
      }
      
      return newReactions;
    });
    
    // Update database
    if (existingReaction) {
      const { error } = await supabase
        .from('league_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);
      
      if (error) {
        // Revert optimistic update
        setReactions((prev) => {
          const reverted = { ...prev };
          const currentReactions = reverted[messageId] || [];
          const existingEmojiReaction = currentReactions.find(r => r.emoji === emoji);
          if (existingEmojiReaction) {
            reverted[messageId] = currentReactions.map(r => 
              r.emoji === emoji 
                ? { ...r, count: r.count + 1, hasUserReacted: true }
                : r
            );
          } else {
            reverted[messageId] = [...currentReactions, { emoji, count: 1, hasUserReacted: true }];
          }
          return reverted;
        });
      }
    } else {
      const { error } = await supabase
        .from('league_message_reactions')
        .upsert({
          message_id: messageId,
          user_id: user.id,
          emoji,
        });
      
      if (error) {
        // Revert optimistic update
        setReactions((prev) => {
          const reverted = { ...prev };
          const currentReactions = reverted[messageId] || [];
          const updatedReactions = currentReactions.map(r => {
            if (r.emoji === emoji) {
              return {
                ...r,
                count: Math.max(0, r.count - 1),
                hasUserReacted: false,
              };
            }
            return r;
          }).filter(r => r.count > 0 || r.emoji !== emoji);
          
          if (updatedReactions.length === 0) {
            delete reverted[messageId];
          } else {
            reverted[messageId] = updatedReactions;
          }
          return reverted;
        });
      }
    }
  }, [user?.id, reactions]);

  // Auto-resize textarea
  useEffect(() => {
    if (!draft && inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = "42px";
    }
  }, [draft]);

  // Keyboard detection and layout adjustment
  const applyKeyboardLayout = useCallback(
    (keyboardHeight: number) => {
      const inputAreaHeight = inputAreaRef.current?.offsetHeight || 72;
      
      if (keyboardHeight > 0) {
        const totalBottomSpace = keyboardHeight + inputAreaHeight;
        setInputBottom(keyboardHeight);
        if (listRef.current) {
          const newPadding = `${totalBottomSpace + 8}px`;
          const oldPadding = listRef.current.style.paddingBottom;
          listRef.current.style.paddingBottom = newPadding;
        }
      } else {
        setInputBottom(0);
        if (listRef.current) {
          const newPadding = `${inputAreaHeight + 8}px`;
          const oldPadding = listRef.current.style.paddingBottom;
          listRef.current.style.paddingBottom = newPadding;
        }
      }

      // Scroll to bottom after keyboard adjustment
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    },
    [scrollToBottom]
  );

  // Keyboard detection
  useEffect(() => {
    const visualViewport = (window as any).visualViewport;
    if (!visualViewport) return;

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastKeyboardHeight = 0;
    let initialLoadComplete = false;
    
    // Wait a bit before allowing keyboard detection to prevent initial jump
    setTimeout(() => {
      initialLoadComplete = true;
    }, 500);

    const detectKeyboardHeight = (): number => {
        const windowHeight = window.innerHeight;
        const viewportHeight = visualViewport.height;
        const viewportBottom = visualViewport.offsetTop + viewportHeight;
      return Math.max(0, windowHeight - viewportBottom);
    };

    const updateLayout = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

      resizeTimeout = setTimeout(() => {
        const keyboardHeight = detectKeyboardHeight();
        
        // Only apply keyboard layout changes after initial load is complete
        if (initialLoadComplete && Math.abs(keyboardHeight - lastKeyboardHeight) > 10) {
          lastKeyboardHeight = keyboardHeight;
          applyKeyboardLayout(keyboardHeight);
        }
      }, 50);
    };

    visualViewport.addEventListener("resize", updateLayout);
    visualViewport.addEventListener("scroll", updateLayout);
    window.addEventListener("resize", updateLayout);

    const handleFocus = () => {
      setTimeout(updateLayout, 50);
    };
    
    const handleBlur = () => {
      setTimeout(updateLayout, 100);
    };

    const focusTimeout = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.addEventListener("focus", handleFocus);
        inputRef.current.addEventListener("blur", handleBlur);
      }
    }, 100);

    
    updateLayout();

    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      clearTimeout(focusTimeout);
      visualViewport.removeEventListener("resize", updateLayout);
      visualViewport.removeEventListener("scroll", updateLayout);
      window.removeEventListener("resize", updateLayout);
      if (inputRef.current) {
        inputRef.current.removeEventListener("focus", handleFocus);
        inputRef.current.removeEventListener("blur", handleBlur);
      }
    };
  }, [applyKeyboardLayout]);

  // Set initial padding synchronously to prevent layout shift
  // This runs on mount to ensure padding is set before first paint
  useEffect(() => {
    if (listRef.current && inputAreaRef.current) {
      const currentPadding = listRef.current.style.paddingBottom;
      const inputAreaHeight = inputAreaRef.current.offsetHeight || 72;
      const inputAreaTop = inputAreaRef.current.offsetTop;
      const inputAreaBottom = inputAreaRef.current.offsetTop + inputAreaRef.current.offsetHeight;
      const correctPadding = `${inputAreaHeight + 8}px`;
      
      // Set padding immediately
      listRef.current.style.paddingBottom = correctPadding;
      
      
      // Check if layout shifts after a delay
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
    if (listRef.current && inputAreaRef.current) {
            const newInputAreaTop = inputAreaRef.current.offsetTop;
            const newInputAreaBottom = inputAreaRef.current.offsetTop + inputAreaRef.current.offsetHeight;
            const newScrollHeight = listRef.current.scrollHeight;
            const newClientHeight = listRef.current.clientHeight;
            const newScrollTop = listRef.current.scrollTop;
            const inputAreaRect = inputAreaRef.current.getBoundingClientRect();
            
          }
        });
      });
    }
  }, []);

  const handleInputFocus = () => {
    if (inputRef.current) {
      inputRef.current.removeAttribute('readonly');
    }
    
    const detectAndApply = () => {
    const visualViewport = (window as any).visualViewport;
    if (visualViewport) {
        const windowHeight = window.innerHeight;
        const viewportHeight = visualViewport.height;
        const viewportBottom = visualViewport.offsetTop + viewportHeight;
        const keyboardHeight = Math.max(0, windowHeight - viewportBottom);
        applyKeyboardLayout(keyboardHeight);
      }
    };
    
    setTimeout(detectAndApply, 50);
    setTimeout(detectAndApply, 150);
    scrollToBottom();
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

  // Build chat groups from messages
  const chatGroups = useMemo<ChatThreadProps["groups"]>(() => {
    if (!messages.length) return [];
    
    // Wait for memberNames to be available
    const hasMemberNames = memberNames instanceof Map ? memberNames.size > 0 : memberNames ? Object.keys(memberNames).length > 0 : false;
    if (!hasMemberNames) {
      return [];
    }
    
    let lastDayKey: string | null = null;
    const groups = messages.reduce<ChatThreadProps["groups"]>((acc, msg) => {
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

      const replyAuthorName = msg.reply_to 
        ? (resolveName(msg.reply_to.user_id, memberNames) || "Unknown")
        : null;

      const messagePayload = {
        id: msg.id,
        text: msg.content,
        time: formatTime(msg.created_at),
        status: msg.status && msg.status !== "sent" ? msg.status : undefined,
        messageId: msg.id,
        replyTo: msg.reply_to ? {
          id: msg.reply_to.id,
          content: msg.reply_to.content,
          authorName: replyAuthorName || undefined,
        } : null,
      };

      const lastGroup = acc[acc.length - 1];
      const lastGroupUserId = lastGroup?.messages.length > 0 && lastGroup.messages[0].messageId
        ? messages.find(m => m.id === lastGroup.messages[0].messageId)?.user_id 
        : null;
      const canAppendToLast =
        lastGroup &&
        !shouldLabelDay &&
        lastGroup.isOwnMessage === isOwnMessage &&
        lastGroupUserId === msg.user_id;

      if (canAppendToLast) {
        const baseId = lastGroup.id.includes('-') ? lastGroup.id.split('-')[0] : lastGroup.id;
        const updatedMessages = lastGroup.messages.map(existingMsg => {
          const originalMsg = existingMsg.messageId ? messages.find(m => m.id === existingMsg.messageId) : null;
          if (originalMsg?.reply_to) {
            const updatedReplyAuthorName = resolveName(originalMsg.reply_to.user_id, memberNames) || "Unknown";
            return {
              ...existingMsg,
              replyTo: existingMsg.replyTo ? {
                ...existingMsg.replyTo,
                authorName: updatedReplyAuthorName || undefined,
              } : null,
            };
          }
          return existingMsg;
        });
        
        const updatedGroup = {
          ...lastGroup,
          id: `${baseId}-${fallbackName}`,
          author: fallbackName,
          avatarInitials,
          userId: msg.user_id,
          messages: [...updatedMessages, messagePayload],
        };
        return [...acc.slice(0, -1), updatedGroup];
      } else {
        return [...acc, {
          id: `${msg.id}-${fallbackName}`,
          author: fallbackName,
          avatarInitials,
          isOwnMessage,
          userId: msg.user_id,
          dayLabel: shouldLabelDay ? formatDayLabel(msg.created_at) : undefined,
          messages: [messagePayload],
        }];
      }
    }, []);

    // Update groups to ensure all names are resolved
    return groups.map((group) => {
      const baseGroup = { ...group };
      
      const updatedMessages = baseGroup.messages.map(msg => {
        const originalMsg = msg.messageId ? messages.find(m => m.id === msg.messageId) : null;
        if (originalMsg?.reply_to && msg.replyTo) {
          const updatedReplyAuthorName = resolveName(originalMsg.reply_to.user_id, memberNames) || "Unknown";
          if (updatedReplyAuthorName !== msg.replyTo.authorName) {
            return {
              ...msg,
              replyTo: {
                ...msg.replyTo,
                authorName: updatedReplyAuthorName || undefined,
              },
            };
          }
        }
        return msg;
      });
      
      if (baseGroup.author === "Unknown" && baseGroup.messages.length > 0 && baseGroup.messages[0].messageId) {
        const firstMessage = messages.find(m => m.id === baseGroup.messages[0].messageId);
        if (firstMessage) {
          const resolvedName = resolveName(firstMessage.user_id, memberNames);
          if (resolvedName && resolvedName !== "Unknown") {
            const baseId = baseGroup.id.includes('-') ? baseGroup.id.split('-')[0] : baseGroup.id;
            return {
              ...baseGroup,
              id: `${baseId}-${resolvedName}`,
              author: resolvedName,
              avatarInitials: initials(resolvedName),
              userId: firstMessage.user_id,
              messages: updatedMessages,
            };
          }
        }
      }
      
      return {
        ...baseGroup,
        messages: updatedMessages,
      };
    });
  }, [currentUserDisplayName, memberNames, messages, user?.id]);

  // Force re-render when memberNames loads
  const chatThreadKey = useMemo(() => {
    const authorNames = chatGroups.map(g => g.author).join(',');
    const hasUnknown = chatGroups.some(g => g.author === "Unknown");
    return `chat-${chatGroups.length}-${hasUnknown ? 'unknown' : 'resolved'}-${authorNames.slice(0, 50)}`;
  }, [chatGroups]);
  
  // Simple ref callback: just store the ref and check scrollability
  // No scroll logic needed - CSS column-reverse handles positioning
  const setListRef = useCallback((node: HTMLDivElement | null) => {
    listRef.current = node;
    
    // Set padding immediately to prevent layout shift
    // Use a default value that matches typical input area height
    if (node) {
      const initialPadding = node.style.paddingBottom;
      
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
        await fetch("/.netlify/functions/notifyLeagueMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leagueId: miniLeagueId,
            senderId: user.id,
            senderName,
            content: text,
            activeUserIds: [user.id],
          }),
        });
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
      await notifyRecipients(text);
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
          alignItems: 'flex-start', // Ensure content aligns to start (horizontal alignment)
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
            onReactionClick={handleReactionClick}
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
        className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-3"
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
        <div className="flex items-end gap-3 bg-slate-100 rounded-2xl px-3 py-2 relative">
          <textarea
            ref={inputRef}
            className="flex-1 bg-transparent resize-none focus:outline-none text-sm text-slate-800 placeholder:text-slate-400"
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
            onFocus={handleInputFocus}
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

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
    const name = memberNames.get(id);
    return name ?? "";
  }
  return memberNames[id] ?? "";
};


function MiniLeagueChatBeta({ miniLeagueId, memberNames, deepLinkError }: MiniLeagueChatBetaProps) {
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
  const [reactions, setReactions] = useState<Record<string, Array<{ emoji: string; count: number; hasUserReacted: boolean }>>>({});
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; authorName?: string } | null>(null);
  const [uiErrors, setUiErrors] = useState<Array<{ id: string; message: string; timestamp: number }>>([]);
  
  // Track presence: mark user as active in chat to suppress notifications
  useEffect(() => {
    if (!miniLeagueId || !user?.id) return;
    
    // Update presence every 10 seconds while user is viewing chat
    const updatePresence = async () => {
      try {
        const { error } = await supabase
          .from('chat_presence')
          .upsert({
            league_id: miniLeagueId,
            user_id: user.id,
            last_seen: new Date().toISOString(),
          }, {
            onConflict: 'league_id,user_id'
          });
        if (error) {
          console.error('[MiniLeagueChatBeta] Failed to update presence:', error);
        }
      } catch (err) {
        // Silently fail - presence is best effort
        console.error('[MiniLeagueChatBeta] Failed to update presence:', err);
      }
    };
    
    // Update immediately and then every 10 seconds
    updatePresence();
    const interval = setInterval(updatePresence, 10000);
    
    // Cleanup: remove presence when component unmounts or user leaves
    return () => {
      clearInterval(interval);
      // Note: We don't delete the presence record here because the notification function
      // will filter by last_seen timestamp (only exclude if seen in last 30 seconds)
    };
  }, [miniLeagueId, user?.id]);
  // Force re-render when memberNames loads by tracking a version
  const [memberNamesVersion, setMemberNamesVersion] = useState(0);
  const hasInitiallyScrolledRef = useRef(false);
  const initialScrollDoneRef = useRef(false);
  const initialLoadCompleteRef = useRef(false);
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

  // Load reactions for all messages
  useEffect(() => {
    if (messages.length === 0 || !user?.id) return;
    
    // Filter out optimistic message IDs (they start with "optimistic-")
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
          console.error('[MiniLeagueChatBeta] Error loading reactions:', error);
          setUiErrors(prev => [...prev, { id: `reactions-${Date.now()}`, message: `Failed to load reactions: ${error.message}`, timestamp: Date.now() }]);
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
        console.error('[MiniLeagueChatBeta] Error in loadReactions:', err);
        setUiErrors(prev => [...prev, { id: `reactions-load-${Date.now()}`, message: `Error loading reactions: ${err?.message || String(err)}`, timestamp: Date.now() }]);
      }
    };
    
    loadReactions();
  }, [messages, user?.id]);

  // Subscribe to reaction changes
  useEffect(() => {
    if (messages.length === 0 || !user?.id) return;
    
    // Filter out optimistic message IDs (they start with "optimistic-")
    const messageIds = messages
      .map(m => m.id)
      .filter(id => !id.startsWith('optimistic-'));
    if (messageIds.length === 0) return;
    
    // Subscribe to all reaction changes and reload when any change occurs
    const channel = supabase
      .channel('message-reactions-mlcb')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'league_message_reactions',
        },
        () => {
          // Reload reactions when they change
          const loadReactions = async () => {
            try {
              const { data, error } = await supabase
                .from('league_message_reactions')
                .select('message_id, emoji, user_id')
                .in('message_id', messageIds);
              
              if (error) {
                console.error('[MiniLeagueChatBeta] Error reloading reactions:', error);
                setUiErrors(prev => [...prev, { id: `reactions-reload-${Date.now()}`, message: `Failed to reload reactions: ${error.message}`, timestamp: Date.now() }]);
                return;
              }
              
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
            } catch (err: any) {
              console.error('[MiniLeagueChatBeta] Error in reaction subscription handler:', err);
              setUiErrors(prev => [...prev, { id: `reactions-sub-${Date.now()}`, message: `Error updating reactions: ${err?.message || String(err)}`, timestamp: Date.now() }]);
            }
          };
          
          loadReactions();
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
    
    // Check if user already reacted with this emoji
    const messageReactions = reactions[messageId] || [];
    const existingReaction = messageReactions.find(r => r.emoji === emoji && r.hasUserReacted);
    
    // Optimistically update local state immediately
    setReactions((prev) => {
      const newReactions = { ...prev };
      const currentReactions = newReactions[messageId] || [];
      
      if (existingReaction) {
        // Remove reaction optimistically
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
        // Add reaction optimistically
        const existingEmojiReaction = currentReactions.find(r => r.emoji === emoji);
        if (existingEmojiReaction) {
          // Emoji already exists, increment count and mark as reacted
          newReactions[messageId] = currentReactions.map(r => 
            r.emoji === emoji 
              ? { ...r, count: r.count + 1, hasUserReacted: true }
              : r
          );
        } else {
          // New emoji reaction
          newReactions[messageId] = [...currentReactions, { emoji, count: 1, hasUserReacted: true }];
        }
      }
      
      return newReactions;
    });
    
    // Then update database
    if (existingReaction) {
      // Remove reaction
      const { error } = await supabase
        .from('league_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);
      
      if (error) {
        // Revert optimistic update on error
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
      // Add reaction
      const { error } = await supabase
        .from('league_message_reactions')
        .upsert({
          message_id: messageId,
          user_id: user.id,
          emoji,
        });
      
      if (error) {
        console.error('[MiniLeagueChatBeta] Error adding reaction:', error);
        setUiErrors(prev => [...prev, { id: `reaction-add-${Date.now()}`, message: `Failed to add reaction: ${error.message}`, timestamp: Date.now() }]);
        // Revert optimistic update on error
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

  // Reset scroll ref when league changes
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueChatBeta.tsx:377',message:'League changed: resetting scroll refs',data:{miniLeagueId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    hasInitiallyScrolledRef.current = false;
    initialScrollDoneRef.current = false;
  }, [miniLeagueId]);

  useEffect(() => {
    if (!draft && inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = "42px";
    }
  }, [draft]);

  const applyKeyboardLayout = useCallback(
    (keyboardHeight: number, scrollDelays: number[] = [0, 100, 300, 500, 700]) => {
      // Always calculate input area height dynamically
      const inputAreaHeight = inputAreaRef.current?.offsetHeight || 72;
      
      if (keyboardHeight > 0) {
        // Calculate the total height needed for input area (including safe area)
        const totalBottomSpace = keyboardHeight + inputAreaHeight;
        
        setInputBottom(keyboardHeight);
        if (listRef.current) {
          // Set padding to account for input area height, ensuring messages are never hidden
          // The accessory view space is already included in keyboardHeight from visualViewport
          listRef.current.style.paddingBottom = `${totalBottomSpace + 8}px`;
        }
      } else {
        setInputBottom(0);
        if (listRef.current) {
          // When keyboard is hidden, use normal padding for input area
          listRef.current.style.paddingBottom = `${inputAreaHeight + 8}px`;
        }
      }

      scrollToBottomWithRetries(scrollDelays);
    },
    [scrollToBottomWithRetries]
  );

  // Reliable keyboard detection - works on both desktop and mobile
  useEffect(() => {
    const visualViewport = (window as any).visualViewport;
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastKeyboardHeight = 0;
    let isInputFocused = false;

    const detectKeyboardHeight = (): number => {
      if (visualViewport) {
        // Use visualViewport API (best for mobile)
        const windowHeight = window.innerHeight;
        const viewportHeight = visualViewport.height;
        const viewportBottom = visualViewport.offsetTop + viewportHeight;
        const keyboardHeight = Math.max(0, windowHeight - viewportBottom);
        return keyboardHeight;
      } else {
        // Fallback: detect via window resize (works on desktop too)
        // On desktop, this will be 0, which is correct
        return 0;
      }
    };

    const updateLayout = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
        resizeTimeout = null;
      }

      resizeTimeout = setTimeout(() => {
        const keyboardHeight = detectKeyboardHeight();

        // Only update if keyboard height changed significantly (avoid jitter)
        // On desktop, keyboardHeight will be 0, which is fine
        if (Math.abs(keyboardHeight - lastKeyboardHeight) < 10 && keyboardHeight > 0 && !isInputFocused) {
          return;
        }
        lastKeyboardHeight = keyboardHeight;

        applyKeyboardLayout(keyboardHeight);
      }, 50);
    };

    // Use visualViewport if available (mobile/Despia)
    if (visualViewport) {
    visualViewport.addEventListener("resize", updateLayout);
    visualViewport.addEventListener("scroll", updateLayout);
    }

    // Also listen to window resize as fallback (works everywhere)
    window.addEventListener("resize", updateLayout);

    // Listen to input focus/blur for immediate response
    const handleFocus = () => {
      isInputFocused = true;
      // Multiple attempts to catch keyboard appearance
      setTimeout(updateLayout, 50);
      setTimeout(updateLayout, 150);
      setTimeout(updateLayout, 300);
      setTimeout(updateLayout, 500);
    };
    
    const handleBlur = () => {
      isInputFocused = false;
      setTimeout(updateLayout, 100);
    };

    const focusTimeout = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.addEventListener("focus", handleFocus);
        inputRef.current.addEventListener("blur", handleBlur);
      }
    }, 100);

    // Initial layout update
    updateLayout();

    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      clearTimeout(focusTimeout);
      if (visualViewport) {
      visualViewport.removeEventListener("resize", updateLayout);
      visualViewport.removeEventListener("scroll", updateLayout);
      }
      window.removeEventListener("resize", updateLayout);
      if (inputRef.current) {
        inputRef.current.removeEventListener("focus", handleFocus);
        inputRef.current.removeEventListener("blur", handleBlur);
      }
    };
  }, [applyKeyboardLayout]);

  // Additional resize handler as backup (handles window resizing on desktop)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      const visualViewport = (window as any).visualViewport;
      let keyboardHeight = 0;
      
      if (visualViewport) {
        const windowHeight = window.innerHeight;
        const viewportHeight = visualViewport.height;
        const viewportBottom = visualViewport.offsetTop + viewportHeight;
        keyboardHeight = Math.max(0, windowHeight - viewportBottom);
      }
      
      applyKeyboardLayout(keyboardHeight);
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [applyKeyboardLayout]);

  // Set initial padding for messages container
  useEffect(() => {
    if (listRef.current && inputAreaRef.current) {
      const inputAreaHeight = inputAreaRef.current.offsetHeight || 72;
      listRef.current.style.paddingBottom = `${inputAreaHeight + 8}px`;
    }
  }, []);

  const handleInputFocus = () => {
    // Try to remove readonly attribute if it exists (workaround for iOS accessory view)
    if (inputRef.current) {
      inputRef.current.removeAttribute('readonly');
    }
    
    // Trigger layout update to detect keyboard (works on both desktop and mobile)
    const detectAndApply = () => {
    const visualViewport = (window as any).visualViewport;
      let keyboardHeight = 0;
      
    if (visualViewport) {
        const windowHeight = window.innerHeight;
        const viewportHeight = visualViewport.height;
        const viewportBottom = visualViewport.offsetTop + viewportHeight;
        keyboardHeight = Math.max(0, windowHeight - viewportBottom);
      }
      
      applyKeyboardLayout(keyboardHeight, [0, 100, 200, 400, 600, 800]);
    };
    
    // Multiple attempts to catch keyboard appearance (especially on mobile)
    setTimeout(detectAndApply, 50);
    setTimeout(detectAndApply, 150);
    setTimeout(detectAndApply, 300);
    setTimeout(detectAndApply, 500);

    scrollToBottomWithRetries([100, 200, 400, 600]);
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
    
    // CRITICAL FIX: Don't compute groups until memberNames is available
    // This ensures groups are always created with correct author names from the start
    const hasMemberNames = memberNames instanceof Map ? memberNames.size > 0 : memberNames ? Object.keys(memberNames).length > 0 : false;
    if (!hasMemberNames) {
      return [];
    }
    
    
    // Build groups immutably using reduce to avoid mutation issues
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

      // Resolve reply author name
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
      // Check if we can append to the last group
      // Compare by user_id, not author name, to handle case where name resolved from "Unknown"
      const lastGroupUserId = lastGroup?.messages.length > 0 && lastGroup.messages[0].messageId
        ? messages.find(m => m.id === lastGroup.messages[0].messageId)?.user_id 
        : null;
      const canAppendToLast =
        lastGroup &&
        !shouldLabelDay &&
        lastGroup.isOwnMessage === isOwnMessage &&
        lastGroupUserId === msg.user_id; // Compare by user_id, not author name

      if (canAppendToLast) {
        // Always update author name to ensure it's current (e.g., from "Unknown" to actual name)
        // Extract the base message ID from the group ID (handle both formats: "msg-id" and "msg-id-Unknown")
        const baseId = lastGroup.id.includes('-') ? lastGroup.id.split('-')[0] : lastGroup.id;
        
        // Update all existing messages in the group to refresh their replyTo.authorName
        const updatedMessages = lastGroup.messages.map(existingMsg => {
          // Find the original message to get reply_to data
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
          id: `${baseId}-${fallbackName}`, // Update ID to include current author name
          author: fallbackName, // Always use the current resolved name
          avatarInitials,
          userId: msg.user_id,
          messages: [...updatedMessages, messagePayload], // Create new array with updated messages
        };
        // Replace the last group with the updated one - create new array immutably
        return [...acc.slice(0, -1), updatedGroup];
      } else {
        return [...acc, {
          id: `${msg.id}-${fallbackName}`, // Include author name in ID to force re-render when name changes
          author: fallbackName,
          avatarInitials,
          isOwnMessage,
          userId: msg.user_id,
          dayLabel: shouldLabelDay ? formatDayLabel(msg.created_at) : undefined,
          messages: [messagePayload],
        }];
      }
    }, []);

    // Return a new array reference to ensure React detects changes
    // Also ensure all groups have the correct author name (in case memberNames loaded after groups were created)
    // Create a completely new array to ensure React detects changes
    const finalGroups: ChatThreadProps["groups"] = groups.map((group) => {
      // Always create a new object to ensure React detects changes
      const baseGroup = { ...group };
      
      // Update all messages in the group to refresh their replyTo.authorName
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
      
      // If group author is "Unknown", try to resolve it from the first message
      if (baseGroup.author === "Unknown" && baseGroup.messages.length > 0 && baseGroup.messages[0].messageId) {
        const firstMessage = messages.find(m => m.id === baseGroup.messages[0].messageId);
        if (firstMessage) {
          const resolvedName = resolveName(firstMessage.user_id, memberNames);
          if (resolvedName && resolvedName !== "Unknown") {
            // Extract the base message ID from the group ID (handle both formats: "msg-id" and "msg-id-Unknown")
            const baseId = baseGroup.id.includes('-') ? baseGroup.id.split('-')[0] : baseGroup.id;
            return {
              ...baseGroup,
              id: `${baseId}-${resolvedName}`, // Update ID to include resolved name
              author: resolvedName,
              avatarInitials: initials(resolvedName),
              userId: firstMessage.user_id, // Preserve userId
              messages: updatedMessages, // Use updated messages with refreshed replyTo.authorName
            };
          }
        }
      }
      
      // Always return a new object with updated messages to ensure React detects changes
      return {
        ...baseGroup,
        messages: updatedMessages,
      };
    });
    
    
    return finalGroups;
  }, [currentUserDisplayName, memberNames, messages, user?.id, memberNamesVersion]);

  // Track when memberNames loads and increment version to force re-render
  useEffect(() => {
    const hasMemberNames = memberNames instanceof Map ? memberNames.size > 0 : memberNames ? Object.keys(memberNames).length > 0 : false;
    if (hasMemberNames && memberNamesVersion === 0) {
      setMemberNamesVersion(1);
    }
  }, [memberNames, memberNamesVersion]);

  // Force re-render when we detect Unknown groups but memberNames is available
  useEffect(() => {
    const hasMemberNames = memberNames instanceof Map ? memberNames.size > 0 : memberNames ? Object.keys(memberNames).length > 0 : false;
    const hasUnknownGroups = chatGroups.some(g => g.author === "Unknown");
    
    if (hasMemberNames && hasUnknownGroups && chatGroups.length > 0) {
      // Use setTimeout to avoid infinite loops, and increment multiple times to force multiple re-renders
      setTimeout(() => {
        setMemberNamesVersion(prev => prev + 1);
      }, 50);
      // Also try again after a longer delay
      setTimeout(() => {
        setMemberNamesVersion(prev => prev + 1);
      }, 200);
    }
  }, [chatGroups, memberNames]);

  // Unknown groups will resolve when memberNames loads
  
  // Force re-render when groups change by creating a key based on group authors and memberNamesVersion
  // This ensures React re-renders when any author name changes from "Unknown" to actual name
  const chatThreadKey = useMemo(() => {
    const authorNames = chatGroups.map(g => g.author).join(',');
    const hasUnknown = chatGroups.some(g => g.author === "Unknown");
    return `chat-${chatGroups.length}-${hasUnknown ? 'unknown' : 'resolved'}-${memberNamesVersion}-${authorNames.slice(0, 50)}`;
  }, [chatGroups, memberNamesVersion]);

  // Set scroll to bottom immediately when container is ready
  // Use ref callback to set scroll position as soon as element is mounted
  const setListRef = useCallback((node: HTMLDivElement | null) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueChatBeta.tsx:783',message:'setListRef called',data:{hasNode:!!node,messagesLength:messages.length,chatGroupsLength:chatGroups.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
    // #endregion
    listRef.current = node;
    // Set scroll to bottom immediately when element mounts AND content is ready
    if (node && messages.length > 0 && chatGroups.length > 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueChatBeta.tsx:787',message:'setListRef: scheduling scroll',data:{scrollHeight:node.scrollHeight,clientHeight:node.clientHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Use double RAF for Despia - ensures layout is fully complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (node) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueChatBeta.tsx:792',message:'setListRef: scrolling (double RAF)',data:{scrollHeight:node.scrollHeight,scrollTop:node.scrollTop,beforeScroll:node.scrollTop},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            node.scrollTop = node.scrollHeight;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueChatBeta.tsx:795',message:'setListRef: after scroll',data:{scrollTop:node.scrollTop,scrollHeight:node.scrollHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            // Force scroll again after a tiny delay for Despia
            setTimeout(() => {
              if (node) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueChatBeta.tsx:800',message:'setListRef: timeout scroll',data:{scrollTop:node.scrollTop,scrollHeight:node.scrollHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                node.scrollTop = node.scrollHeight;
              }
            }, 50);
          }
        });
      });
    }
  }, [messages.length, chatGroups.length]);
  
  // Also scroll when messages/chatGroups change (for Despia)
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueChatBeta.tsx:810',message:'useEffect scroll: messages/chatGroups changed',data:{messagesLength:messages.length,chatGroupsLength:chatGroups.length,hasListRef:!!listRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (listRef.current && messages.length > 0 && chatGroups.length > 0) {
      // Use double RAF for Despia
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (listRef.current) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueChatBeta.tsx:816',message:'useEffect scroll: executing',data:{scrollTop:listRef.current.scrollTop,scrollHeight:listRef.current.scrollHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            listRef.current.scrollTop = listRef.current.scrollHeight;
          }
        });
      });
    }
  }, [messages.length, chatGroups.length]);


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

      const logEntry: any = {
        timestamp: new Date().toISOString(),
        leagueId: miniLeagueId,
        senderId: user.id,
        ok: false,
        sent: 0,
        error: 'Unknown error',
      };

      try {
        const response = await fetch("/.netlify/functions/notifyLeagueMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leagueId: miniLeagueId,
            senderId: user.id,
            senderName,
            content: text,
            activeUserIds: [user.id], // Exclude yourself from notifications when you're actively in chat
          }),
        });

        const result = await response.json().catch((e) => {
          logEntry.error = `Failed to parse response: ${e?.message || String(e)}`;
          logEntry.httpStatus = response.status;
          return { ok: false, error: 'Failed to parse response' };
        });

        // Update log entry
        Object.assign(logEntry, {
          ok: result.ok,
          sent: result.sent || 0,
          recipients: result.recipients || 0,
          message: result.message,
          error: result.error,
          details: result.details,
          httpStatus: response.status,
          fullResponse: result,
        });

        // Status logged to localStorage for AdminData page, but not shown to users
      } catch (err: any) {
        logEntry.error = err?.message || String(err);
        logEntry.exception = true;
      } finally {
        // ALWAYS store log entry for AdminData page
        try {
          const logs = JSON.parse(localStorage.getItem('notification_logs') || '[]');
          logs.push(logEntry);
          // Keep only last 50 logs
          const recentLogs = logs.slice(-50);
          localStorage.setItem('notification_logs', JSON.stringify(recentLogs));
        } catch (e: any) {
          console.error('[MiniLeagueChatBeta] Error storing notification log:', e);
          setUiErrors(prev => [...prev, { id: `notif-log-${Date.now()}`, message: `Failed to log notification: ${e?.message || String(e)}`, timestamp: Date.now() }]);
        }
      }
    },
    [miniLeagueId, user?.id]
  );

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!miniLeagueId || !text || sending) return;
    try {
      setSending(true);
      // Clear draft immediately for better UX
      setDraft("");
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = "42px";
      }
      await sendMessage(text, replyingTo?.id || null);
      await notifyRecipients(text);
      setReplyingTo(null);
      scrollToBottomWithRetries([0, 150, 300]);
    } catch (err: any) {
      console.error('[MiniLeagueChatBeta] Error sending message:', err);
      setUiErrors(prev => [...prev, { id: `send-${Date.now()}`, message: `Failed to send message: ${err?.message || String(err)}`, timestamp: Date.now() }]);
      // Restore draft on error
      setDraft(text);
    } finally {
      setSending(false);
    }
  }, [draft, miniLeagueId, notifyRecipients, scrollToBottomWithRetries, sendMessage, sending, replyingTo]);

  // Add deep link error to uiErrors if present
  useEffect(() => {
    if (deepLinkError) {
      setUiErrors(prev => {
        // Don't duplicate if already shown
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

  // Reset refs when league changes
  useEffect(() => {
    if (miniLeagueId) {
      initialScrollDoneRef.current = false;
      initialLoadCompleteRef.current = false;
    }
  }, [miniLeagueId]);

  // Track when initial load is complete (loading done, messages loaded, memberNames ready)
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueChatBeta.tsx:976',message:'initialLoadComplete effect',data:{loading,messagesLength:messages.length,chatGroupsLength:chatGroups.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // If we have messages already (from cache), we can show immediately
    if (messages.length > 0) {
      const hasMemberNames = memberNames instanceof Map ? memberNames.size > 0 : memberNames ? Object.keys(memberNames).length > 0 : false;
      if (hasMemberNames) {
        // Messages are ready and memberNames are ready - show immediately
        initialLoadCompleteRef.current = true;
        return;
      }
    }
    
    // Otherwise wait for loading to complete
    if (!loading && messages.length >= 0) {
      const hasMemberNames = memberNames instanceof Map ? memberNames.size > 0 : memberNames ? Object.keys(memberNames).length > 0 : false;
      // Wait for memberNames if we have messages, otherwise we can show empty state
      if (messages.length === 0 || hasMemberNames) {
        // Small delay to ensure chatGroups is calculated
        const timer = setTimeout(() => {
          initialLoadCompleteRef.current = true;
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, messages.length, memberNames]);

  // Don't render anything until messages and chatGroups are both ready
  // This prevents all glitchy loading states
  // #region agent log
  if (messages.length === 0 || chatGroups.length === 0) {
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueChatBeta.tsx:959',message:'Early return: not ready',data:{messagesLength:messages.length,chatGroupsLength:chatGroups.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return null;
  }
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MiniLeagueChatBeta.tsx:963',message:'Rendering chat component',data:{messagesLength:messages.length,chatGroupsLength:chatGroups.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

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

        {/* Only render when we have messages AND chatGroups ready - prevents glitchy re-renders */}
        {messages.length > 0 && chatGroups.length > 0 ? (
          <ChatThread 
            key={chatThreadKey}
            groups={chatGroups}
            reactions={reactions}
            onReactionClick={handleReactionClick}
            onMessageClick={(messageId, content, authorName) => {
              // Find the message to get full reply data
              const message = messages.find(m => m.id === messageId);
              if (message) {
                // Extract text content - handle both string and ReactNode
                let messageContent = '';
                if (typeof content === 'string') {
                  messageContent = content;
                } else if (typeof content === 'object' && content !== null) {
                  // Try to extract text from ReactNode
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
                // Focus input after a short delay
                setTimeout(() => {
                  inputRef.current?.focus();
                }, 100);
              }
            }}
          />
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
          // Ensure input is always accessible and clickable
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
            data-1p-ignore="true"
            onKeyDown={(e) => {
              // Cancel reply on Escape
              if (e.key === 'Escape' && replyingTo) {
                setReplyingTo(null);
                e.preventDefault();
                return;
              }
              // Send on Enter (without Shift)
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
              // Update layout when textarea height changes
              requestAnimationFrame(() => {
                const visualViewport = (window as any).visualViewport;
                if (visualViewport) {
                  const windowHeight = window.innerHeight;
                  const viewportHeight = visualViewport.height;
                  const viewportBottom = visualViewport.offsetTop + viewportHeight;
                  const keyboardHeight = windowHeight - viewportBottom;
                  applyKeyboardLayout(keyboardHeight, [0, 100]);
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

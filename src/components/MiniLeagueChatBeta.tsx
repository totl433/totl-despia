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
  const [reactions, setReactions] = useState<Record<string, Array<{ emoji: string; count: number; hasUserReacted: boolean }>>>({});
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; authorName?: string } | null>(null);
  // Force re-render when memberNames loads by tracking a version
  const [memberNamesVersion, setMemberNamesVersion] = useState(0);
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
    
    const messageIds = messages.map(m => m.id);
    if (messageIds.length === 0) return;
    
    const loadReactions = async () => {
      try {
        const { data, error } = await supabase
          .from('league_message_reactions')
          .select('message_id, emoji, user_id')
          .in('message_id', messageIds);
        
        if (error) {
          console.error('[MiniLeagueChatBeta] Error loading reactions:', error);
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
      } catch (err) {
        console.error('[MiniLeagueChatBeta] Error in loadReactions:', err);
      }
    };
    
    loadReactions();
  }, [messages, user?.id]);

  // Subscribe to reaction changes
  useEffect(() => {
    if (messages.length === 0 || !user?.id) return;
    
    const messageIds = messages.map(m => m.id);
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
              console.error('[MiniLeagueChatBeta] Error reloading reactions:', err);
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
        console.error('[MiniLeagueChatBeta] Error removing reaction:', error);
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
      console.warn('[chatGroups] memberNames not available yet, returning empty array to prevent "Unknown" authors');
      return [];
    }
    
    // Debug: log memberNames state
    console.log('[chatGroups] Computing with memberNames:', memberNames instanceof Map ? `Map(${memberNames.size})` : memberNames ? `Record(${Object.keys(memberNames).length})` : 'null/undefined');
    if (memberNames instanceof Map) {
      const memberKeys = Array.from(memberNames.keys());
      console.log('[chatGroups] memberNames keys:', memberKeys);
      // Log the actual name values
      memberKeys.forEach(key => {
        const name = memberNames.get(key);
        console.log(`[chatGroups] memberNames[${key}] = "${name}"`);
      });
    }
    
    // Build groups immutably using reduce to avoid mutation issues
    let lastDayKey: string | null = null;
    const groups = messages.reduce<ChatThreadProps["groups"]>((acc, msg) => {
      const isOwnMessage = msg.user_id === user?.id;
      const resolvedName = resolveName(msg.user_id, memberNames);
      const authorName = resolvedName || (isOwnMessage ? currentUserDisplayName : "");
      const fallbackName = authorName || (isOwnMessage ? "You" : "Unknown");
      
      // Debug: log name resolution for first few messages
      if (messages.indexOf(msg) < 5) {
        const hasKey = memberNames instanceof Map ? memberNames.has(msg.user_id) : memberNames ? msg.user_id in memberNames : false;
        const mapValue = memberNames instanceof Map ? memberNames.get(msg.user_id) : memberNames ? memberNames[msg.user_id] : undefined;
        console.log(`[chatGroups] Message ${messages.indexOf(msg)}: user_id=${msg.user_id}, hasKey=${hasKey}, mapValue="${mapValue}", resolvedName="${resolvedName}", fallbackName="${fallbackName}"`);
      }
      
      // Debug: log if we can't resolve a name
      if (!resolvedName && !isOwnMessage && memberNames) {
        const hasKey = memberNames instanceof Map ? memberNames.has(msg.user_id) : msg.user_id in memberNames;
        console.warn('[chatGroups] Could not resolve name for user_id:', msg.user_id, 'memberNames has this key?', hasKey, 'resolvedName:', resolvedName, 'authorName:', authorName, 'fallbackName:', fallbackName);
      }
      
      const avatarInitials = !isOwnMessage ? initials(fallbackName) : undefined;

      const createdDate = new Date(msg.created_at);
      const dayKey = createdDate.toDateString();
      const shouldLabelDay = dayKey !== lastDayKey;
      if (shouldLabelDay) {
        lastDayKey = dayKey;
      }

      // Debug: log ALL messages with reply_to to see their structure
      if (msg.reply_to) {
        console.log('[chatGroups] Message', msg.id, 'has reply_to:', {
          id: msg.reply_to.id,
          content: msg.reply_to.content,
          user_id: msg.reply_to.user_id,
          author_name: msg.reply_to.author_name,
          full_reply_to: msg.reply_to,
        });
      }
      
      // Resolve reply author name
      const replyAuthorName = msg.reply_to 
        ? (resolveName(msg.reply_to.user_id, memberNames) || "Unknown")
        : null;
      
      // Debug: log if reply author is "Unknown" but memberNames is available
      if (msg.reply_to && replyAuthorName === "Unknown") {
        const hasMemberNames = memberNames instanceof Map ? memberNames.size > 0 : memberNames ? Object.keys(memberNames).length > 0 : false;
        const hasKey = memberNames instanceof Map 
          ? memberNames.has(msg.reply_to.user_id)
          : memberNames 
            ? msg.reply_to.user_id in memberNames 
            : false;
        console.warn('[chatGroups] Reply author is "Unknown" for message', msg.id, 'reply_to.user_id:', msg.reply_to.user_id, 'hasMemberNames:', hasMemberNames, 'hasKey:', hasKey, 'reply_to object:', msg.reply_to);
        if (hasKey && memberNames) {
          const resolved = resolveName(msg.reply_to.user_id, memberNames);
          console.warn('[chatGroups] Resolved name should be:', resolved, 'but got "Unknown"');
        }
      }

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
    const finalGroups: ChatThreadProps["groups"] = groups.map((group, idx) => {
      // Always create a new object to ensure React detects changes
      const baseGroup = { ...group };
      
      // Update all messages in the group to refresh their replyTo.authorName
      const updatedMessages = baseGroup.messages.map(msg => {
        const originalMsg = msg.messageId ? messages.find(m => m.id === msg.messageId) : null;
        if (originalMsg?.reply_to && msg.replyTo) {
          const updatedReplyAuthorName = resolveName(originalMsg.reply_to.user_id, memberNames) || "Unknown";
          if (updatedReplyAuthorName !== msg.replyTo.authorName) {
            console.log('[chatGroups] POST-PROCESSING: Updating replyTo.authorName for message', msg.messageId, 'from', msg.replyTo.authorName, 'to', updatedReplyAuthorName);
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
            console.log('[chatGroups] POST-PROCESSING: Resolving "Unknown" to:', resolvedName, 'for user_id:', firstMessage.user_id, 'group.id:', baseGroup.id, 'group index:', idx);
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
          } else {
            console.log('[chatGroups] POST-PROCESSING: Could not resolve "Unknown" for group', idx, 'user_id:', firstMessage.user_id, 'resolvedName:', resolvedName);
          }
        } else {
          console.log('[chatGroups] POST-PROCESSING: Could not find first message for group', idx, 'messageId:', baseGroup.messages[0]?.messageId);
        }
      } else if (baseGroup.author === "Unknown") {
        console.log('[chatGroups] POST-PROCESSING: Group', idx, 'has "Unknown" author but no messages');
      }
      
      // Always return a new object with updated messages to ensure React detects changes
      return {
        ...baseGroup,
        messages: updatedMessages,
      };
    });
    
    // Log if we resolved any names
    const resolvedCount = finalGroups.filter(g => g.author !== "Unknown" && groups.find((og: ChatThreadProps["groups"][number]) => {
      const ogBaseId = og.id.includes('-') ? og.id.split('-')[0] : og.id;
      const gBaseId = g.id.includes('-') ? g.id.split('-')[0] : g.id;
      return ogBaseId === gBaseId && og.author === "Unknown";
    })).length;
    if (resolvedCount > 0) {
      console.log('[chatGroups] Resolved', resolvedCount, 'groups from "Unknown" to actual names');
    }
    
    // Debug: log final groups to see what we're returning
    const unknownCount = finalGroups.filter((g: ChatThreadProps["groups"][number]) => g.author === "Unknown").length;
    if (unknownCount > 0) {
      console.warn('[chatGroups] FINAL GROUPS: Found', unknownCount, 'groups with "Unknown" author out of', finalGroups.length, 'total groups');
      finalGroups.forEach((g: ChatThreadProps["groups"][number], idx: number) => {
        if (g.author === "Unknown") {
          console.warn(`[chatGroups] Group ${idx}: id="${g.id}", author="${g.author}", messages=${g.messages.length}, firstMessageId=${g.messages[0]?.messageId}`);
        }
      });
    } else {
      console.log('[chatGroups] FINAL GROUPS: All', finalGroups.length, 'groups have resolved author names');
    }
    
    return finalGroups;
  }, [currentUserDisplayName, memberNames, messages, user?.id, memberNamesVersion]);

  // Track when memberNames loads and increment version to force re-render
  useEffect(() => {
    const hasMemberNames = memberNames instanceof Map ? memberNames.size > 0 : memberNames ? Object.keys(memberNames).length > 0 : false;
    if (hasMemberNames && memberNamesVersion === 0) {
      console.log('[MiniLeagueChatBeta] memberNames loaded, incrementing version to force re-render');
      setMemberNamesVersion(1);
    }
  }, [memberNames, memberNamesVersion]);

  // Force re-render when we detect Unknown groups but memberNames is available
  useEffect(() => {
    const hasMemberNames = memberNames instanceof Map ? memberNames.size > 0 : memberNames ? Object.keys(memberNames).length > 0 : false;
    const hasUnknownGroups = chatGroups.some(g => g.author === "Unknown");
    
    if (hasMemberNames && hasUnknownGroups && chatGroups.length > 0) {
      console.warn('[MiniLeagueChatBeta] DETECTED: memberNames available but groups have "Unknown" authors - forcing re-render');
      // Use setTimeout to avoid infinite loops, and increment multiple times to force multiple re-renders
      setTimeout(() => {
        setMemberNamesVersion(prev => {
          const newVersion = prev + 1;
          console.warn('[MiniLeagueChatBeta] Incrementing memberNamesVersion to', newVersion);
          return newVersion;
        });
      }, 50);
      // Also try again after a longer delay
      setTimeout(() => {
        setMemberNamesVersion(prev => {
          const newVersion = prev + 1;
          console.warn('[MiniLeagueChatBeta] Second increment of memberNamesVersion to', newVersion);
          return newVersion;
        });
      }, 200);
    }
  }, [chatGroups, memberNames]);

  // Debug: log when chatGroups changes
  useEffect(() => {
    const unknownGroups = chatGroups.filter(g => g.author === "Unknown");
    if (unknownGroups.length > 0) {
      console.error('[MiniLeagueChatBeta] chatGroups changed:', unknownGroups.length, 'groups with "Unknown" author out of', chatGroups.length, 'total groups');
      unknownGroups.forEach((g, idx) => {
        console.error(`[MiniLeagueChatBeta] Group ${idx}: id="${g.id}", author="${g.author}", messages=${g.messages.length}, firstMessageId=${g.messages[0]?.id}`);
      });
      // CRITICAL: If we have Unknown groups but memberNames is available, something is wrong
      const hasMemberNames = memberNames instanceof Map ? memberNames.size > 0 : memberNames ? Object.keys(memberNames).length > 0 : false;
      if (hasMemberNames) {
        console.error('[MiniLeagueChatBeta] ERROR: memberNames is available but groups still have "Unknown" authors! This should not happen!');
      }
    } else {
      console.log('[MiniLeagueChatBeta] chatGroups changed: All', chatGroups.length, 'groups have resolved author names');
    }
    // Log first few groups to verify author names
    chatGroups.slice(0, 5).forEach((g, idx) => {
      console.log(`[MiniLeagueChatBeta] Group ${idx}: id="${g.id}", author="${g.author}", messages=${g.messages.length}`);
    });
  }, [chatGroups, memberNames]);
  
  // Force re-render when groups change by creating a key based on group authors and memberNamesVersion
  // This ensures React re-renders when any author name changes from "Unknown" to actual name
  const chatThreadKey = useMemo(() => {
    const authorNames = chatGroups.map(g => g.author).join(',');
    const hasUnknown = chatGroups.some(g => g.author === "Unknown");
    return `chat-${chatGroups.length}-${hasUnknown ? 'unknown' : 'resolved'}-${memberNamesVersion}-${authorNames.slice(0, 50)}`;
  }, [chatGroups, memberNamesVersion]);

  const [notificationStatus, setNotificationStatus] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

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

        // ALWAYS show status message
        if (result.ok === true) {
          if (result.recipients > 0 || result.sent > 0) {
            const count = result.recipients || result.sent || 0;
            setNotificationStatus({
              message: `✓ Sent to ${count} device${count === 1 ? '' : 's'}`,
              type: 'success'
            });
          } else if (result.message === 'No devices' || result.message === 'No eligible recipients') {
            setNotificationStatus({
              message: '⚠️ No devices to notify',
              type: 'warning'
            });
          } else {
            setNotificationStatus({
              message: `✓ ${result.message || 'Notification sent'}`,
              type: 'success'
            });
          }
        } else {
          // Error case - show detailed error
          const errorMsg = result.details?.body?.errors?.[0] 
            || result.details?.error 
            || result.error 
            || 'Failed to send notification';
          setNotificationStatus({
            message: `✗ ${errorMsg}`,
            type: 'error'
          });
        }

        setTimeout(() => setNotificationStatus(null), 5000);
      } catch (err: any) {
        logEntry.error = err?.message || String(err);
        logEntry.exception = true;
        setNotificationStatus({
          message: `✗ Error: ${err?.message || 'Failed to send notification'}`,
          type: 'error'
        });
        setTimeout(() => setNotificationStatus(null), 5000);
      } finally {
        // ALWAYS store log entry for AdminData page
        try {
          const logs = JSON.parse(localStorage.getItem('notification_logs') || '[]');
          logs.push(logEntry);
          // Keep only last 50 logs
          const recentLogs = logs.slice(-50);
          localStorage.setItem('notification_logs', JSON.stringify(recentLogs));
        } catch (e) {
          // If localStorage fails, at least try to show error
          console.error('[MiniLeagueChatBeta] Failed to store notification log:', e);
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
    } catch (err) {
      console.error("[MiniLeagueChatBeta] Failed to send message", err);
      // Restore draft on error
      setDraft(text);
    } finally {
      setSending(false);
    }
  }, [draft, miniLeagueId, notifyRecipients, scrollToBottomWithRetries, sendMessage, sending, replyingTo]);


  return (
    <div className="flex flex-col h-full w-full" style={{ position: 'relative', zIndex: 1, overflowX: 'hidden' }}>
      <div
        ref={listRef}
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

        {chatGroups.length === 0 && !loading ? (
          <div className="text-center text-sm text-slate-500 mt-8">
            Say hi to kick off this chat!
          </div>
        ) : (
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
        )}
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
              className="flex-shrink-0 w-5 h-5 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
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
        {notificationStatus && (
          <div className={`text-xs mt-2 text-center ${
            notificationStatus.type === 'success' 
              ? 'text-green-600' 
              : notificationStatus.type === 'warning'
              ? 'text-amber-600'
              : 'text-red-600'
          }`}>
            {notificationStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}

export default MiniLeagueChatBeta;

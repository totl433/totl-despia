import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { resolveLeagueStartGw as getLeagueStartGw, shouldIncludeGwForLeague } from "../lib/leagueStart";
import imageCompression from "browser-image-compression";
import { getLeagueAvatarUrl, getDefaultMlAvatar } from "../lib/leagueAvatars";
import { useLiveScores } from "../hooks/useLiveScores";
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { invalidateLeagueCache } from "../api/leagues";
import MiniLeagueChatBeta from "../components/MiniLeagueChatBeta";
import MessageBubble from "../components/chat/MessageBubble";
import InfoSheet from "../components/InfoSheet";
import WinnerBanner from "../components/league/WinnerBanner";
import GwSelector from "../components/league/GwSelector";
import PointsFormToggle from "../components/league/PointsFormToggle";
import MiniLeagueTable from "../components/league/MiniLeagueTable";
import ResultsTable from "../components/league/ResultsTable";
import SubmissionStatusTable from "../components/league/SubmissionStatusTable";
import LeagueFixtureSection from "../components/league/LeagueFixtureSection";

const MAX_MEMBERS = 8;

/* =========================
   Types
   ========================= */
type League = { id: string; name: string; code: string; created_at?: string; created_by?: string; avatar?: string | null };
type Member = { id: string; name: string };

type Fixture = {
  api_match_id?: number | null;
  id: string;
  gw: number;
  fixture_index: number;
  home_team: string;
  away_team: string;
  home_code?: string | null;
  away_code?: string | null;
  home_name?: string | null;
  away_name?: string | null;
  home_crest?: string | null;
  away_crest?: string | null;
  kickoff_time?: string | null;
};

type PickRow = { user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" };
type SubmissionRow = { user_id: string; gw: number; submitted_at: string | null };

type ResultRowRaw = {
  gw: number;
  fixture_index: number;
  result?: "H" | "D" | "A" | null;
  home_goals?: number | null;
  away_goals?: number | null;
};

type MltRow = {
  user_id: string;
  name: string;
  mltPts: number;
  ocp: number;
  unicorns: number;
  wins: number;
  draws: number;
  form: ("W" | "D" | "L")[];
};

/* Chat */
type ChatMsg = {
  id: string;
  league_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

/* =========================
   Helpers
   ========================= */

function rowToOutcome(r: ResultRowRaw): "H" | "D" | "A" | null {
  if (r.result === "H" || r.result === "D" || r.result === "A") return r.result;
  if (typeof r.home_goals === "number" && typeof r.away_goals === "number") {
    if (r.home_goals > r.away_goals) return "H";
    if (r.home_goals < r.away_goals) return "A";
    return "D";
  }
  return null;
}

// Chip component moved to src/components/league/PickChip.tsx

/* =========================
   ChatTab (external to avoid remount on typing)
   ========================= */

type ChatTabProps = {
  chat: ChatMsg[];
  userId?: string;
  nameById: Map<string, string>;
  isMember: boolean;
  newMsg: string;
  setNewMsg: (v: string) => void;
  onSend: () => void;
  leagueCode?: string;
  memberCount?: number;
  maxMembers?: number;
};

type ReactionData = {
  emoji: string;
  count: number;
  hasUserReacted: boolean;
};

function ChatTab({ chat, userId, nameById, isMember, newMsg, setNewMsg, onSend, leagueCode: _leagueCode, memberCount: _memberCount, maxMembers: _maxMembers, notificationStatus }: ChatTabProps & { notificationStatus?: { message: string; type: 'success' | 'warning' | 'error' | null } | null }) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputAreaRef = useRef<HTMLDivElement | null>(null);
  const [inputBottom, setInputBottom] = useState<number>(0);
  const [reactions, setReactions] = useState<Record<string, ReactionData[]>>({});

  // Simple scroll to bottom
  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };

  // Helper to scroll with multiple attempts for reliability
  const scrollToBottomWithRetries = useCallback((delays: number[] = [0, 100, 300, 500, 700]) => {
    requestAnimationFrame(() => {
      delays.forEach((delay) => {
        setTimeout(() => scrollToBottom(), delay);
      });
    });
  }, []);

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

  // Load reactions for all messages
  useEffect(() => {
    if (chat.length === 0 || !userId) return;
    
    const messageIds = chat.map(m => m.id);
    if (messageIds.length === 0) return;
    
    const loadReactions = async () => {
      try {
        const { data, error } = await supabase
          .from('league_message_reactions')
          .select('message_id, emoji, user_id')
          .in('message_id', messageIds);
        
        if (error) {
          console.error('[ChatTab] Error loading reactions:', error);
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
        if (reaction.user_id === userId) {
          reactionsByMessage[reaction.message_id][reaction.emoji].hasUserReacted = true;
        }
      });
      
      // Convert to array format
      const formattedReactions: Record<string, ReactionData[]> = {};
      Object.keys(reactionsByMessage).forEach(messageId => {
        formattedReactions[messageId] = Object.entries(reactionsByMessage[messageId]).map(([emoji, data]) => ({
          emoji,
          count: data.count,
          hasUserReacted: data.hasUserReacted,
        }));
      });
      
      setReactions(formattedReactions);
      } catch (err) {
        console.error('[ChatTab] Error in loadReactions:', err);
      }
    };
    
    loadReactions();
  }, [chat, userId]);

  // Subscribe to reaction changes
  useEffect(() => {
    if (chat.length === 0 || !userId) return;
    
    const messageIds = chat.map(m => m.id);
    if (messageIds.length === 0) return;
    
    // Subscribe to all reaction changes and reload when any change occurs
    const channel = supabase
      .channel('message-reactions')
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
                if (reaction.user_id === userId) {
                  reactionsByMessage[reaction.message_id][reaction.emoji].hasUserReacted = true;
                }
              });
              
              const formattedReactions: Record<string, ReactionData[]> = {};
              Object.keys(reactionsByMessage).forEach(messageId => {
                formattedReactions[messageId] = Object.entries(reactionsByMessage[messageId]).map(([emoji, data]) => ({
                  emoji,
                  count: data.count,
                  hasUserReacted: data.hasUserReacted,
                }));
              });
              
              setReactions(formattedReactions);
            } catch (err) {
              console.error('[ChatTab] Error reloading reactions:', err);
            }
          };
          
          loadReactions();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chat, userId]);

  // Handle reaction click
  const handleReactionClick = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return;
    
    // Check if user already reacted with this emoji
    const messageReactions = reactions[messageId] || [];
    const existingReaction = messageReactions.find(r => r.emoji === emoji && r.hasUserReacted);
    
    if (existingReaction) {
      // Remove reaction
      const { error } = await supabase
        .from('league_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji);
      
      if (error) {
        console.error('[ChatTab] Error removing reaction:', error);
      }
    } else {
      // Add reaction
      const { error } = await supabase
        .from('league_message_reactions')
        .upsert({
          message_id: messageId,
          user_id: userId,
          emoji,
        });
      
      if (error) {
        console.error('[ChatTab] Error adding reaction:', error);
      }
    }
  }, [userId, reactions]);

  // Scroll when messages change
  useEffect(() => {
    if (chat.length > 0) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [chat.length]);

  // Reset textarea height when message is cleared (after send)
  useEffect(() => {
    if (!newMsg && inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = '42px';
    }
  }, [newMsg]);

  // Set initial padding for messages container
  useEffect(() => {
    if (listRef.current && inputAreaRef.current) {
      const inputAreaHeight = inputAreaRef.current.offsetHeight || 72;
      listRef.current.style.paddingBottom = `${inputAreaHeight + 8}px`;
    }
  }, []);

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
        let keyboardHeight = Math.max(0, windowHeight - viewportBottom);
        return keyboardHeight;
      } else {
        // Fallback: detect via window resize (works on desktop too)
        // On desktop, this will be 0, which is correct
        return 0;
      }
    };

    const updateLayout = () => {
      // Clear any pending updates
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
        resizeTimeout = null;
      }

      // Debounce updates to avoid flickering
      resizeTimeout = setTimeout(() => {
        const keyboardHeight = detectKeyboardHeight();
        
        // Only update if keyboard height changed significantly (avoid jitter)
        // On desktop, keyboardHeight will be 0, which is fine
        if (Math.abs(keyboardHeight - lastKeyboardHeight) < 10 && keyboardHeight > 0 && !isInputFocused) {
          return;
        }
        lastKeyboardHeight = keyboardHeight;
        
        applyKeyboardLayout(keyboardHeight);
      }, 50); // Small debounce delay
    };

    // Use visualViewport if available (mobile/Despia)
    if (visualViewport) {
      visualViewport.addEventListener('resize', updateLayout);
      visualViewport.addEventListener('scroll', updateLayout);
    }
    
    // Also listen to window resize as fallback (works everywhere)
    window.addEventListener('resize', updateLayout);
    
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
    
    // Set up focus/blur listeners
    const focusTimeout = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.addEventListener('focus', handleFocus);
        inputRef.current.addEventListener('blur', handleBlur);
      }
    }, 100);
    
    // Initial layout update
    updateLayout();

    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      clearTimeout(focusTimeout);
      if (visualViewport) {
        visualViewport.removeEventListener('resize', updateLayout);
        visualViewport.removeEventListener('scroll', updateLayout);
      }
      window.removeEventListener('resize', updateLayout);
      if (inputRef.current) {
        inputRef.current.removeEventListener('focus', handleFocus);
        inputRef.current.removeEventListener('blur', handleBlur);
      }
    };
  }, [applyKeyboardLayout]);

  // Scroll on input focus and trigger layout update
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
    
    // Multiple scroll attempts for reliability
    scrollToBottomWithRetries([100, 200, 400, 600]);
  };

  // Additional resize handler as backup (handles window resizing on desktop)
  useEffect(() => {
    if (typeof window === 'undefined') return;
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
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [applyKeyboardLayout]);

  // Dismiss keyboard when tapping messages area (WhatsApp-like behavior)
  const handleMessagesClick = (e: React.MouseEvent) => {
    // Don't blur if clicking on interactive elements (links, buttons, etc.)
    const target = e.target as HTMLElement;
    const isInteractive = target.tagName === 'A' || target.tagName === 'BUTTON' || target.closest('a, button');
    
    // Blur input to dismiss keyboard when tapping messages area
    if (!isInteractive && inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.blur();
    }
  };

  return (
    <div className="flex flex-col chat-container" style={{ height: '100%', position: 'relative' }}>
      {/* Messages list */}
      <div 
        ref={listRef} 
        className="flex-1 overflow-y-auto px-3 pt-3 min-h-0 messages-container" 
        onClick={handleMessagesClick}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          cursor: 'pointer',
        }}
      >
        {chat.map((m, index) => {
          const mine = m.user_id === userId;
          const name = nameById.get(m.user_id) ?? "Unknown";
          const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const prev = chat[index - 1];
          const next = chat[index + 1];
          const samePrev = prev?.user_id === m.user_id;
          const sameNext = next?.user_id === m.user_id;
          const startsRun = !samePrev;
          const endsRun = !sameNext;
          const isSingle = !samePrev && !sameNext;
          const isTop = startsRun && sameNext;
          const isBottom = samePrev && endsRun;
          const showAvatar = !mine && (isSingle || isBottom);
          const initials = name
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .toUpperCase();
          const rowClasses = mine ? "flex justify-end" : "flex items-end gap-2";
          const shape: "single" | "top" | "middle" | "bottom" =
            isSingle ? "single" : isTop ? "top" : isBottom ? "bottom" : "middle";
          return (
            <div
              key={m.id}
              className={rowClasses}
              style={{ marginTop: startsRun ? 24 : 4 }}
            >
              {!mine && (
                <div className="flex-shrink-0 w-8 h-8 flex justify-center self-end">
                  {showAvatar ? (
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-500">
                      {initials}
                    </div>
                  ) : (
                    <div className="w-8 h-8" />
                  )}
                </div>
              )}
              <div className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                <MessageBubble
                  author={!mine && startsRun ? name : undefined}
                  text={m.content}
                  time={time}
                  isOwnMessage={mine}
                  shape={shape}
                  messageId={m.id}
                  reactions={reactions[m.id] || []}
                  onReactionClick={handleReactionClick}
                />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} style={{ height: '1px', width: '100%' }} />
      </div>

      {/* Input area - fixed above keyboard when visible, relative when keyboard hidden */}
      <div 
        ref={inputAreaRef}
        className="flex-shrink-0 bg-white border-t border-slate-200 px-4 py-3" 
        style={{
          paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))`,
          position: inputBottom > 0 ? 'fixed' : 'relative',
          bottom: inputBottom > 0 ? `${inputBottom}px` : '0',
          left: inputBottom > 0 ? '0' : 'auto',
          right: inputBottom > 0 ? '0' : 'auto',
          width: '100%',
          zIndex: inputBottom > 0 ? 100 : 'auto',
          boxShadow: inputBottom > 0 ? '0 -2px 8px rgba(0, 0, 0, 0.1)' : 'none',
          // Ensure input is always accessible and clickable
          pointerEvents: 'auto',
        }}
      >
        {isMember ? (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSend();
              }}
              className="flex items-center gap-2 relative"
            >
              <textarea
                ref={inputRef}
                value={newMsg}
                onChange={(e) => {
                  setNewMsg(e.target.value);
                  // Auto-resize textarea
                  if (inputRef.current) {
                    inputRef.current.style.height = 'auto';
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
                onKeyDown={(e) => {
                  // Submit on Enter (but allow Shift+Enter for new line)
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (newMsg.trim()) {
                      onSend();
                    }
                  }
                }}
                placeholder="Start typing..."
                maxLength={2000}
                rows={1}
                autoComplete="off"
                autoCorrect="on"
                autoCapitalize="sentences"
                spellCheck={true}
                inputMode="text"
                data-1p-ignore="true"
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C8376] focus:border-transparent resize-none overflow-hidden"
                style={{
                  minHeight: '42px',
                  maxHeight: '120px',
                  lineHeight: '1.5',
                }}
              />
              <button
                type="submit"
                className="flex-shrink-0 w-10 h-10 rounded-full bg-[#1C8376] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!newMsg.trim()}
                style={{
                  backgroundColor: !newMsg.trim() ? '#94a3b8' : '#1C8376',
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </form>
          </>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-800 p-3 text-sm">
            Join this league to chat with other members.
          </div>
        )}
        {/* Notification status banner */}
        {notificationStatus && (
          <div className={`w-full rounded px-2 py-1 text-xs mt-2 ${
            notificationStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
            notificationStatus.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
            'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {notificationStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   Page
   ========================= */
export default function LeaguePage() {
  const { code = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [oldSchoolMode] = useState(() => {
    const saved = localStorage.getItem('oldSchoolMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('oldSchoolMode', JSON.stringify(oldSchoolMode));
  }, [oldSchoolMode]);

  // Prevent body/html scrolling and keep header fixed
  useEffect(() => {
    // Prevent body and html from scrolling
    document.body.classList.add('league-page-active');
    document.documentElement.classList.add('league-page-active');
    
    // Ensure header stays fixed - check periodically and on scroll
    const preventHeaderScroll = () => {
      const header = document.querySelector('.league-header-fixed') as HTMLElement;
      if (header) {
        const currentTop = header.style.top || window.getComputedStyle(header).top;
        if (currentTop !== '0px' && currentTop !== '0') {
          header.style.top = '0';
          header.style.transform = 'translate3d(0, 0, 0)';
        }
      }
    };
    
    // Monitor window scroll and reset header if it moves
    const handleWindowScroll = () => {
      preventHeaderScroll();
      // Reset window scroll to 0 if it somehow scrolled
      if (window.scrollY !== 0 || window.pageYOffset !== 0) {
        window.scrollTo(0, 0);
      }
    };
    
    // Prevent touchmove outside content wrapper that could cause body scroll
    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      // Only prevent if touching outside scrollable areas
      const isInScrollableArea = target.closest('.league-content-wrapper') || 
                                  target.closest('.league-header-fixed') ||
                                  target.closest('.chat-tab-wrapper');
      if (!isInScrollableArea) {
        e.preventDefault();
      }
    };
    
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    // Check periodically to ensure header stays fixed
    const checkInterval = setInterval(preventHeaderScroll, 100);
    
    preventHeaderScroll();
    
    return () => {
      document.body.classList.remove('league-page-active');
      document.documentElement.classList.remove('league-page-active');
      window.removeEventListener('scroll', handleWindowScroll);
      document.removeEventListener('touchmove', handleTouchMove);
      clearInterval(checkInterval);
    };
  }, []);

  // Keep header fixed when keyboard appears
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Prevent page scroll when keyboard appears
        setTimeout(() => {
          window.scrollTo(0, 0);
          const header = document.querySelector('.league-header-fixed');
          if (header) {
            (header as HTMLElement).style.top = '0';
          }
        }, 100);
      }
    };

    const handleResize = () => {
      // Ensure header stays at top on resize (keyboard show/hide)
      const header = document.querySelector('.league-header-fixed');
      if (header) {
        (header as HTMLElement).style.top = '0';
      }
      // Only scroll to top on resize if it's a keyboard-related resize (significant height change)
      // Don't scroll on tab changes or minor layout shifts
    };

    document.addEventListener('focusin', handleFocusIn);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    let raf: number | null = null;

    const applyTransform = () => {
      const headerEl = headerRef.current;
      if (!headerEl) return;
      const offset = visualViewport.offsetTop ?? 0;
      headerEl.style.setProperty(
        "transform",
        `translate3d(0, ${offset}px, 0)`,
        "important"
      );
    };

    const scheduleUpdate = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(applyTransform);
    };

    scheduleUpdate();
    visualViewport.addEventListener("resize", scheduleUpdate);
    visualViewport.addEventListener("scroll", scheduleUpdate);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      visualViewport.removeEventListener("resize", scheduleUpdate);
      visualViewport.removeEventListener("scroll", scheduleUpdate);
      if (headerRef.current) {
        headerRef.current.style.removeProperty("transform");
      }
    };
  }, []);

  const [league, setLeague] = useState<League | null>(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // tabs: Chat / Mini League Table / GW Picks / GW Results
  // Check URL parameter for initial tab (e.g., from notification deep link)
  const tabParam = searchParams.get('tab');
  const initialTab = tabParam === 'chat' ? 'chat-beta' : 'chat-beta';
  const [tab, setTab] = useState<"chat" | "chat-beta" | "mlt" | "gw" | "gwr">(initialTab);
  // Use ref to track manual tab selection immediately (synchronously) to prevent race conditions
  const manualTabSelectedRef = useRef(false);
  const manualGwSelectedRef = useRef(false);
  
  // Update tab when URL parameter changes (e.g., from notification deep link)
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab === 'chat' && tab !== 'chat-beta') {
      setTab('chat-beta');
      // Clear the parameter after setting the tab to avoid re-triggering
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, tab]);
  const headerRef = useRef<HTMLDivElement | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [currentGw, setCurrentGw] = useState<number | null>(null);
  const [latestResultsGw, setLatestResultsGw] = useState<number | null>(null);
  const [selectedGw, setSelectedGw] = useState<number | null>(null);
  const [availableGws, setAvailableGws] = useState<number[]>([]);

  // Ref to track current liveScores without causing re-renders
  const liveScoresRef = useRef<Record<number, { homeScore: number; awayScore: number; status: string; minute?: number | null }>>({});
  // Track previous positions for animation (using ref to persist across renders)
  const prevPositionsRef = useRef<Map<string, number>>(new Map());
  const [positionChangeKeys, setPositionChangeKeys] = useState<Set<string>>(new Set());
  const [showGwDropdown, setShowGwDropdown] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  // Track gw_results changes to trigger mini league table recalculation
  const [gwResultsVersion, setGwResultsVersion] = useState(0);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [showBadgeUpload, setShowBadgeUpload] = useState(false);
  const [uploadingBadge, setUploadingBadge] = useState(false);
  const [badgeUploadError, setBadgeUploadError] = useState<string | null>(null);
  const [badgeUploadSuccess, setBadgeUploadSuccess] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [showJoinConfirm, setShowJoinConfirm] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showEndLeagueConfirm, setShowEndLeagueConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [ending, setEnding] = useState(false);
  const [firstMember, setFirstMember] = useState<Member | null>(null);

  /* ----- Chat state ----- */
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [notificationStatus, setNotificationStatus] = useState<{ message: string; type: 'success' | 'warning' | 'error' | null } | null>(null);
  const isMember = useMemo(
    () => !!user?.id && members.some((m) => m.id === user.id),
    [user?.id, members]
  );
  const isAdmin = useMemo(
    () => !!user?.id && !!firstMember && firstMember.id === user.id,
    [user?.id, firstMember]
  );
  const adminName = useMemo(() => firstMember?.name ?? "League admin", [firstMember]);
  const memberNameById = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((x) => m.set(x.id, x.name));
    return m;
  }, [members]);

  const shareLeague = useCallback(() => {
    if (!league?.code) return;
    if (typeof window === "undefined" || typeof navigator === "undefined") return;

    const shareText = `Join my mini league "${league.name}" on TotL!`;
    const shareUrl = `${window.location.origin}/league/${league.code}`;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (typeof nav.share === "function") {
      nav
        .share({ title: `Join ${league.name}`, text: shareText, url: shareUrl })
        .catch((err) => {
          console.warn("[League] Share cancelled", err);
        });
      return;
    }

    const fallbackText = `${shareText}
${shareUrl}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(fallbackText)
        .then(() => window.alert?.("League link copied to clipboard!"))
        .catch(() => {
          window.prompt?.("Share this league code:", league.code);
        });
    } else {
      window.prompt?.("Share this league code:", league.code);
    }
  }, [league]);

  const leaveLeague = useCallback(async () => {
    if (!league?.id || !user?.id) return;
    setLeaving(true);
    try {
      const { error } = await supabase
        .from("league_members")
        .delete()
        .eq("league_id", league.id)
        .eq("user_id", user.id);
      if (error) throw error;
      if (typeof window !== "undefined") {
        window.location.href = "/leagues";
      }
    } catch (error: any) {
      console.error("[League] Error leaving league:", error);
      if (typeof window !== "undefined") {
        window.alert?.(error?.message ?? "Failed to leave league. Please try again.");
      }
    } finally {
      setLeaving(false);
      setShowLeaveConfirm(false);
    }
  }, [league?.id, user?.id]);

  const joinLeague = useCallback(async () => {
    if (!league?.id || !user?.id) return;
    setJoining(true);
    try {
      if (members.length >= MAX_MEMBERS) {
        if (typeof window !== "undefined") {
          window.alert?.("League is full (max 8 members).");
        }
        setShowJoinConfirm(false);
        return;
      }
      const { error } = await supabase
        .from("league_members")
        .insert({ league_id: league.id, user_id: user.id });
      if (error) throw error;
      
      // Send notification to other members
      const userName = user.user_metadata?.display_name || user.email || 'Someone';
      try {
        const response = await fetch('/.netlify/functions/notifyLeagueMemberJoin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leagueId: league.id,
            userId: user.id,
            userName: userName,
          }),
        });
        
        // Check if response has content before trying to parse JSON
        const text = await response.text();
        let result: any;
        try {
          result = text ? JSON.parse(text) : { error: 'Empty response body' };
        } catch (parseError) {
          console.error('[League] Failed to parse notification response. Status:', response.status, 'Text:', text, 'Error:', parseError);
          result = { error: 'Invalid JSON response', status: response.status, raw: text.substring(0, 200) };
        }
        
        if (!response.ok) {
          console.error('[League] Notification function returned error:', response.status, result);
        } else {
          console.log('[League] Join notification sent:', JSON.stringify({
            sent: result.sent,
            recipients: result.recipients,
            ok: result.ok,
            breakdown: result.breakdown,
          }, null, 2));
        }
      } catch (notifError) {
        // Non-critical - log but don't fail the join
        console.error('[League] Error sending join notification:', notifError);
      }
      
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (error: any) {
      console.error("[League] Error joining league:", error);
      if (typeof window !== "undefined") {
        window.alert?.(error?.message ?? "Failed to join league.");
      }
    } finally {
      setJoining(false);
    }
  }, [league?.id, user?.id, members.length]);

  const removeMember = useCallback(async () => {
    if (!memberToRemove || !league?.id || !user?.id) return;
    setRemoving(true);
    try {
      const { error } = await supabase
        .from("league_members")
        .delete()
        .eq("league_id", league.id)
        .eq("user_id", memberToRemove.id);
      if (error) throw error;
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (error: any) {
      console.error("[League] Error removing member:", error);
      if (typeof window !== "undefined") {
        window.alert?.(error?.message ?? "Failed to remove member.");
      }
    } finally {
      setRemoving(false);
      setShowRemoveConfirm(false);
      setMemberToRemove(null);
    }
  }, [league?.id, memberToRemove, user?.id]);

  const endLeague = useCallback(async () => {
    if (!league?.id || !user?.id) return;
    setEnding(true);
    try {
      const { error: membersError } = await supabase
        .from("league_members")
        .delete()
        .eq("league_id", league.id);
      if (membersError) throw membersError;

      const { error: leagueError } = await supabase
        .from("leagues")
        .delete()
        .eq("id", league.id);
      if (leagueError) throw leagueError;

      if (typeof window !== "undefined") {
        window.location.href = "/leagues";
      }
    } catch (error: any) {
      console.error("[League] Error ending league:", error);
      if (typeof window !== "undefined") {
        window.alert?.(error?.message ?? "Failed to end league.");
      }
    } finally {
      setEnding(false);
      setShowEndLeagueConfirm(false);
    }
  }, [league?.id, user?.id]);

  const createImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });
  };

  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('No 2d context');

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg', 0.9);
    });
  };

  const handleFileSelect = useCallback((file: File) => {
    if (!league?.id || !isMember) {
      setBadgeUploadError("You must be a member of the league to upload badges.");
      return;
    }

    const allowedTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      setBadgeUploadError("Please upload a PNG, JPG, or WebP image.");
      return;
    }

    // Allow larger files - we'll compress them client-side
    // Set a reasonable upper limit (e.g., 20MB) to prevent abuse
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_FILE_SIZE) {
      setBadgeUploadError("Please choose an image smaller than 20MB.");
      return;
    }

    // Optional: Show a warning for large files but still process them
    if (file.size > 5 * 1024 * 1024) {
      console.log(`[League] Processing large image (${(file.size / 1024 / 1024).toFixed(1)}MB) - will be optimized automatically`);
    }

    setBadgeUploadError(null);
    setBadgeUploadSuccess(false);
    
    // For very large files, pre-compress before showing crop UI for better performance
    if (file.size > 5 * 1024 * 1024) {
      // Pre-compress large images before cropping for better performance
      imageCompression(file, {
        maxSizeMB: 2, // Compress to max 2MB for crop UI
        maxWidthOrHeight: 1024, // Limit dimensions for crop UI
        useWebWorker: true,
        initialQuality: 0.7,
      }).then((compressed) => {
        const reader = new FileReader();
        reader.onload = () => {
          setCropImage(reader.result as string);
        };
        reader.readAsDataURL(compressed);
      }).catch((error) => {
        console.error('[League] Error pre-compressing image:', error);
        setBadgeUploadError("Failed to process image. Please try a smaller file.");
      });
    } else {
      // For smaller files, use directly
      const reader = new FileReader();
      reader.onload = () => {
        setCropImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [isMember, league?.id]);

  const onCropComplete = useCallback(async (_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
    
    // Create preview image
    if (cropImage) {
      try {
        const croppedBlob = await getCroppedImg(cropImage, croppedAreaPixels);
        const preview = URL.createObjectURL(croppedBlob);
        setPreviewUrl(preview);
      } catch (error) {
        console.error('[League] Error creating preview:', error);
      }
    }
  }, [cropImage]);

  const handleCropAndUpload = useCallback(async () => {
    if (!cropImage || !croppedAreaPixels || !league?.id || !isMember) {
      return;
    }

    setBadgeUploadError(null);
    setBadgeUploadSuccess(false);
    setUploadingBadge(true);

    try {
      // Get cropped image as blob
      const croppedBlob = await getCroppedImg(cropImage, croppedAreaPixels);
      
      // Convert blob to file
      const croppedFile = new File([croppedBlob], 'badge.jpg', { type: 'image/jpeg' });

      // Compress the cropped image
      const compressed = await imageCompression(croppedFile, {
        maxSizeMB: 0.02,
        maxWidthOrHeight: 256,
        useWebWorker: true,
        initialQuality: 0.8,
      });

      if (compressed.size > 20 * 1024) {
        throw new Error("Compressed image is still larger than 20KB. Try a smaller image.");
      }

      const fileName = `${league.id}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("league-avatars")
        .upload(fileName, compressed, {
          cacheControl: "3600",
          upsert: true,
          contentType: compressed.type,
        });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("league-avatars")
        .getPublicUrl(fileName);
      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) {
        throw new Error("Unable to get public URL for badge.");
      }

      const { error: updateError } = await supabase
        .from("leagues")
        .update({ avatar: publicUrl })
        .eq("id", league.id);
      if (updateError) throw updateError;

      setLeague((prev) => (prev ? { ...prev, avatar: publicUrl } : prev));
      setBadgeUploadSuccess(true);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setCropImage(null);
      setPreviewUrl(null);
      setShowBadgeUpload(false);
      
      // Invalidate league cache so home page shows updated badge immediately
      if (user?.id) {
        invalidateLeagueCache(user.id);
        // Dispatch event to trigger refresh on home page if it's open
        window.dispatchEvent(new CustomEvent('leagueBadgeUpdated', { detail: { leagueId: league.id, avatar: publicUrl } }));
      }
    } catch (error: any) {
      console.error("[League] Error uploading badge:", error);
      setBadgeUploadError(error?.message ?? "Failed to upload badge. Please try again.");
    } finally {
      setUploadingBadge(false);
    }
  }, [cropImage, croppedAreaPixels, isMember, league?.id, user?.id]);

  const handleRemoveBadge = useCallback(async () => {
    if (!league?.id || !isMember) return;
    setBadgeUploadError(null);
    setBadgeUploadSuccess(false);
    setUploadingBadge(true);
    try {
      const { error } = await supabase.from("leagues").update({ avatar: null }).eq("id", league.id);
      if (error) throw error;
      setLeague((prev) => (prev ? { ...prev, avatar: null } : prev));
      setBadgeUploadSuccess(true);
      
      // Invalidate league cache so home page shows updated badge immediately
      if (user?.id) {
        invalidateLeagueCache(user.id);
        // Dispatch event to trigger refresh on home page if it's open
        window.dispatchEvent(new CustomEvent('leagueBadgeUpdated', { detail: { leagueId: league.id, avatar: null } }));
      }
    } catch (error: any) {
      console.error("[League] Error removing badge:", error);
      setBadgeUploadError(error?.message ?? "Failed to remove badge. Please try again.");
    } finally {
      setUploadingBadge(false);
    }
  }, [isMember, league?.id]);

  // Store GW deadlines for synchronous access
  const [gwDeadlines, setGwDeadlines] = useState<Map<number, Date>>(new Map());
  
  // Calculate GW deadlines once when component loads
  useEffect(() => {
    (async () => {
      const deadlines = new Map<number, Date>();
      
      // Get all GWs that have fixtures (not just those with results)
      const { data: allGwData } = await supabase
        .from("app_fixtures")
        .select("gw, kickoff_time")
        .order("gw", { ascending: true });
      
      // Also get test fixtures for GW 1 (now in app_fixtures)
      const { data: testGwData } = await supabase
        .from("app_fixtures")
        .select("gw, kickoff_time")
        .eq("gw", 1)
        .order("fixture_index", { ascending: true });
      
      // Group by GW to find first kickoff for each GW
      const gwFirstKickoffs = new Map<number, string>();
      
      // Process regular fixtures
      if (allGwData) {
        allGwData.forEach((f: any) => {
          if (!gwFirstKickoffs.has(f.gw) || (f.kickoff_time && new Date(f.kickoff_time) < new Date(gwFirstKickoffs.get(f.gw)!))) {
            if (f.kickoff_time) {
              gwFirstKickoffs.set(f.gw, f.kickoff_time);
            }
          }
        });
      }
      
      // Process test fixtures for GW 1 (override regular GW 1 if test fixtures exist)
      if (testGwData && testGwData.length > 0) {
        const firstTestKickoff = testGwData.find(f => f.kickoff_time)?.kickoff_time;
        if (firstTestKickoff) {
          // Use test fixture kickoff for GW 1 if it's earlier than regular GW 1, or if regular GW 1 doesn't exist
          const existingGw1 = gwFirstKickoffs.get(1);
          if (!existingGw1 || new Date(firstTestKickoff) < new Date(existingGw1)) {
            gwFirstKickoffs.set(1, firstTestKickoff);
          }
        }
      }
      
      // Calculate deadline for each GW (75 minutes before first kickoff)
      gwFirstKickoffs.forEach((kickoffTime, gw) => {
        const firstKickoff = new Date(kickoffTime);
        const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000)); // 75 minutes before
        deadlines.set(gw, deadlineTime);
      });
      
      setGwDeadlines(deadlines);
    })();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showGwDropdown && !target.closest(".gw-dropdown-container")) {
        setShowGwDropdown(false);
      }
    };
    if (showGwDropdown) document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showGwDropdown]);

  /* ---------- load current GW and latest results GW ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: meta } = await supabase
        .from("app_meta")
        .select("current_gw")
        .eq("id", 1)
        .maybeSingle();
      if (!alive) return;
      setCurrentGw((meta as any)?.current_gw ?? null);

      const { data: rs } = await supabase
        .from("app_gw_results")
        .select("gw")
        .order("gw", { ascending: false })
        .limit(1);
      if (!alive) return;
      setLatestResultsGw((rs && rs.length ? (rs[0] as any).gw : null));

      const { data: allGws } = await supabase
        .from("app_gw_results")
        .select("gw")
        .order("gw", { ascending: false });
      if (!alive) return;
      const gwList = allGws ? [...new Set(allGws.map((r: any) => r.gw))].sort((a, b) => b - a) : [];
      
      // Include currentGw in availableGws if it's not already there (for live GWs without results yet)
      const currentGwValue = (meta as any)?.current_gw;
      if (currentGwValue && !gwList.includes(currentGwValue)) {
        gwList.unshift(currentGwValue); // Add to beginning (highest GW)
      }
      
      setAvailableGws(gwList);
      if (gwList.length > 0 && !selectedGw) setSelectedGw(gwList[0]);
    })();
    return () => {
      alive = false;
    };
  }, [gwResultsVersion]); // Re-run when app_gw_results changes

  // data for GW tabs
  const memberIds = useMemo(() => members.map((m) => m.id), [members]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [subs, setSubs] = useState<SubmissionRow[]>([]);
  const [results, setResults] = useState<ResultRowRaw[]>([]);

  // Get api_match_ids from fixtures for real-time subscription
  const apiMatchIds = useMemo(() => {
    if (!fixtures || fixtures.length === 0) return [];
    return fixtures
      .map(f => f.api_match_id)
      .filter((id): id is number => id !== null && id !== undefined);
  }, [fixtures]);

  // Subscribe to real-time live scores updates (replaces polling)
  const isApiTestLeague = useMemo(() => league?.name === 'API Test', [league?.name]);
  const [currentTestGw, setCurrentTestGw] = useState<number | null>(null);
  
  // Fetch current test GW for API Test league
  // Use current_test_gw from meta as primary source (supports GW T2, T3, etc.)
  useEffect(() => {
    if (!isApiTestLeague) {
      setCurrentTestGw(null);
      return;
    }
    
    let alive = true;
    (async () => {
      // Get current_test_gw from meta first
      const { data: testMetaData } = await supabase
        .from("test_api_meta")
        .select("current_test_gw")
        .eq("id", 1)
        .maybeSingle();
      
      let testGw = testMetaData?.current_test_gw ?? 1;
      
      // Verify that fixtures exist for this test_gw, otherwise fall back to GW T1
      if (testGw && testGw !== 1) {
        const { data: fixturesCheck } = await supabase
          .from("app_fixtures")
          .select("gw")
          .eq("gw", testGw)
          .limit(1)
          .maybeSingle();
        
        // If no fixtures for current_test_gw, fall back to GW T1
        if (!fixturesCheck) {
          const { data: t1Data } = await supabase
            .from("app_fixtures")
            .select("gw")
            .eq("gw", 1)
            .limit(1)
            .maybeSingle();
          
          if (t1Data) {
            testGw = 1; // Fallback to GW T1
          }
        }
      }
      
      if (alive) {
        setCurrentTestGw(testGw);
      }
    })();
    
    return () => {
      alive = false;
    };
  }, [isApiTestLeague]);
  
  const gwForSubscription = useMemo(() => {
    if (isApiTestLeague && currentTestGw !== null) return currentTestGw;
    // Prioritize currentGw for live scores subscription (it's the active/live GW)
    return currentGw || selectedGw || undefined;
  }, [isApiTestLeague, currentTestGw, currentGw, selectedGw]);
  
  const { liveScores: liveScoresMap } = useLiveScores(
    gwForSubscription,
    apiMatchIds.length > 0 ? apiMatchIds : undefined
  );

  // Convert Map to Record format for backward compatibility with existing code
  const liveScores = useMemo(() => {
    const result: Record<number, { homeScore: number; awayScore: number; status: string; minute?: number | null }> = {};
    if (!fixtures || fixtures.length === 0) return result;
    fixtures.forEach(fixture => {
      const apiMatchId = fixture.api_match_id;
      if (apiMatchId) {
        const liveScore = liveScoresMap.get(apiMatchId);
        if (liveScore) {
          result[fixture.fixture_index] = {
            homeScore: liveScore.home_score ?? 0,
            awayScore: liveScore.away_score ?? 0,
            status: liveScore.status || 'SCHEDULED',
            minute: liveScore.minute ?? null
          };
        }
      }
    });
    return result;
  }, [liveScoresMap, fixtures]);

  // MLT rows
  const [mltRows, setMltRows] = useState<MltRow[]>([]);
  const [mltLoading, setMltLoading] = useState(false);

  /* ---------- load league + members ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);

      const { data: lg } = await supabase
        .from("leagues")
        .select("id,name,code,created_at,avatar")
        .eq("code", code)
        .maybeSingle();

      if (!alive) return;
      if (!lg) {
        setLeague(null);
        setMembers([]);
        setLoading(false);
        return;
      }
      setLeague(lg as League);

      const { data: mm } = await supabase
        .from("league_members")
        .select("users(id,name),created_at")
        .eq("league_id", (lg as League).id)
        .order("created_at", { ascending: true });

      const mem: Member[] =
        (mm as any[])?.map((r) => ({
          id: r.users.id,
          name: r.users.name ?? "(no name)",
        })) ?? [];

      const memSorted = [...mem].sort((a, b) => a.name.localeCompare(b.name));
      setMembers(memSorted);

      const first = mem[0];
      setFirstMember(first);

      if (user?.id && !mem.some((m) => m.id === user.id)) {
        setShowJoinConfirm(true);
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [code]);

  /* ---------- Redirect to valid tab if current tab shouldn't be visible for this league ---------- */
  useEffect(() => {
    if (!league) return;
    
    // For now, we'll let users access all tabs and handle visibility within each tab component
    // The individual tab components will show appropriate messages if the GW shouldn't be visible
  }, [league, tab]);

  /* ---------- mark-as-read when viewing Chat or Chat Beta ---------- */
  useEffect(() => {
    if ((tab !== "chat" && tab !== "chat-beta") || !league?.id || !user?.id) return;
    const mark = async () => {
      await supabase
        .from("league_message_reads")
        .upsert(
          { league_id: league.id, user_id: user.id, last_read_at: new Date().toISOString() },
          { onConflict: "league_id,user_id" }
        );
    };
    mark();
  }, [tab, league?.id, user?.id]);

  // Helper function to load and merge messages (reusable)
  const loadAndMergeMessages = useCallback(async (leagueId: string, isInitialLoad = false) => {
    const { data, error } = await supabase
      .from("league_messages")
      .select("id, league_id, user_id, content, created_at")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: false })
      .limit(500);
    
    if (!error && data) {
      const fetchedMessages = (data as ChatMsg[]) ?? [];
      const sortedMessages = fetchedMessages.reverse();
      if (isInitialLoad) {
        console.log('[Chat] Loaded messages:', sortedMessages.length, 'from database (most recent)');
      }
      
      setChat((prev) => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMessages = sortedMessages.filter(m => !existingIds.has(m.id));
        
        if (prev.length === 0) {
          if (isInitialLoad) {
            console.log('[Chat] Initial load, setting', sortedMessages.length, 'messages');
          }
          return sortedMessages;
        }
        
        const combined = [...prev, ...newMessages];
        const sorted = combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const limited = sorted.length > 500 ? sorted.slice(-500) : sorted;
        
        if (isInitialLoad) {
          console.log('[Chat] Merged messages. Previous:', prev.length, 'New from DB:', newMessages.length, 'Total:', sorted.length, 'After limit:', limited.length);
        }
        return limited;
      });
    } else if (error) {
      console.error('[Chat] Error loading messages:', error);
    }
  }, []);

  /* ---------- realtime chat: load + subscribe ---------- */
  useEffect(() => {
    if (!league?.id) return;
    let alive = true;

    const loadMessages = async () => {
      if (!alive) return;
      await loadAndMergeMessages(league.id, true);
    };

    // Initial load
    loadMessages();

    const channel = supabase
      .channel(`league-messages:${league.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "league_messages",
          filter: `league_id=eq.${league.id}`,
        },
        (payload) => {
          const msg = payload.new as ChatMsg;
          console.log('[Chat] Realtime message received:', msg.id, msg.content.substring(0, 50));
          setChat((prev) => {
            if (prev.some((m) => m.id === msg.id)) {
              console.log('[Chat] Message already exists, skipping');
              return prev;
            }
            const updated = [...prev, msg];
            console.log('[Chat] Added realtime message. Total messages:', updated.length);
            return updated;
          });
        }
      )
      .subscribe();

    // Refetch messages when app comes to foreground (e.g., user taps push notification)
    // This ensures messages sent while app was in background are loaded
    const handleVisibilityChange = () => {
      if (!document.hidden && league?.id && alive) {
        console.log('[Chat] App became visible, refetching messages...');
        loadMessages();
      }
    };

    // Also refetch when window gains focus (similar to Home.tsx)
    const handleFocus = () => {
      if (league?.id && alive) {
        console.log('[Chat] Window gained focus, refetching messages...');
        loadMessages();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      alive = false;
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [league?.id]);

  /* ---------- send chat ---------- */
  const sendChat = useCallback(async () => {
    if (!league || !user?.id) return;
    const text = newMsg.trim();
    if (!text) return;
    setNewMsg("");
    const { data: inserted, error } = await supabase
      .from("league_messages")
      .insert({
        league_id: league.id,
        user_id: user.id,
        content: text,
      })
      .select("id, league_id, user_id, content, created_at")
      .single();
    if (error) {
      console.error(error);
      alert("Failed to send message.");
    } else if (inserted) {
      // Optimistic add so the message appears immediately; realtime will also append
      setChat((prev) => [...prev, inserted as ChatMsg]);
    }
    // Request push notifications to league members (exclude sender)
    // Skip in local development (Netlify Functions not available)
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalDev) {
      setTimeout(async () => {
        try {
          const senderName = user.user_metadata?.display_name || user.email || 'User';
          const response = await fetch('/.netlify/functions/notifyLeagueMessageV2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leagueId: league.id, senderId: user.id, senderName, content: text })
          });
          
          const result = await response.json().catch(() => ({}));
          
          // Set notification status based on response
          if (result.ok === true) {
            if (result.sent && result.sent > 0) {
              setNotificationStatus({
                message: `✓ Message sent to ${result.sent} device${result.sent === 1 ? '' : 's'}`,
                type: 'success'
              });
            } else if (result.message === 'No subscribed devices') {
              setNotificationStatus({
                message: `⚠️ No subscribed devices (${result.eligibleRecipients || 0} eligible recipient${result.eligibleRecipients === 1 ? '' : 's'})`,
                type: 'warning'
              });
            } else if (result.message === 'No devices') {
              setNotificationStatus({
                message: `⚠️ No devices registered (${result.eligibleRecipients || 0} eligible recipient${result.eligibleRecipients === 1 ? '' : 's'})`,
                type: 'warning'
              });
            } else if (result.message === 'No eligible recipients') {
              setNotificationStatus({
                message: '✓ All members are currently active',
                type: 'success'
              });
            } else {
              setNotificationStatus({
                message: `✓ ${result.message || 'Notification sent'}`,
                type: 'success'
              });
            }
          } else if (result.ok === false || result.error) {
            setNotificationStatus({
              message: `✗ Failed to send notification: ${result.error || 'Unknown error'}`,
              type: 'error'
            });
          } else if (!response.ok) {
            setNotificationStatus({
              message: `✗ Notification error (HTTP ${response.status})`,
              type: 'error'
            });
          }
          
          // Clear status after 5 seconds
          setTimeout(() => setNotificationStatus(null), 5000);
        } catch (err) {
          console.error('[Chat] Notification exception:', err);
          setNotificationStatus({
            message: '✗ Failed to send notification',
            type: 'error'
          });
          setTimeout(() => setNotificationStatus(null), 5000);
        }
      }, 100);
    }
  }, [league, user, newMsg, setNewMsg, setChat, setNotificationStatus]);

  /* ---------- load fixtures + picks + submissions + results for selected GW ---------- */
  useEffect(() => {
    let alive = true;

    (async () => {
      // Special handling for API Test league - use test_api_fixtures for current test GW
      // CRITICAL: Only use test API tables if league name is EXACTLY 'API Test'
      // All other leagues MUST use main database tables (fixtures, picks, gw_submissions)
      const isApiTestLeague = league?.name === 'API Test';
      
      // Fetch current test GW from meta table for API Test league
      // Use current_test_gw from meta as primary source (supports GW T2, T3, etc.)
      let testGwForData = currentTestGw ?? 1; // Use state if available, otherwise default to 1
      if (isApiTestLeague) {
        // Get current_test_gw from meta
        const { data: testMetaData } = await supabase
          .from("test_api_meta")
          .select("current_test_gw")
          .eq("id", 1)
          .maybeSingle();
        
        testGwForData = testMetaData?.current_test_gw ?? 1;
        
        // Verify that fixtures exist for this test_gw, otherwise fall back to GW T1
        if (testGwForData && testGwForData !== 1) {
          const { data: fixturesCheck } = await supabase
            .from("app_fixtures")
            .select("gw")
            .eq("gw", testGwForData)
            .limit(1)
            .maybeSingle();
          
          // If no fixtures for current_test_gw, fall back to GW T1
          if (!fixturesCheck) {
            const { data: t1Data } = await supabase
              .from("app_fixtures")
              .select("gw")
              .eq("gw", 1)
              .limit(1)
              .maybeSingle();
            
            if (t1Data) {
              testGwForData = 1; // Fallback to GW T1
              console.log('[League] No fixtures for current_test_gw, falling back to GW T1');
            }
          } else {
            console.log('[League] Using current_test_gw from meta:', testGwForData);
          }
        } else {
          console.log('[League] Using GW T1 or current_test_gw:', testGwForData);
        }
      }
      
      // For API Test league, only allow "gw" tab if all members have submitted
      // Check if all submitted for current test GW (we'll check this properly after loading submissions)
      const useTestFixtures = isApiTestLeague && (tab === "gw" || tab === "gwr");
      console.log('[League] Data fetch:', { 
        isApiTestLeague, 
        tab, 
        useTestFixtures, 
        leagueName: league?.name,
        testGwForData,
        willUseTestTables: useTestFixtures,
        willUseMainTables: !useTestFixtures
      });
      
      // For API Test league in predictions/results tabs, use current test GW
      // For "gwr" (Live Table/Results) tab, prioritize selectedGw if manually selected, otherwise currentGw, otherwise selectedGw
      // For "gw" (Predictions) tab, always use currentGw
      let gwForData = tab === "gwr" ? (manualGwSelectedRef.current ? selectedGw : (currentGw || selectedGw)) : tab === "gw" ? currentGw : currentGw;
      if (isApiTestLeague && (tab === "gw" || tab === "gwr")) {
        gwForData = testGwForData; // Use current test GW for API Test league
      }
      
      console.log('[League] gwForData calculation:', {
        tab,
        manualGwSelected: manualGwSelectedRef.current,
        selectedGw,
        currentGw,
        gwForData,
        isApiTestLeague
      });
      
      // For predictions tab with regular leagues, try to detect the GW from submissions
      // This ensures we show picks even if currentGw hasn't been updated yet or if members submitted for a different GW
      if (tab === "gw" && !isApiTestLeague && memberIds.length > 0) {
        // Get the most recent GW that members have submitted for
        const { data: submissionsCheck } = await supabase
          .from("app_gw_submissions")
          .select("gw")
          .in("user_id", memberIds)
          .not("submitted_at", "is", null)
          .order("gw", { ascending: false })
          .limit(10); // Check last 10 GWs
        
        // Try to find a GW that has both submissions AND fixtures
        if (submissionsCheck && submissionsCheck.length > 0) {
          const submittedGws = [...new Set(submissionsCheck.map(s => s.gw))].sort((a, b) => (b || 0) - (a || 0));
          
          for (const submittedGw of submittedGws) {
            if (submittedGw) {
              // Check if fixtures exist for this GW
              const { data: fixtureCheck } = await supabase
                .from("app_fixtures")
                .select("gw")
                .eq("gw", submittedGw)
                .limit(1);
              
              if (fixtureCheck && fixtureCheck.length > 0) {
                console.log('[League] Found fixtures for GW', submittedGw, 'from submissions - using this GW (currentGw was', gwForData, ')');
                gwForData = submittedGw;
                break; // Use the most recent GW with fixtures
              }
            }
          }
        }
        
        // If we still don't have a valid gwForData, use currentGw if it exists
        if (!gwForData && currentGw) {
          gwForData = currentGw;
          console.log('[League] Using currentGw as fallback:', currentGw);
        }
      }
      
      console.log('[League] gwForData:', gwForData, 'memberIds:', memberIds);
      
      if (!gwForData && !useTestFixtures) {
        setFixtures([]);
        setPicks([]);
        setSubs([]);
        setResults([]);
        return;
      }
      
      let fx;
      if (useTestFixtures) {
        // Fetch from test_api_fixtures for API Test league current test GW
        const { data: testFx } = await supabase
          .from("app_fixtures")
          .select(
            "id,test_gw,fixture_index,home_team,away_team,home_code,away_code,home_name,away_name,home_crest,away_crest,kickoff_time,api_match_id"
          )
          .eq("test_gw", testGwForData)
          .order("fixture_index", { ascending: true });
        // Map test_gw to gw for consistency
        fx = testFx?.map(f => ({ ...f, gw: f.test_gw })) || null;
      } else {
        // Regular fixtures - ALWAYS use main database table for non-API Test leagues
        // CRITICAL: Never use test_api_fixtures for regular leagues
        // Regular fixtures - ALWAYS use main database table for non-API Test leagues
        // CRITICAL: Never use test_api_fixtures for regular leagues
        // NOTE: fixtures table does NOT have api_match_id column (only test_api_fixtures has it)
        console.log('[League] Fetching from MAIN database table (app_fixtures) for regular league, GW:', gwForData);
        const { data: regularFx } = await supabase
          .from("app_fixtures")
          .select(
            "id,gw,fixture_index,home_team,away_team,home_code,away_code,home_name,away_name,kickoff_time,api_match_id"
          )
          .eq("gw", gwForData)
          .order("fixture_index", { ascending: true });
        
        fx = regularFx || null;
        console.log('[League] Fetched fixtures from main database:', regularFx?.length || 0, 'fixtures');
      }

      if (!alive) return;
      setFixtures((fx as Fixture[]) ?? []);

      if (!memberIds.length) {
        setPicks([]);
        setSubs([]);
        setResults([]);
        return;
      }

      // For API Test league, use test_api_picks and test_api_submissions
      let pk: PickRow[] | null = null;
      let submissions;
      
      if (useTestFixtures) {
        // Fetch from test_api_picks for API Test league current test GW
        const { data: testPicks } = await supabase
          .from("app_picks")
          .select("user_id,matchday,fixture_index,pick")
          .eq("matchday", testGwForData)
          .in("user_id", memberIds);
        // Map matchday to gw for consistency
        pk = testPicks?.map(p => ({ ...p, gw: p.matchday })) || null;
        
        // Fetch from test_api_submissions for API Test league current test GW
        // IMPORTANT: Only get submissions that have a non-null submitted_at (actually submitted)
        const { data: testSubs, error: testSubsError } = await supabase
          .from("app_gw_submissions")
          .select("user_id,matchday,submitted_at")
          .eq("matchday", testGwForData)
          .not("submitted_at", "is", null)  // CRITICAL: Only count submissions with non-null submitted_at
          .in("user_id", memberIds);
        if (testSubsError) {
          console.error('Error fetching test_api_submissions:', testSubsError);
        }
        
        // CRITICAL: Only count submissions if the user has picks for the CURRENT fixtures
        // This filters out old submissions from previous test runs (like Brazil picks)
        // Get the current fixtures with their teams to verify picks match actual teams, not just indices
        const { data: currentTestFixtures } = await supabase
          .from("app_fixtures")
          .select("fixture_index,home_team,away_team,home_code,away_code,kickoff_time")
          .eq("test_gw", testGwForData)
          .order("fixture_index", { ascending: true });
        
        const currentFixtureIndicesSet = new Set((currentTestFixtures || []).map(f => f.fixture_index));
        console.log('[League] Current fixture indices from test_api_fixtures:', Array.from(currentFixtureIndicesSet));
        console.log('[League] Current fixtures:', currentTestFixtures?.map(f => ({ index: f.fixture_index, home: f.home_team, away: f.away_team })));
        
        // Filter submissions: only count if user has picks for ALL current fixtures AND those picks match the actual teams
        // This ensures we don't count old submissions (like Brazil picks) even if they have matching fixture indices
        const validSubmissions: typeof testSubs = [];
        if (testSubs && pk && currentTestFixtures) {
          const requiredFixtureCount = currentFixtureIndicesSet.size;
          console.log('[League] Required fixture count for valid submission:', requiredFixtureCount);
          
          // Get the picks that were fetched - we need to match them against current fixtures
          // Note: We can't directly match teams from picks table, but we can verify:
          // 1. User has picks for ALL current fixture indices
          // 2. The submission timestamp is recent (after current fixtures were created)
          // For now, we'll require ALL picks match current fixture indices
          
          // Get the earliest kickoff time from current fixtures to determine cutoff date
          // Submissions before this date are from old test runs
          const currentFixtureKickoffs = (currentTestFixtures || [])
            .map(f => f.kickoff_time ? new Date(f.kickoff_time) : null)
            .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
          const earliestKickoff = currentFixtureKickoffs.length > 0 
            ? new Date(Math.min(...currentFixtureKickoffs.map(d => d.getTime())))
            : null;
          
          // Use a cutoff date: submissions must be after Nov 18, 2025 (when new fixtures were likely loaded)
          // We use Nov 18 as the cutoff because that's when the new Premier League fixtures were loaded
          // Old submissions from Nov 15 (Brazil picks) will be filtered out
          // Recent submissions from Nov 19+ (Carl, ThomasJamesBird) will be counted
          const cutoffDate = new Date('2025-11-18T00:00:00Z'); // Nov 18, 2025 - when new fixtures were loaded
          console.log('[League] Submission cutoff date (submissions before this are old):', cutoffDate.toISOString());
          console.log('[League] Earliest kickoff:', earliestKickoff?.toISOString());
          
          testSubs.forEach((sub) => {
            // Check if this user has picks for ALL current fixtures
            const userPicks = (pk || []).filter((p: PickRow) => p.user_id === sub.user_id && (p as any).matchday === testGwForData);
            const picksForCurrentFixtures = userPicks.filter((p: PickRow) => currentFixtureIndicesSet.has(p.fixture_index));
            const hasAllRequiredPicks = picksForCurrentFixtures.length === requiredFixtureCount && requiredFixtureCount > 0;
            
            // Additional check: verify the picks are for the right number of fixtures
            // If user has more picks than current fixtures, they might be old picks mixed with new ones
            const uniqueFixtureIndices = new Set(picksForCurrentFixtures.map((p: PickRow) => p.fixture_index));
            const hasExactMatch = uniqueFixtureIndices.size === requiredFixtureCount;
            
            // CRITICAL: Check if submission timestamp is recent (after cutoff date)
            // Old submissions from previous test runs (like Brazil picks) will be filtered out
            const submissionDate = sub.submitted_at ? new Date(sub.submitted_at) : null;
            const isRecentSubmission = submissionDate && submissionDate >= cutoffDate;
            
            if (hasAllRequiredPicks && hasExactMatch && isRecentSubmission) {
              validSubmissions.push(sub);
              console.log('[League] ✅ VALID submission (has picks for ALL current fixtures AND recent submission):', {
                user_id: sub.user_id,
                submitted_at: sub.submitted_at,
                submissionDate: submissionDate?.toISOString(),
                cutoffDate: cutoffDate.toISOString(),
                picksCount: userPicks.length,
                picksForCurrentFixtures: picksForCurrentFixtures.length,
                uniqueIndices: uniqueFixtureIndices.size,
                requiredCount: requiredFixtureCount
              });
            } else {
              const reasons = [];
              if (!hasAllRequiredPicks) reasons.push('missing picks');
              if (!hasExactMatch) reasons.push('duplicate/extra picks');
              if (!isRecentSubmission) reasons.push(`old submission (${submissionDate?.toISOString()} < ${cutoffDate.toISOString()})`);
              
              console.log('[League] ❌ INVALID submission:', {
                user_id: sub.user_id,
                submitted_at: sub.submitted_at,
                submissionDate: submissionDate?.toISOString(),
                cutoffDate: cutoffDate.toISOString(),
                picksCount: userPicks.length,
                picksForCurrentFixtures: picksForCurrentFixtures.length,
                uniqueIndices: uniqueFixtureIndices.size,
                requiredCount: requiredFixtureCount,
                hasAllRequired: hasAllRequiredPicks,
                hasExactMatch: hasExactMatch,
                isRecent: isRecentSubmission,
                reason: reasons.join(', ')
              });
            }
          });
        }
        
        // Map matchday to gw for consistency
        submissions = validSubmissions.map(s => ({ ...s, gw: s.matchday })) || null;
        console.log('[League] Test API submissions fetched (filtered to only current fixtures):', submissions);
        console.log('[League] Valid submissions count:', validSubmissions.length, 'out of', testSubs?.length || 0, 'total');
      } else {
        // Regular picks and submissions - ALWAYS use main database tables for non-API Test leagues
        // CRITICAL: Never use test_api_picks or test_api_submissions for regular leagues
        console.log('[League] Fetching from MAIN database tables (picks, gw_submissions) for regular league');
        const { data: regularPicks } = await supabase
          .from("app_picks")
          .select("user_id,gw,fixture_index,pick")
          .eq("gw", gwForData)
          .in("user_id", memberIds);
        pk = regularPicks;
        console.log('[League] Fetched picks from main database:', regularPicks?.length || 0, 'picks');
        
        const { data: regularSubs } = await supabase
          .from("app_gw_submissions")
          .select("user_id,gw,submitted_at")
          .eq("gw", gwForData)
          .in("user_id", memberIds);
        submissions = regularSubs;
        console.log('[League] Fetched submissions from main database:', regularSubs?.length || 0, 'submissions');
      }
      
      if (!alive) return;
      setPicks((pk as PickRow[]) ?? []);
      setSubs((submissions as SubmissionRow[]) ?? []);

      // For API Test league GW 1, results are stored with gw=1 (same as regular results)
      // We'll need to check if results exist for test fixtures specifically
      const { data: rs } = await supabase
        .from("app_gw_results")
        .select("gw,fixture_index,result")
        .eq("gw", useTestFixtures ? 1 : (gwForData || 0));
      if (!alive) return;
      setResults((rs as ResultRowRaw[]) ?? []);
    })();

    return () => {
      alive = false;
    };
  }, [tab, currentGw, latestResultsGw, selectedGw, memberIds]);

  // Fetch live scores from Football Data API
  // Fetch live score from Supabase ONLY (updated by scheduled Netlify function)
  // NO API calls from client - all API calls go through the scheduled function
  // NOTE: This function is no longer used - we use useLiveScores hook instead
  // const fetchLiveScore = async (apiMatchId: number, kickoffTime?: string | null) => {
  //   try {
  //     console.log('[League] fetchLiveScore called for matchId:', apiMatchId, 'kickoffTime:', kickoffTime);
  //     
  //     // Read from Supabase live_scores table (updated by scheduled Netlify function)
  //     const { data: liveScore, error } = await supabase
  //       .from('live_scores')
  //       .select('*')
  //       .eq('api_match_id', apiMatchId)
  //       .single();
  //     
  //     if (error) {
  //       if (error.code === 'PGRST116') {
  //         // No row found - scheduled function hasn't run yet or game hasn't started
  //         console.log('[League] No live score found in Supabase for match', apiMatchId, '- scheduled function may not have run yet');
  //         return null;
  //       }
  //       console.error('[League] Error fetching live score from Supabase:', error);
  //       return null;
  //     }
  //     
  //     if (!liveScore) {
  //       console.warn('[League] No live score data in Supabase');
  //       return null;
  //     }
  //     
  //     console.log('[League] Live score from Supabase:', liveScore);
  //     
  //     const homeScore = liveScore.home_score ?? 0;
  //     const awayScore = liveScore.away_score ?? 0;
  //     const status = liveScore.status || 'SCHEDULED';
  //     let minute = liveScore.minute;
  //     
  //     // If minute is not provided, calculate from kickoff time (fallback)
  //     if ((minute === null || minute === undefined) && (status === 'IN_PLAY' || status === 'PAUSED') && kickoffTime) {
  //       try {
  //         const matchStart = new Date(kickoffTime);
  //         const now = new Date();
  //         const diffMinutes = Math.floor((now.getTime() - matchStart.getTime()) / (1000 * 60));
  //         
  //         if (diffMinutes > 0 && diffMinutes < 120) {
  //           if (status === 'PAUSED') {
  //             minute = null;
  //           } else if (status === 'IN_PLAY') {
  //             if (diffMinutes <= 50) {
  //               minute = diffMinutes;
  //             } else {
  //               minute = 46 + Math.max(0, diffMinutes - 50);
  //             }
  //           }
  //         }
  //       } catch (e) {
  //         console.warn('[League] Error calculating minute from kickoff time:', e);
  //       }
  //     }
  //     
  //     const result = { homeScore, awayScore, status, minute, retryAfter: null as number | null };
  //     console.log('[League] Returning score data from Supabase:', result);
  //     return result;
  //   } catch (error: any) {
  //     console.error('[League] Error fetching live score from Supabase:', error?.message || error, error?.stack);
  //     return null;
  //   }
  // };

  // Sync ref with liveScores state whenever it changes
  useEffect(() => {
    liveScoresRef.current = liveScores;
  }, [liveScores]);

  // Real-time live scores are now handled by useLiveScores hook above
  // No polling needed - scores update instantly when Netlify writes to live_scores table

  const submittedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    console.log('[League] Building submittedMap from subs:', subs);
    subs.forEach((s) => {
      // Only count as submitted if submitted_at is not null
      if (s.submitted_at) {
        const key = `${s.user_id}:${s.gw}`;
        console.log(`[League] Adding submission key: ${key}`, s);
        m.set(key, true);
      } else {
        console.log(`[League] Skipping submission with null submitted_at:`, s);
      }
    });
    console.log('[League] Final submittedMap:', Array.from(m.entries()));
    return m;
  }, [subs]);

  // Helper to create empty MLT rows (reusable)
  const createEmptyMltRows = useCallback((memberList: Member[]): MltRow[] => {
    return memberList.map((m) => ({
      user_id: m.id,
      name: m.name,
      mltPts: 0,
      ocp: 0,
      unicorns: 0,
      wins: 0,
      draws: 0,
      form: [],
    }));
  }, []);

  /* ---------- Subscribe to gw_results changes for real-time table updates ---------- */
  useEffect(() => {
    // Subscribe to changes in app_gw_results table to trigger table recalculation and update available GWs
    const channel = supabase
      .channel('app-gw-results-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'app_gw_results',
        },
        () => {
          // Increment version to trigger recalculation and update available GWs
          setGwResultsVersion(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ---------- Compute Mini League Table (season) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!members.length) {
        setMltRows([]);
        return;
      }
      
      // Special handling for "API Test" league - it uses test API data, not regular game data
      if (league?.name === 'API Test') {
        // Show empty table with zero points for all members (test league starts fresh)
        setMltRows(createEmptyMltRows(members));
        setMltLoading(false);
        return;
      }
      
      // Don't calculate until we have currentGw loaded
      if (currentGw === null) {
        return;
      }
      
      setMltLoading(true);

      // Use app results for mini-league calculations (app data source)
      const { data: rs } = await supabase.from("app_gw_results").select("gw,fixture_index,result");
      const resultList = (rs as ResultRowRaw[]) ?? [];

      const outcomeByGwIdx = new Map<string, "H" | "D" | "A">();
      resultList.forEach((r) => {
        const out = rowToOutcome(r);
        if (!out) return;
        outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
      });

      if (outcomeByGwIdx.size === 0) {
        setMltRows(createEmptyMltRows(members));
        setMltLoading(false);
        return;
      }

      const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort(
        (a, b) => a - b
      );

      // Filter gameweeks to only include those from the league's start_gw onwards
      // Special leagues that should include all historical data (start from GW0)
      // Note: "API Test" is excluded - it uses test API data, not regular game data
      const specialLeagues = ['Prem Predictions', 'FC Football', 'Easy League'];
      const gw7StartLeagues = ['The Bird league'];
      
      const leagueStartGw = await getLeagueStartGw(league, currentGw);
      let relevantGws = gwsWithResults.filter(gw => gw >= leagueStartGw);
      
      // CRITICAL: Always exclude currentGw from form calculation if it's still live
      // A gameweek is complete only when it's less than currentGw (i.e., previous gameweeks)
      // Even if currentGw has some results in app_gw_results, it's still live until all games finish
      if (currentGw !== null) {
        relevantGws = relevantGws.filter(gw => gw < currentGw);
      }

      // For late-starting leagues, if there are no results for the start gameweek or later, show empty table
      if (!specialLeagues.includes(league?.name || '') && !gw7StartLeagues.includes(league?.name || '') && relevantGws.length === 0) {
        setMltRows(createEmptyMltRows(members));
        setMltLoading(false);
        return;
      }

      const { data: pk } = await supabase
        .from("app_picks")
        .select("user_id,gw,fixture_index,pick")
        .in("user_id", members.map((m) => m.id))
        .in("gw", relevantGws);
      const picksAll = (pk as PickRow[]) ?? [];

      type GwScore = { user_id: string; score: number; unicorns: number };
      const perGw = new Map<number, Map<string, GwScore>>();
      relevantGws.forEach((g) => {
        const map = new Map<string, GwScore>();
        members.forEach((m) => map.set(m.id, { user_id: m.id, score: 0, unicorns: 0 }));
        perGw.set(g, map);
      });

      relevantGws.forEach((g) => {
        const idxInGw = Array.from(outcomeByGwIdx.entries())
          .filter(([k]) => parseInt(k.split(":")[0], 10) === g)
          .map(([k, v]) => ({ idx: parseInt(k.split(":")[1], 10), out: v }));

        idxInGw.forEach(({ idx, out }) => {
          const thesePicks = picksAll.filter((p) => p.gw === g && p.fixture_index === idx);
          const correctUsers = thesePicks.filter((p) => p.pick === out).map((p) => p.user_id);

          const map = perGw.get(g)!;
          thesePicks.forEach((p) => {
            if (p.pick === out) {
              const row = map.get(p.user_id)!;
              row.score += 1;
            }
          });

          if (correctUsers.length === 1 && members.length >= 3) {
            const uid = correctUsers[0];
            const row = map.get(uid)!;
            row.unicorns += 1;
          }
        });
      });

      const mltPts = new Map<string, number>();
      const ocp = new Map<string, number>();
      const unis = new Map<string, number>();
      const wins = new Map<string, number>();
      const draws = new Map<string, number>();
      const form = new Map<string, ("W" | "D" | "L")[]>();
      members.forEach((m) => {
        mltPts.set(m.id, 0);
        ocp.set(m.id, 0);
        unis.set(m.id, 0);
        wins.set(m.id, 0);
        draws.set(m.id, 0);
        form.set(m.id, []);
      });

      relevantGws.forEach((g) => {
        const rows = Array.from(perGw.get(g)!.values());
        rows.forEach((r) => {
          ocp.set(r.user_id, (ocp.get(r.user_id) ?? 0) + r.score);
          unis.set(r.user_id, (unis.get(r.user_id) ?? 0) + r.unicorns);
        });

        rows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);
        if (!rows.length) return;

        const top = rows[0];
        const coTop = rows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);

        if (coTop.length === 1) {
          mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
          wins.set(top.user_id, (wins.get(top.user_id) ?? 0) + 1);
          form.get(top.user_id)!.push("W");
          rows.slice(1).forEach((r) => form.get(r.user_id)!.push("L"));
        } else {
          coTop.forEach((r) => {
            mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
            draws.set(r.user_id, (draws.get(r.user_id) ?? 0) + 1);
            form.get(r.user_id)!.push("D");
          });
          rows
            .filter((r) => !coTop.find((t) => t.user_id === r.user_id))
            .forEach((r) => form.get(r.user_id)!.push("L"));
        }
      });

      const rows: MltRow[] = members.map((m) => ({
        user_id: m.id,
        name: m.name,
        mltPts: mltPts.get(m.id) ?? 0,
        ocp: ocp.get(m.id) ?? 0,
        unicorns: unis.get(m.id) ?? 0,
        wins: wins.get(m.id) ?? 0,
        draws: draws.get(m.id) ?? 0,
        form: form.get(m.id) ?? [],
      }));

      rows.sort((a, b) => b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name));

      if (!alive) return;
      setMltRows(rows);
      setMltLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [members, league, currentGw, createEmptyMltRows, gwResultsVersion]);

  /* =========================
     Renderers
     ========================= */

  function MltTab() {

    // Check if this is a late-starting league (not one of the special leagues that start from GW0)
    // Note: "API Test" is excluded - it uses test API data, not regular game data
    const specialLeagues = ['Prem Predictions', 'FC Football', 'Easy League'];
    const gw7StartLeagues = ['The Bird league'];
    const gw8StartLeagues = ['gregVjofVcarl', 'Let Down'];
    const isLateStartingLeague = !!(league && !specialLeagues.includes(league.name) && !gw7StartLeagues.includes(league.name) && !gw8StartLeagues.includes(league.name));

    const rows = mltRows.length
      ? mltRows
      : members.map((m) => ({
          user_id: m.id,
          name: m.name,
          mltPts: 0,
          ocp: 0,
          unicorns: 0,
          wins: 0,
          draws: 0,
          form: [] as ("W" | "D" | "L")[],
        }));

    if (members.length === 1) {
      return (
        <div className="text-center p-8 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Invite at least one more user to make the ML start</h3>
          <p className="text-slate-600 mb-4">Share your league code with friends to get the competition going!</p>
          <button
            onClick={() => setShowInvite(true)}
            className="px-4 py-2 bg-[#1C8376] text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Share League Code
          </button>
        </div>
      );
    }

    return (
      <div className="pt-4">
        <MiniLeagueTable
          rows={rows}
          members={members}
          showForm={showForm}
          currentUserId={user?.id}
          loading={mltLoading}
          isLateStartingLeague={isLateStartingLeague}
        />

        <div className="mt-6 flex justify-between items-center">
          <div className="flex items-center justify-between w-full">
            <PointsFormToggle showForm={showForm} onToggle={setShowForm} />
            <button
              onClick={() => setShowTableModal(true)}
              className="flex items-center justify-center gap-1.5 bg-white border-2 border-slate-300 hover:bg-slate-50 rounded-full text-slate-600 hover:text-slate-800 cursor-help transition-colors flex-shrink-0 px-3 py-2"
            >
              <img 
                src="/assets/Icons/School--Streamline-Outlined-Material-Pr0_White.png" 
                alt="Rules" 
                className="w-4 h-4"
                style={{ filter: 'invert(40%) sepia(8%) saturate(750%) hue-rotate(180deg) brightness(95%) contrast(88%)' }}
              />
              <span className="text-sm font-medium">Rules</span>
            </button>
          </div>
        </div>

        {league?.name === 'API Test' && (
          <div className="mt-4" style={{ marginLeft: '-1rem', marginRight: '-1rem', width: 'calc(100% + 2rem)', paddingLeft: 0, paddingRight: 0 }}>
            <video 
              src="/assets/Animation/Unicorn_Small.mov" 
              autoPlay 
              loop 
              muted 
              playsInline
              style={{ width: '100%', height: 'auto', display: 'block', padding: 0, margin: 0 }}
            />
          </div>
        )}
      </div>
    );
  }

  function GwPicksTab() {
    const picksGw = league?.name === 'API Test' ? (currentTestGw ?? 1) : currentGw;
    if (!picksGw) {
      return <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-600">No current gameweek available.</div>;
    }

    // Check if this specific GW should be shown for this league
    if (!shouldIncludeGwForLeague(league, picksGw, gwDeadlines)) {
      return (
        <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-600">
          <div className="text-center">
            <div className="text-lg font-semibold mb-2">No Predictions Available</div>
            <div className="text-sm">This league started from a later gameweek.</div>
            <div className="text-sm">GW{picksGw} predictions are not included in this league.</div>
          </div>
        </div>
      );
    }

    const outcomes = new Map<number, "H" | "D" | "A">();
    
    // First, populate from database results
    results.forEach((r) => {
      if (r.gw !== picksGw) return;
      const out = rowToOutcome(r);
      if (!out) return;
      outcomes.set(r.fixture_index, out);
    });
    
    // Then, update with live scores for fixtures that are live or finished
    // This ensures correct picks are shown even when results aren't in the database yet
    fixtures.forEach((f) => {
      if (f.gw !== picksGw) return;
      const liveScore = liveScores[f.fixture_index];
      if (liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED')) {
        // Determine outcome from live score
        if (liveScore.homeScore > liveScore.awayScore) {
          outcomes.set(f.fixture_index, 'H');
        } else if (liveScore.awayScore > liveScore.homeScore) {
          outcomes.set(f.fixture_index, 'A');
        } else {
          outcomes.set(f.fixture_index, 'D');
        }
      }
    });

    const sections = useMemo(() => {
      const fmt = (iso?: string | null) => {
        if (!iso) return "Fixtures";
        const d = new Date(iso);
        if (isNaN(d.getTime())) return "Fixtures";
        return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      };
      const buckets = new Map<string, { label: string; key: number; items: Fixture[] }>();
      fixtures
        .filter((f) => f.gw === picksGw)
        .forEach((f) => {
          const label = fmt(f.kickoff_time);
          const key = f.kickoff_time ? new Date(f.kickoff_time).getTime() : Number.MAX_SAFE_INTEGER;
          if (!buckets.has(label)) buckets.set(label, { label, key, items: [] });
          buckets.get(label)!.items.push(f);
        });
      const out = Array.from(buckets.values());
      out.forEach((b) => b.items.sort((a, b) => a.fixture_index - b.fixture_index));
      out.sort((a, b) => a.key - b.key);
      return out;
    }, [fixtures, picksGw]);

    // Get current fixture indices to filter out old picks (e.g., old Brazil picks)
    // For API Test league, we need to be extra careful - only include picks that match EXACTLY
    const currentFixtureIndices = new Set(fixtures.filter(f => f.gw === picksGw).map(f => f.fixture_index));
    
    // Check if this is API Test league (used throughout this function)
    const isApiTestLeague = league?.name === 'API Test';
    
    // Calculate allSubmitted FIRST - we need this before processing picks
    const allSubmitted = members.length > 0 && members.every((m) => submittedMap.get(`${m.id}:${picksGw}`));
    
    // Debug logging for API Test league
    if (isApiTestLeague && picksGw === (currentTestGw ?? 1)) {
      console.log('[League] API Test filtering:', {
        currentFixtureIndices: Array.from(currentFixtureIndices),
        totalPicks: picks.length,
        picksForGw: picks.filter(p => p.gw === picksGw).length,
        submittedMapSize: submittedMap.size,
        allSubmitted,
        members: members.map(m => ({ id: m.id, name: m.name, submitted: submittedMap.get(`${m.id}:${picksGw}`) })),
        fixturesCount: fixtures.filter(f => f.gw === picksGw).length
      });
      
      // Log all picks to see what we're dealing with
      const allPicksForGw = picks.filter(p => p.gw === picksGw);
      console.log(`[League] All picks for GW${picksGw}:`, allPicksForGw.map(p => ({
        user_id: p.user_id,
        userName: members.find(m => m.id === p.user_id)?.name,
        fixture_index: p.fixture_index,
        pick: p.pick,
        hasSubmitted: !!submittedMap.get(`${p.user_id}:${picksGw}`),
        inCurrentFixtures: currentFixtureIndices.has(p.fixture_index)
      })));
    }
    
    const picksByFixture = new Map<number, PickRow[]>();
    
    // For API Test league, if not all submitted, don't process ANY picks - they shouldn't be shown
    if (!isApiTestLeague || allSubmitted) {
      picks.forEach((p) => {
        if (p.gw !== picksGw) return;
        
        // CRITICAL: Only include picks from users who have submitted (confirmed) their predictions
        // This applies to ALL leagues - if someone didn't submit, don't show their picks
        const hasSubmitted = submittedMap.get(`${p.user_id}:${picksGw}`);
        if (!hasSubmitted) {
          if (isApiTestLeague && picksGw === 1) {
            console.log('[League] API Test: Filtering out unsubmitted pick:', { user_id: p.user_id, fixture_index: p.fixture_index, userName: members.find(m => m.id === p.user_id)?.name });
          }
          return;
        }
        
        // CRITICAL: Only include picks for current fixtures (filter out old picks like Brazil)
        // This ensures we don't show picks from previous test runs
        if (!currentFixtureIndices.has(p.fixture_index)) {
          if (isApiTestLeague && picksGw === 1) {
            console.log('[League] Filtering out old pick (not in current fixtures):', { 
              fixture_index: p.fixture_index, 
              currentIndices: Array.from(currentFixtureIndices),
              userName: members.find(m => m.id === p.user_id)?.name
            });
          }
          return;
        }
        
        const arr = picksByFixture.get(p.fixture_index) ?? [];
        arr.push(p);
        picksByFixture.set(p.fixture_index, arr);
      });
    } else {
      console.log('[League] API Test: Not all submitted - skipping ALL picks processing. allSubmitted=', allSubmitted);
    }
    const resultsPublished = latestResultsGw !== null && latestResultsGw >= picksGw;
    const remaining = members.filter((m) => !submittedMap.get(`${m.id}:${picksGw}`)).length;
    const whoDidntSubmit = members.filter((m) => !submittedMap.get(`${m.id}:${picksGw}`)).map(m => m.name);
    
    // Check if deadline has passed for this GW
    const gwDeadline = gwDeadlines.get(picksGw);
    const deadlinePassed = gwDeadline ? new Date() >= gwDeadline : false;
    
    // Debug logging for API Test league
    if (isApiTestLeague && picksGw === 1) {
      const memberSubmissionStatus = members.map(m => {
        const key = `${m.id}:${picksGw}`;
        const submitted = submittedMap.get(key);
        return { id: m.id, name: m.name, submitted: !!submitted, key };
      });
      console.log(`[League] ===== API Test GW${picksGw} SUBMISSION CHECK =====`);
      console.log(`[League] All submitted:`, allSubmitted);
      console.log(`[League] Remaining:`, remaining);
      console.log(`[League] Who didn't submit:`, whoDidntSubmit);
      console.log(`[League] Member submission status:`, memberSubmissionStatus);
      console.log(`[League] Submitted map entries:`, Array.from(submittedMap.entries()));
      console.log(`[League] ================================================`);
      
      // Specifically check for Steve and Jof
      const steve = members.find(m => m.name.toLowerCase().includes('steve') || m.name.toLowerCase().includes('s'));
      const jof = members.find(m => m.name.toLowerCase().includes('jof') || m.name.toLowerCase().includes('j'));
      if (steve) {
        const steveKey = `${steve.id}:${picksGw}`;
        console.log(`[League] STEVE (${steve.name}):`, { id: steve.id, submitted: !!submittedMap.get(steveKey), key: steveKey });
      }
      if (jof) {
        const jofKey = `${jof.id}:${picksGw}`;
        console.log(`[League] JOF (${jof.name}):`, { id: jof.id, submitted: !!submittedMap.get(jofKey), key: jofKey });
      }
    }
    
    console.log(`GW${picksGw} deadline check:`, {
      gwDeadline,
      now: new Date(),
      deadlinePassed,
      allSubmitted,
      willShowPredictions: allSubmitted || deadlinePassed
    });

    // For API Test league, show submission status only if not all submitted
    // Also show it if user is on "gw" tab but not all submitted (they should see "Who's submitted" instead of predictions)
    const showSubmissionStatus = isApiTestLeague 
      ? !allSubmitted  // Always show "Who's submitted" if not all submitted, regardless of tab
      : (!allSubmitted && !deadlinePassed);

    // For ALL leagues, if not all submitted (and deadline hasn't passed for regular leagues), ONLY show "Who's submitted" view, nothing else
    // This is CRITICAL - no predictions/fixtures should show if not all submitted
    const shouldShowWhoSubmitted = isApiTestLeague ? !allSubmitted : (!allSubmitted && !deadlinePassed);
    
    if (shouldShowWhoSubmitted) {
      console.log('[League] Not all submitted, showing ONLY "Who\'s submitted" view. Blocking all predictions/fixtures.', {
        isApiTestLeague,
        allSubmitted,
        deadlinePassed,
        remaining
      });
      return (
        <SubmissionStatusTable
          members={members}
          submittedMap={submittedMap}
          picksGw={picksGw}
          allSubmitted={allSubmitted}
          remaining={remaining}
          fixtures={fixtures.filter(f => f.gw === picksGw)}
          variant="compact"
        />
      );
    }

    return (
      <div className="mt-2 pt-2">

        {showSubmissionStatus ? (
          <SubmissionStatusTable
            members={members}
            submittedMap={submittedMap}
            picksGw={picksGw}
            allSubmitted={allSubmitted}
            remaining={remaining}
            fixtures={fixtures.filter(f => f.gw === picksGw)}
            variant="full"
          />
        ) : null}

        {/* API Test league "who picked who" view when all submitted - ONLY show if all submitted */}
        {league?.name === 'API Test' && allSubmitted && sections.length > 0 && !showSubmissionStatus && (() => {
          // Check if any games are live or finished - match Home page logic exactly
          const fixturesToCheck = sections.flatMap(sec => sec.items);
          // Create a Set of fixture_indices for quick lookup
          const currentFixtureIndices = new Set(fixturesToCheck.map(f => f.fixture_index));
          
          // Filter liveScores to only include scores for fixtures in current GW
          const filteredLiveScores: Record<number, { homeScore: number; awayScore: number; status: string; minute?: number | null }> = {};
          Object.keys(liveScores).forEach(key => {
            const fixtureIndex = parseInt(key, 10);
            if (currentFixtureIndices.has(fixtureIndex)) {
              filteredLiveScores[fixtureIndex] = liveScores[fixtureIndex];
            }
          });
          
          const hasLiveGames = fixturesToCheck.some(f => {
            const score = filteredLiveScores[f.fixture_index];
            return score && (score.status === 'IN_PLAY' || score.status === 'PAUSED');
          });
          const allGamesFinished = fixturesToCheck.length > 0 && fixturesToCheck.every(f => {
            const score = filteredLiveScores[f.fixture_index];
            return score && score.status === 'FINISHED';
          });
          const hasStarted = hasLiveGames || allGamesFinished || fixturesToCheck.some(f => filteredLiveScores[f.fixture_index]);
          
          // Count live fixtures where user has correct predictions (matches Home page logic)
          let liveFixturesCount = 0;
          if (user?.id) {
            fixturesToCheck.forEach(f => {
              const liveScore = filteredLiveScores[f.fixture_index];
              const isLive = liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
              const isFinished = liveScore && liveScore.status === 'FINISHED';
              
              if (liveScore && (isLive || isFinished)) {
                const userPicks = picksByFixture.get(f.fixture_index) ?? [];
                const userPick = userPicks.find(p => p.user_id === user.id);
                
                if (userPick) {
                  let isCorrect = false;
                  if (userPick.pick === 'H' && liveScore.homeScore > liveScore.awayScore) isCorrect = true;
                  else if (userPick.pick === 'A' && liveScore.awayScore > liveScore.homeScore) isCorrect = true;
                  else if (userPick.pick === 'D' && liveScore.homeScore === liveScore.awayScore) isCorrect = true;
                  
                  if (isCorrect) {
                    liveFixturesCount++;
                  }
                }
              }
            });
          }
          
          return (
            <div className="mt-3 space-y-6">
              {sections.map((sec, si) => (
                <LeagueFixtureSection
                  key={si}
                  label={sec.label}
                  fixtures={sec.items}
                  picksByFixture={picksByFixture}
                  members={members}
                  outcomes={outcomes}
                  liveScores={filteredLiveScores}
                  submittedMap={submittedMap}
                  picksGw={picksGw}
                  isApiTestLeague={true}
                  isFirstSection={si === 0}
                  hasLiveGames={hasLiveGames}
                  allGamesFinished={allGamesFinished}
                  hasStarted={hasStarted}
                  liveFixturesCount={liveFixturesCount}
                />
              ))}
            </div>
          );
        })()}

        {/* Regular league predictions view - NEVER show for API Test league (it has its own view above) */}
        {sections.length > 0 && league?.name !== 'API Test' && (
          <div className="mt-3 space-y-6">
            {sections.map((sec, si) => (
              <LeagueFixtureSection
                key={si}
                label={sec.label}
                fixtures={sec.items}
                picksByFixture={picksByFixture}
                members={members}
                outcomes={outcomes}
                liveScores={liveScores}
                submittedMap={submittedMap}
                picksGw={picksGw}
                isApiTestLeague={false}
                isFirstSection={si === 0}
                allSubmitted={allSubmitted}
                resultsPublished={resultsPublished}
                deadlinePassed={deadlinePassed}
                whoDidntSubmit={whoDidntSubmit}
              />
            ))}
          </div>
        )}

        {!sections.length && !showSubmissionStatus && (
          <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-500">No fixtures for GW {picksGw}.</div>
        )}

      </div>
    );
  }

  function GwResultsTab() {
    // For Live Table tab, prioritize currentGw (the active/live GW) over selectedGw
    // UNLESS the user has manually selected a GW, in which case use selectedGw
    // For other tabs, use selectedGw
    const resGw = league?.name === 'API Test' 
      ? (currentTestGw ?? 1) 
      : (tab === "gwr" ? (manualGwSelectedRef.current ? selectedGw : (currentGw || selectedGw)) : selectedGw);
    
    if (!resGw || (availableGws.length === 0 && league?.name !== 'API Test')) {
      return <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-600">No gameweek selected.</div>;
    }

    // Check if this specific GW should be shown for this league
    if (!shouldIncludeGwForLeague(league, resGw, gwDeadlines)) {
      return (
        <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4 text-slate-600">
          <div className="text-center">
            <div className="text-lg font-semibold mb-2">No Results Available</div>
            <div className="text-sm">This league started from a later gameweek.</div>
            <div className="text-sm">GW{resGw} results are not included in this league.</div>
          </div>
        </div>
      );
    }

    const outcomes = new Map<number, "H" | "D" | "A">();
    const isApiTestLeague = league?.name === 'API Test';
    
    // Filter fixtures to only those for the selected GW
    const fixturesForGw = fixtures.filter((f: any) => f.gw === resGw);
    
    // Check if this GW is live (has live or finished games) - only check fixtures for this GW
    const hasLiveScores = fixturesForGw.some((f: any) => {
      const liveScore = liveScores[f.fixture_index];
      return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED');
    });
    
    console.log('[League] Live Table calculation:', {
      resGw,
      currentGw,
      selectedGw,
      hasLiveScores,
      liveScoresCount: Object.keys(liveScores).length,
      isApiTestLeague,
      fixturesCount: fixtures.length,
      fixturesForGwCount: fixturesForGw.length,
      manualGwSelected: manualGwSelectedRef.current
    });
    
    // For API Test league, ONLY use live scores (ignore database results)
    // For regular leagues, use live scores if GW is live, otherwise use results
    if (isApiTestLeague && resGw === (currentTestGw ?? 1)) {
      // Check live scores for fixtures in this GW - count both live and finished fixtures
      fixturesForGw.forEach((f: any) => {
        const liveScore = liveScores[f.fixture_index];
        if (liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED')) {
          // Determine outcome from live score
          if (liveScore.homeScore > liveScore.awayScore) {
            outcomes.set(f.fixture_index, 'H');
          } else if (liveScore.awayScore > liveScore.homeScore) {
            outcomes.set(f.fixture_index, 'A');
          } else {
            outcomes.set(f.fixture_index, 'D');
          }
        }
      });
      // DO NOT fill in from results - only count live/finished fixtures
    } else if (hasLiveScores && resGw === currentGw) {
      // Regular league with live GW - use live scores
      console.log('[League] Using live scores for regular league GW', resGw);
      fixturesForGw.forEach((f: any) => {
        const liveScore = liveScores[f.fixture_index];
        if (liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED')) {
          // Determine outcome from live score
          if (liveScore.homeScore > liveScore.awayScore) {
            outcomes.set(f.fixture_index, 'H');
          } else if (liveScore.awayScore > liveScore.homeScore) {
            outcomes.set(f.fixture_index, 'A');
          } else {
            outcomes.set(f.fixture_index, 'D');
          }
        }
      });
      console.log('[League] Outcomes from live scores:', Array.from(outcomes.entries()));
    } else {
      // Regular league - use results (for past GWs)
      console.log('[League] Using results table for GW', resGw, {
        hasLiveScores,
        resGwEqualsCurrentGw: resGw === currentGw,
        resultsCount: results.length,
        resultsForThisGw: results.filter(r => r.gw === resGw).length,
        manualGwSelected: manualGwSelectedRef.current,
        selectedGw
      });
      results.forEach((r) => {
        if (r.gw !== resGw) return;
        const out = rowToOutcome(r);
        if (!out) return;
        outcomes.set(r.fixture_index, out);
      });
      console.log('[League] Outcomes from results:', Array.from(outcomes.entries()));
    }

    type Row = { user_id: string; name: string; score: number; unicorns: number };
    // CRITICAL: Only include members who have submitted for this GW
    // Filter out members who didn't submit (like Dan Gray in the user's example)
    const rows: Row[] = members
      .filter((m) => submittedMap.get(`${m.id}:${resGw}`))
      .map((m) => ({ user_id: m.id, name: m.name, score: 0, unicorns: 0 }));

    const picksByFixture = new Map<number, PickRow[]>();
    picks.forEach((p) => {
      if (p.gw !== resGw) return;
      // Also filter picks to only include from users who submitted
      if (!submittedMap.get(`${p.user_id}:${resGw}`)) return;
      const arr = picksByFixture.get(p.fixture_index) ?? [];
      arr.push(p);
      picksByFixture.set(p.fixture_index, arr);
    });

    Array.from(outcomes.entries()).forEach(([idx, out]) => {
      const these = picksByFixture.get(idx) ?? [];
      const correctIds = these.filter((p) => p.pick === out).map((p) => p.user_id);

      correctIds.forEach((uid) => {
        const r = rows.find((x) => x.user_id === uid)!;
        r.score += 1;
      });

      if (correctIds.length === 1 && members.length >= 3) {
        const r = rows.find((x) => x.user_id === correctIds[0])!;
        r.unicorns += 1;
      }
    });

    rows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns || a.name.localeCompare(b.name));

    // Detect position changes and trigger animations (using useEffect to handle state updates)
    useEffect(() => {
      if (rows.length === 0) return;
      
      const currentPositions = new Map<string, number>();
      rows.forEach((r, index) => {
        currentPositions.set(r.user_id, index);
      });
      
      const changedKeys = new Set<string>();
      currentPositions.forEach((newPos, userId) => {
        const oldPos = prevPositionsRef.current.get(userId);
        if (oldPos !== undefined && oldPos !== newPos) {
          changedKeys.add(userId);
        }
      });
      
      // Update previous positions in ref
      prevPositionsRef.current = currentPositions;
      
      // Trigger animation for changed positions
      if (changedKeys.size > 0) {
        setPositionChangeKeys(changedKeys);
        // Clear animation after it completes
        const timeout = setTimeout(() => {
          setPositionChangeKeys(new Set());
        }, 2000);
        return () => clearTimeout(timeout);
      }
    }, [rows.map(r => `${r.user_id}-${r.score}-${r.unicorns}`).join(',')]);

    // Check if all fixtures have finished
    let allFixturesFinished = false;
    let hasLiveFixtures = false;
    let hasStartingSoonFixtures = false;
    let hasStartedFixtures = false; // Track if at least one game has started
    if (isApiTestLeague && resGw === (currentTestGw ?? 1)) {
      // For API Test league, check if all fixtures (first 3) have finished
      const fixturesToCheck = fixtures;
      if (fixturesToCheck.length > 0) {
        allFixturesFinished = fixturesToCheck.every((f: any) => {
          const liveScore = liveScores[f.fixture_index];
          // Check if fixture has finished status
          return liveScore && liveScore.status === 'FINISHED';
        });
        // Check if any fixtures are live
        const firstLiveFixture = fixturesToCheck.find((f: any) => {
          const liveScore = liveScores[f.fixture_index];
          return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
        });
        hasLiveFixtures = !!firstLiveFixture;
        // Check if at least one fixture has started (live or finished)
        hasStartedFixtures = fixturesToCheck.some((f: any) => {
          const liveScore = liveScores[f.fixture_index];
          return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED');
        });
        // Check if any fixtures are starting soon (within 24 hours of kickoff but not started)
        // Only show if not all fixtures are finished
        if (!allFixturesFinished) {
          const now = new Date();
          hasStartingSoonFixtures = fixturesToCheck.some((f: any) => {
            if (!f.kickoff_time) return false;
            const kickoffTime = new Date(f.kickoff_time);
            const timeUntilKickoff = kickoffTime.getTime() - now.getTime();
            // Starting soon if kickoff is in the future and within 24 hours
            // Also check that there's no live score (meaning it hasn't started)
            const liveScore = liveScores[f.fixture_index];
            const hasNotStarted = !liveScore || (liveScore.status !== 'IN_PLAY' && liveScore.status !== 'PAUSED' && liveScore.status !== 'FINISHED');
            return hasNotStarted && timeUntilKickoff > 0 && timeUntilKickoff <= 24 * 60 * 60 * 1000;
          });
        }
      }
    } else {
      // For regular leagues, check if all fixtures have results
      const fixturesForGw = fixtures.filter(f => f.gw === resGw);
      if (fixturesForGw.length > 0) {
        // Check if all fixtures have results in outcomes map
        const allHaveResults = fixturesForGw.every(f => outcomes.has(f.fixture_index));
        
        // Check if there are any active games (IN_PLAY or PAUSED)
        const hasActiveGames = fixturesForGw.some((f: any) => {
          const liveScore = liveScores[f.fixture_index];
          return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
        });
        
        // GW is finished if:
        // 1. All fixtures have results (outcomes map has all fixture indices)
        // 2. No active games (no IN_PLAY or PAUSED status)
        // If results are published, we trust that the GW has finished
        allFixturesFinished = allHaveResults && !hasActiveGames;
        
        console.log(`[League] GW ${resGw} finished check:`, {
          allHaveResults,
          hasActiveGames,
          fixturesCount: fixturesForGw.length,
          outcomesCount: fixturesForGw.filter(f => outcomes.has(f.fixture_index)).length,
          allFixturesFinished
        });
      }
    }

    return (
      <div>
        <style>{`
          @keyframes flash {
            0%, 100% {
              background-color: rgb(209, 250, 229);
            }
            25% {
              background-color: rgb(167, 243, 208);
            }
            50% {
              background-color: rgb(209, 250, 229);
            }
            75% {
              background-color: rgb(167, 243, 208);
            }
          }
          @keyframes pulse-score {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.7;
            }
          }
          @keyframes position-change {
            0% {
              background-color: rgb(254, 243, 199);
            }
            50% {
              background-color: rgb(253, 230, 138);
            }
            100% {
              background-color: transparent;
            }
          }
          .flash-user-row {
            animation: flash 1.5s ease-in-out 3;
          }
          .pulse-live-score {
            animation: pulse-score 2s ease-in-out infinite;
          }
          .position-changed {
            animation: position-change 1.5s ease-out;
          }
          .full-width-header-border::after {
            content: '';
            position: absolute;
            left: -1rem;
            right: -1rem;
            bottom: 0;
            height: 1px;
            background-color: #cbd5e1;
            z-index: 1;
          }
        `}</style>
        
        {/* SP Wins Banner - only show when all fixtures have finished AND GW is not still live */}
        {rows.length > 0 && allFixturesFinished && (
          <WinnerBanner 
            winnerName={rows[0].name} 
            isDraw={rows[0].score === rows[1]?.score && rows[0].unicorns === rows[1]?.unicorns}
          />
        )}

        {/* Table */}
        <ResultsTable
          rows={rows}
          members={members}
          currentUserId={user?.id}
          positionChangeKeys={positionChangeKeys}
          isApiTestLeague={isApiTestLeague}
          hasLiveFixtures={hasLiveFixtures}
          hasStartingSoonFixtures={hasStartingSoonFixtures}
          hasStartedFixtures={hasStartedFixtures}
          allFixturesFinished={allFixturesFinished}
          resGw={resGw}
        />

        {/* GW Selector and Rules Button */}
        {availableGws.length > 1 && (
          <div className="mt-6 mb-4 flex flex-col items-center gap-3 px-4">
            <div className="flex items-center justify-center gap-3 w-full max-w-sm">
              <GwSelector 
                availableGws={availableGws}
                selectedGw={resGw}
                onChange={(newGw) => {
                  manualGwSelectedRef.current = true; // Mark as manually selected
                  setSelectedGw(newGw);
                  // If changing away from currentGw on Live Table, update selectedGw
                  // This allows users to view past GWs even when current GW is live
                }}
              />
              <button
                onClick={() => setShowScoringModal(true)}
                className="flex items-center justify-center gap-1.5 bg-white border-2 border-slate-300 hover:bg-slate-50 rounded-full text-slate-600 hover:text-slate-800 cursor-help transition-colors flex-shrink-0 px-3 py-2"
              >
                <img 
                  src="/assets/Icons/School--Streamline-Outlined-Material-Pr0_White.png" 
                  alt="Rules" 
                  className="w-4 h-4"
                  style={{ filter: 'invert(40%) sepia(8%) saturate(750%) hue-rotate(180deg) brightness(95%) contrast(88%)' }}
                />
                <span className="text-sm font-medium">Rules</span>
              </button>
            </div>
          </div>
        )}


        {/* Scoring Modal */}
        <InfoSheet
          isOpen={showScoringModal}
          onClose={() => setShowScoringModal(false)}
          title="Weekly Winner"
          description={`🏆 How to Win the Week

The player with the most correct predictions wins.

🦄 Unicorns

In Mini-Leagues with 3 or more players, if you're the only person to correctly predict a fixture, that's a Unicorn. In ties, the player with most Unicorns wins!`}
        />

    </div>
  );
}

  // Scroll to top when tab changes - MUST be before any conditional returns
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [tab]);

  /* ---------- page chrome ---------- */
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-slate-500">Loading…</div>
      </div>
    );
  }

  if (!league && !loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded border bg-white p-6">
          <div className="font-semibold mb-2">League not found</div>
          <Link to="/leagues" className="text-slate-600 underline">
            Back to Mini Leagues
          </Link>
        </div>
      </div>
    );
  }

  if (!league) {
    return null; // Still loading
  }

  return (
    <div className={`${oldSchoolMode ? 'oldschool-theme' : 'bg-slate-50'}`} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      height: '100vh',
      maxHeight: '100vh',
      overflow: 'hidden',
      touchAction: 'none',
    }}>
      <style>{`
        /* Prevent body/html scrolling that could affect fixed header */
        body.league-page-active {
          overflow: hidden !important;
          position: fixed !important;
          width: 100% !important;
          height: 100% !important;
        }
        html.league-page-active {
          overflow: hidden !important;
        }
        .league-header-fixed {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 50 !important;
          transform: translate3d(0, 0, 0) !important;
          -webkit-transform: translate3d(0, 0, 0) !important;
          will-change: transform !important;
          contain: layout style paint !important;
          touch-action: none !important;
          user-select: none !important;
          -webkit-user-select: none !important;
          pointer-events: auto !important;
          -webkit-overflow-scrolling: auto !important;
          overflow: visible !important;
        }
        .league-header-fixed a,
        .league-header-fixed button {
          touch-action: manipulation !important;
          user-select: none !important;
          -webkit-user-select: none !important;
        }
        .league-header-fixed .relative {
          position: relative !important;
          z-index: 100 !important;
        }
        @supports (height: 100dvh) {
          .league-header-fixed {
            top: env(safe-area-inset-top, 0px) !important;
          }
        }
        .league-content-wrapper {
          position: fixed;
          top: calc(3.5rem + 3rem + env(safe-area-inset-top, 0px) + 0.5rem);
          left: 0;
          right: 0;
          bottom: 0;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: none;
          overscroll-behavior-y: none;
          overscroll-behavior-x: none;
          touch-action: pan-y;
          padding-bottom: 2rem;
          padding-left: 1rem;
          padding-right: 1rem;
          transition: top 0.3s ease-in-out;
        }
        .league-content-wrapper.has-banner {
          top: calc(3.5rem + 3rem + 3.5rem + env(safe-area-inset-top, 0px) + 0.5rem);
        }
        .league-content-wrapper.menu-open {
          top: calc(3.5rem + 3rem + 12rem + env(safe-area-inset-top, 0px) + 0.5rem);
        }
        .league-content-wrapper.menu-open.has-banner {
          top: calc(3.5rem + 3rem + 3.5rem + 12rem + env(safe-area-inset-top, 0px) + 0.5rem);
        }
        @media (max-width: 768px) {
          .league-content-wrapper {
            top: calc(3.5rem + 3rem + env(safe-area-inset-top, 0px) + 0.5rem);
            padding-bottom: 2rem;
            padding-left: 1rem;
            padding-right: 1rem;
          }
          .league-content-wrapper.has-banner {
            top: calc(3.5rem + 3rem + 3.5rem + env(safe-area-inset-top, 0px) + 0.5rem);
          }
          .league-content-wrapper.menu-open {
            top: calc(3.5rem + 3rem + 12rem + env(safe-area-inset-top, 0px) + 0.5rem);
          }
          .league-content-wrapper.menu-open.has-banner {
            top: calc(3.5rem + 3rem + 3.5rem + 12rem + env(safe-area-inset-top, 0px) + 0.5rem);
          }
        }
        /* Chat tab - full height layout */
        .chat-tab-wrapper {
          position: fixed;
          top: calc(3.5rem + 3rem + env(safe-area-inset-top, 0px));
          left: 0;
          right: 0;
          bottom: 0;
          height: calc(100vh - 3.5rem - 3rem - env(safe-area-inset-top, 0px));
          max-height: calc(100vh - 3.5rem - 3rem - env(safe-area-inset-top, 0px));
          z-index: 10;
          overflow: visible;
          pointer-events: none;
        }
        .chat-tab-wrapper.has-banner {
          top: calc(3.5rem + 3rem + 3.5rem + env(safe-area-inset-top, 0px));
          height: calc(100vh - 3.5rem - 3rem - 3.5rem - env(safe-area-inset-top, 0px));
          max-height: calc(100vh - 3.5rem - 3rem - 3.5rem - env(safe-area-inset-top, 0px));
        }
        .chat-tab-wrapper > * {
          pointer-events: auto;
        }
        @supports (height: 100dvh) {
          .chat-tab-wrapper {
            height: calc(100dvh - 3.5rem - 3rem - env(safe-area-inset-top, 0px));
            max-height: calc(100dvh - 3.5rem - 3rem - env(safe-area-inset-top, 0px));
          }
          .chat-tab-wrapper.has-banner {
            height: calc(100dvh - 3.5rem - 3rem - 3.5rem - env(safe-area-inset-top, 0px));
            max-height: calc(100dvh - 3.5rem - 3rem - 3.5rem - env(safe-area-inset-top, 0px));
          }
        }
      `}</style>
      {/* Sticky iOS-style header */}
      <div ref={headerRef} className="league-header-fixed bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          {/* Compact header bar */}
          <div className="flex items-center justify-between h-16">
            {/* Back button */}
            <Link 
              to="/leagues" 
              className="flex items-center text-slate-600 hover:text-slate-900 transition-colors -ml-2 px-2 py-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>

            {/* Title with badge */}
            <div className="flex items-center gap-3 flex-1 min-w-0 px-2">
              <button
                type="button"
                onClick={() => {
                  console.log('[League] Badge clicked, opening modal. isMember:', isMember);
                  setShowBadgeModal(true);
                }}
                className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 relative hover:opacity-80 transition-opacity cursor-pointer"
              >
                {league ? (
                  <img
                    src={getLeagueAvatarUrl(league)}
                    alt="League badge"
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="eager"
                    decoding="async"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      console.error('[League] Badge image failed to load:', target.src, 'League:', league);
                      // Fallback to default ML avatar
                      const defaultAvatar = getDefaultMlAvatar(league.id);
                      const fallbackSrc = `/assets/league-avatars/${defaultAvatar}`;
                      if (target.src !== fallbackSrc) {
                        target.src = fallbackSrc;
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-200" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-normal text-slate-900 truncate">
                  {league.name}
                </h1>
                {selectedGw && (
                  <p className="text-sm text-slate-500 truncate">
                    Gameweek {selectedGw}
                  </p>
                )}
              </div>
            </div>
            
            {/* Menu button */}
            <div className="relative" style={{ zIndex: 100 }}>
              <button
                onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100 transition-colors -mr-2"
                aria-label="Menu"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
                    </button>
            </div>
          </div>

          {/* Slide-down menu panel */}
          <div 
            className={`bg-white border-b border-slate-200 transition-all duration-300 ease-in-out overflow-hidden ${
              showHeaderMenu ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="px-4 py-3">
              {isAdmin && (
                <>
                  <div className="mb-3 pb-3 border-b border-slate-200 px-0">
                    <div className="text-xs text-slate-500 mb-1">Admin</div>
                    <div className="text-sm font-semibold text-slate-800">{adminName}</div>
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setShowAdminMenu(true);
                        setShowHeaderMenu(false);
                      }}
                      className="w-full text-left px-0 py-2.5 text-base font-bold text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 touch-manipulation"
                    >
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Manage</span>
                    </button>
                  </div>
                  <div className="my-3 border-b border-slate-200"></div>
                </>
              )}
              <div className="space-y-1">
                {isMember && (
                  <button
                    onClick={() => {
                      setShowBadgeUpload(true);
                      setShowHeaderMenu(false);
                    }}
                    className="w-full text-left px-0 py-2.5 text-base font-bold text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 touch-manipulation"
                  >
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Edit League Badge</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowInvite(true);
                    setShowHeaderMenu(false);
                  }}
                  className="w-full text-left px-0 py-2.5 text-base font-bold text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 touch-manipulation"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Invite players</span>
                </button>
                <button
                  onClick={() => {
                    shareLeague();
                    setShowHeaderMenu(false);
                  }}
                  className="w-full text-left px-0 py-2.5 text-base font-bold text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 touch-manipulation"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>Share league code</span>
                </button>
                <button
                  onClick={() => {
                    setShowLeaveConfirm(true);
                    setShowHeaderMenu(false);
                  }}
                  className="w-full text-left px-0 py-2.5 text-base font-bold text-red-600 hover:bg-red-50 active:bg-red-100 rounded-lg transition-colors flex items-center gap-2 touch-manipulation"
                >
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Leave</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className={`flex border-b border-slate-200 bg-white gap-2 transition-all duration-300 ease-in-out ${
            showHeaderMenu ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-20 opacity-100'
          }`}>
            <button
              onClick={() => {
                manualTabSelectedRef.current = true; // Mark as manually selected (synchronous)
                        setTab("chat-beta");
              }}
              className={
                "flex-1 min-w-0 px-2 sm:px-4 py-3 text-xs font-semibold transition-colors relative leading-tight " +
                (tab === "chat-beta" ? "text-[#1C8376]" : "text-slate-400")
              }
            >
              <span className="hidden sm:inline">Chat</span>
              <span className="sm:hidden whitespace-pre-line text-center">
                Chat
              </span>
              {tab === "chat-beta" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C8376]" />
              )}
            </button>
            {/* Show GW Results tab if there are any results available (or if it's API Test league) */}
            {(availableGws.length > 0 || league?.name === 'API Test') && (
              <button
                onClick={() => {
                  manualTabSelectedRef.current = true; // Mark as manually selected (synchronous)
                            setTab("gwr");
                }}
                className={
                  "flex-1 min-w-0 px-2 sm:px-4 py-3 text-xs font-semibold transition-colors relative leading-tight flex items-center justify-center gap-1.5 " +
                  (tab === "gwr" ? "text-[#1C8376]" : "text-slate-400")
                }
              >
                {(() => {
                  // Check if GW is live: first game started AND last game not finished
                  const now = new Date();
                  const firstFixture = fixtures[0];
                  const firstKickoff = firstFixture?.kickoff_time ? new Date(firstFixture.kickoff_time) : null;
                  const firstGameStarted = firstKickoff && firstKickoff <= now;
                  
                  const lastFixture = fixtures[fixtures.length - 1];
                  const lastFixtureIndex = lastFixture?.fixture_index;
                  const lastFixtureScore = lastFixtureIndex !== undefined ? liveScores[lastFixtureIndex] : null;
                  const lastGameFinished = lastFixtureScore?.status === 'FINISHED';
                  
                  const isGwLive = firstGameStarted && !lastGameFinished;
                  
                  return (
                    <>
                      {isGwLive && (
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0"></div>
                      )}
                      <span className="whitespace-nowrap">
                        GW Table
                      </span>
                    </>
                  );
                })()}
                {tab === "gwr" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C8376]" />
                )}
              </button>
            )}
            {/* Show GW Predictions tab if there's a current GW (or if it's API Test league) */}
            {/* Tab is always visible, but content will show "Who's submitted" if not all submitted */}
            {(currentGw || league?.name === 'API Test') && (
              <button
                onClick={() => {
                  manualTabSelectedRef.current = true; // Mark as manually selected (synchronous)
                            setTab("gw");
                }}
                className={
                  "flex-1 min-w-0 px-2 sm:px-4 py-3 text-xs font-semibold transition-colors relative leading-tight " +
                  (tab === "gw" ? "text-[#1C8376]" : "text-slate-400")
                }
              >
                <span className="hidden sm:inline">Predictions</span>
                <span className="sm:hidden whitespace-pre-line">Predictions</span>
                {tab === "gw" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C8376]" />
                )}
              </button>
            )}
            <button
              onClick={() => {
                manualTabSelectedRef.current = true; // Mark as manually selected (synchronous)
                        setTab("mlt");
              }}
              className={
                "flex-1 min-w-0 px-2 sm:px-4 py-3 text-xs font-semibold transition-colors relative leading-tight " +
                (tab === "mlt" ? "text-[#1C8376]" : "text-slate-400")
              }
            >
              Season
              {tab === "mlt" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C8376]" />
              )}
            </button>
          </div>
      </div>
      </div>

      {tab === "chat" ? (
        <div className="chat-tab-wrapper">
          <ChatTab
            chat={chat}
            userId={user?.id}
            nameById={memberNameById}
            isMember={isMember}
            newMsg={newMsg}
            setNewMsg={setNewMsg}
            onSend={sendChat}
            leagueCode={league?.code}
            memberCount={members.length}
            maxMembers={MAX_MEMBERS}
            notificationStatus={notificationStatus}
          />
        </div>
      ) : tab === "chat-beta" ? (

        <div className="chat-tab-wrapper">
          <MiniLeagueChatBeta
            miniLeagueId={league?.id ?? null}
            memberNames={memberNameById}
          />
        </div>
      ) : (
        <div className={`league-content-wrapper ${showHeaderMenu ? 'menu-open' : ''}`}>
          <div className="px-1 sm:px-2">
            {tab === "mlt" && <MltTab />}
            {tab === "gw" && <GwPicksTab />}
            {tab === "gwr" && <GwResultsTab />}
          </div>

      </div>
      )}

      {/* Admin Menu Modal */}
      {isAdmin && showAdminMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAdminMenu(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 relative" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setShowAdminMenu(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal content */}
            <div className="p-6 pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">League Management</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm text-slate-600 mb-3 font-semibold">Remove Members:</h3>
                  <div className="space-y-2">
                    {members
                      .filter((m) => m.id !== user?.id)
                      .map((member) => (
                        <div key={member.id} className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg">
                          <span className="text-sm font-medium text-slate-800">{member.name}</span>
                          <button
                            onClick={() => {
                              setMemberToRemove(member);
                              setShowRemoveConfirm(true);
                              setShowAdminMenu(false);
                            }}
                            className="px-3 py-1.5 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ))}

                    {members.filter((m) => m.id !== user?.id).length === 0 && (
                      <div className="text-sm text-slate-500 italic py-4 text-center">No other members to remove</div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <button
                    onClick={() => {
                      setShowEndLeagueConfirm(true);
                      setShowAdminMenu(false);
                    }}
                    className="w-full px-4 py-3 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    🗑️ End League
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* League Badge Upload Modal */}
      {isMember && showBadgeUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
          setShowBadgeUpload(false);
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }
          setCropImage(null);
          setBadgeUploadError(null);
          setBadgeUploadSuccess(false);
          setPreviewUrl(null);
        }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 relative" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => {
                setShowBadgeUpload(false);
                if (previewUrl) {
                  URL.revokeObjectURL(previewUrl);
                }
                setCropImage(null);
                setBadgeUploadError(null);
                setBadgeUploadSuccess(false);
                setPreviewUrl(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal content */}
            <div className="p-4 pt-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">League Badge</h2>
              <p className="text-xs text-gray-600 mb-4">Upload and customize your mini-league badge</p>
              
              {!cropImage ? (
                <>
                  {/* Current badge preview */}
                  <div className="mb-4">
                    <div className="text-xs text-slate-600 mb-2 font-medium">Current Badge:</div>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border-2 border-slate-200">
                        <img
                          src={league ? getLeagueAvatarUrl(league) : '/assets/league-avatars/ML-avatar-1.png'}
                          alt="League badge"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/assets/league-avatars/ML-avatar-1.png';
                          }}
                        />
                      </div>
                      {league?.avatar && (
                        <button
                          onClick={handleRemoveBadge}
                          disabled={uploadingBadge}
                          className="px-4 py-2 text-xs bg-red-100 text-red-700 active:bg-red-200 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[36px]"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Upload section */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-2">
                        Choose Image
                      </label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileSelect(file);
                          }
                        }}
                        disabled={uploadingBadge}
                        className="hidden"
                        id="badge-upload-input"
                      />
                      <label
                        htmlFor="badge-upload-input"
                        className="block w-full border-2 border-dashed border-slate-300 rounded-lg p-6 text-center active:bg-slate-50 active:border-[#1C8376] transition-colors touch-manipulation"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <div className="text-sm">
                            <span className="text-[#1C8376] font-semibold">Tap to choose image</span>
                          </div>
                          <p className="text-xs text-slate-500">
                            PNG, JPG, or WebP (up to 20MB - will be optimized automatically)
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Upload progress */}
                    {uploadingBadge && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#1C8376]"></div>
                        <span>Processing and uploading...</span>
                      </div>
                    )}

                    {/* Success message */}
                    {badgeUploadSuccess && (
                      <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
                        ✓ Badge uploaded successfully!
                      </div>
                    )}

                    {/* Error message */}
                    {badgeUploadError && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                        {badgeUploadError}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Crop view */}
                  <div className="space-y-3">
                    <div className="text-xs text-slate-600">
                      <p className="font-medium">Position your image</p>
                      <p className="text-xs text-slate-500">Drag to position, use slider to zoom</p>
                    </div>
                    
                    <div className="relative w-full" style={{ height: '280px' }}>
                      <Cropper
                        image={cropImage}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        cropShape="round"
                        showGrid={false}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                        style={{
                          containerStyle: {
                            width: '100%',
                            height: '100%',
                            position: 'relative',
                          },
                        }}
                      />
                    </div>

                    {/* Zoom control and Preview in one row */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-1">
                        <label className="block text-xs font-medium text-slate-700">
                          Zoom: {Math.round(zoom * 100)}%
                        </label>
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.1}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1C8376] touch-manipulation"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-medium text-slate-700">Preview:</div>
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-300 flex items-center justify-center flex-shrink-0">
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-200" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Error message */}
                    {badgeUploadError && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                        {badgeUploadError}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          if (previewUrl) {
                            URL.revokeObjectURL(previewUrl);
                          }
                          setCropImage(null);
                          setCrop({ x: 0, y: 0 });
                          setZoom(1);
                          setCroppedAreaPixels(null);
                          setPreviewUrl(null);
                        }}
                        disabled={uploadingBadge}
                        className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg active:bg-slate-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCropAndUpload}
                        disabled={uploadingBadge || !croppedAreaPixels}
                        className="flex-1 px-4 py-3 bg-[#1C8376] text-white rounded-lg active:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
                      >
                        {uploadingBadge ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            Uploading...
                          </span>
                        ) : (
                          'Upload Badge'
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table Modal */}
      <InfoSheet
        isOpen={showTableModal}
        onClose={() => setShowTableModal(false)}
        title="League Points"
        description={`Win the week – 3 points
Draw – 1 point
Lose – 0 points

🤝 Ties

If two or more players are tied on Points in the table, the player with the most overall Unicorns in the mini league is ranked higher.${league && (['The Bird league'].includes(league.name) || ['gregVjofVcarl', 'Let Down'].includes(league.name)) ? '\n\nNote: This mini league started after GW1, so the "CP" column shows correct predictions since this mini league began.' : ''}`}
      />

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Invite players</h3>
            <p className="text-slate-600 text-sm">Share this code (up to {MAX_MEMBERS} members):</p>
            <div className="mt-3 flex items-center gap-2">
              <code className="font-mono text-lg font-bold">{league.code}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(league.code);
                }}
                className="px-3 py-1.5 border rounded-md text-sm hover:bg-slate-50"
              >
                Copy
              </button>
              <button onClick={shareLeague} className="px-3 py-1.5 border rounded-md text-sm hover:bg-slate-50">
                Share
              </button>
            </div>
            <div className="mt-3 text-xs text-slate-500">{members.length}/{MAX_MEMBERS} members</div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowInvite(false)} className="px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave League Confirmation */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Leave League</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to leave "{league?.name}"? You'll need the league code to rejoin later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                disabled={leaving}
              >
                Cancel
              </button>
              <button
                onClick={leaveLeague}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={leaving}
              >
                {leaving ? "Leaving..." : "Leave League"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Confirmation */}
      {showJoinConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Join Mini League</h3>
            <p className="text-slate-600 mb-6">
              You are about to join <strong>"{league?.name}"</strong>. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowJoinConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                disabled={joining}
              >
                Cancel
              </button>
              <button
                onClick={joinLeague}
                className="flex-1 px-4 py-2 bg-[#1C8376] text-white rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
                disabled={joining}
              >
                {joining ? "Joining..." : "Join League"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Remove Member</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to remove <strong>"{memberToRemove?.name}"</strong> from the league? They will need the league code to rejoin.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                disabled={removing}
              >
                Cancel
              </button>
              <button
                onClick={removeMember}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={removing}
              >
                {removing ? "Removing..." : "Remove Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End League Confirmation */}
      {showEndLeagueConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-red-600 mb-2">⚠️ End League</h3>
            <p className="text-slate-600 mb-4">
              Are you absolutely sure you want to <strong>permanently end</strong> the league <strong>"{league?.name}"</strong>?
            </p>
            <p className="text-sm text-red-600 mb-6">
              This will remove all members and delete the league forever. This action cannot be undone!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndLeagueConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                disabled={ending}
              >
                Cancel
              </button>
              <button
                onClick={endLeague}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={ending}
              >
                {ending ? "Ending..." : "Yes, End League"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Test League Notice - at bottom of page */}
      {league?.name === 'API Test' && (
        <div className="mt-6 mb-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-yellow-800">
            <strong>⚠️ Test League:</strong> This league uses test API data and starts from Test GW 1 with zero points. It does not affect your main game scores.
          </div>
        </div>
      )}

      {/* Full-screen league badge modal */}
      {showBadgeModal && league && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center"
          onClick={() => setShowBadgeModal(false)}
        >
          <div 
            className="flex flex-col items-center gap-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-80 h-80 rounded-full overflow-hidden bg-white shadow-2xl relative">
              <img
                src={getLeagueAvatarUrl(league)}
                alt="League badge"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const defaultAvatar = getDefaultMlAvatar(league.id);
                  const fallbackSrc = `/assets/league-avatars/${defaultAvatar}`;
                  if (target.src !== fallbackSrc) {
                    target.src = fallbackSrc;
                  }
                }}
              />
            </div>
            {isMember && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('[League] Edit icon clicked');
                  setShowBadgeModal(false);
                  setShowBadgeUpload(true);
                }}
                className="absolute bottom-[272px] right-1/2 translate-x-[144px] w-16 h-16 rounded-full bg-white hover:bg-slate-50 shadow-2xl flex items-center justify-center transition-all z-20 border-4 border-slate-400"
                title="Edit League Badge"
              >
                <svg className="w-8 h-8 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            <div className="text-white text-xl font-medium">
              {league.name}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
import type { ReactNode } from "react";
import { useState, useEffect, useRef } from "react";

type BubbleShape = "single" | "top" | "middle" | "bottom";

const incomingShape: Record<BubbleShape, string> = {
 single: "rounded-tl-[12px] rounded-tr-[12px] rounded-br-[12px] rounded-bl-[12px]",
 top: "rounded-tl-[12px] rounded-tr-[12px] rounded-br-[12px] rounded-bl-[4px]",
 middle: "rounded-tl-[4px] rounded-tr-[12px] rounded-br-[12px] rounded-bl-[4px]",
 bottom: "rounded-tl-[4px] rounded-tr-[12px] rounded-br-[12px] rounded-bl-[12px]",
};

const outgoingShape: Record<BubbleShape, string> = {
 single: "rounded-tl-[12px] rounded-tr-[12px] rounded-br-[12px] rounded-bl-[12px]",
 top: "rounded-tl-[12px] rounded-tr-[12px] rounded-br-[4px] rounded-bl-[12px]",
 middle: "rounded-tl-[12px] rounded-tr-[4px] rounded-br-[4px] rounded-bl-[12px]",
 bottom: "rounded-tl-[12px] rounded-tr-[4px] rounded-br-[12px] rounded-bl-[12px]",
};

type Reaction = {
 emoji: string;
 count: number;
 hasUserReacted: boolean;
};

type MessageBubbleProps = {
 author?: string;
 text: ReactNode;
 time: string;
 isOwnMessage?: boolean;
 shape?: BubbleShape;
 messageId?: string;
 reactions?: Reaction[];
 onReactionClick?: (messageId: string, emoji: string) => void;
 replyTo?: {
 id: string;
 content: string;
 authorName?: string;
 } | null;
 onMessageClick?: () => void;
};

const QUICK_REACTIONS = ['👍', '❤️', '😂'];
const EMOJI_TRAY = [
 '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
 '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
 '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
 '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
 '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
 '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
 '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
 '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
 '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧',
 '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
 '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑',
 '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻',
 '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸',
 '😹', '😻', '😼', '😽', '🙀', '😿', '😾'
];

export function MessageBubble({
 author,
 text,
 time,
 isOwnMessage,
 shape = "single",
 messageId,
 reactions = [],
 onReactionClick,
 replyTo,
 onMessageClick,
}: MessageBubbleProps) {
  const textAlignment = "text-left";
 const bubbleClasses = isOwnMessage ? "bg-[#1C8376] text-white" : "bg-white text-slate-900";
 const shapeClasses = isOwnMessage ? outgoingShape : incomingShape;
  const maxWidth = "max-w-[85%]";
 const [showReactionPicker, setShowReactionPicker] = useState(false);
 const [showEmojiPicker, setShowEmojiPicker] = useState(false);
 const reactionPickerRef = useRef<HTMLDivElement>(null);

 // Close reaction picker when clicking outside
 useEffect(() => {
 if (!showReactionPicker) return;

 const handleClickOutside = (event: MouseEvent) => {
 if (reactionPickerRef.current && !reactionPickerRef.current.contains(event.target as Node)) {
 setShowReactionPicker(false);
 }
 };

 // Add a small delay to avoid closing immediately when opening
 const timeoutId = setTimeout(() => {
 document.addEventListener('mousedown', handleClickOutside);
 }, 100);

 return () => {
 clearTimeout(timeoutId);
 document.removeEventListener('mousedown', handleClickOutside);
 };
 }, [showReactionPicker]);

 const handleReactionClick = (emoji: string) => {
 if (messageId && onReactionClick) {
 onReactionClick(messageId, emoji);
 }
 setShowReactionPicker(false);
 setShowEmojiPicker(false);
 };

 const handleBubbleClick = (e: React.MouseEvent) => {
 // Don't trigger reply if clicking on reactions or reaction buttons
 const target = e.target as HTMLElement;
 if (target.closest('button') || target.closest('[data-reaction]')) {
 return;
 }
 if (onMessageClick) {
 onMessageClick();
 }
 };

 return (
    <div className={`inline-block ${maxWidth} min-w-0 relative`} style={{ width: 'fit-content', maxWidth: '85%' }}>
 <div
        className={`px-2.5 py-1.5 text-sm leading-relaxed shadow-sm whitespace-pre-wrap break-words ${textAlignment} ${bubbleClasses} ${shapeClasses[shape]} ${onMessageClick ? 'cursor-pointer' : ''}`}
 onClick={handleBubbleClick}
        style={{ 
          wordBreak: 'break-word', 
          overflowWrap: 'anywhere',
          display: 'inline-block',
          width: 'fit-content',
          maxWidth: '100%',
          overflow: 'hidden'
        }}
 >
 {author && !isOwnMessage && (
          <div className="text-xs font-semibold text-slate-600 mb-1 break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{author}</div>
 )}
 {/* Reply preview - WhatsApp style */}
 {replyTo && (
 <div
 className={`mb-2 pb-2 border-l-2 ${
 isOwnMessage
 ? "border-white/30 text-white/90"
 : "border-[#1C8376] text-slate-600"
            } pl-2 text-xs`}
            style={{ 
              wordBreak: 'break-word', 
              overflowWrap: 'anywhere',
              overflow: 'hidden',
              maxWidth: '100%'
            }}
 >
            <div className="font-medium text-[10px] mb-0.5 break-words" style={{ 
              wordBreak: 'break-word', 
              overflowWrap: 'anywhere',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
 {replyTo.authorName || "Unknown"}
 </div>
            <div className="text-[10px] break-words" style={{ 
              wordBreak: 'break-word', 
              overflowWrap: 'anywhere',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: '1.3',
              maxHeight: '2.6em'
            }}>
 {replyTo.content}
 </div>
 </div>
 )}
        <div style={{ 
          wordBreak: 'break-word', 
          overflowWrap: 'anywhere',
          position: 'relative'
        }}>
          <span style={{ 
            wordBreak: 'break-word', 
            overflowWrap: 'anywhere',
            display: 'inline'
          }}>{text}</span>
          <span className={`text-xs relative top-1 ${isOwnMessage ? 'text-[#DCDCDD]' : 'text-slate-400'}`} style={{ 
            whiteSpace: 'nowrap',
            float: 'right',
            clear: 'right',
            marginLeft: '12px'
          }}>{time}</span>
        </div>
 </div>
 {/* Reaction button and picker - positioned on the right of the bubble (only for other users' messages) */}
 {messageId && !isOwnMessage && (
 <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 flex items-center gap-1">
 {/* Quick reaction buttons - appear when SVG is clicked */}
 {showReactionPicker && (
 <div ref={reactionPickerRef} className="flex items-center gap-1 bg-white rounded-full px-1 py-1 shadow-lg border border-slate-200 z-50">
 {QUICK_REACTIONS.map((emoji) => (
 <button
 key={emoji}
 onClick={() => handleReactionClick(emoji)}
 className="w-7 h-7 rounded-full flex items-center justify-center text-base"
 title={`React with ${emoji}`}
 >
 {emoji}
 </button>
 ))}
 {/* Reply button */}
 {onMessageClick && (
 <button
 onClick={() => {
 setShowReactionPicker(false);
 onMessageClick();
 }}
 className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500"
 title="Reply to message"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
 </svg>
 </button>
 )}
 {/* + button for more options */}
 <button
 onClick={() => {
 setShowReactionPicker(false);
 setShowEmojiPicker(true);
 }}
 className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 font-semibold"
 title="More reactions"
 >
 <span className="text-sm">+</span>
 </button>
 </div>
 )}
 {/* SVG button - always visible */}
 <button
 onClick={() => setShowReactionPicker(!showReactionPicker)}
 className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shadow-sm"
 title="Add reaction"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 </button>
 </div>
 )}
 {/* Emoji tray - bottom sheet that slides up */}
 {showEmojiPicker && messageId && !isOwnMessage && (
 <>
 {/* Backdrop */}
 <div 
 className="fixed inset-0 bg-black/20 z-40"
 onClick={() => setShowEmojiPicker(false)}
 />
 {/* Bottom sheet */}
 <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl border-t border-slate-200 overflow-x-hidden" style={{ animation: 'slideUp 0.3s ease-out' }}>
 <div className="px-4 pt-3 pb-4 overflow-x-hidden">
 {/* Header with handle bar and close button */}
 <div className="flex items-center justify-between mb-3">
 <div className="w-12 h-1 bg-slate-300 rounded-full" />
 <button
 onClick={() => setShowEmojiPicker(false)}
 className="px-4 py-1.5 text-sm font-medium text-slate-600 rounded-lg"
 >
 Close
 </button>
 <div className="w-12" />
 </div>
 {/* Emoji grid */}
 <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto overflow-x-hidden">
 {EMOJI_TRAY.map((emoji) => (
 <button
 key={emoji}
 onClick={() => {
 if (messageId && onReactionClick) {
 onReactionClick(messageId, emoji);
 }
 setShowEmojiPicker(false);
 }}
 className="w-10 h-10 rounded-lg active:bg-slate-200 flex items-center justify-center text-2xl"
 title={emoji}
 >
 {emoji}
 </button>
 ))}
 </div>
 </div>
 </div>
 </>
 )}
 {/* Reactions */}
 {reactions.length > 0 && (
 <div className={`mt-1 flex items-center gap-1 flex-wrap ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
 {reactions.map((reaction) => (
 <button
 key={reaction.emoji}
 onClick={() => handleReactionClick(reaction.emoji)}
     className={`px-2 py-0.5 rounded-full text-sm flex items-center gap-1 ${
     reaction.hasUserReacted
     ? 'bg-[#1C8376] text-white'
     : 'bg-slate-100 text-slate-700'
     }`}
 >
 <span className="text-base">{reaction.emoji}</span>
 <span>{reaction.count}</span>
 </button>
 ))}
 </div>
 )}
 </div>
 );
}

export default MessageBubble;

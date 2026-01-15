import { useMemo } from 'react';
import type { ChatThreadProps } from '../components/chat/ChatThread';

type MessageLike = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  status?: 'sending' | 'sent' | 'error';
  reply_to?: {
    id: string;
    content: string;
    user_id: string;
  } | null;
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDayLabel = (value: string) =>
  new Date(value).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

const initials = (text?: string) => {
  if (!text) return '?';
  const parts = text.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return `${parts[0][0]?.toUpperCase() ?? ''}${parts[parts.length - 1][0]?.toUpperCase() ?? ''}`;
};

type UseChatGroupsArgs = {
  messages: MessageLike[];
  currentUserId: string | null | undefined;
  currentUserDisplayName: string;
  /** If false, return [] to match the existing “wait for names” behavior. */
  hasAnyNames: boolean;
  /** Returns display name for a userId or '' if unknown. */
  getName: (userId: string) => string;
};

export function useChatGroups({
  messages,
  currentUserId,
  currentUserDisplayName,
  hasAnyNames,
  getName,
}: UseChatGroupsArgs): { groups: ChatThreadProps['groups']; key: string } {
  const groups = useMemo<ChatThreadProps['groups']>(() => {
    if (!messages.length) return [];
    if (!hasAnyNames) return [];

    let lastDayKey: string | null = null;
    const result: ChatThreadProps['groups'] = [];

    for (const msg of messages) {
      const isOwnMessage = Boolean(currentUserId && msg.user_id === currentUserId);
      const resolvedName = getName(msg.user_id);
      const authorName = resolvedName || (isOwnMessage ? currentUserDisplayName : '');
      const fallbackName = authorName || (isOwnMessage ? 'You' : 'Unknown');

      const avatarInitials = !isOwnMessage ? initials(fallbackName) : undefined;

      const createdDate = new Date(msg.created_at);
      const dayKey = createdDate.toDateString();
      const shouldLabelDay = dayKey !== lastDayKey;
      if (shouldLabelDay) lastDayKey = dayKey;

      const replyAuthorName =
        msg.reply_to?.user_id ? getName(msg.reply_to.user_id) || 'Unknown' : undefined;

      const messagePayload: ChatThreadProps['groups'][number]['messages'][number] = {
        id: msg.id,
        text: msg.content,
        time: formatTime(msg.created_at),
        status: msg.status && msg.status !== 'sent' ? msg.status : undefined,
        messageId: msg.id,
        replyTo: msg.reply_to
          ? {
              id: msg.reply_to.id,
              content: msg.reply_to.content,
              authorName: replyAuthorName,
            }
          : null,
      };

      const lastGroup = result[result.length - 1];
      const canAppendToLast =
        lastGroup &&
        !shouldLabelDay &&
        Boolean(lastGroup.isOwnMessage) === isOwnMessage &&
        lastGroup.userId === msg.user_id;

      if (canAppendToLast) {
        // Keep existing id semantics (base-id derived from first chunk).
        const baseId = lastGroup.id.includes('-') ? lastGroup.id.split('-')[0] : lastGroup.id;
        result[result.length - 1] = {
          ...lastGroup,
          id: `${baseId}-${fallbackName}`,
          author: fallbackName,
          avatarInitials,
          userId: msg.user_id,
          messages: [...lastGroup.messages, messagePayload],
        };
      } else {
        result.push({
          id: `${msg.id}-${fallbackName}`,
          author: fallbackName,
          avatarInitials,
          isOwnMessage,
          userId: msg.user_id,
          dayLabel: shouldLabelDay ? formatDayLabel(msg.created_at) : undefined,
          messages: [messagePayload],
        });
      }
    }

    return result;
  }, [messages, currentUserId, currentUserDisplayName, hasAnyNames, getName]);

  const key = useMemo(() => {
    const authorNames = groups.map((g) => g.author).join(',');
    const hasUnknown = groups.some((g) => g.author === 'Unknown');
    return `chat-${groups.length}-${hasUnknown ? 'unknown' : 'resolved'}-${authorNames.slice(0, 50)}`;
  }, [groups]);

  return { groups, key };
}


import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { VOLLEY_NAME, VOLLEY_USER_ID } from '../lib/volley';

export type MemberNames = Map<string, string> | Record<string, string> | undefined;

const resolveNameFromSources = (
  id: string,
  memberNames?: MemberNames,
  additionalNames?: Map<string, string>
): string => {
  if (id === VOLLEY_USER_ID) return VOLLEY_NAME;

  if (memberNames) {
    if (memberNames instanceof Map) {
      const name = memberNames.get(id);
      if (name) return name;
    } else {
      const name = memberNames[id];
      if (name) return name;
    }
  }

  if (additionalNames) {
    const name = additionalNames.get(id);
    if (name) return name;
  }

  return '';
};

export function useChatAuthorNames({
  messages,
  memberNames,
  currentUserId,
}: {
  messages: Array<{ user_id: string; reply_to?: { user_id: string } | null }>;
  memberNames?: MemberNames;
  currentUserId?: string | null;
}): {
  additionalNames: Map<string, string>;
  hasAnyNames: boolean;
  getName: (userId: string) => string;
} {
  const [additionalNames, setAdditionalNames] = useState<Map<string, string>>(new Map());
  const fetchedUserIdsRef = useRef<Set<string>>(new Set());

  // Fetch names for authors not present in memberNames (e.g., users who left the league).
  useEffect(() => {
    if (messages.length === 0) return;

    const missingUserIds: string[] = [];

    const consider = (userId: string) => {
      if (!userId) return;
      if (userId === VOLLEY_USER_ID) return;
      if (currentUserId && userId === currentUserId) return;
      if (fetchedUserIdsRef.current.has(userId)) return;

      const resolvable = resolveNameFromSources(userId, memberNames, additionalNames);
      if (resolvable) return;

      missingUserIds.push(userId);
    };

    for (const msg of messages) {
      consider(msg.user_id);
      if (msg.reply_to?.user_id) consider(msg.reply_to.user_id);
    }

    const uniqueMissing = Array.from(new Set(missingUserIds));
    if (uniqueMissing.length === 0) return;

    uniqueMissing.forEach((id) => fetchedUserIdsRef.current.add(id));

    (async () => {
      try {
        const { data, error } = await supabase.from('users').select('id, name').in('id', uniqueMissing);
        if (error) {
          console.error('[useChatAuthorNames] Error fetching user names:', error);
          return;
        }

        if (data && data.length > 0) {
          setAdditionalNames((prev) => {
            const next = new Map(prev);
            for (const row of data as any[]) {
              if (row.id && row.name) next.set(row.id, row.name);
            }
            return next;
          });
        }
      } catch (err) {
        console.error('[useChatAuthorNames] Error fetching user names:', err);
      }
    })();
  }, [messages, memberNames, additionalNames, currentUserId]);

  const hasAnyNames = useMemo(() => {
    const hasMemberNames =
      memberNames instanceof Map
        ? memberNames.size > 0
        : memberNames
          ? Object.keys(memberNames).length > 0
          : false;
    return hasMemberNames || additionalNames.size > 0;
  }, [memberNames, additionalNames]);

  const getName = useCallback(
    (userId: string) => resolveNameFromSources(userId, memberNames, additionalNames),
    [memberNames, additionalNames]
  );

  return { additionalNames, hasAnyNames, getName };
}


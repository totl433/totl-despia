import React from 'react';
import { View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

import LeaguePickPill, { type LeaguePick, type LeaguePickTone } from './LeaguePickPill';

export default function LeagueFixturePicks({
  members,
  picksByUserId,
  outcome,
  currentUserId,
}: {
  members: Array<{ id: string; name: string }>;
  picksByUserId: Map<string, LeaguePick>;
  outcome: LeaguePick | null;
  currentUserId: string | null;
}) {
  const t = useTokens();

  const rows = members
    .filter((m) => picksByUserId.has(m.id))
    .map((m) => ({ id: m.id, name: m.name, pick: picksByUserId.get(m.id)! }));

  if (!rows.length) return null;

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
      {rows.map((r) => {
        const isMe = currentUserId && r.id === currentUserId;
        const isPickedCorrect = outcome ? r.pick === outcome : false;
        const tone: LeaguePickTone = outcome ? (isPickedCorrect ? 'correct' : 'wrong') : 'picked';

        return (
          <View
            key={r.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 6,
              borderTopWidth: 1,
              borderTopColor: 'rgba(148,163,184,0.10)',
            }}
          >
            <TotlText
              variant="caption"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ flex: 1, fontWeight: isMe ? '900' : '700', color: isMe ? t.color.text : t.color.muted }}
            >
              {r.name}
            </TotlText>

            <LeaguePickPill value={r.pick} tone={tone} />
          </View>
        );
      })}
    </View>
  );
}


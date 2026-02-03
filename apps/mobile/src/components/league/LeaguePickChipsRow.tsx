import React from 'react';
import { Image, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

import type { LeaguePick } from './LeaguePickPill';

function initial1(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0]![0] ?? '?').toUpperCase();
}

function Chip({
  name,
  avatarUri,
  ring,
  isMe,
  overlap,
}: {
  name: string;
  avatarUri?: string | null;
  ring: string;
  isMe: boolean;
  overlap: number;
}) {
  const t = useTokens();
  const SIZE = 28;
  return (
    <View
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: 999,
        backgroundColor: t.color.surface2,
        borderWidth: isMe ? 2 : 1,
        borderColor: isMe ? t.color.brand : ring,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: overlap,
        overflow: 'hidden',
      }}
    >
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={{ width: SIZE, height: SIZE }} resizeMode="cover" />
      ) : (
        <TotlText variant="caption" style={{ fontWeight: '900' }}>
          {initial1(name)}
        </TotlText>
      )}
    </View>
  );
}

/**
 * LeaguePickChipsRow
 * Renders member “chips” under a fixture, bucketed by pick (H / D / A) like the web UI.
 */
export default function LeaguePickChipsRow({
  members,
  picksByUserId,
  outcome,
  currentUserId,
}: {
  members: Array<{ id: string; name: string; avatar_url?: string | null }>;
  picksByUserId: Map<string, LeaguePick>;
  outcome: LeaguePick | null;
  currentUserId: string | null;
}) {
  const t = useTokens();

  const byPick = React.useMemo(() => {
    const m = new Map<LeaguePick, Array<{ id: string; name: string; avatar_url?: string | null }>>([
      ['H', []],
      ['D', []],
      ['A', []],
    ]);
    members.forEach((mem) => {
      const p = picksByUserId.get(mem.id);
      if (!p) return;
      m.get(p)!.push({ id: mem.id, name: mem.name, avatar_url: mem.avatar_url ?? null });
    });
    return m;
  }, [members, picksByUserId]);

  const ringFor = (p: LeaguePick) => {
    if (!outcome) return t.color.border;
    return p === outcome ? 'rgba(34,197,94,0.75)' : 'rgba(239,68,68,0.70)';
  };

  const renderBucket = (pick: LeaguePick, align: 'flex-start' | 'center' | 'flex-end') => {
    const arr = byPick.get(pick) ?? [];
    if (!arr.length) return <View style={{ height: 28 }} />;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: align }}>
        {arr.map((u, idx) => (
          <Chip
            key={u.id}
            name={u.name}
            avatarUri={u.avatar_url ?? null}
            ring={ringFor(pick)}
            isMe={!!currentUserId && u.id === currentUserId}
            overlap={idx === 0 ? 0 : -8}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>{renderBucket('H', 'flex-end')}</View>
        <View style={{ width: 84, alignItems: 'center' }}>{renderBucket('D', 'center')}</View>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>{renderBucket('A', 'flex-start')}</View>
      </View>
    </View>
  );
}


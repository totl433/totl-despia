import React from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card, TotlText, useTokens } from '@totl/ui';
import { api } from '../lib/api';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

function MemberChip({ name, avatarUri }: { name: string; avatarUri?: string | null }) {
  const t = useTokens();
  const SIZE = 26;
  return (
    <View
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: 999,
        backgroundColor: t.color.surface2,
        borderWidth: 3,
        borderColor: '#FACC15', // temp: matches screenshot “winner-ish” ring; we’ll map to game state later
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={{ width: SIZE, height: SIZE }} />
      ) : (
        <TotlText variant="caption" style={{ fontWeight: '900' }}>
          {initials(name)}
        </TotlText>
      )}
    </View>
  );
}

export function MiniLeaguesDefaultRow({
  league,
  onPress,
}: {
  league: { id: string; name: string; avatarUri: string | null };
  onPress: () => void;
}) {
  const t = useTokens();
  const { data, isLoading } = useQuery({
    queryKey: ['leagueMembers', league.id],
    queryFn: () => api.getLeague(league.id),
  });

  const members = (data?.members ?? []).slice(0, 3);
  const AVATAR_SIZE = 54;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.95 : 1,
      })}
    >
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: 999,
            backgroundColor: t.color.surface2,
            borderWidth: 1,
            borderColor: t.color.border,
            overflow: 'hidden',
            marginRight: 14,
          }}
        >
          {league.avatarUri ? <Image source={{ uri: league.avatarUri }} style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }} /> : null}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <TotlText
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              color: t.color.text,
              fontFamily: 'Gramatika-Regular',
              fontWeight: '400',
              fontSize: 16,
              lineHeight: 16,
            }}
          >
            {league.name}
          </TotlText>

          <View style={{ marginTop: 10, flexDirection: 'row' }}>
            {isLoading ? (
              <TotlText variant="muted">Loading…</TotlText>
            ) : members.length ? (
              members.map((m, idx) => (
                <View key={m.id} style={{ marginLeft: idx === 0 ? 0 : -8 }}>
                  <MemberChip name={m.name} avatarUri={m.avatar_url ?? null} />
                </View>
              ))
            ) : (
              <TotlText variant="muted">No members yet.</TotlText>
            )}
          </View>
        </View>

        <TotlText variant="caption" style={{ color: t.color.muted, fontWeight: '900', fontSize: 18, lineHeight: 18, marginLeft: 12 }}>
          ›
        </TotlText>
      </View>
    </Pressable>
  );
}

/**
 * Mini-league “Default View” shown before LIVE (and when user toggles off live tables).
 * Mirrors the web Home default view: horizontal scroll, batched in rows of 3.
 */
export function MiniLeaguesDefaultBatchCard({
  batch,
  onLeaguePress,
  width = 320,
}: {
  batch: Array<{ id: string; name: string; avatarUri: string | null }>;
  onLeaguePress: (leagueId: string, name: string) => void;
  width?: number;
}) {
  const t = useTokens();
  const isLightMode = t.color.background.toLowerCase() === '#f8fafc';
  const SPACER = 20;
  return (
    <Card
      style={{
        width,
        padding: 20,
        borderRadius: 16,
        backgroundColor: t.color.surface,
        ...(isLightMode
          ? {
              shadowOpacity: 0,
              shadowRadius: 0,
              shadowOffset: { width: 0, height: 0 },
              elevation: 0,
            }
          : null),
      }}
    >
      {batch.map((l, idx) => (
        <View key={l.id}>
          <MiniLeaguesDefaultRow league={l} onPress={() => onLeaguePress(l.id, l.name)} />
          {idx < batch.length - 1 ? (
            <>
              <View style={{ height: SPACER }} />
              <View style={{ height: 1, backgroundColor: 'rgba(148,163,184,0.18)', opacity: 1 }} />
              <View style={{ height: SPACER }} />
            </>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

export default function MiniLeaguesDefaultList({
  leagues,
  onLeaguePress,
}: {
  leagues: Array<{ id: string; name: string; avatarUri: string | null }>;
  onLeaguePress: (leagueId: string, name: string) => void;
}) {
  const batches = React.useMemo(() => {
    const out: Array<Array<{ id: string; name: string; avatarUri: string | null }>> = [];
    const batchSize = 3;
    for (let i = 0; i < leagues.length; i += batchSize) {
      out.push(leagues.slice(i, i + batchSize));
    }
    return out;
  }, [leagues]);

  return (
    <FlatList
      horizontal
      data={batches}
      keyExtractor={(_, idx) => String(idx)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 12 }}
      renderItem={({
        item: batch,
        index: batchIdx,
      }: {
        item: Array<{ id: string; name: string; avatarUri: string | null }>;
        index: number;
      }) => (
        <View style={{ marginRight: batchIdx === batches.length - 1 ? 0 : 12 }}>
          <MiniLeaguesDefaultBatchCard batch={batch} onLeaguePress={onLeaguePress} width={320} />
        </View>
      )}
    />
  );
}


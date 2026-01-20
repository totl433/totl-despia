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

function MemberChip({ name }: { name: string }) {
  const t = useTokens();
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 999,
        backgroundColor: t.color.surface2,
        borderWidth: 3,
        borderColor: '#FACC15', // temp: matches screenshot “winner-ish” ring; we’ll map to game state later
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TotlText variant="caption" style={{ fontWeight: '900' }}>
        {initials(name)}
      </TotlText>
    </View>
  );
}

function LeagueDefaultRow({
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

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.95 : 1,
      })}
    >
      <View style={{ paddingVertical: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              backgroundColor: t.color.surface2,
              borderWidth: 1,
              borderColor: t.color.border,
              overflow: 'hidden',
              marginRight: 12,
            }}
          >
            {league.avatarUri ? <Image source={{ uri: league.avatarUri }} style={{ width: 44, height: 44 }} /> : null}
          </View>

          <TotlText variant="body" style={{ flex: 1, fontWeight: '900' }} numberOfLines={1}>
            {league.name}
          </TotlText>
          <TotlText variant="caption" style={{ color: t.color.muted, fontWeight: '900', fontSize: 18, lineHeight: 18 }}>
            ›
          </TotlText>
        </View>

        <View style={{ marginTop: 10, flexDirection: 'row' }}>
          {isLoading ? (
            <TotlText variant="muted">Loading…</TotlText>
          ) : members.length ? (
            members.map((m, idx) => (
              <View key={m.id} style={{ marginLeft: idx === 0 ? 0 : -10 }}>
                <MemberChip name={m.name} />
              </View>
            ))
          ) : (
            <TotlText variant="muted">No members yet.</TotlText>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Mini-league “Default View” shown before LIVE (and when user toggles off live tables).
 * Mirrors the web Home default view: horizontal scroll, batched in rows of 3.
 */
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
          <Card style={{ width: 320, paddingVertical: 6 }}>
            {batch.map((l, idx) => (
              <View key={l.id}>
                <View style={{ paddingHorizontal: 16 }}>
                  <LeagueDefaultRow league={l} onPress={() => onLeaguePress(l.id, l.name)} />
                </View>
                {idx < batch.length - 1 ? (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: 'rgba(148,163,184,0.18)',
                      marginLeft: 16,
                      marginRight: 16,
                    }}
                  />
                ) : null}
              </View>
            ))}
          </Card>
        </View>
      )}
    />
  );
}


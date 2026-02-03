import React from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card, TotlText, useTokens } from '@totl/ui';
import { api } from '../lib/api';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

function initial1(name: string): string {
  const s = name.trim();
  if (!s) return '?';
  return s.slice(0, 1).toUpperCase();
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
        backgroundColor: '#CED5D2',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={{ width: SIZE, height: SIZE }} />
      ) : (
        <TotlText
          style={{
            fontFamily: 'System',
            fontWeight: '600',
            fontSize: 12.5,
            lineHeight: 13,
            color: '#000000',
            textAlign: 'center',
          }}
        >
          {initial1(name)}
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
  const { unreadByLeagueId } = useLeagueUnreadCounts();
  const { data, isLoading } = useQuery({
    queryKey: ['leagueMembers', league.id],
    queryFn: () => api.getLeague(league.id),
  });

  const members = (data?.members ?? []).slice(0, 4);
  const AVATAR_SIZE = 44;
  const unread = Number(unreadByLeagueId[String(league.id)] ?? 0);
  const badgeNumber = Math.min(99, unread);
  const showBadge = badgeNumber > 0;
  const badgeLabel = String(Math.min(99, badgeNumber));
  const badgeIsSingleDigit = badgeLabel.length === 1;

  return (
    <Pressable
      onPress={() => {
        onPress();
      }}
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

        {showBadge ? (
          <View
            style={{
              marginLeft: 12,
              height: 20,
              width: badgeIsSingleDigit ? 20 : undefined,
              minWidth: badgeIsSingleDigit ? 20 : 30,
              paddingHorizontal: badgeIsSingleDigit ? 0 : 3, // Figma: 0px 3px
              borderRadius: 999,
              backgroundColor: '#FF5E5C',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TotlText
              style={{
                color: '#FFFFFF',
                // iOS spec: SF Pro Display, 14/17, weight 500.
                // RN-safe fallback: System + fontWeight.
                fontFamily: 'SF Pro Display',
                fontWeight: '500',
                fontSize: 14,
                lineHeight: 17,
                textAlign: 'center',
                fontVariant: ['tabular-nums'],
              }}
          >
              {badgeLabel}
          </TotlText>
        </View>
        ) : (
          <View style={{ width: 30, marginLeft: 12 }} />
        )}
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
  // Match the 3-row layout so *all* default cards have the same container height.
  // This avoids the “single league” case looking taller than other default cards.
  const DEFAULT_CONTAINER_HEIGHT = 290;
  const CARD_RADIUS = 16;
  const CARD_BORDER = '#DFEBE9';
  return (
    <Card
      style={{
        width,
        height: DEFAULT_CONTAINER_HEIGHT,
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderRadius: CARD_RADIUS,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: CARD_BORDER,
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


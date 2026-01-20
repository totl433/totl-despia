import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

function ordinal(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function MemberChip({ name, avatarUri, ringColor }: { name: string; avatarUri?: string | null; ringColor: string }) {
  const t = useTokens();
  const size = 32;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: t.color.surface2,
        borderWidth: 3,
        borderColor: ringColor,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={{ width: size, height: size }} />
      ) : (
        <TotlText variant="caption" style={{ fontWeight: '900' }}>
          {initials(name)}
        </TotlText>
      )}
    </View>
  );
}

export default function MiniLeagueListItem({
  title,
  avatarUri,
  allSubmitted,
  membersCount,
  userRank,
  rankDelta,
  membersPreview,
  onPress,
}: {
  title: string;
  avatarUri: string | null;
  allSubmitted: boolean;
  membersCount: number | null;
  userRank: number | null;
  /** Positive = up, negative = down, 0/ null = none */
  rankDelta: number | null;
  membersPreview: Array<{ id: string; name: string; avatarUri?: string | null }>;
  onPress: () => void;
}) {
  const t = useTokens();
  const AVATAR_SIZE = 64; // match Home default-view sizing

  const statusText = allSubmitted ? 'All Submitted' : 'Waiting…';
  const statusColor = allSubmitted ? '#1C8376' : t.color.muted;

  const deltaIcon = rankDelta === null ? null : rankDelta === 0 ? '·' : rankDelta > 0 ? '▲' : '▼';
  const deltaColor = rankDelta === null || rankDelta === 0 ? t.color.muted : rankDelta > 0 ? '#16A34A' : '#DC2626';

  const ringColors = ['#FACC15', '#22C55E', '#60A5FA', '#EC4899'];

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1, transform: [{ scale: pressed ? 0.995 : 1 }] })}>
      <Card style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: 999,
              backgroundColor: t.color.surface2,
              borderWidth: 1,
              borderColor: t.color.border,
              overflow: 'hidden',
              marginRight: 16,
            }}
          >
            {avatarUri ? <Image source={{ uri: avatarUri }} style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }} /> : null}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <TotlText variant="body" numberOfLines={1} style={{ fontWeight: '900' }}>
              {title}
            </TotlText>

            <TotlText variant="caption" style={{ color: statusColor, fontWeight: '800', marginTop: 4 }}>
              {statusText}
            </TotlText>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              {/* Numbers match league title sizing */}
              <TotlText variant="body" style={{ fontWeight: '900' }}>
                {membersCount ?? '—'}
              </TotlText>
              <TotlText style={{ marginLeft: 10, color: deltaColor, fontWeight: '900' }}>{deltaIcon ?? ''}</TotlText>
              <TotlText variant="body" style={{ fontWeight: '900', marginLeft: 8 }}>
                {userRank ? ordinal(userRank) : '—'}
              </TotlText>
            </View>

            <View style={{ marginTop: 8, flexDirection: 'row' }}>
              {membersPreview.slice(0, 4).map((m, idx) => (
                <View key={m.id} style={{ marginLeft: idx === 0 ? 0 : -10 }}>
                  <MemberChip name={m.name} avatarUri={m.avatarUri ?? null} ringColor={ringColors[idx % ringColors.length]!} />
                </View>
              ))}
            </View>
          </View>

          <TotlText variant="caption" style={{ color: t.color.muted, fontWeight: '900', fontSize: 22, lineHeight: 22, marginLeft: 10 }}>
            ›
          </TotlText>
        </View>
      </Card>
    </Pressable>
  );
}


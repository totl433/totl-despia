import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';

function initial1(name: string): string {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return '?';
  return trimmed[0]!.toUpperCase();
}

function MemberChip({ name, avatarUri }: { name: string; avatarUri?: string | null }) {
  const t = useTokens();
  const size = 32;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        // Flat chips (no coloured rings)
        backgroundColor: '#CED5D2',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={{ width: size, height: size }} />
      ) : (
        <TotlText variant="caption" style={{ fontWeight: '900', color: '#0F172A' }}>
          {initial1(name)}
        </TotlText>
      )}
    </View>
  );
}

export default function MiniLeagueListItem({
  title,
  avatarUri,
  submittedCount,
  totalMembers,
  membersPreview,
  unreadCount,
  onPress,
}: {
  title: string;
  avatarUri: string | null;
  submittedCount: number | null;
  totalMembers: number | null;
  membersPreview: Array<{ id: string; name: string; avatarUri?: string | null }>;
  unreadCount?: number | null;
  onPress: () => void;
}) {
  const t = useTokens();
  const AVATAR_SIZE = 64; // match Home default-view sizing
  const badgeNumber = Math.min(99, Math.max(0, Number(unreadCount ?? 0)));
  const showBadge = badgeNumber > 0;
  const badgeLabel = String(badgeNumber);
  const badgeIsSingleDigit = badgeLabel.length === 1;

  const allSubmitted = !!totalMembers && !!submittedCount && submittedCount === totalMembers && totalMembers > 0;
  const statusText =
    typeof submittedCount === 'number' && typeof totalMembers === 'number' && totalMembers > 0
      ? allSubmitted
        ? 'All Submitted'
        : `${submittedCount}/${totalMembers} Submitted`
      : '—';
  const statusColor = allSubmitted ? '#1C8376' : t.color.muted;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1, transform: [{ scale: pressed ? 0.995 : 1 }] })}>
      <Card
        style={{
          paddingVertical: 14,
          paddingHorizontal: 16,
          // Remove all shadows (flat iOS surface)
          shadowOpacity: 0,
          shadowRadius: 0,
          shadowOffset: { width: 0, height: 0 },
          elevation: 0,
        }}
      >
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

            <View style={{ marginTop: 8, flexDirection: 'row' }}>
              {membersPreview.slice(0, 4).map((m, idx) => (
                <View key={m.id} style={{ marginLeft: idx === 0 ? 0 : -10 }}>
                  <MemberChip name={m.name} avatarUri={m.avatarUri ?? null} />
                </View>
              ))}
            </View>
          </View>

          {showBadge ? (
            <View
              style={{
                marginLeft: 10,
                height: 20,
                width: badgeIsSingleDigit ? 20 : undefined,
                minWidth: badgeIsSingleDigit ? 20 : 30,
                paddingHorizontal: badgeIsSingleDigit ? 0 : 3,
                borderRadius: 999,
                backgroundColor: '#FF5E5C',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TotlText
                style={{
                  color: '#FFFFFF',
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
            <TotlText variant="caption" style={{ color: t.color.muted, fontWeight: '900', fontSize: 22, lineHeight: 22, marginLeft: 10 }}>
              ›
            </TotlText>
          )}
        </View>
      </Card>
    </Pressable>
  );
}


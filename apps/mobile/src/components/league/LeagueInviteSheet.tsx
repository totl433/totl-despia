import React from 'react';
import { Image, Pressable, Share, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { TotlText, useTokens } from '@totl/ui';
import * as Clipboard from 'expo-clipboard';

import { buildMiniLeagueInviteLink } from '../../lib/deepLinks';
import { inviteErrorMessage, leagueInviteApi } from '../../lib/leagueInviteApi';
import { USERNAME_MAX_LENGTH } from '../../lib/displayName';
import { searchUsersByName, type UserSearchHit } from '../../lib/searchUsers';

type UserMatch = UserSearchHit;
type Invitee = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  status: 'waiting' | 'joined' | 'declined';
  invitedAt: string;
};
const LEAGUE_MAX_MEMBERS = 8;
const INVITEE_STATUS: Record<Invitee['status'], { label: string; color: string }> = {
  waiting: { label: 'Waiting', color: '#64748B' },
  joined: { label: 'Joined', color: '#0F766E' },
  declined: { label: 'Declined', color: '#B91C1C' },
};

export default function LeagueInviteSheet({
  open,
  onClose,
  leagueId,
  leagueName,
  leagueCode,
  memberCount = 1,
  title = 'Invite players',
  shareTextOverride,
  urlOverride,
}: {
  open: boolean;
  onClose: () => void;
  leagueId?: string | null;
  leagueName: string;
  leagueCode: string;
  memberCount?: number;
  title?: string;
  shareTextOverride?: string;
  urlOverride?: string;
}) {
  const t = useTokens();
  const ref = React.useRef<BottomSheetModal>(null);
  const canInviteByUsername = Boolean(leagueId);

  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [username, setUsername] = React.useState('');
  const [selected, setSelected] = React.useState<UserMatch[]>([]);
  const [matches, setMatches] = React.useState<UserMatch[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [inviting, setInviting] = React.useState(false);
  const [invitees, setInvitees] = React.useState<Invitee[]>([]);
  const waitingCount = invitees.filter((row) => row.status === 'waiting').length;
  const spacesLeft = Math.max(0, LEAGUE_MAX_MEMBERS - memberCount - waitingCount - selected.length);
  const leagueFull = memberCount + waitingCount >= LEAGUE_MAX_MEMBERS;
  const snapPoints = React.useMemo(
    () => [canInviteByUsername ? (invitees.length > 0 ? 720 : 620) : 252],
    [canInviteByUsername, invitees.length]
  );

  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => ref.current?.present());
      return;
    }
    setUsername('');
    setSelected([]);
    setMatches([]);
    setNotice(null);
    ref.current?.dismiss();
  }, [open]);

  const loadInvitees = React.useCallback(async () => {
    if (!leagueId) {
      setInvitees([]);
      return;
    }
    try {
      const { invitees: rows } = await leagueInviteApi.listInvitees(leagueId);
      setInvitees(rows);
    } catch {
      // Keep whatever we already showed — Railway may not have the list route yet.
    }
  }, [leagueId]);

  React.useEffect(() => {
    if (!open || !leagueId) return;
    void loadInvitees();
  }, [leagueId, loadInvitees, open]);

  React.useEffect(() => {
    const q = username.trim();
    if (!open || !canInviteByUsername || q.length < 3) {
      setMatches([]);
      setSearchError(null);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    setSearchError(null);
    const timer = setTimeout(() => {
      void searchUsersByName(q)
        .then((users) => {
          if (alive) setMatches(users);
        })
        .catch(() => {
          if (alive) {
            setMatches([]);
            setSearchError('Could not look up usernames.');
          }
        })
        .finally(() => {
          if (alive) setSearching(false);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [canInviteByUsername, open, username]);

  const shareText = String(
    shareTextOverride ?? `You've been invited to join "${leagueName}" on TOTL.\nTap to open the invite:`
  );
  const url = urlOverride ? String(urlOverride) : buildMiniLeagueInviteLink(leagueCode);

  const handleShare = async () => {
    try {
      await Share.share({ message: url ? `${shareText}\n${url}` : `${shareText}\nCode: ${leagueCode}` });
    } catch {
      // ignore
    }
  };

  const addMatch = (match: UserMatch) => {
    if (selected.some((row) => row.id === match.id)) {
      setUsername('');
      setMatches([]);
      return;
    }
    const existing = invitees.find((row) => row.userId === match.id);
    if (existing) {
      setUsername('');
      setMatches([]);
      setNotice({
        kind: 'error',
        text:
          existing.status === 'joined'
            ? `${match.name} is already in this mini league.`
            : existing.status === 'declined'
              ? `${match.name} declined. You can share the code if they change their mind.`
              : `${match.name} already has an invite.`,
      });
      return;
    }
    if (leagueFull || spacesLeft <= 0) {
      setNotice({ kind: 'error', text: `This mini league is full (${LEAGUE_MAX_MEMBERS}).` });
      return;
    }
    setSelected((current) => [...current, match]);
    setUsername('');
    setMatches([]);
  };

  const removeSelected = (id: string) => {
    setSelected((current) => current.filter((row) => row.id !== id));
  };

  const handleInviteByUsername = async () => {
    if (!leagueId || inviting || selected.length === 0) return;
    setInviting(true);
    const sent: string[] = [];
    const failed: string[] = [];
    try {
      for (const player of selected) {
        try {
          await leagueInviteApi.invite(leagueId, player.name);
          sent.push(player.name);
        } catch (error) {
          failed.push(inviteErrorMessage(error, `Could not invite ${player.name}.`));
        }
      }
      if (failed.length === 0) {
        const names = sent.length === 1 ? sent[0] : sent.length === 2 ? `${sent[0]} and ${sent[1]}` : `${sent.slice(0, -1).join(', ')} and ${sent[sent.length - 1]}`;
        const sentRows = selected.filter((row) => sent.includes(row.name));
        setInvitees((current) => {
          const seen = new Set(current.map((row) => row.userId));
          return [
            ...current,
            ...sentRows
              .filter((row) => !seen.has(row.id))
              .map((row) => ({
                userId: row.id,
                name: row.name,
                avatarUrl: row.avatarUrl,
                status: 'waiting' as const,
                invitedAt: new Date().toISOString(),
              })),
          ];
        });
        setSelected([]);
        setNotice({
          kind: 'ok',
          text: sent.length === 1 ? `Invite sent to ${names}. They'll see it pinned on Match Center.` : `Invites sent to ${names}. They'll see them pinned on Match Center.`,
        });
        void loadInvitees();
      } else {
        setSelected((current) => current.filter((row) => !sent.includes(row.name)));
        setNotice({
          kind: 'error',
          text: sent.length > 0 ? `Sent ${sent.length}, but ${failed[0]}` : failed[0] ?? 'Could not send those invites.',
        });
      }
    } finally {
      setInviting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(leagueCode);
      setNotice({ kind: 'ok', text: 'Code copied. Share it with anyone not on TotL yet.' });
    } catch {
      setNotice({ kind: 'error', text: "Couldn't copy the code." });
    }
  };

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={onClose}
      backgroundStyle={{ backgroundColor: t.color.surface }}
      handleIndicatorStyle={{ backgroundColor: t.color.border }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
      )}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24 }}>
        <TotlText style={{ fontFamily: 'System', fontSize: 16, lineHeight: 20, fontWeight: '700', color: t.color.text }}>
          {title}
        </TotlText>
        <TotlText style={{ marginTop: 6, fontFamily: 'System', fontSize: 13, lineHeight: 16, color: t.color.muted }}>
          {canInviteByUsername
            ? leagueFull
              ? `This mini league is full (${LEAGUE_MAX_MEMBERS}). Share the code only if someone is leaving.`
              : `Add players by username — ${spacesLeft} space${spacesLeft === 1 ? '' : 's'} left of ${LEAGUE_MAX_MEMBERS}.`
            : url
              ? 'Copy the code, or tap Share — your message includes the TotL join link.'
              : 'Copy the code or tap Share.'}
        </TotlText>

        {canInviteByUsername ? (
          <View style={{ marginTop: 14, gap: 8 }}>
            {invitees.length > 0 ? (
              <View style={{ gap: 8 }}>
                <TotlText style={{ fontFamily: 'System', fontSize: 13, lineHeight: 16, fontWeight: '700', color: t.color.text }}>
                  Invited
                </TotlText>
                {invitees.map((player) => {
                  const status = INVITEE_STATUS[player.status];
                  return (
                    <View
                      key={player.userId}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderRadius: 12,
                        backgroundColor: t.color.surface2,
                      }}
                    >
                      {player.avatarUrl ? (
                        <Image source={{ uri: player.avatarUrl }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                      ) : (
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: t.color.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <TotlText style={{ fontSize: 12, fontWeight: '800', color: t.color.text }}>
                            {player.name.slice(0, 1).toUpperCase()}
                          </TotlText>
                        </View>
                      )}
                      <TotlText style={{ flex: 1, fontFamily: 'System', fontSize: 14, fontWeight: '700', color: t.color.text }}>
                        {player.name}
                      </TotlText>
                      <View
                        style={{
                          paddingVertical: 4,
                          paddingHorizontal: 8,
                          borderRadius: 999,
                          backgroundColor: player.status === 'joined' ? 'rgba(15,118,110,0.12)' : player.status === 'declined' ? 'rgba(185,28,28,0.08)' : 'rgba(100,116,139,0.12)',
                        }}
                      >
                        <TotlText style={{ fontFamily: 'System', fontSize: 12, lineHeight: 14, fontWeight: '800', color: status.color }}>
                          {status.label}
                        </TotlText>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
            {!leagueFull ? (
            <>
            <TotlText style={{ fontFamily: 'System', fontSize: 13, lineHeight: 16, fontWeight: '700', color: t.color.text }}>
              Invite by username
            </TotlText>
            {selected.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {selected.map((player) => (
                  <Pressable
                    key={player.id}
                    onPress={() => removeSelected(player.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      backgroundColor: 'rgba(15,118,110,0.12)',
                    }}
                  >
                    <TotlText style={{ fontFamily: 'System', fontSize: 13, fontWeight: '700', color: t.color.text }}>
                      {player.name}
                    </TotlText>
                    <Ionicons name="close" size={14} color={t.color.text} />
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BottomSheetTextInput
                value={username}
                onChangeText={(value) => setUsername(value.slice(0, USERNAME_MAX_LENGTH))}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={spacesLeft > 0 ? 'e.g. Carl' : 'League is full'}
                placeholderTextColor={t.color.muted}
                editable={spacesLeft > 0}
                returnKeyType="done"
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: t.color.border,
                  backgroundColor: t.color.surface2,
                  paddingHorizontal: 14,
                  color: t.color.text,
                  fontSize: 16,
                }}
              />
              <Pressable
                onPress={() => void handleInviteByUsername()}
                disabled={inviting || selected.length === 0}
                style={({ pressed }) => ({
                  height: 44,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  backgroundColor: t.color.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: inviting || selected.length === 0 ? 0.5 : pressed ? 0.92 : 1,
                })}
              >
                <TotlText style={{ color: '#FFFFFF', fontFamily: 'System', fontSize: 14, fontWeight: '800' }}>
                  {inviting ? 'Sending…' : selected.length > 1 ? `Invite ${selected.length}` : 'Invite'}
                </TotlText>
              </Pressable>
            </View>
            {username.trim().length >= 3 ? (
              <View style={{ gap: 6 }}>
                {searching && matches.length === 0 ? (
                  <TotlText style={{ fontFamily: 'System', fontSize: 12, lineHeight: 16, color: t.color.muted }}>
                    Looking up that username…
                  </TotlText>
                ) : null}
                {matches.map((match) => {
                  const already = selected.some((row) => row.id === match.id) || invitees.some((row) => row.userId === match.id);
                  return (
                    <Pressable
                      key={match.id}
                      onPress={() => addMatch(match)}
                      disabled={already || spacesLeft <= 0}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderRadius: 12,
                        backgroundColor: already ? 'rgba(15,118,110,0.12)' : pressed ? 'rgba(148,163,184,0.12)' : t.color.surface2,
                        opacity: already || spacesLeft <= 0 ? 0.55 : 1,
                      })}
                    >
                      {match.avatarUrl ? (
                        <Image source={{ uri: match.avatarUrl }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                      ) : (
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: t.color.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <TotlText style={{ fontSize: 12, fontWeight: '800', color: t.color.text }}>
                            {match.name.slice(0, 1).toUpperCase()}
                          </TotlText>
                        </View>
                      )}
                      <TotlText style={{ flex: 1, fontFamily: 'System', fontSize: 14, fontWeight: '700', color: t.color.text }}>
                        {match.name}
                      </TotlText>
                      <Ionicons name={already ? 'checkmark-circle' : 'add-circle-outline'} size={18} color={t.color.brand} />
                    </Pressable>
                  );
                })}
                {!searching && searchError ? (
                  <TotlText style={{ fontFamily: 'System', fontSize: 12, lineHeight: 16, color: t.color.muted }}>
                    {searchError}
                  </TotlText>
                ) : null}
                {!searching && !searchError && matches.length === 0 ? (
                  <TotlText style={{ fontFamily: 'System', fontSize: 12, lineHeight: 16, color: t.color.muted }}>
                    No player has that username.
                  </TotlText>
                ) : null}
              </View>
            ) : null}
            </>
            ) : null}
            {notice ? (
              <View
                style={{
                  marginTop: 4,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  backgroundColor: notice.kind === 'ok' ? 'rgba(15,118,110,0.12)' : 'rgba(185,28,28,0.08)',
                }}
              >
                <Ionicons
                  name={notice.kind === 'ok' ? 'checkmark-circle' : 'alert-circle'}
                  size={20}
                  color={notice.kind === 'ok' ? t.color.brand : '#B91C1C'}
                  style={{ marginTop: 1 }}
                />
                <TotlText style={{ flex: 1, fontFamily: 'System', fontSize: 14, lineHeight: 18, fontWeight: '600', color: t.color.text }}>
                  {notice.text}
                </TotlText>
              </View>
            ) : null}
          </View>
        ) : notice ? (
          <View
            style={{
              marginTop: 14,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 14,
              backgroundColor: notice.kind === 'ok' ? 'rgba(15,118,110,0.12)' : 'rgba(185,28,28,0.08)',
            }}
          >
            <Ionicons
              name={notice.kind === 'ok' ? 'checkmark-circle' : 'alert-circle'}
              size={20}
              color={notice.kind === 'ok' ? t.color.brand : '#B91C1C'}
              style={{ marginTop: 1 }}
            />
            <TotlText style={{ flex: 1, fontFamily: 'System', fontSize: 14, lineHeight: 18, fontWeight: '600', color: t.color.text }}>
              {notice.text}
            </TotlText>
          </View>
        ) : null}

        <View
          style={{
            marginTop: 10,
            borderWidth: 1,
            borderColor: t.color.border,
            backgroundColor: t.color.surface2,
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 14,
          }}
        >
          <TotlText
            style={{
              fontFamily: 'System',
              fontSize: 18,
              lineHeight: 22,
              fontWeight: '800',
              letterSpacing: 1.2,
              color: t.color.text,
            }}
          >
            {leagueCode}
          </TotlText>
        </View>

        <View style={{ height: 12 }} />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={handleCopy}
            style={({ pressed }) => ({
              flex: 1,
              height: 44,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: t.color.border,
              backgroundColor: pressed ? 'rgba(148,163,184,0.12)' : t.color.surface,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            })}
          >
            <Ionicons name="copy-outline" size={18} color={t.color.text} />
            <TotlText
              style={{
                fontFamily: 'System',
                fontSize: 14,
                lineHeight: 18,
                fontWeight: '700',
                color: t.color.text,
              }}
            >
              Copy code
            </TotlText>
          </Pressable>

          <Pressable
            onPress={handleShare}
            style={({ pressed }) => ({
              flex: 1,
              height: 44,
              borderRadius: 14,
              backgroundColor: t.color.brand,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <Ionicons name="share-outline" size={18} color="#FFFFFF" />
            <TotlText style={{ color: '#FFFFFF', fontFamily: 'System', fontSize: 14, lineHeight: 18, fontWeight: '800' }}>Share</TotlText>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}


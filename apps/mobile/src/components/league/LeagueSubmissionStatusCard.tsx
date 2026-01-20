import React from 'react';
import { Pressable, Share, View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';

export default function LeagueSubmissionStatusCard({
  members,
  submittedSet,
  picksGw,
  fixtures,
  variant = 'full',
}: {
  members: Array<{ id: string; name: string }>;
  submittedSet: Set<string>;
  picksGw: number;
  fixtures: Array<{ kickoff_time?: string | null }>;
  variant?: 'full' | 'compact';
}) {
  const t = useTokens();

  const remaining = members.filter((m) => !submittedSet.has(m.id)).length;
  const allSubmitted = members.length > 0 && remaining === 0;

  const kickoffTimes = fixtures
    .map((f) => f.kickoff_time)
    .filter((kt): kt is string => !!kt)
    .map((kt) => new Date(kt))
    .filter((d) => !Number.isNaN(d.getTime()));

  const firstKickoff = kickoffTimes.length ? new Date(Math.min(...kickoffTimes.map((d) => d.getTime()))) : null;
  const deadlineTime = firstKickoff ? new Date(firstKickoff.getTime() - 75 * 60 * 1000) : null;
  const deadlinePassed = deadlineTime ? new Date() >= deadlineTime : false;

  const deadlineStr = (() => {
    if (!deadlineTime) return null;
    const day = deadlineTime.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
    const hh = String(deadlineTime.getUTCHours()).padStart(2, '0');
    const mm = String(deadlineTime.getUTCMinutes()).padStart(2, '0');
    return `${day}, ${hh}:${mm} BST`;
  })();

  const shareReminder = async () => {
    const title = `Gameweek ${picksGw} Predictions Reminder!`;
    const msg = `${title}\n\nDEADLINE: ${deadlineStr ?? '—'}\n\nDon't forget!\nplaytotl.com`;
    await Share.share({ message: msg });
  };

  return (
    <Card style={{ marginTop: 8, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <TotlText variant="body" style={{ fontWeight: '900' }}>
          {allSubmitted
            ? `All ${members.length} members have submitted.`
            : `Waiting for ${remaining} of ${members.length} to submit.`}
        </TotlText>

        {!allSubmitted ? (
          <Pressable
            onPress={() => void shareReminder()}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 12,
              backgroundColor: t.color.brand,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <TotlText variant="caption" style={{ color: '#FFFFFF', fontWeight: '900' }}>
              Share reminder
            </TotlText>
          </Pressable>
        ) : null}
      </View>

      {deadlineStr ? (
        <TotlText variant="caption" style={{ color: deadlinePassed ? '#FB923C' : t.color.muted, fontWeight: deadlinePassed ? '900' : '700' }}>
          {deadlinePassed ? '⏰ Deadline Passed: ' : '⏰ Deadline: '}
          {deadlineStr}
        </TotlText>
      ) : null}

      <View style={{ height: 10 }} />

      <View style={{ gap: 8 }}>
        {members
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((m) => {
            const submitted = submittedSet.has(m.id);
            return (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <TotlText variant="caption" numberOfLines={1} style={{ flex: 1, fontWeight: '800' }}>
                  {m.name}
                </TotlText>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: submitted ? 'rgba(34,197,94,0.35)' : 'rgba(251,191,36,0.35)',
                    backgroundColor: submitted ? 'rgba(34,197,94,0.14)' : 'rgba(251,191,36,0.14)',
                    minWidth: variant === 'compact' ? 88 : 96,
                    alignItems: 'center',
                  }}
                >
                  <TotlText variant="caption" style={{ fontWeight: '900', color: submitted ? '#22C55E' : '#F59E0B' }}>
                    {submitted ? 'Submitted' : 'Not yet'}
                  </TotlText>
                </View>
              </View>
            );
          })}
      </View>
    </Card>
  );
}


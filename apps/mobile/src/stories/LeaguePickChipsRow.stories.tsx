import React from 'react';
import { View } from 'react-native';
import { Screen, TotlText } from '@totl/ui';

import LeaguePickChipsRow from '../components/league/LeaguePickChipsRow';
import { DEV_FAKE_LEAGUE_MEMBERS, buildDevFixturePicks } from '../lib/devFakeLeague';
import type { LeaguePick } from '../components/league/LeaguePickPill';

export default {
  title: 'League/LeaguePickChipsRow',
};

const members = DEV_FAKE_LEAGUE_MEMBERS.map((m) => ({
  id: m.id,
  name: m.name,
  avatar_url: m.avatar_url,
  avatar_bg_color: m.avatar_bg_color,
}));
const memberIds = members.map((m) => m.id);

function picksMap(displayOrder: number, isLast = false): Map<string, LeaguePick> {
  return new Map(Object.entries(buildDevFixturePicks(memberIds, displayOrder, isLast)));
}

export function Basic() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <LeaguePickChipsRow
          members={[
            { id: '1', name: 'Thomas James Bird', avatar_url: null },
            { id: '2', name: 'Jof' },
            { id: '3', name: 'SP' },
            { id: '4', name: 'Carl', avatar_url: 'https://placehold.co/64x64/png' },
          ]}
          picksByUserId={
            new Map([
              ['1', 'D'],
              ['2', 'D'],
              ['3', 'H'],
              ['4', 'D'],
            ])
          }
          outcome="D"
          currentUserId="2"
        />
      </View>
    </Screen>
  );
}

export function EightPlayerHomeDrawSteps() {
  const rows: Array<{ label: string; order: number; isLast?: boolean }> = [
    { label: '8–0–0', order: 0 },
    { label: '7–1–0', order: 1 },
    { label: '6–2–0', order: 2 },
    { label: '5–3–0', order: 3 },
    { label: '4–4–0', order: 4 },
    { label: '3–2–3', order: 0, isLast: true },
  ];
  return (
    <Screen fullBleed>
      <View style={{ padding: 16, gap: 16 }}>
        {rows.map((row) => (
          <View key={row.label} style={{ backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 8 }}>
            <TotlText variant="caption" style={{ paddingHorizontal: 12, marginBottom: 4 }}>
              {row.label}
            </TotlText>
            <LeaguePickChipsRow
              members={members}
              picksByUserId={picksMap(row.order, row.isLast)}
              outcome={null}
              currentUserId={null}
            />
          </View>
        ))}
      </View>
    </Screen>
  );
}

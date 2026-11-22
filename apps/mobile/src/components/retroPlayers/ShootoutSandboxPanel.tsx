import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { TotlText } from '@totl/ui';

import { shootoutSandbox, type SandboxBotSkill } from '../../lib/retroPlayers/shootoutSandbox';
import { PLAYERS_COLORS, PLAYERS_FONTS } from './playersTheme';

/** Re-renders whenever the sandbox changes. */
function useSandboxVersion(): number {
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => shootoutSandbox.subscribe(() => setVersion((v) => v + 1)), []);
  return version;
}

function Pills<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.pills}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.pill, on && styles.pillOn]}
          >
            <TotlText style={[styles.pillLabel, on && { color: PLAYERS_COLORS.white }]}>{o.label}</TotlText>
          </Pressable>
        );
      })}
    </View>
  );
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, { opacity: pressed ? 0.7 : 1 }]}
    >
      <TotlText style={styles.actionLabel}>{label}</TotlText>
    </Pressable>
  );
}

/**
 * Admin sandbox controls on the Shootout home: how Test Bot plays, time skips,
 * and a log of every move. Nothing here touches real data.
 */
export default function ShootoutSandboxPanel({ onOpenChallenge }: { onOpenChallenge: (id: string) => void }) {
  useSandboxVersion();
  const settings = shootoutSandbox.getSettings();
  const log = shootoutSandbox.log().slice(0, 10);

  return (
    <View style={styles.panel}>
      <TotlText style={styles.title}>Sandbox</TotlText>
      <TotlText style={styles.help}>
        Same rules as the real thing, against Test Bot and sample players, played in memory. Nothing is saved and no one is notified. Reloading the app clears it.
      </TotlText>

      <TotlText style={styles.label}>Opponents answer</TotlText>
      <Pills<SandboxBotSkill>
        value={settings.botSkill}
        onChange={(v) => shootoutSandbox.setBotSkill(v)}
        options={[
          { value: 'right', label: 'Always right' },
          { value: 'coin', label: '50/50' },
          { value: 'wrong', label: 'Always wrong' },
        ]}
      />

      <TotlText style={styles.label}>Opponents take</TotlText>
      <Pills<number>
        value={settings.botDelayMs}
        onChange={(v) => shootoutSandbox.setBotDelay(v)}
        options={[
          { value: 300, label: 'No time' },
          { value: 1500, label: '1.5 sec' },
          { value: 6000, label: '6 sec' },
        ]}
      />

      <View style={styles.switchRow}>
        <TotlText style={[styles.label, { marginTop: 0, flex: 1 }]}>Show the answer on your cards</TotlText>
        <Switch
          value={settings.showAnswers}
          onValueChange={(on) => shootoutSandbox.setShowAnswers(on)}
          trackColor={{ true: PLAYERS_COLORS.brand }}
        />
      </View>

      <View style={styles.actions}>
        <ActionButton label="Test Bot challenges you" onPress={() => onOpenChallenge(shootoutSandbox.botChallengesYou())} />
        <ActionButton label="Skip 24 hours" onPress={() => shootoutSandbox.skipTime()} />
        <ActionButton label="Add sample Shootouts" onPress={() => void shootoutSandbox.addSamples()} />
        <ActionButton label="Reset" onPress={() => shootoutSandbox.reset()} />
      </View>

      {log.length ? (
        <View style={{ marginTop: 12, gap: 4 }}>
          <TotlText style={styles.label}>What happened</TotlText>
          {log.map((line, i) => (
            <TotlText key={`${line.at}-${i}`} style={styles.logLine}>
              {line.text}
            </TotlText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: PLAYERS_COLORS.brand,
    padding: 14,
  },
  title: { fontFamily: PLAYERS_FONTS.display, fontSize: 22, lineHeight: 24, textTransform: 'uppercase', color: PLAYERS_COLORS.brand },
  help: { fontFamily: PLAYERS_FONTS.body, fontSize: 13, lineHeight: 18, color: PLAYERS_COLORS.muted, marginTop: 4 },
  label: { fontFamily: PLAYERS_FONTS.medium, fontSize: 14, lineHeight: 18, color: PLAYERS_COLORS.inkSoft, marginTop: 12, marginBottom: 6 },
  pills: { flexDirection: 'row', gap: 6 },
  pill: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PLAYERS_COLORS.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: { backgroundColor: PLAYERS_COLORS.brand, borderColor: PLAYERS_COLORS.brand },
  pillLabel: { fontFamily: PLAYERS_FONTS.medium, fontSize: 13, color: PLAYERS_COLORS.inkSoft },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  action: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
    backgroundColor: PLAYERS_COLORS.mist,
    justifyContent: 'center',
  },
  actionLabel: { fontFamily: PLAYERS_FONTS.medium, fontSize: 13, color: PLAYERS_COLORS.inkSoft },
  logLine: { fontFamily: PLAYERS_FONTS.body, fontSize: 13, lineHeight: 18, color: PLAYERS_COLORS.inkSoft },
});

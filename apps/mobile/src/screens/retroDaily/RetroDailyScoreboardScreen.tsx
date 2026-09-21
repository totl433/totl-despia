import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TotlText, useTokens } from '@totl/ui';

import { MOCK_RETRO_SEASON, MOCK_RETRO_SEASON_FULL } from '../../lib/retroDaily/mockPuzzle';
import { RETRO_PIXEL_FONT } from '../../lib/retroDaily/retroFont';

const BG = '#0B1F3A';
const CHROME_WHITE = '#FFFFFF';
const TEAL = '#1C8376';

type BoardTab = 'today' | 'allTime';

type BoardRow = {
  rank: number;
  name: string;
  score: number;
  you?: boolean;
};

/** Prototype daily board — replaced by live daily seed rankings later. */
const MOCK_TODAY: BoardRow[] = [
  { rank: 1, name: 'PixelPundit', score: 10 },
  { rank: 2, name: 'RetroRonnie', score: 9 },
  { rank: 3, name: 'You', score: 8, you: true },
  { rank: 4, name: 'WembleyWizard', score: 7 },
  { rank: 5, name: 'TerraceTom', score: 6 },
  { rank: 6, name: 'CornerFlag', score: 5 },
  { rank: 7, name: 'LastMinute', score: 4 },
  { rank: 8, name: 'OffsideOwl', score: 3 },
];

/** Prototype all-time board — cumulative correct picks across days. */
const MOCK_ALL_TIME: BoardRow[] = [
  { rank: 1, name: 'RetroRonnie', score: 186 },
  { rank: 2, name: 'PixelPundit', score: 172 },
  { rank: 3, name: 'WembleyWizard', score: 164 },
  { rank: 4, name: 'You', score: 141, you: true },
  { rank: 5, name: 'TerraceTom', score: 128 },
  { rank: 6, name: 'CornerFlag', score: 119 },
  { rank: 7, name: 'LastMinute', score: 97 },
  { rank: 8, name: 'OffsideOwl', score: 84 },
  { rank: 9, name: 'BackPassBill', score: 71 },
  { rank: 10, name: 'NutmegNed', score: 58 },
];

/**
 * Full-screen Retro Totl Daily scoreboard — Today + All Time.
 */
export default function RetroDailyScoreboardScreen() {
  const t = useTokens();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = React.useState<BoardTab>('today');

  const close = React.useCallback(() => {
    if (navigation.canGoBack?.()) navigation.goBack();
  }, [navigation]);

  const rows = tab === 'today' ? MOCK_TODAY : MOCK_ALL_TIME;
  const scoreHeader = tab === 'today' ? 'Score' : 'Total';

  return (
    <View style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top }}>
      <View style={{ height: 56, paddingHorizontal: t.space[4], justifyContent: 'center' }}>
        <View style={{ height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={close}
            style={({ pressed }) => ({
              position: 'absolute',
              left: 0,
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'transparent',
            })}
          >
            <Ionicons name="close" size={24} color={CHROME_WHITE} />
          </Pressable>
          <TotlText style={{ fontWeight: '900', fontSize: 18, lineHeight: 22, color: CHROME_WHITE }}>
            Scoreboard
          </TotlText>
        </View>
      </View>

      <View style={{ paddingHorizontal: t.space[4], paddingTop: 4, paddingBottom: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderRadius: 14,
            padding: 4,
          }}
        >
          <TabButton label="Today" active={tab === 'today'} onPress={() => setTab('today')} />
          <TabButton label="All Time" active={tab === 'allTime'} onPress={() => setTab('allTime')} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingBottom: insets.bottom + 28,
          paddingTop: 4,
        }}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'today' ? (
          <>
            <TotlText
              style={{
                fontFamily: RETRO_PIXEL_FONT,
                fontSize: 14,
                lineHeight: 20,
                color: '#5EEAD4',
                textAlign: 'center',
              }}
            >
              {MOCK_RETRO_SEASON_FULL}
            </TotlText>
            <TotlText
              style={{
                marginTop: 6,
                textAlign: 'center',
                fontWeight: '700',
                fontSize: 13,
                color: 'rgba(255,255,255,0.65)',
              }}
            >
              Today’s board · season {MOCK_RETRO_SEASON}
            </TotlText>
          </>
        ) : (
          <>
            <TotlText
              style={{
                fontFamily: RETRO_PIXEL_FONT,
                fontSize: 14,
                lineHeight: 20,
                color: '#5EEAD4',
                textAlign: 'center',
              }}
            >
              ALL TIME
            </TotlText>
            <TotlText
              style={{
                marginTop: 6,
                textAlign: 'center',
                fontWeight: '700',
                fontSize: 13,
                color: 'rgba(255,255,255,0.65)',
              }}
            >
              Cumulative correct picks across every day
            </TotlText>
          </>
        )}

        <LeaderboardTable rows={rows} scoreHeader={scoreHeader} textColor={t.color.text} />

        <TotlText
          style={{
            marginTop: 16,
            textAlign: 'center',
            fontSize: 12,
            fontWeight: '600',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          Prototype rankings — live boards ship with the real daily seed.
        </TotlText>
      </ScrollView>
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 40,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? TEAL : 'transparent',
        opacity: pressed && !active ? 0.75 : 1,
      })}
    >
      <TotlText
        style={{
          fontWeight: '800',
          fontSize: 14,
          color: CHROME_WHITE,
        }}
      >
        {label}
      </TotlText>
    </Pressable>
  );
}

function LeaderboardTable({
  rows,
  scoreHeader,
  textColor,
}: {
  rows: BoardRow[];
  scoreHeader: string;
  textColor: string;
}) {
  return (
    <View
      style={{
        marginTop: 22,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        paddingVertical: 6,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: '#E2E8F0',
        }}
      >
        <TotlText style={{ width: 36, fontWeight: '800', fontSize: 11, color: '#94A3B8' }}>#</TotlText>
        <TotlText style={{ flex: 1, fontWeight: '800', fontSize: 11, color: '#94A3B8' }}>Player</TotlText>
        <TotlText style={{ width: 56, textAlign: 'right', fontWeight: '800', fontSize: 11, color: '#94A3B8' }}>
          {scoreHeader}
        </TotlText>
      </View>

      {rows.map((row, i) => (
        <View
          key={`${scoreHeader}-${row.name}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: row.you ? 'rgba(28,131,118,0.1)' : 'transparent',
            borderBottomWidth: i === rows.length - 1 ? 0 : 1,
            borderBottomColor: '#F1F5F9',
          }}
        >
          <TotlText
            style={{
              width: 36,
              fontFamily: RETRO_PIXEL_FONT,
              fontSize: 14,
              color: row.rank <= 3 ? '#0F766E' : '#334155',
            }}
          >
            {row.rank}
          </TotlText>
          <TotlText
            style={{
              flex: 1,
              fontWeight: row.you ? '900' : '700',
              fontSize: 15,
              color: textColor,
            }}
            numberOfLines={1}
          >
            {row.name}
            {row.you ? '  · you' : ''}
          </TotlText>
          <TotlText
            style={{
              width: 56,
              textAlign: 'right',
              fontFamily: RETRO_PIXEL_FONT,
              fontSize: 16,
              color: textColor,
            }}
          >
            {row.score}
          </TotlText>
        </View>
      ))}
    </View>
  );
}

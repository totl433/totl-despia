import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { SvgUri } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import { TotlText, tokens, useTokens } from '@totl/ui';

import { TEAM_BADGES } from '../../lib/teamBadges';
import { isShareCancelled, shareCapturedImage } from '../../lib/shareToSocial';
import { TotlShareCanvas, TotlShareCardTilt } from '../share/TotlShareCanvas';
import type { FeedScoreRow } from '../../features/matchCenter/feed';

const CORRECT = Asset.fromModule(require('../../../assets/icons/score-sheet-correct.svg')).uri;
const WRONG = Asset.fromModule(require('../../../assets/icons/score-sheet-wrong.svg')).uri;
const EYE = Asset.fromModule(require('../../../assets/icons/only-you-eye.svg')).uri;

/** Figma 443:59698 (D02): white card, lime behind your pick, green share button. */
export const SCORE_SHEET_CARD = {
  green: '#0A635A',
  pick: '#EEFDB0',
  pill: '#F7F6F6',
  text: '#37373D',
  muted: '#97979D',
  score: '#19191C',
};

/** Score sheet header (Figma 443:59699): season and gameweek, "Only you", then your avatar, title and line. */
function ScoreSheetHeader({ eyebrow, title, line, avatarUrl }: { eyebrow: string; title: string; line?: string | null; avatarUrl?: string | null }) {
  const t = useTokens();
  return (
    <View style={{ paddingHorizontal: 16, gap: 20 }} accessible accessibilityLabel={[eyebrow, 'Only you', title, line].filter(Boolean).join('. ')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <TotlText numberOfLines={1} style={{ flexShrink: 1, fontFamily: t.font.bold, fontSize: 12, lineHeight: 14, textTransform: 'uppercase', color: SCORE_SHEET_CARD.green }}>
          {eyebrow}
        </TotlText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 2 }}>
          <SvgUri uri={EYE} width={13.418} height={14} />
          <TotlText style={{ fontFamily: t.font.regular, fontSize: 12, lineHeight: 14, letterSpacing: 0.12, color: SCORE_SHEET_CARD.muted }}>Only you</TotlText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: 38, height: 38, borderRadius: 19 }} resizeMode="cover" />
        ) : (
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: SCORE_SHEET_CARD.pill }} />
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <TotlText accessibilityRole="header" style={{ fontFamily: t.font.regular, fontSize: 22, lineHeight: 26, letterSpacing: 0.22, color: SCORE_SHEET_CARD.text }}>
            {title}
          </TotlText>
          {line ? (
            <TotlText style={{ fontFamily: t.font.regular, fontSize: 16, lineHeight: 20, letterSpacing: 0.16, color: SCORE_SHEET_CARD.muted }}>{line}</TotlText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function Crest({ code }: { code?: string }) {
  const badge = code ? TEAM_BADGES[code] : undefined;
  if (!badge) return <View style={{ width: 24, height: 24 }} />;
  return <Image source={badge} style={{ width: 24, height: 24 }} resizeMode="contain" />;
}

function Side({ code, name, align, picked }: { code?: string; name: string; align: 'home' | 'away'; picked: boolean }) {
  const home = align === 'home';
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        height: 36,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: home ? 'flex-end' : 'flex-start',
        gap: 8,
        paddingHorizontal: 8,
        borderRadius: 8,
        backgroundColor: picked ? SCORE_SHEET_CARD.pick : SCORE_SHEET_CARD.pill,
      }}
    >
      {home ? null : <Crest code={code} />}
      <TotlText
        numberOfLines={1}
        style={{
          flexShrink: 1,
          fontFamily: tokens.font.medium,
          fontSize: 12,
          lineHeight: 14,
          textAlign: home ? 'right' : 'left',
          color: picked ? SCORE_SHEET_CARD.green : SCORE_SHEET_CARD.text,
        }}
      >
        {name}
      </TotlText>
      {home ? <Crest code={code} /> : null}
    </View>
  );
}

function scoreLabel(row: FeedScoreRow): string {
  return typeof row.homeScore === 'number' && typeof row.awayScore === 'number' ? `${row.homeScore}:${row.awayScore}` : '–';
}

function pickWords(row: FeedScoreRow): string {
  return row.pickSide ? `you picked ${row.pick}` : 'no pick';
}

/**
 * Your ten Predictions against the results (Figma 443:59707): a tick or cross, then the home club,
 * the final score and the away club. Lime marks your pick: the club, or the score for a draw.
 */
export function ScoreSheetRows({ rows }: { rows: FeedScoreRow[] }) {
  return (
    <View style={{ gap: 4, paddingHorizontal: 14 }}>
      {rows.map((row, index) => (
        <View
          key={`${row.home}-${row.away}-${index}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          accessible
          accessibilityLabel={`${row.home} ${scoreLabel(row).replace(':', ' ')} ${row.away}, ${pickWords(row)}, ${row.hit ? 'correct' : 'wrong'}`}
        >
          <SvgUri uri={row.hit ? CORRECT : WRONG} width={24.0112} height={24} />
          <Side code={row.homeCode} name={row.home} align="home" picked={row.pickSide === 'H'} />
          <View
            style={{
              width: 45,
              height: 36,
              borderRadius: 4,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: row.pickSide === 'D' ? SCORE_SHEET_CARD.pick : 'transparent',
            }}
          >
            <TotlText style={{ fontFamily: tokens.font.bold, fontSize: 14, lineHeight: 17, color: SCORE_SHEET_CARD.score, fontVariant: ['tabular-nums'] }}>
              {scoreLabel(row)}
            </TotlText>
          </View>
          <Side code={row.awayCode} name={row.away} align="away" picked={row.pickSide === 'A'} />
        </View>
      ))}
    </View>
  );
}

const SHARE_CANVAS_WIDTH = 390;
const SHARE_CARD_WIDTH = 340;

/**
 * D02 Score sheet (Figma 445:64711). Share draws the header and rows (not the button) on the TOTL
 * share image, off screen, captures it as a PNG and hands it to the share sheet.
 */
export function ScoreSheetFeedCard({
  eyebrow,
  title,
  line,
  avatarUrl,
  rows,
  shareLabel = 'Share',
}: {
  eyebrow: string;
  title: string;
  line?: string | null;
  avatarUrl?: string | null;
  rows: FeedScoreRow[];
  shareLabel?: string;
}) {
  const t = useTokens();
  const shot = React.useRef<ViewShot>(null);
  const [sharing, setSharing] = React.useState(false);

  const share = React.useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      // Let the off-screen share image (logo, crests, icons) paint before capture.
      await new Promise((resolve) => setTimeout(resolve, 500));
      const uri = await shot.current?.capture?.();
      let filePath: string | null = null;
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (uri && baseDir) {
        filePath = `${baseDir}score-sheet-${Date.now()}.png`;
        await FileSystem.copyAsync({ from: uri, to: filePath });
      }
      await shareCapturedImage({ filePath, target: 'more', message: 'Check out my TOTL score sheet.', title: `Share: ${title}` });
    } catch (error) {
      if (!isShareCancelled(error)) console.error('[ScoreSheetFeedCard] Share failed', error);
    } finally {
      setSharing(false);
    }
  }, [sharing, title]);

  const sheet = (
    <View style={{ paddingTop: 20, paddingBottom: 20, gap: 28 }}>
      <ScoreSheetHeader eyebrow={eyebrow} title={title} line={line} avatarUrl={avatarUrl} />
      <ScoreSheetRows rows={rows} />
    </View>
  );

  return (
    <View>
      {sharing ? (
        // Off screen, and only while sharing.
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', top: 0, left: -10000 }}
        >
          <ViewShot ref={shot} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
            <TotlShareCanvas width={SHARE_CANVAS_WIDTH}>
              <TotlShareCardTilt>
                <View style={{ width: SHARE_CARD_WIDTH, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>{sheet}</View>
              </TotlShareCardTilt>
            </TotlShareCanvas>
          </ViewShot>
        </View>
      ) : null}
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: t.color.cardBorder, backgroundColor: '#FFFFFF', overflow: 'hidden' }}>
        {sheet}
        <View style={{ paddingHorizontal: 12, paddingBottom: 16 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share your score sheet"
            accessibilityState={{ disabled: sharing, busy: sharing }}
            disabled={sharing}
            onPress={() => void share()}
            style={({ pressed }) => ({
              height: 48,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: SCORE_SHEET_CARD.green,
              opacity: pressed || sharing ? 0.85 : 1,
            })}
          >
            <TotlText style={{ fontFamily: t.font.medium, fontSize: 16, lineHeight: 16, color: '#FFFFFF' }}>{shareLabel}</TotlText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

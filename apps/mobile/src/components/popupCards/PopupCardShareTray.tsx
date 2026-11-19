import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

import ShareActionsFooter, { type ShareTarget } from '../share/ShareActionsFooter';
import ShareAssetTray from '../share/ShareAssetTray';
import { TotlShareCanvas } from '../share/TotlShareCanvas';
import PopupInfoCard from './PopupInfoCard';
import type { PopupCardDescriptor } from './types';
import { isShareCancelled, shareCapturedImage } from '../../lib/shareToSocial';

function getPopupShareMessage(card: PopupCardDescriptor): string {
  switch (card.kind) {
    case 'personalWinner':
      return 'I won on TOTL.';
    case 'resultsScoreSheet':
      return 'Check out my TOTL score sheet.';
    case 'results':
      return 'Check out my TOTL results.';
    case 'winners':
      return "Check out this week's TOTL winners.";
    case 'newGameweek':
      return 'A new TOTL Gameweek is ready to go.';
    case 'newSeason':
      return 'Welcome to the new TOTL season.';
    case 'championMiniLeague':
      return 'I won my mini league on TOTL.';
    case 'championOverall':
      return "I'm the overall TOTL champion this season.";
    default:
      return 'Check this out on TOTL.';
  }
}

function getPopupShareTitle(card: PopupCardDescriptor, target: ShareTarget): string {
  const prefix = target === 'instagram' ? 'Share to Instagram' : target === 'whatsapp' ? 'Share to WhatsApp' : 'Share';
  return `${prefix}: ${card.title}`;
}

function PopupCardSharePreview({
  card,
  width,
  height,
}: {
  card: PopupCardDescriptor;
  width: number;
  height: number;
}) {
  return (
    <View collapsable={false} pointerEvents="none" style={{ width, height, backgroundColor: 'transparent' }}>
      <PopupInfoCard kind={card.kind} title={card.title} eventKey={card.eventKey} payload={card.payload} isTopCard={false} isShareAsset />
    </View>
  );
}

function BrandedPopupShareAsset({
  card,
  cardWidth,
  cardHeight,
  canvasWidth,
  canvasHeight,
  scale = 0.92,
}: {
  card: PopupCardDescriptor;
  cardWidth: number;
  cardHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  scale?: number;
}) {
  const displayCardWidth = cardWidth * scale;
  const displayCardHeight = cardHeight * scale;

  return (
    <TotlShareCanvas width={canvasWidth} height={canvasHeight}>
      <View
        style={{
          width: displayCardWidth,
          height: displayCardHeight,
          borderRadius: 34,
          backgroundColor: 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#0F172A',
          shadowOpacity: 0.24,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: 18 },
          elevation: 14,
          transform: [{ rotateZ: '-1.1deg' }],
        }}
      >
        <View
          style={{
            width: cardWidth,
            height: cardHeight,
            borderRadius: 28,
            overflow: 'hidden',
            transform: [{ scale }],
          }}
        >
          <PopupCardSharePreview card={card} width={cardWidth} height={cardHeight} />
        </View>
      </View>
    </TotlShareCanvas>
  );
}

export default function PopupCardShareTray({
  card,
  cardWidth,
  cardHeight,
  onClose,
}: {
  card: PopupCardDescriptor;
  cardWidth: number;
  cardHeight: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const shareShotRef = React.useRef<any>(null);
  const [sharing, setSharing] = React.useState(false);

  const topGapPx = Math.max(insets.top + 42, 72);
  const footerReserved = insets.bottom + 120;
  const shareCanvasWidth = 390;
  const shareCanvasHeight = Math.max(690, Math.min(760, Math.round(cardHeight * 1.42)));
  const previewScale = Math.min(1, Math.max(0.7, (windowHeight - topGapPx - footerReserved - 74) / shareCanvasHeight));
  const shareMessage = getPopupShareMessage(card);

  const buildShareImageFile = React.useCallback(async () => {
    // Let the on-screen card (and its async score-sheet query) paint before capture.
    await new Promise((resolve) => setTimeout(resolve, 350));
    const uri: string | undefined = await shareShotRef.current?.capture?.();
    if (!uri) return null;

    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDir) return null;

    const safeKind = card.kind.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const dest = `${baseDir}popup-${safeKind}-${Date.now()}.png`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  }, [card.kind]);

  const handleShare = React.useCallback(
    async (target: ShareTarget) => {
      if (sharing) return;
      setSharing(true);
      try {
        const imageFile = await buildShareImageFile();
        await shareCapturedImage({
          filePath: imageFile,
          target,
          message: shareMessage,
          title: getPopupShareTitle(card, target),
        });
      } catch (error) {
        if (isShareCancelled(error)) return;
        console.error('[PopupCardShareTray] Share failed', target, error);
      } finally {
        setSharing(false);
      }
    },
    [buildShareImageFile, card, shareMessage, sharing]
  );

  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 30 }}>
      <ShareAssetTray
        topGapPx={topGapPx}
        footerReserved={footerReserved}
        footerBottomInset={insets.bottom + 8}
        onClose={onClose}
        footer={<ShareActionsFooter disabled={sharing} onShare={handleShare} />}
      >
        <View
          pointerEvents="none"
          style={{
            width: shareCanvasWidth * previewScale,
            height: shareCanvasHeight * previewScale,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ width: shareCanvasWidth, height: shareCanvasHeight, transform: [{ scale: previewScale }] }}>
            <ViewShot
              ref={shareShotRef}
              options={{ format: 'png', quality: 1, result: 'tmpfile' }}
              style={{ width: shareCanvasWidth, height: shareCanvasHeight, backgroundColor: '#EEF3F2' }}
            >
              <BrandedPopupShareAsset
                card={card}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                canvasWidth={shareCanvasWidth}
                canvasHeight={shareCanvasHeight}
              />
            </ViewShot>
          </View>
        </View>
      </ShareAssetTray>
    </View>
  );
}

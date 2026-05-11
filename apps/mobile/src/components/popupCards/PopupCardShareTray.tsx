import React from 'react';
import { Share, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgUri } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import { TotlText } from '@totl/ui';

import ShareActionsFooter, { type ShareTarget } from '../share/ShareActionsFooter';
import ShareAssetTray from '../share/ShareAssetTray';
import PopupInfoCard from './PopupInfoCard';
import type { PopupCardDescriptor } from './types';

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

function isShareCancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /cancel|dismiss|did not share/i.test(message);
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
      <PopupInfoCard kind={card.kind} title={card.title} eventKey={card.eventKey} isTopCard={false} isShareAsset />
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
  const totlLogoUri = Asset.fromModule(require('../../../../../public/assets/badges/totl-logo1-black.svg')).uri;
  const displayCardWidth = cardWidth * scale;
  const displayCardHeight = cardHeight * scale;

  return (
    <View
      collapsable={false}
      style={{
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: '#EEF3F2',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 42,
        paddingBottom: 34,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 78,
          left: -118,
          width: 210,
          height: 210,
          borderRadius: 105,
          backgroundColor: 'rgba(28,131,118,0.09)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: -72,
          bottom: 36,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: 'rgba(28,131,118,0.075)',
        }}
      />

      <View style={{ alignItems: 'center' }}>
        <SvgUri uri={totlLogoUri} width={180} height={87} />
      </View>

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

      <View style={{ alignItems: 'center' }}>
        <TotlText
          style={{
            color: '#0F172A',
            fontFamily: 'Gramatika-Bold',
            fontWeight: '900',
            fontSize: 18,
            lineHeight: 20,
          }}
        >
          playtotl.com
        </TotlText>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <Ionicons name="logo-instagram" size={17} color="#1C8376" />
          <TotlText
            style={{
              marginLeft: 6,
              color: '#1C8376',
              fontFamily: 'Gramatika-Medium',
              fontWeight: '700',
              fontSize: 14,
              lineHeight: 16,
            }}
          >
            @playtotl
          </TotlText>
        </View>
      </View>
    </View>
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
    // Give async card queries and animations a beat to paint before capture.
    await new Promise((resolve) => setTimeout(resolve, 80));
    const uri: string | undefined = await shareShotRef.current?.capture?.();
    if (!uri) return null;

    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDir) return null;

    const safeKind = card.kind.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const dest = `${baseDir}popup-${safeKind}-${Date.now()}.png`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  }, [card.kind]);

  const shareImage = React.useCallback(
    async (target: ShareTarget) => {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        await Share.share({ message: shareMessage });
        return;
      }

      const imageFile = await buildShareImageFile();
      if (!imageFile) {
        await Share.share({ message: shareMessage });
        return;
      }

      await Sharing.shareAsync(imageFile, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: getPopupShareTitle(card, target),
      });
    },
    [buildShareImageFile, card, shareMessage]
  );

  const shareToWhatsApp = React.useCallback(async () => {
    const imageFile = await buildShareImageFile();
    if (!imageFile) {
      await shareImage('whatsapp');
      return;
    }

    await shareImage('whatsapp');
  }, [buildShareImageFile, card, shareImage, shareMessage]);

  const shareToInstagram = React.useCallback(async () => {
    await Clipboard.setStringAsync(shareMessage);
    const imageFile = await buildShareImageFile();
    if (!imageFile) {
      await shareImage('instagram');
      return;
    }

    await shareImage('instagram');
  }, [buildShareImageFile, card, shareImage, shareMessage]);

  const handleShare = React.useCallback(
    async (target: ShareTarget) => {
      if (sharing) return;
      setSharing(true);
      try {
        if (target === 'whatsapp') {
          await shareToWhatsApp();
          return;
        }
        if (target === 'instagram') {
          await shareToInstagram();
          return;
        }
        await shareImage(target);
      } finally {
        setSharing(false);
      }
    },
    [shareImage, shareToInstagram, shareToWhatsApp, sharing]
  );

  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
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
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ width: shareCanvasWidth, height: shareCanvasHeight, transform: [{ scale: previewScale }] }}>
            <BrandedPopupShareAsset
              card={card}
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              canvasWidth={shareCanvasWidth}
              canvasHeight={shareCanvasHeight}
            />
          </View>
        </View>
      </ShareAssetTray>

      <ViewShot
        ref={shareShotRef}
        options={{ format: 'png', quality: 1, result: 'tmpfile' }}
        style={{ position: 'absolute', left: -9999, top: 0, width: shareCanvasWidth, height: shareCanvasHeight, backgroundColor: '#F7FBFA' }}
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
  );
}

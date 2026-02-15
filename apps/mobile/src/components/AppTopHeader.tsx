import React from 'react';
import { Pressable, View } from 'react-native';
import { Asset } from 'expo-asset';
import Svg, { Path, SvgUri } from 'react-native-svg';
import { TotlText, useTokens } from '@totl/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RoundIconButton from './home/RoundIconButton';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';

export default function AppTopHeader({
  onPressChat,
  onPressProfile,
  avatarUrl,
  title,
  leftAction,
}: {
  onPressChat: () => void;
  onPressProfile: () => void;
  avatarUrl?: string | null;
  title?: string;
  leftAction?: React.ReactNode;
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const { unreadByLeagueId } = useLeagueUnreadCounts();
  const unreadCount = React.useMemo(
    () =>
      Object.values(unreadByLeagueId ?? {}).reduce((sum, value) => {
        const n = Number(value ?? 0);
        return Number.isFinite(n) && n > 0 ? sum + n : sum;
      }, 0),
    [unreadByLeagueId]
  );
  const showUnreadBadge = unreadCount > 0;
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  const fixedHeaderLogoUri = React.useMemo(() => {
    const isLightMode = t.color.background.toLowerCase() === '#f8fafc';
    return Asset.fromModule(
      isLightMode
        ? require('../../../../public/assets/badges/totl-logo1-black.svg')
        : require('../../../../public/assets/badges/totl-logo1.svg')
    ).uri;
  }, [t.color.background]);

  return (
    <View
      style={{
        marginTop: -insets.top,
        paddingTop: insets.top + 4,
        paddingHorizontal: t.space[4],
        backgroundColor: '#FFFFFF',
      }}
    >
      <View style={{ height: 60, justifyContent: 'center', alignItems: 'center' }}>
        {leftAction ? <View style={{ position: 'absolute', left: 0 }}>{leftAction}</View> : null}

        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          {title ? (
            <TotlText style={{ fontWeight: '900', fontSize: 20, lineHeight: 24, color: t.color.text }}>{title}</TotlText>
          ) : (
            <SvgUri uri={fixedHeaderLogoUri} width={159} height={50} />
          )}
        </View>

        <View style={{ position: 'absolute', right: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={onPressChat}
            accessibilityRole="button"
            accessibilityLabel="Open chat"
            style={({ pressed }) => ({
              width: 44,
              height: 46,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            <Svg width={34} height={34} viewBox="0 0 36 36" fill="none">
              <Path
                d="M19.0586 25.9746C17.0664 25.9746 15.709 25.2031 15.0938 23.7871L11.7832 26.707C11.1191 27.3027 10.709 27.5664 10.1621 27.5664C9.38086 27.5664 8.92188 27.0195 8.92188 26.1602V23.748H8.52148C5.68945 23.748 4 22.0684 4 19.1582V11.5898C4 8.67969 5.65039 7 8.58984 7H21.041C23.9805 7 25.6309 8.68945 25.6309 11.5898V11.873H28.2676C31.0801 11.873 32.6133 13.4355 32.6133 16.1895V21.7168C32.6133 24.4414 31.0996 25.9746 28.3262 25.9746H28.1504V28.2109C28.1504 29.0605 27.6914 29.6074 26.9199 29.6074C26.3926 29.6074 25.9434 29.3145 25.3086 28.7578L22.0566 25.9746H19.0586ZM10.6406 22.6348V25.418L13.7363 22.3516C14.0684 22.0098 14.3223 21.8828 14.7129 21.8438C14.7129 21.8047 14.7031 21.7656 14.7031 21.7266V16.1895C14.7031 13.4355 16.2461 11.873 19.0586 11.873H23.7168V11.6484C23.7168 9.85156 22.8281 8.91406 20.9824 8.91406H8.63867C6.79297 8.91406 5.91406 9.85156 5.91406 11.6484V19.0996C5.91406 20.8965 6.79297 21.834 8.63867 21.834H9.83984C10.3965 21.834 10.6406 22.0488 10.6406 22.6348ZM19.2051 24.0996H22.0176C22.4668 24.0996 22.8477 24.2559 23.2188 24.6074L26.4316 27.5176V24.9785C26.4316 24.3926 26.793 24.0996 27.2715 24.0996H28.1211C29.9082 24.0996 30.7188 23.2207 30.7188 21.5117V16.3359C30.7188 14.627 29.9082 13.748 28.1211 13.748H19.2051C17.418 13.748 16.6074 14.627 16.6074 16.3359V21.5117C16.6074 23.2207 17.418 24.0996 19.2051 24.0996ZM20.3184 17.9961C19.8691 17.9961 19.5469 17.6445 19.5469 17.2148C19.5469 16.7656 19.8691 16.4336 20.3184 16.4336H27.0566C27.5059 16.4336 27.8379 16.7656 27.8379 17.2148C27.8379 17.6445 27.5059 17.9961 27.0566 17.9961H20.3184ZM20.3184 21.5605C19.8691 21.5605 19.5469 21.2285 19.5469 20.7891C19.5469 20.3496 19.8691 19.998 20.3184 19.998H25.2109C25.6504 19.998 25.9922 20.3496 25.9922 20.7891C25.9922 21.2285 25.6504 21.5605 25.2109 21.5605H20.3184Z"
                fill="#0F172A"
              />
            </Svg>
            {showUnreadBadge ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 0,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 999,
                  paddingHorizontal: unreadLabel.length === 1 ? 0 : 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#DC2626',
                  borderWidth: 1,
                  borderColor: '#FFFFFF',
                }}
              >
                <TotlText
                  style={{
                    color: '#FFFFFF',
                    fontWeight: '900',
                    fontSize: unreadLabel.length > 2 ? 9 : 10,
                    lineHeight: unreadLabel.length > 2 ? 10 : 11,
                  }}
                >
                  {unreadLabel}
                </TotlText>
              </View>
            ) : null}
          </Pressable>
          <RoundIconButton
            onPress={onPressProfile}
            icon={require('../../../../public/assets/Icons/Person--Streamline-Outlined-Material-Pro_white.png')}
            imageUri={avatarUrl}
          />
        </View>
      </View>
    </View>
  );
}

import React from 'react';
import { Image, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { TotlText, useTokens } from '@totl/ui';

function ChatNavIcon({ color }: { color: string }) {
  return (
    <Svg width={32} height={32} viewBox="0 0 36 36" fill="none">
      <Path
        d="M19.0586 25.9746C17.0664 25.9746 15.709 25.2031 15.0938 23.7871L11.7832 26.707C11.1191 27.3027 10.709 27.5664 10.1621 27.5664C9.38086 27.5664 8.92188 27.0195 8.92188 26.1602V23.748H8.52148C5.68945 23.748 4 22.0684 4 19.1582V11.5898C4 8.67969 5.65039 7 8.58984 7H21.041C23.9805 7 25.6309 8.68945 25.6309 11.5898V11.873H28.2676C31.0801 11.873 32.6133 13.4355 32.6133 16.1895V21.7168C32.6133 24.4414 31.0996 25.9746 28.3262 25.9746H28.1504V28.2109C28.1504 29.0605 27.6914 29.6074 26.9199 29.6074C26.3926 29.6074 25.9434 29.3145 25.3086 28.7578L22.0566 25.9746H19.0586ZM10.6406 22.6348V25.418L13.7363 22.3516C14.0684 22.0098 14.3223 21.8828 14.7129 21.8438C14.7129 21.8047 14.7031 21.7656 14.7031 21.7266V16.1895C14.7031 13.4355 16.2461 11.873 19.0586 11.873H23.7168V11.6484C23.7168 9.85156 22.8281 8.91406 20.9824 8.91406H8.63867C6.79297 8.91406 5.91406 9.85156 5.91406 11.6484V19.0996C5.91406 20.8965 6.79297 21.834 8.63867 21.834H9.83984C10.3965 21.834 10.6406 22.0488 10.6406 22.6348ZM19.2051 24.0996H22.0176C22.4668 24.0996 22.8477 24.2559 23.2188 24.6074L26.4316 27.5176V24.9785C26.4316 24.3926 26.793 24.0996 27.2715 24.0996H28.1211C29.9082 24.0996 30.7188 23.2207 30.7188 21.5117V16.3359C30.7188 14.627 29.9082 13.748 28.1211 13.748H19.2051C17.418 13.748 16.6074 14.627 16.6074 16.3359V21.5117C16.6074 23.2207 17.418 24.0996 19.2051 24.0996ZM20.3184 17.9961C19.8691 17.9961 19.5469 17.6445 19.5469 17.2148C19.5469 16.7656 19.8691 16.4336 20.3184 16.4336H27.0566C27.5059 16.4336 27.8379 16.7656 27.8379 17.2148C27.8379 17.6445 27.5059 17.9961 27.0566 17.9961H20.3184ZM20.3184 21.5605C19.8691 21.5605 19.5469 21.2285 19.5469 20.7891C19.5469 20.3496 19.8691 19.998 20.3184 19.998H25.2109C25.6504 19.998 25.9922 20.3496 25.9922 20.7891C25.9922 21.2285 25.6504 21.5605 25.2109 21.5605H20.3184Z"
        fill={color}
      />
    </Svg>
  );
}

export default function LeagueHeader({
  title,
  subtitle,
  avatarUri,
  onPressBack,
  onPressChat,
  onPressSecondaryAction,
  secondaryActionIcon,
  compactSubtitle = false,
  onPressSubtitle,
  onPressHeaderInfo,
  onPressMenu,
}: {
  title: string;
  subtitle: string;
  avatarUri: string | null;
  onPressBack: () => void;
  onPressChat?: () => void;
  onPressSecondaryAction?: () => void;
  secondaryActionIcon?: React.ReactNode;
  compactSubtitle?: boolean;
  onPressSubtitle?: () => void;
  onPressHeaderInfo?: () => void;
  onPressMenu?: () => void;
}) {
  const t = useTokens();
  const AVATAR = 54;

  return (
    <View style={{ paddingHorizontal: t.space[4], paddingTop: t.space[3], paddingBottom: t.space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          onPress={onPressBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
            marginRight: 10,
          })}
        >
          <TotlText style={{ color: t.color.muted, fontWeight: '900', fontSize: 22, lineHeight: 22 }}>‹</TotlText>
        </Pressable>

        {onPressHeaderInfo ? (
          <Pressable
            onPress={onPressHeaderInfo}
            accessibilityRole="button"
            accessibilityLabel="Open group info"
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              flexDirection: 'row',
              alignItems: 'center',
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <View
              style={{
                width: AVATAR,
                height: AVATAR,
                borderRadius: 999,
                backgroundColor: t.color.surface2,
                borderWidth: 1,
                borderColor: t.color.border,
                overflow: 'hidden',
                marginRight: 12,
              }}
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: AVATAR, height: AVATAR }}
                  onError={(e) => {
                    console.error('[LeagueHeader] Avatar failed to load:', { uri: avatarUri, error: e.nativeEvent });
                  }}
                />
              ) : null}
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <TotlText variant="body" numberOfLines={1} style={{ fontWeight: '900' }}>
                {title}
              </TotlText>
              <TotlText
                numberOfLines={1}
                ellipsizeMode="tail"
                variant="caption"
                style={{
                  marginTop: 2,
                  color: t.color.muted,
                  fontWeight: compactSubtitle ? '700' : '800',
                  ...(compactSubtitle ? { fontSize: 12, lineHeight: 16 } : null),
                }}
              >
                {subtitle}
              </TotlText>
            </View>
          </Pressable>
        ) : (
          <>
            <View
              style={{
                width: AVATAR,
                height: AVATAR,
                borderRadius: 999,
                backgroundColor: t.color.surface2,
                borderWidth: 1,
                borderColor: t.color.border,
                overflow: 'hidden',
                marginRight: 12,
              }}
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: AVATAR, height: AVATAR }}
                  onError={(e) => {
                    console.error('[LeagueHeader] Avatar failed to load:', { uri: avatarUri, error: e.nativeEvent });
                  }}
                />
              ) : null}
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <TotlText variant="body" numberOfLines={1} style={{ fontWeight: '900' }}>
                {title}
              </TotlText>
              {onPressSubtitle ? (
                <Pressable
                  onPress={onPressSubtitle}
                  accessibilityRole="button"
                  accessibilityLabel="Open group info"
                  style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
                >
                  <TotlText
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    variant="caption"
                    style={{
                      marginTop: 2,
                      color: t.color.muted,
                      fontWeight: compactSubtitle ? '700' : '800',
                      ...(compactSubtitle ? { fontSize: 12, lineHeight: 16 } : null),
                    }}
                  >
                    {subtitle}
                  </TotlText>
                </Pressable>
              ) : (
                <TotlText
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  variant="caption"
                  style={{
                    marginTop: 2,
                    color: t.color.muted,
                    fontWeight: compactSubtitle ? '700' : '800',
                    ...(compactSubtitle ? { fontSize: 12, lineHeight: 16 } : null),
                  }}
                >
                  {subtitle}
                </TotlText>
              )}
            </View>
          </>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
          {onPressSecondaryAction ? (
            <Pressable
              onPress={onPressSecondaryAction}
              accessibilityRole="button"
              accessibilityLabel="Open secondary action"
              style={({ pressed }) => ({
                width: 38,
                height: 38,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
                marginRight: 4,
              })}
            >
              {secondaryActionIcon ?? <ChatNavIcon color={t.color.muted} />}
            </Pressable>
          ) : onPressChat ? (
            <Pressable
              onPress={onPressChat}
              accessibilityRole="button"
              accessibilityLabel="Open chat"
              style={({ pressed }) => ({
                width: 38,
                height: 38,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
                marginRight: 4,
              })}
            >
              <ChatNavIcon color={t.color.muted} />
            </Pressable>
          ) : null}

          {onPressMenu ? (
            <Pressable
              onPress={onPressMenu}
              accessibilityRole="button"
              accessibilityLabel="Menu"
              style={({ pressed }) => ({
                width: 38,
                height: 38,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <TotlText style={{ color: t.color.muted, fontWeight: '900', fontSize: 22, lineHeight: 22 }}>⋯</TotlText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}


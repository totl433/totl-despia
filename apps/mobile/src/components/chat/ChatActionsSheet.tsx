import React from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { TotlText, useTokens } from '@totl/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemePreference } from '../../context/ThemePreferenceContext';
import GlobalButton from '../GlobalButton';

const EMOJIS = ['👍', '❤️', '😂', '🔥', '😮', '😢'];

type ReportState = 'idle' | 'submitting' | 'error' | 'success';
type SheetStep = 'actions' | 'reportForm' | 'reportSuccess';

export default function ChatActionsSheet({
  open,
  onClose,
  onReply,
  onReact,
  reportReason,
  reportState = 'idle',
  reportError,
  onChangeReportReason,
  onSubmitReport,
}: {
  open: boolean;
  onClose: () => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
  reportReason: string;
  reportState?: ReportState;
  reportError?: string | null;
  onChangeReportReason: (value: string) => void;
  onSubmitReport: () => void;
}) {
  const t = useTokens();
  const { isDark } = useThemePreference();
  const insets = useSafeAreaInsets();
  const ref = React.useRef<BottomSheetModal>(null);
  const [step, setStep] = React.useState<SheetStep>('actions');
  const snapPoints = React.useMemo(() => {
    if (step === 'reportForm') return [560];
    if (step === 'reportSuccess') return [320];
    return [220];
  }, [step]);

  React.useEffect(() => {
    if (reportState === 'success' && open) {
      setStep('reportSuccess');
    }
  }, [open, reportState]);

  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        ref.current?.present();
      });
      return;
    }
    // Dismiss when parent closes (keeps state in sync).
    ref.current?.dismiss();
    setStep('actions');
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      ref.current?.snapToIndex(0);
    });
  }, [open, step]);

  const handleClose = React.useCallback(() => {
    setStep('actions');
    onClose();
  }, [onClose]);

  const canSubmitReport = reportReason.trim().length > 0 && reportState !== 'submitting';

  const inputStyle = {
    minHeight: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.background,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: t.color.text,
    fontFamily: 'Gramatika-Regular',
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top' as const,
  };

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      // Keep the sheet background flush to the bottom of the screen.
      // We handle safe-area spacing via content padding so there's no visible "gap" under the sheet.
      bottomInset={0}
      enablePanDownToClose
      onDismiss={handleClose}
      backgroundStyle={{ backgroundColor: t.color.surface }}
      handleIndicatorStyle={{ backgroundColor: t.color.border }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
          pressBehavior="close"
        />
      )}
    >
      <BottomSheetView style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 + insets.bottom }}>
        {step === 'actions' ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <TotlText variant="caption" style={{ color: t.color.muted, fontWeight: '900' }}>
                React
              </TotlText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Report message"
                onPress={() => setStep('reportForm')}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, paddingVertical: 2 })}
              >
                <TotlText style={{ color: t.color.brand, fontFamily: 'Gramatika-Medium', fontSize: 14, lineHeight: 18, fontWeight: '700' }}>
                  Report
                </TotlText>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => onReact(e)}
                  style={({ pressed }) => ({
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: t.color.surface2,
                    borderWidth: 1,
                    borderColor: t.color.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <TotlText
                    style={{
                      fontSize: 22,
                      lineHeight: 26,
                      textAlign: 'center',
                      ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
                    }}
                  >
                    {e}
                  </TotlText>
                </Pressable>
              ))}
            </View>

            <View style={{ height: 14 }} />

            <Pressable
              onPress={onReply}
              style={({ pressed }) => ({
                width: '100%',
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: t.color.brand,
                opacity: pressed ? 0.92 : 1,
                alignItems: 'center',
              })}
            >
              <TotlText style={{ color: '#FFFFFF', fontWeight: '900' }}>Reply</TotlText>
            </Pressable>
          </>
        ) : null}

        {step === 'reportForm' ? (
          <>
            <TotlText style={{ fontFamily: 'Gramatika-Bold', fontSize: 18, lineHeight: 24, fontWeight: '900', marginBottom: 18 }}>
              Report a comment
            </TotlText>
            <TotlText style={{ fontSize: 15, lineHeight: 23, color: t.color.text, marginBottom: 22 }}>
              If you believe this comment violates our community guidelines, you can report it for review. Our team will assess the content to ensure it aligns with our standards.
            </TotlText>
            <TotlText style={{ fontSize: 15, lineHeight: 23, color: t.color.text, marginBottom: 24 }}>
              Your feedback helps us maintain a safe and respectful space for all users.
            </TotlText>
            <TotlText style={{ fontFamily: 'Gramatika-Bold', fontSize: 16, lineHeight: 22, fontWeight: '900', marginBottom: 14 }}>
              Tell us why you are reporting this comment
            </TotlText>
            <TextInput
              value={reportReason}
              onChangeText={onChangeReportReason}
              placeholder="I’m reporting this because..."
              placeholderTextColor={t.color.muted}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              selectionColor={t.color.brand}
              multiline
              style={inputStyle}
            />
            {reportError ? (
              <>
                <View style={{ height: 12 }} />
                <View
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(239,68,68,0.22)',
                    backgroundColor: 'rgba(239,68,68,0.08)',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <TotlText style={{ fontFamily: 'System', fontSize: 13, lineHeight: 16, fontWeight: '700', color: '#DC2626' }}>
                    {reportError}
                  </TotlText>
                </View>
              </>
            ) : null}
            <View style={{ height: 18 }} />
            <GlobalButton
              title={reportState === 'submitting' ? 'Reporting…' : 'Report'}
              disabled={!canSubmitReport}
              onPress={onSubmitReport}
            />
          </>
        ) : null}

        {step === 'reportSuccess' ? (
          <>
            <TotlText style={{ fontFamily: 'Gramatika-Bold', fontSize: 18, lineHeight: 24, fontWeight: '900', marginBottom: 18 }}>
              Thanks for your feedback
            </TotlText>
            <TotlText style={{ fontSize: 15, lineHeight: 23, color: t.color.text, marginBottom: 28 }}>
              Our team has been notified and will review it promptly. Relevant actions will be taken if necessary to maintain a respectful and safe environment.
            </TotlText>
            <GlobalButton title="Close" onPress={() => ref.current?.dismiss()} />
          </>
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
}


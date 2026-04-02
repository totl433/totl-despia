import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { TotlText, useTokens } from '@totl/ui';
import { useThemePreference } from '../../context/ThemePreferenceContext';
import GlobalButton from '../GlobalButton';

const EMOJIS = ['👍', '❤️', '😂', '🔥', '😮', '😢'];
/** Matches @gorhom/bottom-sheet handle; snap height must include this + measured content or you get empty space under the CTA. */
const BOTTOM_SHEET_HANDLE_HEIGHT = 24;

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
  const ref = React.useRef<BottomSheetModal>(null);
  const [step, setStep] = React.useState<SheetStep>('actions');
  const [reportFormSnapHeight, setReportFormSnapHeight] = React.useState(480);
  const [reportSuccessSnapHeight, setReportSuccessSnapHeight] = React.useState(300);

  const snapPoints = React.useMemo(() => {
    if (step === 'reportForm') return [reportFormSnapHeight];
    if (step === 'reportSuccess') return [reportSuccessSnapHeight];
    return [192];
  }, [reportFormSnapHeight, reportSuccessSnapHeight, step]);

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
  }, [open, reportFormSnapHeight, reportSuccessSnapHeight, step]);

  const handleClose = React.useCallback(() => {
    setStep('actions');
    onClose();
  }, [onClose]);

  const canSubmitReport = reportReason.trim().length > 0 && reportState !== 'submitting';

  const inputStyle = {
    height: 110,
    width: '100%' as const,
    alignSelf: 'stretch' as const,
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
      // v5 defaults enableDynamicSizing=true; that sizes the sheet to content and can look like a centered modal.
      // We want standard bottom-anchored sheets like the rest of the app.
      enableDynamicSizing={false}
      detached={false}
      // Keep the sheet background flush to the bottom of the screen.
      // We handle safe-area spacing via content padding so there's no visible "gap" under the sheet.
      bottomInset={0}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enableBlurKeyboardOnGesture
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
      {step === 'reportForm' ? (
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h < 48) return;
              const next = Math.ceil(h + BOTTOM_SHEET_HANDLE_HEIGHT);
              const clamped = Math.min(Math.max(next, 300), 620);
              setReportFormSnapHeight((prev) => (Math.abs(prev - clamped) < 2 ? prev : clamped));
            }}
            style={{ paddingHorizontal: 18, paddingTop: 24, paddingBottom: 24 }}
          >
            <TotlText style={{ color: t.color.text, fontFamily: 'Gramatika-Bold', fontSize: 18, lineHeight: 24, fontWeight: '900', marginBottom: 16 }}>
              Report a comment
            </TotlText>
            <TotlText style={{ fontSize: 15, lineHeight: 23, color: t.color.text, marginBottom: 18 }}>
              If you believe this comment violates our community guidelines, you can report it for review. Our team will assess the content to ensure it aligns with our standards.
            </TotlText>
            <TotlText style={{ fontSize: 15, lineHeight: 23, color: t.color.text, marginBottom: 20 }}>
              Your feedback helps us maintain a safe and respectful space for all users.
            </TotlText>
            <TotlText style={{ color: t.color.text, fontFamily: 'Gramatika-Bold', fontSize: 16, lineHeight: 22, fontWeight: '900', marginBottom: 12 }}>
              Tell us why you are reporting this comment
            </TotlText>
            <BottomSheetTextInput
              value={reportReason}
              onChangeText={onChangeReportReason}
              placeholder="I’m reporting this because..."
              placeholderTextColor={t.color.muted}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              selectionColor={t.color.brand}
              multiline
              scrollEnabled
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
            <View style={{ height: 14 }} />
            <GlobalButton
              title={reportState === 'submitting' ? 'Reporting…' : 'Report'}
              disabled={!canSubmitReport}
              onPress={onSubmitReport}
            />
          </View>
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView
          style={
            step === 'reportSuccess'
              ? { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }
              : {
                  paddingHorizontal: 18,
                  paddingTop: 0,
                  // 24px below primary actions; safe-area for home indicator is additive
                  paddingBottom: 24,
                }
          }
        >
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

        {step === 'reportSuccess' ? (
          <View
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h < 48) return;
              const next = Math.ceil(h + BOTTOM_SHEET_HANDLE_HEIGHT);
              const clamped = Math.min(Math.max(next, 260), 520);
              setReportSuccessSnapHeight((prev) => (Math.abs(prev - clamped) < 2 ? prev : clamped));
            }}
            style={{
              paddingHorizontal: 18,
              paddingTop: 24,
              paddingBottom: 24,
            }}
          >
            <TotlText style={{ color: t.color.text, fontFamily: 'Gramatika-Bold', fontSize: 18, lineHeight: 24, fontWeight: '900', marginBottom: 14 }}>
              Thanks for your feedback
            </TotlText>
            <TotlText style={{ fontSize: 15, lineHeight: 23, color: t.color.text, marginBottom: 18 }}>
              Our team has been notified and will review it promptly. Relevant actions will be taken if necessary to maintain a respectful and safe environment.
            </TotlText>
            <GlobalButton title="Close" onPress={() => ref.current?.dismiss()} />
          </View>
        ) : null}
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
}


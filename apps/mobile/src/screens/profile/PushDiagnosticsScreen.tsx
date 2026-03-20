import React from 'react';
import { Alert, Pressable, ScrollView, Share, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';

import PageHeader from '../../components/PageHeader';
import CenteredSpinner from '../../components/CenteredSpinner';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';
import { env } from '../../env';
import { supabase } from '../../lib/supabase';
import {
  deactivatePushSubscription,
  getPushDebugSnapshot,
  registerForPushNotifications,
} from '../../lib/push';

type FetchResult = {
  ok: boolean;
  status: number;
  bodyText: string;
  json: any;
};

function formatValue(value: unknown): string {
  if (value == null) return 'n/a';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function summarizeRecentLogEntry(entry: any): string {
  const when = entry?.created_at ? String(entry.created_at).replace('T', ' ').slice(0, 19) : 'unknown';
  return `${when} | ${entry?.notification_key ?? 'unknown'} | ${entry?.result ?? 'unknown'}`;
}

async function fetchJson(url: string, init?: RequestInit): Promise<FetchResult> {
  const response = await fetch(url, init);
  const bodyText = await response.text().catch(() => '');
  let json: any = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    bodyText,
    json,
  };
}

function KeyValueRow({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 }}>
      <TotlText variant="muted" style={{ flex: 1 }}>
        {label}
      </TotlText>
      <TotlText style={{ flex: 1, textAlign: 'right', fontWeight: '700' }}>{formatValue(value)}</TotlText>
    </View>
  );
}

export default function PushDiagnosticsScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [localSnapshot, setLocalSnapshot] = React.useState<any>(null);
  const [serverReport, setServerReport] = React.useState<any>(null);
  const [reportText, setReportText] = React.useState('');
  const [lastActionResult, setLastActionResult] = React.useState<string | null>(null);

  const baseUrl = React.useMemo(() => String(env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/$/, ''), []);

  const buildReportText = React.useCallback((localData: any, serverData: any) => {
    const local = localData?.local ?? {};
    const traces = localData?.traces ?? {};
    const subscriptions = Array.isArray(serverData?.subscriptions) ? serverData.subscriptions : [];
    const recentLog = Array.isArray(serverData?.recent_notification_log) ? serverData.recent_notification_log : [];

    return [
      `TOTL Push Diagnostics Report`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      `== Local Device ==`,
      `User ID: ${local?.lastLoginUserId ?? 'n/a'}`,
      `Bundle ID: ${local?.bundleId ?? 'n/a'}`,
      `App version: ${local?.appVersion ?? 'n/a'} (${local?.buildNumber ?? 'n/a'})`,
      `OneSignal app ID: ${local?.oneSignalAppId ?? 'n/a'}`,
      `SDK available: ${formatValue(local?.sdkAvailable)}`,
      `Initialized: ${formatValue(local?.initialized)}`,
      `Physical device: ${formatValue(local?.isPhysicalDevice)}`,
      `Permission granted: ${formatValue(local?.notificationPermission)}`,
      `Opted in: ${formatValue(local?.optedIn)}`,
      `External user ID: ${local?.externalUserId ?? 'n/a'}`,
      `Current player ID: ${local?.livePlayerId ?? local?.currentPlayerId ?? 'n/a'}`,
      ``,
      `== Server ==`,
      `Current player in DB: ${formatValue(serverData?.current_player_in_db)}`,
      `Subscription rows: ${subscriptions.length}`,
      `Recent notification rows: ${recentLog.length}`,
      `Recommendation: ${serverData?.recommendation ?? 'n/a'}`,
      ``,
      `== Last Push Traces ==`,
      `Register: ${JSON.stringify(traces?.lastRegisterTrace ?? null)}`,
      `Heartbeat: ${JSON.stringify(traces?.lastHeartbeatTrace ?? null)}`,
      `Deactivate: ${JSON.stringify(traces?.lastDeactivateTrace ?? null)}`,
      `Chat notify: ${JSON.stringify(traces?.lastChatNotifyTrace ?? null)}`,
      ``,
      `== Recent App Events ==`,
      ...(Array.isArray(traces?.events) && traces.events.length > 0
        ? traces.events.slice(0, 10).map((event: any) => `${event.at} | ${event.scope} | ${event.status} | ${event.message}`)
        : ['No local events recorded']),
      ``,
      `== Subscription Rows ==`,
      ...(subscriptions.length > 0
        ? subscriptions.map(
            (subscription: any) =>
              `${subscription.player_id} | active=${subscription.is_active} | subscribed=${subscription.subscribed} | invalid=${subscription.invalid}`
          )
        : ['No subscription rows']),
      ``,
      `== Recent Notification Log ==`,
      ...(recentLog.length > 0 ? recentLog.map((entry: any) => summarizeRecentLogEntry(entry)) : ['No recent notification log']),
    ].join('\n');
  }, []);

  const loadDiagnostics = React.useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw new Error('No active session');
    }

    const localData = await getPushDebugSnapshot();
    const livePlayerId = localData?.local?.livePlayerId || localData?.local?.currentPlayerId;
    // Use /totl-functions/* proxy — SPA /* → index.html catches /.netlify/functions/* in practice.
    const reportUrl = `${baseUrl}/totl-functions/pushDebugReport${
      livePlayerId ? `?playerId=${encodeURIComponent(String(livePlayerId))}` : ''
    }`;
    const serverResult = await fetchJson(reportUrl, {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    });
    const nextServerReport = serverResult.json ?? { ok: false, status: serverResult.status, raw: serverResult.bodyText };

    setLocalSnapshot(localData);
    setServerReport(nextServerReport);
    setReportText(buildReportText(localData, nextServerReport));

    return {
      localData,
      serverData: nextServerReport,
    };
  }, [baseUrl, buildReportText]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        await loadDiagnostics();
      } catch (error: any) {
        if (!active) return;
        setLastActionResult(error?.message || 'Failed to load diagnostics');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadDiagnostics]);

  const refreshAll = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDiagnostics();
      setLastActionResult('Diagnostics refreshed');
    } catch (error: any) {
      setLastActionResult(error?.message || 'Failed to refresh diagnostics');
    } finally {
      setRefreshing(false);
    }
  }, [loadDiagnostics]);

  const withSession = React.useCallback(async (fn: (session: any) => Promise<unknown>) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('No active session');
    return fn(data.session);
  }, []);

  const handleForceRegister = React.useCallback(async () => {
    setBusyAction('register');
    try {
      await withSession(async (session) => {
        const result = await registerForPushNotifications(session, { force: true, userId: session.user.id });
        setLastActionResult(result.ok ? `Registered ${result.playerId ?? 'device'}` : result.error || result.reason || 'Register failed');
      });
      await refreshAll();
    } catch (error: any) {
      setLastActionResult(error?.message || 'Force register failed');
    } finally {
      setBusyAction(null);
    }
  }, [refreshAll, withSession]);

  const handleResetAndRegister = React.useCallback(async () => {
    setBusyAction('reset');
    try {
      await withSession(async (session) => {
        await deactivatePushSubscription(session);
        const result = await registerForPushNotifications(session, { force: true, userId: session.user.id });
        setLastActionResult(
          result.ok ? `Reset + registered ${result.playerId ?? 'device'}` : result.error || result.reason || 'Reset failed'
        );
      });
      await refreshAll();
    } catch (error: any) {
      setLastActionResult(error?.message || 'Reset + register failed');
    } finally {
      setBusyAction(null);
    }
  }, [refreshAll, withSession]);

  const handleSendDirectTest = React.useCallback(async () => {
    setBusyAction('direct-test');
    try {
      await withSession(async (session) => {
        const result = await fetchJson(`${baseUrl}/.netlify/functions/testCarlNotification?userId=${session.user.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'TOTL Direct Push Test',
            message: `Direct push test at ${new Date().toLocaleTimeString()}`,
          }),
        });
        setLastActionResult(result.ok ? 'Direct push requested' : result.bodyText || 'Direct push failed');
      });
      await refreshAll();
    } catch (error: any) {
      setLastActionResult(error?.message || 'Direct push failed');
    } finally {
      setBusyAction(null);
    }
  }, [baseUrl, refreshAll, withSession]);

  const handleSendDispatcherTest = React.useCallback(async () => {
    setBusyAction('dispatcher-test');
    try {
      await withSession(async (session) => {
        const result = await fetchJson(`${baseUrl}/.netlify/functions/sendTestNotification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notification_type: 'new-gameweek',
            user_id: session.user.id,
            params: { gw: 31 },
          }),
        });
        setLastActionResult(result.ok ? 'Dispatcher push requested' : result.bodyText || 'Dispatcher push failed');
      });
      await refreshAll();
    } catch (error: any) {
      setLastActionResult(error?.message || 'Dispatcher push failed');
    } finally {
      setBusyAction(null);
    }
  }, [baseUrl, refreshAll, withSession]);

  const handleGenerateReport = React.useCallback(async () => {
    setBusyAction('report');
    try {
      const { localData, serverData } = await loadDiagnostics();
      const nextText = buildReportText(localData, serverData);
      setReportText(nextText);
      await Clipboard.setStringAsync(nextText);
      setLastActionResult('Report copied to clipboard');
      Alert.alert('Report ready', 'Push diagnostics report copied to clipboard.');
    } catch (error: any) {
      setLastActionResult(error?.message || 'Could not generate report');
    } finally {
      setBusyAction(null);
    }
  }, [buildReportText, loadDiagnostics]);

  const handleShareReport = React.useCallback(async () => {
    try {
      if (!reportText) {
        Alert.alert('No report yet', 'Generate a report first.');
        return;
      }
      await Share.share({ message: reportText });
    } catch {
      // ignore
    }
  }, [reportText]);

  if (loading) {
    return (
      <Screen fullBleed>
        <PageHeader
          title="Push Diagnostics"
          leftAction={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => navigation.goBack()}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Ionicons name="chevron-back" size={24} color={t.color.text} />
            </Pressable>
          }
        />
        <CenteredSpinner loading />
      </Screen>
    );
  }

  const local = localSnapshot?.local ?? {};
  const traces = localSnapshot?.traces ?? {};
  const currentPlayerCheck = serverReport?.current_player_check ?? null;
  const subscriptions = Array.isArray(serverReport?.subscriptions) ? serverReport.subscriptions : [];
  const recentLog = Array.isArray(serverReport?.recent_notification_log) ? serverReport.recent_notification_log : [];

  return (
    <Screen fullBleed>
      <PageHeader
        title="Push Diagnostics"
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={24} color={t.color.text} />
          </Pressable>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingTop: t.space[4],
          paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 8 }}>
            Quick Actions
          </TotlText>
          <TotlText variant="muted" style={{ marginBottom: 12 }}>
            Refresh the current state, repair registration, or generate a report to share back.
          </TotlText>
          <View style={{ gap: 10 }}>
            <Button title="Refresh diagnostics" onPress={() => void refreshAll()} loading={refreshing} />
            <Button title="Generate + copy report" onPress={() => void handleGenerateReport()} loading={busyAction === 'report'} />
            <Button title="Share current report" onPress={() => void handleShareReport()} variant="secondary" />
            <Button title="Force re-register push" onPress={() => void handleForceRegister()} loading={busyAction === 'register'} />
            <Button
              title="Deactivate then re-register"
              onPress={() => void handleResetAndRegister()}
              variant="secondary"
              loading={busyAction === 'reset'}
            />
            <Button
              title="Send direct push to me"
              onPress={() => void handleSendDirectTest()}
              variant="secondary"
              loading={busyAction === 'direct-test'}
            />
            <Button
              title="Send dispatcher test push"
              onPress={() => void handleSendDispatcherTest()}
              variant="secondary"
              loading={busyAction === 'dispatcher-test'}
            />
          </View>
          {lastActionResult ? (
            <TotlText variant="muted" style={{ marginTop: 12 }}>
              {lastActionResult}
            </TotlText>
          ) : null}
        </Card>

        <Card style={{ padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 8 }}>
            Local Device
          </TotlText>
          <KeyValueRow label="User ID" value={local.lastLoginUserId} />
          <KeyValueRow label="Bundle ID" value={local.bundleId} />
          <KeyValueRow label="Version" value={`${formatValue(local.appVersion)} (${formatValue(local.buildNumber)})`} />
          <KeyValueRow label="OneSignal App ID" value={local.oneSignalAppId} />
          <KeyValueRow label="SDK available" value={local.sdkAvailable} />
          <KeyValueRow label="Initialized" value={local.initialized} />
          <KeyValueRow label="Permission granted" value={local.notificationPermission} />
          <KeyValueRow label="Opted in" value={local.optedIn} />
          <KeyValueRow label="External user ID" value={local.externalUserId} />
          <KeyValueRow label="Live player ID" value={local.livePlayerId ?? local.currentPlayerId} />
        </Card>

        <Card style={{ padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 8 }}>
            Server State
          </TotlText>
          <KeyValueRow label="Current player in DB" value={serverReport?.current_player_in_db} />
          <KeyValueRow label="Subscription rows" value={subscriptions.length} />
          <KeyValueRow label="Recent notification rows" value={recentLog.length} />
          <KeyValueRow label="Chat messages enabled" value={serverReport?.preferences?.['chat-messages']} />
          <KeyValueRow label="Current player subscribed in OneSignal" value={currentPlayerCheck?.subscribed} />
          <KeyValueRow label="Current player external user ID" value={currentPlayerCheck?.player?.external_user_id} />
        </Card>

        <Card style={{ padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 8 }}>
            Last Traces
          </TotlText>
          <TotlText variant="muted" style={{ marginBottom: 10 }}>
            These come from the app itself and help prove whether the notify call was even attempted.
          </TotlText>
          <KeyValueRow label="Register trace" value={traces?.lastRegisterTrace ? JSON.stringify(traces.lastRegisterTrace) : 'n/a'} />
          <KeyValueRow label="Heartbeat trace" value={traces?.lastHeartbeatTrace ? JSON.stringify(traces.lastHeartbeatTrace) : 'n/a'} />
          <KeyValueRow label="Chat notify trace" value={traces?.lastChatNotifyTrace ? JSON.stringify(traces.lastChatNotifyTrace) : 'n/a'} />
        </Card>

        <Card style={{ padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 8 }}>
            Recent Notification Log
          </TotlText>
          {recentLog.length > 0 ? (
            recentLog.slice(0, 8).map((entry: any) => (
              <TotlText key={`${entry.event_id}-${entry.created_at}`} variant="muted" style={{ marginBottom: 8 }}>
                {summarizeRecentLogEntry(entry)}
              </TotlText>
            ))
          ) : (
            <TotlText variant="muted">No recent notification log rows.</TotlText>
          )}
        </Card>

        <Card style={{ padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 8 }}>
            Recent App Events
          </TotlText>
          {Array.isArray(traces?.events) && traces.events.length > 0 ? (
            traces.events.slice(0, 10).map((event: any) => (
              <TotlText key={`${event.at}-${event.message}`} variant="muted" style={{ marginBottom: 8 }}>
                {`${event.at} | ${event.scope} | ${event.status} | ${event.message}`}
              </TotlText>
            ))
          ) : (
            <TotlText variant="muted">No local events recorded yet.</TotlText>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

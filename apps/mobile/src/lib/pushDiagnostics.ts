export type PushDiagnosticStatus = 'info' | 'success' | 'error';

export interface PushDiagnosticEvent {
  at: string;
  scope: 'push' | 'chat' | 'admin';
  status: PushDiagnosticStatus;
  message: string;
  data?: Record<string, unknown>;
}

export interface BackendCallTrace {
  at: string;
  ok: boolean;
  status?: number;
  bodyText?: string;
  error?: string;
}

export interface PushOperationTrace {
  at: string;
  operation: 'init' | 'register' | 'heartbeat' | 'deactivate';
  ok: boolean;
  reason?: string;
  playerId?: string | null;
  error?: string;
  backend?: BackendCallTrace | null;
}

export interface ChatNotifyTrace {
  at: string;
  leagueId: string;
  messageId?: string | null;
  url: string;
  ok: boolean;
  attemptCount: number;
  status?: number;
  bodyText?: string;
  error?: string;
}

type PushDiagnosticsState = {
  lastLoginUserId: string | null;
  lastRegisterTrace: PushOperationTrace | null;
  lastHeartbeatTrace: PushOperationTrace | null;
  lastDeactivateTrace: PushOperationTrace | null;
  lastChatNotifyTrace: ChatNotifyTrace | null;
  events: PushDiagnosticEvent[];
};

const MAX_EVENTS = 40;

const state: PushDiagnosticsState = {
  lastLoginUserId: null,
  lastRegisterTrace: null,
  lastHeartbeatTrace: null,
  lastDeactivateTrace: null,
  lastChatNotifyTrace: null,
  events: [],
};

function pushEvent(event: PushDiagnosticEvent) {
  state.events = [event, ...state.events].slice(0, MAX_EVENTS);
}

export function recordPushDiagnosticEvent(event: Omit<PushDiagnosticEvent, 'at'>) {
  pushEvent({
    ...event,
    at: new Date().toISOString(),
  });
}

export function setLastLoginUserId(userId: string | null) {
  state.lastLoginUserId = userId;
}

export function setLastPushOperationTrace(trace: PushOperationTrace) {
  if (trace.operation === 'register') state.lastRegisterTrace = trace;
  if (trace.operation === 'heartbeat') state.lastHeartbeatTrace = trace;
  if (trace.operation === 'deactivate') state.lastDeactivateTrace = trace;
  if (trace.operation === 'init' && !trace.ok) {
    state.lastRegisterTrace = trace;
  }
}

export function setLastChatNotifyTrace(trace: ChatNotifyTrace) {
  state.lastChatNotifyTrace = trace;
}

export function getPushDiagnosticsState(): PushDiagnosticsState {
  return {
    lastLoginUserId: state.lastLoginUserId,
    lastRegisterTrace: state.lastRegisterTrace ? { ...state.lastRegisterTrace } : null,
    lastHeartbeatTrace: state.lastHeartbeatTrace ? { ...state.lastHeartbeatTrace } : null,
    lastDeactivateTrace: state.lastDeactivateTrace ? { ...state.lastDeactivateTrace } : null,
    lastChatNotifyTrace: state.lastChatNotifyTrace ? { ...state.lastChatNotifyTrace } : null,
    events: state.events.map((event) => ({ ...event, data: event.data ? { ...event.data } : undefined })),
  };
}

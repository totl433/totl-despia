const PRIVACY_KEY = 'totl_consent_privacy_v1';
const PUSH_KEY = 'totl_consent_push_v1';

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

function safeRemoveItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

export function getPrivacyAccepted(): boolean {
  return safeGetItem(PRIVACY_KEY) === '1';
}

export function setPrivacyAccepted(accepted: boolean) {
  if (accepted) {
    safeSetItem(PRIVACY_KEY, '1');
  } else {
    safeRemoveItem(PRIVACY_KEY);
  }
}

export function getPushScreenCompleted(): boolean {
  return safeGetItem(PUSH_KEY) === '1';
}

export function setPushScreenCompleted(completed: boolean) {
  if (completed) {
    safeSetItem(PUSH_KEY, '1');
  } else {
    safeRemoveItem(PUSH_KEY);
  }
}

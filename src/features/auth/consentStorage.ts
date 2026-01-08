const PRIVACY_KEY = 'totl_consent_privacy_v1';
const COOKIES_KEY = 'totl_consent_cookies_v1';
const PUSH_KEY = 'totl_consent_push_v1';

export type CookieChoice = 'all' | 'essential' | 'managed';

export interface CookiePreferences {
  performance: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface StoredCookieConsent {
  choice: CookieChoice;
  preferences?: CookiePreferences;
}

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

export function getCookieConsent(): StoredCookieConsent | null {
  const raw = safeGetItem(COOKIES_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredCookieConsent;
    if (parsed && parsed.choice) {
      return parsed;
    }
  } catch {
    // ignore parse failures
  }
  return null;
}

export function setCookieConsent(consent: StoredCookieConsent | null) {
  if (!consent) {
    safeRemoveItem(COOKIES_KEY);
    return;
  }
  safeSetItem(COOKIES_KEY, JSON.stringify(consent));
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

export function hasConsents(): boolean {
  return getPrivacyAccepted() && !!getCookieConsent();
}



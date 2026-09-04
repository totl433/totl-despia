import {
  COOKIE_CONSENT_CHANGED_EVENT,
  allowsAnalyticsCookies,
  getCookieConsent,
} from '../features/auth/consentStorage';
import { isDespiaAvailable } from './platform';

export const DEFAULT_GA_ID = 'G-5HWWJWTRRD';

export type AppStoreClickPlacement = 'splash' | 'feature_slide' | 'final_cta';

export type Gtag = (...args: unknown[]) => void;

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: Gtag;
  __totlGaConsentListenerRegistered?: boolean;
};

type GtagTarget = {
  dataLayer?: unknown[];
  gtag?: Gtag;
};

export function installGoogleTagQueue(target: GtagTarget): Gtag {
  const dataLayer = target.dataLayer ?? [];
  target.dataLayer = dataLayer;

  target.gtag = function gtag(..._args: unknown[]) {
    // Google Tag's command processor expects the native Arguments object.
    // Converting it to an Array prevents GA4 destinations from initializing.
    dataLayer.push(arguments);
  };

  return target.gtag;
}

function queueConsentState(gtag: Gtag) {
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  });

  if (allowsAnalyticsCookies(getCookieConsent())) {
    gtag('consent', 'update', {
      analytics_storage: 'granted',
    });
  }
}

function registerConsentUpdates(target: AnalyticsWindow) {
  if (target.__totlGaConsentListenerRegistered) return;
  target.__totlGaConsentListenerRegistered = true;

  target.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, () => {
    target.gtag?.('consent', 'update', {
      analytics_storage: allowsAnalyticsCookies(getCookieConsent()) ? 'granted' : 'denied',
    });
  });
}

export function initializeGoogleAnalytics(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (isDespiaAvailable()) return false;

  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return false;
  }

  const measurementId = import.meta.env.VITE_GA_ID || DEFAULT_GA_ID;
  const target = window as AnalyticsWindow;
  const existing = document.querySelector(
    `script[src*="googletagmanager.com/gtag/js?id=${measurementId}"]`,
  );
  if (existing) {
    registerConsentUpdates(target);
    return true;
  }

  const gtag = installGoogleTagQueue(target);
  queueConsentState(gtag);
  gtag('js', new Date());
  gtag('config', measurementId);
  registerConsentUpdates(target);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
  return true;
}

export function trackAppStoreClick({
  placement,
  slideId,
  linkUrl,
}: {
  placement: AppStoreClickPlacement;
  slideId: string;
  linkUrl: string;
}): boolean {
  initializeGoogleAnalytics();
  const target = typeof window === 'undefined' ? null : (window as AnalyticsWindow);
  if (!target?.gtag) return false;

  target.gtag('event', 'app_store_click', {
    placement,
    slide_id: slideId,
    link_url: linkUrl,
  });
  return true;
}

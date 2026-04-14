import { NativeModules } from 'react-native';
import type { CustomerInfo, PurchasesOffering } from 'react-native-purchases';
import { supabase } from './supabase';

const RC_API_KEY = 'appl_GWrmMNrbiSPWUfWlqFYiWnkopgX';

let configured = false;
let available = false;
let configurePromise: Promise<void> | null = null;
let currentPurchasesUserId: string | null = null;

function getPurchases() {
  if (!NativeModules.RNPurchases) {
    return null;
  }
  try {
    const mod = require('react-native-purchases');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

export async function configurePurchases() {
  if (configured) return;
  if (configurePromise) return configurePromise;

  configurePromise = (async () => {
    if (!NativeModules.RNPurchases) {
      console.warn(
        '[Purchases] RNPurchases native module not found in NativeModules. ' +
          'Run "npx expo run:ios" to rebuild the native binary with the module linked.',
      );
      return;
    }

    const Purchases = getPurchases();
    if (!Purchases) {
      console.warn('[Purchases] JS module not available — skipping');
      return;
    }
    try {
      const { LOG_LEVEL } = require('react-native-purchases');
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey: RC_API_KEY });
      configured = true;
      available = true;
      console.info('[Purchases] configured successfully');
    } catch (err: any) {
      if (err?.message?.includes('already') || err?.message?.includes('instance')) {
        configured = true;
        available = true;
        console.info('[Purchases] SDK already configured, reusing existing instance');
      } else {
        console.warn('[Purchases] configure failed:', err?.message ?? err);
      }
    }
  })();

  try {
    await configurePromise;
  } finally {
    configurePromise = null;
  }
}

export async function loginPurchases(userId: string) {
  await configurePurchases();
  if (!available) return null;
  try {
    const Purchases = getPurchases();
    if (!Purchases) return null;
    const currentAppUserId =
      typeof Purchases.getAppUserID === 'function' ? await Purchases.getAppUserID().catch(() => null) : null;
    if (currentPurchasesUserId === userId || currentAppUserId === userId) {
      const info = await Purchases.getCustomerInfo();
      currentPurchasesUserId = userId;
      console.info('[Purchases] user already synced', { userId, appUserId: currentAppUserId });
      return info;
    }
    const { customerInfo } = await Purchases.logIn(userId);
    currentPurchasesUserId = userId;
    console.info('[Purchases] logged in user', { userId, previousAppUserId: currentAppUserId });
    return customerInfo;
  } catch (err) {
    console.warn('[Purchases] logIn failed', err);
    return null;
  }
}

export async function logoutPurchases() {
  await configurePurchases();
  if (!available) return null;
  try {
    const Purchases = getPurchases();
    if (!Purchases) return null;
    const info = await Purchases.logOut();
    currentPurchasesUserId = null;
    return info;
  } catch (err) {
    console.warn('[Purchases] logOut failed', err);
    return null;
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  await configurePurchases();
  if (!available) return null;
  try {
    const Purchases = getPurchases();
    if (!Purchases) return null;
    return await Purchases.getCustomerInfo();
  } catch (err) {
    console.warn('[Purchases] getCustomerInfo failed', err);
    return null;
  }
}

export async function syncPurchasesForCurrentSession(): Promise<CustomerInfo | null> {
  await configurePurchases();
  if (!available) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id ?? null;
    if (!userId) {
      return await getCustomerInfo();
    }
    return await loginPurchases(userId);
  } catch (err) {
    console.warn('[Purchases] sync for current session failed', err);
    return null;
  }
}

export async function fetchOffering(offeringId: string): Promise<PurchasesOffering | null> {
  await configurePurchases();
  if (!available) return null;
  try {
    const Purchases = getPurchases();
    if (!Purchases) return null;
    const offerings = await Purchases.getOfferings();
    return offerings.all[offeringId] ?? null;
  } catch (err) {
    console.warn('[Purchases] fetchOffering failed', err);
    return null;
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  await configurePurchases();
  if (!available) return null;
  try {
    const Purchases = getPurchases();
    if (!Purchases) return null;
    return await Purchases.restorePurchases();
  } catch (err) {
    console.warn('[Purchases] restorePurchases failed', err);
    return null;
  }
}

export function hasEntitlement(customerInfo: CustomerInfo, entitlementId: string): boolean {
  return !!customerInfo.entitlements.active[entitlementId];
}

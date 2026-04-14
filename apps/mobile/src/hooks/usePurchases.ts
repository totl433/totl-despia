import { useCallback, useEffect, useState } from 'react';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { getCustomerInfo, fetchOffering, syncPurchasesForCurrentSession } from '../lib/purchases';

function getPurchases() {
  try {
    const mod = require('react-native-purchases');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

export function usePurchases() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const info = await getCustomerInfo();
    setCustomerInfo(info);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    const Purchases = getPurchases();
    if (!Purchases) return;

    const listener = (info: CustomerInfo) => {
      setCustomerInfo(info);
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [refresh]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage) => {
    await syncPurchasesForCurrentSession();
    const Purchases = getPurchases();
    if (!Purchases) throw new Error('Purchases not available');
    const { customerInfo: updated } = await Purchases.purchasePackage(pkg);
    setCustomerInfo(updated);
    return updated;
  }, []);

  return { customerInfo, loading, refresh, purchasePackage };
}

export function useOffering(offeringId: string | null | undefined) {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!offeringId) return;
    setLoading(true);
    fetchOffering(offeringId).then((o) => {
      setOffering(o);
      setLoading(false);
    });
  }, [offeringId]);

  return { offering, loading };
}

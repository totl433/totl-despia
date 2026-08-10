import React from 'react';
import { Linking } from 'react-native';

import { getDeepLinkDedupeKey } from '../lib/deepLinks';

type DeepLinkContextValue = {
  pendingUrl: string | null;
  consumePendingUrl: (url: string) => void;
};

const DeepLinkContext = React.createContext<DeepLinkContextValue | null>(null);
const DUPLICATE_URL_WINDOW_MS = 10_000;

export function DeepLinkProvider({ children }: { children: React.ReactNode }) {
  const [pendingUrl, setPendingUrl] = React.useState<string | null>(null);
  const lastReceivedRef = React.useRef<{ key: string; at: number } | null>(null);

  const queueUrl = React.useCallback((url: string) => {
    const key = getDeepLinkDedupeKey(url) ?? String(url).trim();
    if (!key) return;

    const now = Date.now();
    const last = lastReceivedRef.current;
    if (last?.key === key && now - last.at < DUPLICATE_URL_WINDOW_MS) return;

    lastReceivedRef.current = { key, at: now };
    setPendingUrl(url);
  }, []);

  React.useEffect(() => {
    let alive = true;
    let receivedRuntimeUrl = false;

    void Linking.getInitialURL()
      .then((url) => {
        if (alive && !receivedRuntimeUrl && url) queueUrl(url);
      })
      .catch(() => {});

    const subscription = Linking.addEventListener('url', ({ url }) => {
      receivedRuntimeUrl = true;
      if (url) queueUrl(url);
    });

    return () => {
      alive = false;
      subscription.remove();
    };
  }, [queueUrl]);

  const consumePendingUrl = React.useCallback((url: string) => {
    setPendingUrl((current) => (current === url ? null : current));
  }, []);

  const value = React.useMemo(
    () => ({ pendingUrl, consumePendingUrl }),
    [consumePendingUrl, pendingUrl]
  );

  return <DeepLinkContext.Provider value={value}>{children}</DeepLinkContext.Provider>;
}

export function useDeepLink() {
  const value = React.useContext(DeepLinkContext);
  if (!value) throw new Error('useDeepLink must be used within DeepLinkProvider');
  return value;
}

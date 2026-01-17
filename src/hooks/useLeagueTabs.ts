import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export type LeagueTab = 'chat' | 'mlt' | 'gw' | 'gwr';

interface UseLeagueTabsProps {
  code: string;
  defaultTab?: LeagueTab;
}

interface UseLeagueTabsReturn {
  tab: LeagueTab;
  setTab: (t: LeagueTab) => void;
  deepLinkError: string | null;
  markManualTabSelection: () => void;
}

/**
 * Owns League tab state + safe deep-link handling.
 * Deep-links (`?tab=...&leagueCode=...`) are applied ONCE and then removed from the URL
 * so they can't force tabs or trigger "notification open" logic repeatedly.
 */
export function useLeagueTabs({
  code,
  defaultTab = 'chat',
}: UseLeagueTabsProps): UseLeagueTabsReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTabState] = useState<LeagueTab>(defaultTab);
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);

  const tabRef = useRef(tab);
  const deepLinkAppliedRef = useRef(false);
  const manualTabSelectedRef = useRef(false);

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    if (deepLinkAppliedRef.current || manualTabSelectedRef.current) return;

    const urlTab = searchParams.get('tab');
    const urlLeagueCode = searchParams.get('leagueCode');

    setDeepLinkError(null);

    const isTab =
      urlTab === 'chat' || urlTab === 'mlt' || urlTab === 'gw' || urlTab === 'gwr';

    if (!isTab && !urlLeagueCode) return;

    if (urlLeagueCode && code && urlLeagueCode.toUpperCase() !== code.toUpperCase()) {
      setDeepLinkError(
        `Deep link mismatch: URL has leagueCode=${urlLeagueCode} but we're on league ${code}. URL: ${window.location.href}`
      );
      return;
    }

    if (isTab && tabRef.current !== urlTab) {
      setTabState(urlTab);
    }

    deepLinkAppliedRef.current = true;

    // Remove params so they can't re-trigger anything.
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    next.delete('leagueCode');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, code]);

  const setTab = useCallback((t: LeagueTab) => {
    manualTabSelectedRef.current = true;
    setTabState(t);
  }, []);

  const markManualTabSelection = useCallback(() => {
    manualTabSelectedRef.current = true;
  }, []);

  return { tab, setTab, deepLinkError, markManualTabSelection };
}


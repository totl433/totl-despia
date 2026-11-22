import React from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { api } from '../api';
import { SHOOTOUTS_QUERY_KEY } from './shootout';
import { shootoutSandbox, shootoutSandboxClient, type ShootoutClient } from './shootoutSandbox';

/**
 * The Shootout screens' data source: the BFF, or (admin sandbox) the in-memory
 * copy with Test Bot. The two keep separate React Query caches.
 */
export function useShootoutClient(sandbox?: boolean) {
  const queryClient = useQueryClient();
  const on = !!sandbox;

  // The bot moves on its own: refresh the screens when it does.
  React.useEffect(() => {
    if (!on) return;
    return shootoutSandbox.subscribe(() => {
      void queryClient.invalidateQueries({ queryKey: ['sandbox'] });
    });
  }, [on, queryClient]);

  return React.useMemo(() => {
    const client: ShootoutClient = on ? shootoutSandboxClient : (api as ShootoutClient);
    return {
      client,
      sandbox: on,
      listKey: on ? (['sandbox', ...SHOOTOUTS_QUERY_KEY] as const) : SHOOTOUTS_QUERY_KEY,
      oneKey: (id: string) => (on ? (['sandbox', 'players-shootout', id] as const) : (['players-shootout', id] as const)),
    };
  }, [on]);
}

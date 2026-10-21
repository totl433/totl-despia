import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultShouldDehydrateQuery, QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 60 * 60_000,
      retry: 2,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  // Bump the key when persisted response shapes or season bootstrapping changes.
  // This prevents an older installed build from hydrating stale empty snapshots.
  key: 'totl.react-query.v2',
});

export const queryPersistOptions = {
  persister: queryPersister,
  maxAge: 24 * 60 * 60_000,
  buster: '2.4',
  dehydrateOptions: {
    // Older gameweeks in the Game Centre timeline run to thousands of cards; they reload
    // as the feed scrolls to them rather than filling device storage.
    shouldDehydrateQuery: (query: Parameters<typeof defaultShouldDehydrateQuery>[0]) =>
      query.queryKey[0] !== 'game-centre-timeline' && defaultShouldDehydrateQuery(query),
  },
};


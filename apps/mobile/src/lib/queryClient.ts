import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
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
  buster: '2.0.27',
};


import React, { createContext, useCallback, useContext, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'totl:pendingJoinCode';

type JoinIntent = {
  leaderboardId?: string;
  code: string;
};

type JoinIntentContextType = {
  pending: JoinIntent | null;
  setPending: (intent: JoinIntent | null) => void;
  clearPending: () => void;
};

const JoinIntentContext = createContext<JoinIntentContextType>({
  pending: null,
  setPending: () => {},
  clearPending: () => {},
});

export function JoinIntentProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPendingState] = useState<JoinIntent | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setPendingState(JSON.parse(raw));
        } catch {}
      }
    });
  }, []);

  const setPending = useCallback((intent: JoinIntent | null) => {
    setPendingState(intent);
    if (intent) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
    } else {
      AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const clearPending = useCallback(() => {
    setPendingState(null);
    AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <JoinIntentContext.Provider value={{ pending, setPending, clearPending }}>
      {children}
    </JoinIntentContext.Provider>
  );
}

export function useJoinIntent() {
  return useContext(JoinIntentContext);
}

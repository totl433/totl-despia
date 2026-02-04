import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';

type ConfettiConfig = {
  count: number;
  origin: { x: number; y: number };
  explosionSpeed: number;
  fallSpeed: number;
  fadeOut: boolean;
  /** How long the overlay stays mounted (ms). */
  ttlMs: number;
};

type ConfettiApi = {
  fire: (opts?: Partial<ConfettiConfig>) => void;
};

const ConfettiContext = React.createContext<ConfettiApi | null>(null);

export function useConfetti(): ConfettiApi {
  const ctx = React.useContext(ConfettiContext);
  if (!ctx) throw new Error('useConfetti must be used within <ConfettiProvider>.');
  return ctx;
}

export function ConfettiProvider({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const [shot, setShot] = React.useState<{ key: number; cfg: ConfettiConfig } | null>(null);

  const fire = React.useCallback(
    (opts?: Partial<ConfettiConfig>) => {
      const cfg: ConfettiConfig = {
        count: 260,
        origin: { x: width / 2, y: -10 },
        explosionSpeed: 420,
        fallSpeed: 3200,
        fadeOut: true,
        ttlMs: 2600,
        ...(opts ?? {}),
      };
      setShot({ key: Date.now(), cfg });
    },
    [width]
  );

  React.useEffect(() => {
    if (!shot) return;
    const id = setTimeout(() => setShot(null), shot.cfg.ttlMs);
    return () => clearTimeout(id);
  }, [shot]);

  return (
    <ConfettiContext.Provider value={{ fire }}>
      <View style={{ flex: 1 }}>
        {children as any}
        {shot ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <ConfettiCannon
              key={shot.key}
              count={shot.cfg.count}
              origin={shot.cfg.origin}
              explosionSpeed={shot.cfg.explosionSpeed}
              fallSpeed={shot.cfg.fallSpeed}
              fadeOut={shot.cfg.fadeOut}
            />
          </View>
        ) : null}
      </View>
    </ConfettiContext.Provider>
  );
}


import React from 'react';
import { View } from 'react-native';

export default function PredictionsProgressPills({
  total,
  currentIndex,
  hasPick,
}: {
  total: number;
  currentIndex: number;
  hasPick: (idx: number) => boolean;
}) {
  if (total <= 0) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
      }}
    >
      {Array.from({ length: total }, (_, idx) => {
        const isCurrent = idx === currentIndex;
        const picked = hasPick(idx);

        const bg = isCurrent ? '#178F72' : picked ? '#116F59' : '#FFFFFF';

        return (
          <View
            key={idx}
            style={{
              width: isCurrent ? 26 : 10,
              height: 10,
              borderRadius: 999,
              backgroundColor: bg,
              borderWidth: picked || isCurrent ? 0 : 1,
              borderColor: 'rgba(148,163,184,0.35)',
            }}
          />
        );
      })}
    </View>
  );
}


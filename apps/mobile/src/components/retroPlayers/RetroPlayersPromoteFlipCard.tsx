import React from 'react';
import { View } from 'react-native';
import RetroDailyFlip from '../retroDaily/RetroDailyFlip';
import RetroDailyLogoBack from '../retroDaily/RetroDailyLogoBack';
import RetroPlayersCard from './RetroPlayersCard';
import type { PlayersCard } from '../../lib/retroPlayers/buildPuzzle';
import {
  RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS,
  RETRO_PROMOTE_FLIP_DELAY_MS,
  RETRO_PROMOTE_FLIP_MS,
} from '../retroDaily/RetroDailyPromoteFlipCard';

export {
  RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS,
  RETRO_PROMOTE_FLIP_DELAY_MS,
  RETRO_PROMOTE_FLIP_MS,
};

/** Holds on the back face, then 3D-flips to the player card. */
export default function RetroPlayersPromoteFlipCard({
  card,
  flipKey,
  holdMs = RETRO_PROMOTE_FLIP_DELAY_MS,
  flipMs = RETRO_PROMOTE_FLIP_MS,
  backFace,
  instant = false,
}: {
  card: PlayersCard;
  flipKey: number;
  holdMs?: number;
  flipMs?: number;
  backFace?: React.ReactNode;
  instant?: boolean;
}) {
  const [show, setShow] = React.useState(instant);

  React.useEffect(() => {
    if (instant) {
      setShow(true);
      return;
    }
    setShow(false);
    const id = setTimeout(() => setShow(true), holdMs);
    return () => clearTimeout(id);
  }, [card.id, flipKey, holdMs, instant]);

  if (instant) {
    return (
      <View style={{ flex: 1 }}>
        <RetroPlayersCard card={card} />
      </View>
    );
  }

  return (
    <RetroDailyFlip
      resetKey={`${flipKey}-${card.id}`}
      showB={show}
      durationMs={flipMs}
      faceA={backFace ?? <RetroDailyLogoBack seasonLabel="The Players" />}
      faceB={<RetroPlayersCard card={card} />}
    />
  );
}

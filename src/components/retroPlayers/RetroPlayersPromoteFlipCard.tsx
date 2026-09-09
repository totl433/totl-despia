import { useEffect, useState } from 'react';
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

export default function RetroPlayersPromoteFlipCard({
  card,
  flipKey,
  holdMs = RETRO_PROMOTE_FLIP_DELAY_MS,
}: {
  card: PlayersCard;
  flipKey: number;
  holdMs?: number;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(false);
    const id = window.setTimeout(() => setShow(true), holdMs);
    return () => window.clearTimeout(id);
  }, [card.id, flipKey, holdMs]);

  return (
    <RetroDailyFlip
      resetKey={`${flipKey}-${card.id}`}
      showB={show}
      durationMs={RETRO_PROMOTE_FLIP_MS}
      faceA={<RetroDailyLogoBack seasonLabel="The Players" />}
      faceB={<RetroPlayersCard card={card} />}
    />
  );
}

import React from 'react';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';

import GameCentreCard, { GameCentreCardButton, GameCentreCardHeader } from './GameCentreCard';

const PIN = Asset.fromModule(require('../../../assets/icons/pin.svg')).uri;
const PINNED_GAP = 20;

export type LeagueInvitePin = {
  id: string;
  leagueName: string;
  invitedByName: string;
};

/**
 * Pinned above the Game Centre feed when someone has invited you to a mini league.
 */
function GameCentreInvitePinnedCard({
  invite,
  busy = false,
  onJoin,
  onDismiss,
}: {
  invite: LeagueInvitePin;
  busy?: boolean;
  onJoin: (invite: LeagueInvitePin) => void;
  onDismiss: (invite: LeagueInvitePin) => void;
}) {
  return (
    <GameCentreCard
      gap={PINNED_GAP}
      header={
        <GameCentreCardHeader
          title="Mini-leagues"
          subtitle={`You've been invited to ${invite.leagueName}`}
          accessory={<SvgUri uri={PIN} width={10.6598} height={16} accessibilityLabel="Pinned" />}
        />
      }
      footer={
        <GameCentreCardButton
          label={busy ? 'Joining…' : 'Join now'}
          disabled={busy}
          onPress={() => onJoin(invite)}
          secondary={{ label: 'Dismiss', onPress: () => onDismiss(invite) }}
        />
      }
    />
  );
}

export default React.memo(GameCentreInvitePinnedCard);

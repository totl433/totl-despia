/**
 * DEV ONLY: rows for the feed audit (`features/matchCenter/feedAudit.ts`). A label above each
 * card names it without touching the card itself; sections and gaps are plain text, not cards.
 */
import React from 'react';
import { Text, View } from 'react-native';

import type { AuditEntry, AuditMeta } from '../../features/matchCenter/feedAudit';
import GameCentreInvitePinnedCard from './GameCentreInvitePinnedCard';
import GameCentrePinnedCard from './GameCentrePinnedCard';

const MONO = 'Menlo';
const INK = '#7C2D12';
const LABEL_BG = '#FEF3C7';

export function FeedAuditLabel({ meta, index }: { meta: AuditMeta; index: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <View style={{ backgroundColor: INK, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
        <Text style={{ fontFamily: MONO, fontSize: 11, color: '#FFFFFF', fontWeight: '700' }}>
          #{index} {meta.code}
        </Text>
      </View>
      <View style={{ backgroundColor: LABEL_BG, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, flexShrink: 1 }}>
        <Text style={{ fontFamily: MONO, fontSize: 11, color: INK }}>
          {meta.name}
          {meta.variant ? ` · ${meta.variant}` : ''} · {meta.origin}
        </Text>
      </View>
    </View>
  );
}

export function FeedAuditSection({ title }: { title: string }) {
  return (
    <View style={{ paddingTop: 12, paddingBottom: 12, borderTopWidth: 2, borderColor: INK, marginBottom: 8 }}>
      <Text style={{ fontFamily: MONO, fontSize: 13, fontWeight: '700', color: INK }}>{title.toUpperCase()}</Text>
    </View>
  );
}

export function FeedAuditMissing({ entry }: { entry: Extract<AuditEntry, { type: 'missing' }> }) {
  return (
    <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: INK, borderRadius: 8, padding: 10, marginBottom: 16 }}>
      <Text style={{ fontFamily: MONO, fontSize: 11, fontWeight: '700', color: INK }}>
        {entry.code} · NOT IN THE FEED · {entry.name}
      </Text>
      <Text style={{ fontFamily: MONO, fontSize: 11, color: INK, marginTop: 4 }}>{entry.note}</Text>
      <Text style={{ fontFamily: MONO, fontSize: 10, color: INK, opacity: 0.7, marginTop: 4 }}>Source: {entry.source}</Text>
    </View>
  );
}

const noop = () => {};

export function FeedAuditPin({ entry, index }: { entry: Extract<AuditEntry, { type: 'pin' | 'invite' }>; index: number }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <FeedAuditLabel meta={entry.meta} index={index} />
      {entry.type === 'pin' ? (
        <GameCentrePinnedCard pin={entry.pin} leagues={entry.leagues} scoreLabel={entry.scoreLabel} onAction={noop} onDismiss={noop} />
      ) : (
        <GameCentreInvitePinnedCard invite={entry.invite} onJoin={noop} onDismiss={noop} />
      )}
    </View>
  );
}

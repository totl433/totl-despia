import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { Card, Screen, TotlText } from '@totl/ui';

import ShareActionsFooter from '../components/share/ShareActionsFooter';
import ShareAssetTray from '../components/share/ShareAssetTray';

const meta: Meta<typeof ShareAssetTray> = {
  title: 'share/ShareAssetTray',
  component: ShareAssetTray,
};

export default meta;
type Story = StoryObj<typeof ShareAssetTray>;

export const Default: Story = {
  render: () => (
    <Screen fullBleed>
      <ShareAssetTray
        topGapPx={72}
        footerReserved={132}
        footerBottomInset={16}
        onClose={() => {}}
        footer={<ShareActionsFooter onShare={() => {}} />}
      >
        <Card style={{ width: 300, height: 420, alignSelf: 'center', justifyContent: 'center', alignItems: 'center' }}>
          <TotlText variant="heading">Share Card Preview</TotlText>
        </Card>
      </ShareAssetTray>
    </Screen>
  ),
};

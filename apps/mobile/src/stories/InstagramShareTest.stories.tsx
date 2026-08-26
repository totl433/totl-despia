import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import ViewShot from 'react-native-view-shot';
import { Card, Screen, TotlText } from '@totl/ui';

import ShareActionsFooter, { type ShareTarget } from '../components/share/ShareActionsFooter';
import { isShareCancelled, shareCapturedImage } from '../lib/shareToSocial';

/**
 * On-device Instagram share test. Open this story on a physical iPhone with
 * Instagram installed (simulator cannot run Instagram).
 *
 * From apps/mobile:
 *   EXPO_PUBLIC_STORYBOOK_ENABLED=true npx expo start --dev-client --localhost
 * then reload the existing dev client. No TestFlight required.
 */
function InstagramShareTest() {
  const shotRef = React.useRef<ViewShot>(null);
  const [sharing, setSharing] = React.useState(false);
  const [status, setStatus] = React.useState('Tap Instagram on a real iPhone');

  const handleShare = React.useCallback(async (target: ShareTarget) => {
    if (sharing) return;
    setSharing(true);
    setStatus(`Capturing for ${target}…`);
    try {
      const uri = await (shotRef.current as unknown as { capture?: () => Promise<string> })?.capture?.();
      if (!uri) {
        setStatus('Capture failed');
        return;
      }
      const dest = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}instagram-share-test-${Date.now()}.png`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      await shareCapturedImage({
        filePath: dest,
        target,
        message: 'TOTL Instagram share test',
        title: 'Share to Instagram',
      });
      setStatus(`${target} share finished`);
    } catch (error) {
      if (isShareCancelled(error)) {
        setStatus('Cancelled');
        return;
      }
      setStatus(error instanceof Error ? error.message : 'Share failed');
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ViewShot ref={shotRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
          <Card style={{ width: 280, height: 360, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF3F2' }}>
            <TotlText variant="heading">TOTL share test</TotlText>
            <TotlText style={{ marginTop: 12, textAlign: 'center' }}>
              If Instagram opens this card, the share path is working.
            </TotlText>
          </Card>
        </ViewShot>
        <TotlText style={{ marginTop: 20, marginBottom: 16, textAlign: 'center' }}>{status}</TotlText>
        <ShareActionsFooter disabled={sharing} onShare={handleShare} />
      </View>
    </Screen>
  );
}

const meta: Meta<typeof InstagramShareTest> = {
  title: 'share/InstagramShareTest',
  component: InstagramShareTest,
};

export default meta;
type Story = StoryObj<typeof InstagramShareTest>;

export const OnDevice: Story = {
  render: () => <InstagramShareTest />,
};

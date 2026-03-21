import React from 'react';
import { View } from 'react-native';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';
import { useTokens } from '@totl/ui';

/**
 * Center header mark: same TOTL wordmark as the default AppTopHeader (Home).
 */
export default function HeaderTotlLogo() {
  const t = useTokens();
  const fixedHeaderLogoUri = React.useMemo(() => {
    const isLightMode = t.color.background.toLowerCase() === '#f8fafc';
    return Asset.fromModule(
      isLightMode
        ? require('../../../../public/assets/badges/totl-logo1-black.svg')
        : require('../../../../public/assets/badges/totl-logo1.svg')
    ).uri;
  }, [t.color.background]);

  return (
    <View
      style={{
        width: 159,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SvgUri uri={fixedHeaderLogoUri} width={159} height={50} />
    </View>
  );
}

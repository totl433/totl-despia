import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';

import PageHeader from '../../components/PageHeader';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';

export default function CookiePolicyScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();

  return (
    <Screen fullBleed>
      <PageHeader
        title="Cookie Policy"
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={24} color={t.color.text} />
          </Pressable>
        }
      />
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: t.space[4],
            paddingTop: t.space[4],
            paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '900', marginBottom: 4 }}>COOKIE POLICY</TotlText>
            <TotlText variant="muted">Last updated 22 January 2026</TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ marginBottom: 10 }}>
              This Cookie Policy explains how Play TotL Ltd ("Company", "we", "us", and "our") uses cookies and similar
              technologies to recognise you when you visit https://playtotl.com. It explains what these technologies are,
              why we use them, and your rights to control our use of them.
            </TotlText>
            <TotlText variant="muted">
              In some cases we may use cookies to collect personal information, or information that becomes personal
              information when combined with other data.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>What are cookies?</TotlText>
            <TotlText style={{ marginBottom: 10 }}>
              Cookies are small data files placed on your computer or mobile device when you visit a website. Cookies are
              widely used by website owners to make websites work, improve performance, and provide reporting information.
            </TotlText>
            <TotlText variant="muted">
              Cookies set by the website owner are called first-party cookies. Cookies set by other parties are
              third-party cookies and can enable analytics, advertising, and interactive features.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>Why do we use cookies?</TotlText>
            <TotlText style={{ marginBottom: 10 }}>
              We use first- and third-party cookies for several reasons. Some cookies are required for technical reasons in
              order for our Website to operate, and we refer to these as essential or strictly necessary cookies. Other
              cookies enable us to track and target the interests of our users to enhance experience on our online
              properties. Third parties also serve cookies through our Website for advertising, analytics, and other
              purposes.
            </TotlText>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>How can I control cookies?</TotlText>
            <TotlText variant="muted" style={{ marginBottom: 8 }}>
              You have the right to decide whether to accept or reject cookies. You can exercise your cookie rights by
              setting your preferences in the Cookie Consent Manager. Essential cookies cannot be rejected because they are
              strictly necessary to provide services.
            </TotlText>
            <TotlText variant="muted">
              If you choose to reject cookies, you may still use our Website, but access to some functionality and areas
              may be restricted. You may also set or amend your browser controls to accept or refuse cookies.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>Analytics and customisation cookies</TotlText>
            <TotlText style={{ marginBottom: 8 }}>Cookie: _ga</TotlText>
            <TotlText variant="muted" style={{ marginBottom: 8 }}>
              Purpose: records a particular ID used to come up with data about website usage by the user.
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 8 }}>
              Provider: playtotl.com | Service: Google Analytics | Type: http cookie | Expires: 1 year 1 month 4 days
            </TotlText>
            <TotlText style={{ marginBottom: 8 }}>Cookie: _ga_#</TotlText>
            <TotlText variant="muted" style={{ marginBottom: 8 }}>
              Purpose: used to distinguish individual users by means of a randomly generated client identifier, which
              allows calculation of visits and sessions.
            </TotlText>
            <TotlText variant="muted">
              Provider: playtotl.com | Service: Google Analytics | Type: http cookie | Expires: 1 year 1 month 4 days
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>Browser controls and ads</TotlText>
            <TotlText style={{ marginBottom: 10 }}>
              As the means by which you can refuse cookies through browser controls vary from browser to browser, you
              should visit your browser help menu for more information. Information is typically available for Chrome,
              Internet Explorer, Firefox, Safari, Edge, and Opera.
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 10 }}>
              In addition, most advertising networks offer an opt-out for targeted advertising, including the Digital
              Advertising Alliance, Digital Advertising Alliance of Canada, and the European Interactive Digital Advertising
              Alliance.
            </TotlText>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>Other tracking technologies</TotlText>
            <TotlText variant="muted" style={{ marginBottom: 8 }}>
              Cookies are not the only way to recognise or track visitors. We may use web beacons (tracking pixels or
              clear gifs), which are tiny graphics files containing a unique identifier.
            </TotlText>
            <TotlText variant="muted">
              These technologies help us monitor traffic patterns, communicate with cookies, understand referral sources,
              improve site performance, and measure campaign effectiveness. In many instances, these technologies rely on
              cookies to function properly.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>Flash cookies and targeted advertising</TotlText>
            <TotlText style={{ marginBottom: 10 }}>
              Websites may also use Flash Cookies (Local Shared Objects or LSOs) to collect and store information about use
              of services, fraud prevention, and site operations. If you do not want Flash Cookies stored, you can adjust
              your Flash player settings to block storage.
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 10 }}>
              Setting Flash Player to restrict acceptance of Flash Cookies may reduce or impede functionality of some Flash
              applications used in connection with services or online content.
            </TotlText>
            <TotlText style={{ marginBottom: 10 }}>
              Third parties may serve cookies on your device to serve advertising through our Website. These companies may
              use information about visits to this and other websites to provide relevant advertisements and measure
              effectiveness. This process does not identify your name or direct contact details unless you choose to provide
              them.
            </TotlText>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>Policy updates</TotlText>
            <TotlText variant="muted">
              We may update this Cookie Policy from time to time to reflect changes to cookies we use or for operational,
              legal, or regulatory reasons. Please revisit this policy regularly. The date at the top indicates when it was
              last updated.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>Contact</TotlText>
            <TotlText>hello@playtotl.com</TotlText>
            <TotlText variant="muted">Play TotL Ltd, London, E96GE, United Kingdom</TotlText>
          </Card>
        </ScrollView>
      </View>
    </Screen>
  );
}

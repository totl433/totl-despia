import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';

import PageHeader from '../../components/PageHeader';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';

export default function PrivacyPolicyScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();

  return (
    <Screen fullBleed>
      <PageHeader
        title="Privacy Policy"
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
            <TotlText style={{ fontWeight: '900', marginBottom: 4 }}>PRIVACY POLICY</TotlText>
            <TotlText variant="muted" style={{ marginBottom: 6 }}>
              Last updated November 24, 2025
            </TotlText>
            <TotlText variant="muted">
              Play TotL Ltd (doing business as TotL) explains in this policy how personal information is collected, used,
              stored, shared, and protected when you use TotL services.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>1. What information we collect</TotlText>
            <TotlText variant="muted" style={{ marginBottom: 8 }}>
              We may collect personal information you provide directly, such as account and profile details, contact
              details, support messages, and preference settings.
            </TotlText>
            <TotlText variant="muted">
              We may also collect application, device, and usage data automatically to support operations, security,
              analytics, and product improvement.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>2. How we process your information</TotlText>
            <TotlText variant="muted" style={{ marginBottom: 8 }}>
              We process information to create and manage accounts, provide game and leaderboard features, communicate with
              users, maintain service reliability, and prevent abuse.
            </TotlText>
            <TotlText variant="muted">
              Processing may also support legal compliance, troubleshooting, service diagnostics, and internal analytics.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>3. Legal bases for processing</TotlText>
            <TotlText variant="muted" style={{ marginBottom: 8 }}>
              Depending on your location, we may process information based on consent, contract performance, legitimate
              interests, legal obligations, or protection of vital interests.
            </TotlText>
            <TotlText variant="muted">
              Where required, you can withdraw consent for consent-based processing.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>4. When and with whom information is shared</TotlText>
            <TotlText variant="muted" style={{ marginBottom: 8 }}>
              Information may be shared with service providers that support hosting, analytics, messaging, operations, or
              customer support under contractual safeguards.
            </TotlText>
            <TotlText variant="muted">
              We may also share information in legal, compliance, business transfer, fraud prevention, or rights-protection
              scenarios when required or permitted by law.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>5. Third-party websites and services</TotlText>
            <TotlText variant="muted">
              Our services may include links or integrations with third-party services. Their privacy practices are governed
              by their own policies, and we recommend reviewing those policies directly.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>6. Cookies and tracking technologies</TotlText>
            <TotlText variant="muted">
              We may use cookies and similar technologies for authentication, preference storage, analytics, fraud
              prevention, and service performance. See Cookie Policy for cookie-specific controls and details.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>7. International data transfers</TotlText>
            <TotlText variant="muted">
              Your information may be processed in countries other than your own. Where required, appropriate safeguards are
              used for cross-border transfers, including contractual and technical measures.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>8. Data retention</TotlText>
            <TotlText variant="muted">
              We retain personal information only as long as necessary for business, legal, tax, security, and compliance
              purposes, and then delete or anonymize it where appropriate.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>9. How we keep information safe</TotlText>
            <TotlText variant="muted">
              We use technical and organizational safeguards to protect personal information. No online system can guarantee
              absolute security, but we continuously work to reduce risk and respond to incidents quickly.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>10. Information about minors</TotlText>
            <TotlText variant="muted">
              We do not knowingly collect personal information from minors where prohibited by law. If you believe such data
              has been provided, contact us so we can investigate and remove it where required.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>11. Your privacy rights</TotlText>
            <TotlText variant="muted" style={{ marginBottom: 8 }}>
              Depending on your location, you may have rights to access, correct, update, delete, restrict, object, or
              request portability of personal information.
            </TotlText>
            <TotlText variant="muted">
              You may also have rights related to consent withdrawal, complaint submission, and direct marketing preferences.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>12. Do-Not-Track controls</TotlText>
            <TotlText variant="muted">
              Some browsers include Do-Not-Track settings. Because no uniform standard exists, services may not respond to
              all DNT signals in the same way.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>13. U.S. resident privacy disclosures</TotlText>
            <TotlText variant="muted">
              U.S. state privacy laws may grant additional rights regarding access, deletion, correction, and opt-out
              requests. We honor applicable rights requests under the laws that apply to you.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>14. Policy updates</TotlText>
            <TotlText variant="muted">
              We may update this Privacy Policy from time to time for legal, operational, or product reasons. Updates are
              indicated by revising the date at the top of this page.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>15. Contact us</TotlText>
            <TotlText style={{ marginBottom: 6 }}>hello@playtotl.com</TotlText>
            <TotlText variant="muted">Play TotL Ltd</TotlText>
            <TotlText variant="muted">Brenthouse Road, London E96GE, United Kingdom</TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>16. Review, update, or delete your data</TotlText>
            <TotlText variant="muted">
              You can request to review, update, or delete your personal information by contacting us at the email above.
              We may need to verify your identity before completing requests, consistent with applicable law.
            </TotlText>
          </Card>
        </ScrollView>
      </View>
    </Screen>
  );
}

import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';

import PageHeader from '../../components/PageHeader';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';

export default function TermsConditionsScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();

  return (
    <Screen fullBleed>
      <PageHeader
        title="Terms and Conditions"
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
            <TotlText style={{ fontWeight: '900', marginBottom: 4 }}>TERMS AND CONDITIONS</TotlText>
            <TotlText variant="muted" style={{ marginBottom: 6 }}>
              Last updated November 26, 2025
            </TotlText>
            <TotlText variant="muted">
              These Legal Terms are a binding agreement between you and Play TotL Ltd (doing business as TotL) for use of
              TotL services and the TotL mobile app.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>1. Our Services</TotlText>
            <TotlText variant="muted">Information about the services provided by TotL, including website and app features.</TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>2. Intellectual Property Rights</TotlText>
            <TotlText variant="muted">
              TotL owns or licenses service content and related intellectual property. You may use the services for personal,
              non-commercial use in line with these Terms.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>3. User Representations</TotlText>
            <TotlText variant="muted">
              By using TotL, you confirm account details are accurate, you have legal capacity to agree, and your use
              complies with applicable laws and these Terms.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>4. User Registration</TotlText>
            <TotlText variant="muted">
              You are responsible for maintaining account confidentiality, safeguarding credentials, and all activity under
              your account.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>5. Prohibited Activities</TotlText>
            <TotlText variant="muted">
              You must not misuse the services, interfere with operation, violate security controls, scrape data at scale,
              impersonate others, run unauthorized automation, or otherwise abuse TotL systems.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>6. User Generated Contributions</TotlText>
            <TotlText variant="muted">
              If you submit content, you confirm you have rights and permissions for it, and that it does not violate laws
              or third-party rights.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>7. Contribution Licence</TotlText>
            <TotlText variant="muted">
              You grant TotL a non-exclusive, worldwide, royalty-free licence to use contributions in connection with
              operating and improving the services.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>8. Mobile Application Licence</TotlText>
            <TotlText variant="muted">
              TotL grants a limited, revocable, non-transferable licence to install and use the app on devices you own or
              control, subject to these Terms and store rules.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>9. Third-Party Websites and Content</TotlText>
            <TotlText variant="muted">
              TotL may include links or integrations to third-party services. TotL is not responsible for third-party
              content, operations, or privacy practices.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>10. Advertisers</TotlText>
            <TotlText variant="muted">
              Advertisers may display material through TotL services. Interactions with advertisers are between you and the
              advertiser.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>11. Services Management</TotlText>
            <TotlText variant="muted">
              TotL may monitor use, remove content, restrict access, investigate misuse, and take steps needed to protect
              service integrity and legal rights.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>12. Privacy Policy</TotlText>
            <TotlText variant="muted">
              Use of TotL is also governed by the Privacy Policy, which explains data collection, use, storage, and sharing.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>13. Copyright Infringements</TotlText>
            <TotlText variant="muted">
              If you believe content infringes copyright, contact TotL with sufficient details so the claim can be reviewed
              and handled appropriately.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>14. Term and Termination</TotlText>
            <TotlText variant="muted">
              These Terms apply while you use TotL. TotL may suspend or terminate access in line with these Terms and
              applicable law.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>15. Modifications and Interruptions</TotlText>
            <TotlText variant="muted">
              TotL may update, modify, pause, or discontinue services or features at any time. Availability may vary due to
              maintenance or operational factors.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>16. Governing Law</TotlText>
            <TotlText variant="muted">These Terms are governed by the laws of the United Kingdom.</TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>17. Dispute Resolution</TotlText>
            <TotlText variant="muted">
              Disputes are intended to be resolved first through informal discussions and then by the dispute mechanisms set
              out in the Terms, subject to exceptions required by law.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>18. Corrections</TotlText>
            <TotlText variant="muted">
              TotL may correct inaccuracies, omissions, or typographical errors and update service information without prior
              notice.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>19. Disclaimer</TotlText>
            <TotlText variant="muted">
              Services are provided on an "as is" and "as available" basis to the extent permitted by law, without
              warranties not expressly stated.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>20. Limitations of Liability</TotlText>
            <TotlText variant="muted">
              To the extent permitted by law, TotL and its personnel are not liable for indirect, incidental, or
              consequential damages arising from service use.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>21. Indemnification</TotlText>
            <TotlText variant="muted">
              You agree to indemnify TotL against claims arising from misuse of the services, breach of these Terms, or
              violation of third-party rights.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>22. User Data</TotlText>
            <TotlText variant="muted">
              TotL maintains data needed to operate the services. You are responsible for the accuracy and legality of data
              you provide.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>23. Electronic Communications</TotlText>
            <TotlText variant="muted">
              By using TotL, you consent to electronic communications and agree electronic notices and agreements satisfy
              legal writing requirements where allowed.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>24. California Users and Residents</TotlText>
            <TotlText variant="muted">
              Additional disclosures may apply to California residents under California consumer protection requirements.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>25. Miscellaneous</TotlText>
            <TotlText variant="muted">
              These Terms are the entire agreement regarding service use. If any provision is unenforceable, remaining
              provisions continue in effect.
            </TotlText>
          </Card>

          <Card style={{ padding: 16 }}>
            <TotlText style={{ fontWeight: '800', marginBottom: 6 }}>26. Contact Us</TotlText>
            <TotlText>Play TotL Ltd</TotlText>
            <TotlText>80 Elbury House</TotlText>
            <TotlText>London E96GE</TotlText>
            <TotlText style={{ marginBottom: 4 }}>United Kingdom</TotlText>
            <TotlText variant="muted">hello@playtotl.com</TotlText>
          </Card>
        </ScrollView>
      </View>
    </Screen>
  );
}

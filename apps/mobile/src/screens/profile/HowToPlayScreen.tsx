import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';

import PageHeader from '../../components/PageHeader';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';

export default function HowToPlayScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const sections: Array<{
    title: string;
    icon: string;
    intro: string;
    callouts?: Array<{ title: string; body: string }>;
  }> = [
    {
      title: 'Predictions',
      icon: '🎯',
      intro:
        'Before each Premier League Gameweek, head to Predictions and make your picks for every match: Home Win, Draw, or Away Win.',
      callouts: [
        {
          title: 'Important',
          body: 'Once the first match kicks off, predictions are locked. Make sure your picks are in before the deadline.',
        },
        {
          title: 'Scoring',
          body: 'Each correct prediction adds 1 to your Overall Correct Predictions (OCP) total for the season.',
        },
      ],
    },
    {
      title: 'Mini-Leagues',
      icon: '🏆',
      intro:
        'Create a Mini-League and invite up to 8 players. Share the code, get everyone predicting, and battle week by week.',
      callouts: [
        {
          title: 'League points',
          body: 'Win the week = 3 points, Draw = 1 point, Lose = 0 points.',
        },
        {
          title: 'Ties',
          body: 'If players tie on correct predictions, the most Unicorns wins. Still tied? It is a draw.',
        },
      ],
    },
    {
      title: 'Unicorns',
      icon: '🦄',
      intro:
        'In Mini-Leagues with 3+ players, if you are the only person to correctly predict a fixture, that is a Unicorn.',
      callouts: [
        {
          title: 'Strategy tip',
          body: 'Unicorns can decide tight weeks, so backing a surprise result can pay off.',
        },
      ],
    },
    {
      title: 'Leaderboard',
      icon: '📈',
      intro: 'The Leaderboard shows how you rank against all players in TOTL.',
      callouts: [
        {
          title: 'Simple rule',
          body: 'The more correct predictions you make, the higher you climb. No extra points, no tie-break complexity.',
        },
      ],
    },
    {
      title: 'Form Leaderboards',
      icon: '⚡',
      intro: 'Form tables focus on current performance, not just season totals.',
      callouts: [
        {
          title: '5-Week Form',
          body: 'Your short-term hot streak view.',
        },
        {
          title: '10-Week Form',
          body: 'A wider rolling view that rewards consistency and momentum.',
        },
        {
          title: 'How they work',
          body: 'Both update weekly. To appear on 10-Week form, you need to have played 10 gameweeks in a row.',
        },
      ],
    },
    {
      title: "That's It",
      icon: '🎉',
      intro:
        'Predict each week, beat your mates, and climb the tables. Stay sharp and see who is truly Top of the League.',
    },
  ];

  return (
    <Screen fullBleed>
      <PageHeader
        title="How To Play"
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingTop: t.space[4],
          paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
        }}
        showsVerticalScrollIndicator={false}
      >
        <TotlText variant="muted" style={{ marginBottom: 10 }}>
          Welcome to TOTL (Top of the League) — quick predictions and friendly rivalries.
        </TotlText>

        {sections.map((section, idx) => (
          <Card key={section.title} style={{ padding: 16, marginBottom: idx === sections.length - 1 ? 0 : 12 }}>
            <TotlText style={{ fontWeight: '900', marginBottom: 8 }}>
              {section.icon} {section.title}
            </TotlText>
            <TotlText style={{ marginBottom: section.callouts?.length ? 10 : 0 }}>{section.intro}</TotlText>
            {section.callouts?.length ? (
              <View style={{ gap: 8 }}>
                {section.callouts.map((callout) => (
                  <View
                    key={`${section.title}-${callout.title}`}
                    style={{
                      borderWidth: 1,
                      borderColor: 'rgba(148,163,184,0.24)',
                      borderRadius: 10,
                      padding: 10,
                      backgroundColor: 'rgba(248,250,252,0.8)',
                    }}
                  >
                    <TotlText style={{ fontWeight: '800', marginBottom: 4 }}>{callout.title}</TotlText>
                    <TotlText variant="muted">{callout.body}</TotlText>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

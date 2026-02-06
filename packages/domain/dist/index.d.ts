import { z } from 'zod';
export declare const PickSchema: z.ZodEnum<{
    H: "H";
    D: "D";
    A: "A";
}>;
export type Pick = z.infer<typeof PickSchema>;
export declare const LiveStatusSchema: z.ZodEnum<{
    TIMED: "TIMED";
    IN_PLAY: "IN_PLAY";
    PAUSED: "PAUSED";
    FINISHED: "FINISHED";
    SCHEDULED: "SCHEDULED";
}>;
export type LiveStatus = z.infer<typeof LiveStatusSchema>;
export declare const GameweekStateSchema: z.ZodEnum<{
    GW_OPEN: "GW_OPEN";
    GW_PREDICTED: "GW_PREDICTED";
    LIVE: "LIVE";
    RESULTS_PRE_GW: "RESULTS_PRE_GW";
}>;
export type GameweekState = z.infer<typeof GameweekStateSchema>;
export declare const FixtureSchema: z.ZodObject<{
    id: z.ZodString;
    gw: z.ZodNumber;
    fixture_index: z.ZodNumber;
    kickoff_time: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    api_match_id: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    home_team: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    away_team: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    home_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    away_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    home_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    away_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    home_crest: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    away_crest: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type Fixture = z.infer<typeof FixtureSchema>;
export declare const LiveScoreSchema: z.ZodObject<{
    api_match_id: z.ZodNumber;
    gw: z.ZodNumber;
    fixture_index: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    home_score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    away_score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        TIMED: "TIMED";
        IN_PLAY: "IN_PLAY";
        PAUSED: "PAUSED";
        FINISHED: "FINISHED";
        SCHEDULED: "SCHEDULED";
    }>>>;
    minute: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    home_team: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    away_team: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    kickoff_time: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    updated_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    goals: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    red_cards: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
}, z.core.$strip>;
export type LiveScore = z.infer<typeof LiveScoreSchema>;
export declare const GwResultRowSchema: z.ZodObject<{
    fixture_index: z.ZodNumber;
    result: z.ZodEnum<{
        H: "H";
        D: "D";
        A: "A";
    }>;
}, z.core.$strip>;
export type GwResultRow = z.infer<typeof GwResultRowSchema>;
export declare const PredictionPickRowSchema: z.ZodObject<{
    fixture_index: z.ZodNumber;
    pick: z.ZodEnum<{
        H: "H";
        D: "D";
        A: "A";
    }>;
}, z.core.$strip>;
export type PredictionPickRow = z.infer<typeof PredictionPickRowSchema>;
export declare const PredictionsResponseSchema: z.ZodObject<{
    gw: z.ZodNumber;
    fixtures: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        gw: z.ZodNumber;
        fixture_index: z.ZodNumber;
        kickoff_time: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        api_match_id: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        home_team: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        away_team: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        home_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        away_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        home_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        away_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        home_crest: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        away_crest: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    picks: z.ZodArray<z.ZodObject<{
        fixture_index: z.ZodNumber;
        pick: z.ZodEnum<{
            H: "H";
            D: "D";
            A: "A";
        }>;
    }, z.core.$strip>>;
    submitted: z.ZodBoolean;
    teamForms: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>>;
}, z.core.$strip>;
export type PredictionsResponse = z.infer<typeof PredictionsResponseSchema>;
export declare const HomeSnapshotSchema: z.ZodObject<{
    currentGw: z.ZodNumber;
    viewingGw: z.ZodNumber;
    fixtures: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        gw: z.ZodNumber;
        fixture_index: z.ZodNumber;
        kickoff_time: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        api_match_id: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        home_team: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        away_team: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        home_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        away_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        home_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        away_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        home_crest: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        away_crest: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    userPicks: z.ZodRecord<z.ZodString, z.ZodEnum<{
        H: "H";
        D: "D";
        A: "A";
    }>>;
    liveScores: z.ZodArray<z.ZodObject<{
        api_match_id: z.ZodNumber;
        gw: z.ZodNumber;
        fixture_index: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        home_score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        away_score: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        status: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            TIMED: "TIMED";
            IN_PLAY: "IN_PLAY";
            PAUSED: "PAUSED";
            FINISHED: "FINISHED";
            SCHEDULED: "SCHEDULED";
        }>>>;
        minute: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        home_team: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        away_team: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        kickoff_time: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        updated_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        goals: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
        red_cards: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    }, z.core.$strip>>;
    gwResults: z.ZodArray<z.ZodObject<{
        fixture_index: z.ZodNumber;
        result: z.ZodEnum<{
            H: "H";
            D: "D";
            A: "A";
        }>;
    }, z.core.$strip>>;
    hasSubmittedViewingGw: z.ZodBoolean;
}, z.core.$strip>;
export type HomeSnapshot = z.infer<typeof HomeSnapshotSchema>;
export declare const RankBadgeSchema: z.ZodObject<{
    label: z.ZodString;
    rank: z.ZodNumber;
    total: z.ZodNumber;
    percentileLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    score: z.ZodOptional<z.ZodNumber>;
    totalFixtures: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type RankBadge = z.infer<typeof RankBadgeSchema>;
export declare const HomeRanksSchema: z.ZodObject<{
    latestGw: z.ZodNullable<z.ZodNumber>;
    gwRank: z.ZodNullable<z.ZodObject<{
        label: z.ZodString;
        rank: z.ZodNumber;
        total: z.ZodNumber;
        percentileLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        score: z.ZodOptional<z.ZodNumber>;
        totalFixtures: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    fiveWeekForm: z.ZodNullable<z.ZodObject<{
        label: z.ZodString;
        rank: z.ZodNumber;
        total: z.ZodNumber;
        percentileLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        score: z.ZodOptional<z.ZodNumber>;
        totalFixtures: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    tenWeekForm: z.ZodNullable<z.ZodObject<{
        label: z.ZodString;
        rank: z.ZodNumber;
        total: z.ZodNumber;
        percentileLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        score: z.ZodOptional<z.ZodNumber>;
        totalFixtures: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    seasonRank: z.ZodNullable<z.ZodObject<{
        label: z.ZodString;
        rank: z.ZodNumber;
        total: z.ZodNumber;
        percentileLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        score: z.ZodOptional<z.ZodNumber>;
        totalFixtures: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type HomeRanks = z.infer<typeof HomeRanksSchema>;
export declare const GwResultsSchema: z.ZodObject<{
    score: z.ZodNumber;
    totalFixtures: z.ZodNumber;
    gwRank: z.ZodNullable<z.ZodNumber>;
    gwRankTotal: z.ZodNullable<z.ZodNumber>;
    trophies: z.ZodObject<{
        gw: z.ZodBoolean;
        form5: z.ZodBoolean;
        form10: z.ZodBoolean;
        overall: z.ZodBoolean;
    }, z.core.$strip>;
    mlVictories: z.ZodNumber;
    mlVictoryNames: z.ZodArray<z.ZodString>;
    mlVictoryData: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        avatar: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    leaderboardChanges: z.ZodObject<{
        overall: z.ZodObject<{
            before: z.ZodNullable<z.ZodNumber>;
            after: z.ZodNullable<z.ZodNumber>;
            change: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strip>;
        form5: z.ZodObject<{
            before: z.ZodNullable<z.ZodNumber>;
            after: z.ZodNullable<z.ZodNumber>;
            change: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strip>;
        form10: z.ZodObject<{
            before: z.ZodNullable<z.ZodNumber>;
            after: z.ZodNullable<z.ZodNumber>;
            change: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type GwResults = z.infer<typeof GwResultsSchema>;
export declare const ProfileSummarySchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodNullable<z.ZodString>;
    avatar_url: z.ZodNullable<z.ZodString>;
    isAdmin: z.ZodBoolean;
    ocp: z.ZodNumber;
    miniLeaguesCount: z.ZodNumber;
    weeksStreak: z.ZodNumber;
}, z.core.$strip>;
export type ProfileSummary = z.infer<typeof ProfileSummarySchema>;
export declare const EmailPreferencesSchema: z.ZodObject<{
    new_gameweek: z.ZodBoolean;
    results_published: z.ZodBoolean;
    news_updates: z.ZodBoolean;
}, z.core.$strip>;
export type EmailPreferences = z.infer<typeof EmailPreferencesSchema>;
export declare const UserStatsDataSchema: z.ZodObject<{
    lastCompletedGw: z.ZodNullable<z.ZodNumber>;
    lastCompletedGwPercentile: z.ZodNullable<z.ZodNumber>;
    overallPercentile: z.ZodNullable<z.ZodNumber>;
    correctPredictionRate: z.ZodNullable<z.ZodNumber>;
    bestStreak: z.ZodNumber;
    bestStreakGwRange: z.ZodNullable<z.ZodString>;
    avgPointsPerWeek: z.ZodNullable<z.ZodNumber>;
    bestSingleGw: z.ZodNullable<z.ZodObject<{
        points: z.ZodNumber;
        gw: z.ZodNumber;
    }, z.core.$strip>>;
    lowestSingleGw: z.ZodNullable<z.ZodObject<{
        points: z.ZodNumber;
        gw: z.ZodNumber;
    }, z.core.$strip>>;
    chaosIndex: z.ZodNullable<z.ZodNumber>;
    chaosCorrectCount: z.ZodNullable<z.ZodNumber>;
    chaosTotalCount: z.ZodNullable<z.ZodNumber>;
    mostCorrectTeam: z.ZodNullable<z.ZodObject<{
        code: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        percentage: z.ZodNumber;
    }, z.core.$strip>>;
    mostIncorrectTeam: z.ZodNullable<z.ZodObject<{
        code: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        percentage: z.ZodNumber;
    }, z.core.$strip>>;
    weeklyParData: z.ZodNullable<z.ZodArray<z.ZodObject<{
        gw: z.ZodNumber;
        userPoints: z.ZodNumber;
        averagePoints: z.ZodNumber;
    }, z.core.$strip>>>;
    trophyCabinet: z.ZodNullable<z.ZodObject<{
        lastGw: z.ZodNumber;
        form5: z.ZodNumber;
        form10: z.ZodNumber;
        overall: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type UserStatsData = z.infer<typeof UserStatsDataSchema>;
export declare const UnicornCardSchema: z.ZodObject<{
    fixture_index: z.ZodNumber;
    gw: z.ZodNumber;
    home_team: z.ZodString;
    away_team: z.ZodString;
    home_code: z.ZodNullable<z.ZodString>;
    away_code: z.ZodNullable<z.ZodString>;
    home_name: z.ZodNullable<z.ZodString>;
    away_name: z.ZodNullable<z.ZodString>;
    kickoff_time: z.ZodNullable<z.ZodString>;
    pick: z.ZodEnum<{
        H: "H";
        D: "D";
        A: "A";
    }>;
    league_names: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type UnicornCard = z.infer<typeof UnicornCardSchema>;
//# sourceMappingURL=index.d.ts.map
# Prompt Execution Rules

## Core Principles

1. **Single Source of Truth**: Always use the authoritative data source. For live data: `live_scores` table. For historical data: `app_gw_results`, `app_v_gw_points`, `app_v_ocp_overall` views.

2. **Test Locally First**: Always test changes in local dev (`npm run dev`) before pushing.

3. **Never Push Without Asking**: Never commit or push changes without explicitly asking the user first.

4. **Debug Yourself**: When debugging UI issues, investigate the code, add logging, and analyze the logic yourself. Never ask the user to check the console - you can add console.log statements and analyze the code flow yourself.

5. **Platform-Aware Development**: The app serves both web browsers and Despia native app. Always consider platform differences:
    - Use `isNativeApp()` / `isWebBrowser()` from `src/lib/platform.ts` for platform detection (planned - see `PLATFORM_DIFFERENTIATION_PLAN.md`)
    - Push notifications only work in native app - hide UI on web
    - Cookie consent required on web only (GDPR/CCPA compliance)
    - Some features may differ between platforms (see Platform Differentiation in `PROJECT_CONTEXT.md`)
    - Until platform detection utility is implemented, use `isDespiaAvailable()` from `src/lib/pushNotificationsV2.ts`

6. **Ask for Clarification**: If a request is ambiguous or could have multiple interpretations, ask for clarification before implementing.

7. **Preserve Existing Patterns**: Follow existing code patterns and conventions in the codebase.

8. **Verify Data Consistency**: When calculating derived values (like OCP), ensure consistency with the single source of truth.

9. **Always Use Storybook**: Always try to use Storybook. Ask if this should be a component in Storybook or look for a relevant component.

10. **Always Consider Game State**: When working on any component that displays gameweek data, predictions, scores, or leaderboards, you MUST:
    - Use the `useGameweekState` hook to determine the current state
    - Check the `GAME_STATE.md` document for component behavior rules
    - Ensure the component behaves correctly in all 4 states: `GW_OPEN`, `GW_PREDICTED`, `LIVE`, `RESULTS_PRE_GW`
    - Pass `userId` to `useGameweekState` when user-specific behavior is needed (e.g., prediction banners, shiny icons)
    - Never create custom state logic - always use the centralized game state system
    - Test component behavior in all states before considering work complete
    - **Key principle**: GW is LIVE between first kickoff and last FT. A game is LIVE between kickoff and FT (status IN_PLAY or PAUSED)

11. **Game State Data Sources**: When displaying data, use the correct source based on game state:
    - For live scores/updates: `live_scores` table
    - For final results: `app_gw_results` table
    - For fixture details: `app_fixtures` table
    - For points/leaderboards: `app_v_gw_points`, `app_v_ocp_overall` views
    - Never mix live and final data sources incorrectly

12. **GW Transition Awareness**: Be aware of the GW transition system:
    - Users can stay in `RESULTS_PRE_GW` even when a new GW is published
    - Check `user_notification_preferences.current_viewing_gw` to know which GW the user is viewing
    - The transition happens when user clicks the "GW ready" banner
    - See `GAME_STATE.md` for full details on the transition system




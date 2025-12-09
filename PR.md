# Prompt Execution Rules

## Core Principles

1. **Single Source of Truth**: Always use the authoritative data source. For live data: `live_scores` table. For historical data: `app_gw_results`, `app_v_gw_points`, `app_v_ocp_overall` views.

2. **Test Locally First**: Always test changes in local dev (`npm run dev`) before pushing.

3. **Never Push Without Asking**: Never commit or push changes without explicitly asking the user first.

4. **Debug Yourself**: When debugging UI issues, investigate the code, add logging, and analyze the logic yourself. Never ask the user to check the console - you can add console.log statements and analyze the code flow yourself.

5. **Always Build for Despia**: Users will only ever see this via Despia, so always build for Despia native app.

6. **Ask for Clarification**: If a request is ambiguous or could have multiple interpretations, ask for clarification before implementing.

7. **Preserve Existing Patterns**: Follow existing code patterns and conventions in the codebase.

8. **Verify Data Consistency**: When calculating derived values (like OCP), ensure consistency with the single source of truth.

9. **Always Use Storybook**: Always try to use Storybook. Ask if this should be a component in Storybook or look for a relevant component.




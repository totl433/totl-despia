<objective>
Analyze the React application codebase to identify performance bottlenecks, architectural inefficiencies, and "laggy" behavior sources. Create a comprehensive, prioritized refactoring plan to improve load times and runtime speed, using concepts akin to Sentry's performance monitoring (identifying slow renders, hydration errors, waterfall requests).
</objective>

<context>
The user reports the application "feels laggy" and wants to clean up/refactor for speed.
The project is a Vite + React application.
Key areas of concern:
- Initial load time
- Runtime responsiveness
- Code structure and organization
- Large component files (e.g., known large `Home.tsx`)
</context>

<data_sources>
Audit the following key areas:
1. **Build & Config**: `vite.config.ts`, `package.json` (dependencies)
2. **Entry & Routing**: `src/main.tsx`, `src/App.tsx` (check for lazy loading/splitting)
3. **State Management**: `src/context/` (check for Context provider optimization/re-render risks)
4. **Heavy Components**: `src/pages/Home.tsx` and other page files (check for monolithic components, missing `useMemo`/`useCallback`, large loops)
5. **Network/Data**: `src/lib/supabase.ts`, `src/lib/` (check for waterfall fetching, lack of caching)
</data_sources>

<requirements>
Perform a deep analysis and produce a plan that addresses:
1. **Code Splitting & Lazy Loading**: Identify routes or components that should be loaded lazily.
2. **Render Optimization**: Identify components needing `React.memo`, stable callbacks, or virtualization (for long lists).
3. **State Management Refactor**: Recommend improved patterns if global context is causing wide re-renders.
4. **Asset Optimization**: Strategies for images/fonts (though focus on code first).
5. **Observability**: Recommend where to add performance boundaries or logging (Sentry-style) to prevent regression.
6. **Quick Wins vs. Deep Dives**: Categorize tasks by effort/impact.
</requirements>

<output>
1.  **Analysis Report**: Summary of findings.
2.  **Action Plan**: A step-by-step roadmap saved to `./PERFORMANCE_PLAN.md` with sections:
    *   **Phase 1: Immediate Fixes (Low Effort, High Impact)**
    *   **Phase 2: Architectural Refactoring (Splitting components, State)**
    *   **Phase 3: Observability & Prevention (Adding monitoring/linting)**
</output>

<verification>
Verify that the plan specifically addresses the "laggy" feel by targeting the main thread blockers (rendering) and network waterfalls.
</verification>


# Performance Analysis & Refactoring Plan

This analysis identifies key performance bottlenecks in the `totl-web-2` React application, focusing on load times, rendering efficiency, and code structure. The goal is to eliminate the "laggy" feel reported by the user.

## Analysis Report

### 1. Bundle Size & Code Splitting
*   **Issue**: The application uses standard imports in `src/main.tsx` for all routes (Home, League, Predictions, etc.). This means the entire application bundle is downloaded before the first paint, even if the user only visits the login page or home page.
*   **Impact**: High initial load time (LCP), especially on mobile networks.
*   **Fix**: Implement `React.lazy` and `Suspense` for all page-level components in `src/main.tsx`.

### 2. Heavy Rendering in `Home.tsx`
*   **Issue**: `src/pages/Home.tsx` is extremely large (3400+ lines). It likely contains a single massive component that re-renders entirely on any state change.
*   **Impact**: "Laggy" interactions (scrolling, typing, clicking) because the main thread is blocked by massive React reconciliation cycles.
*   **Fix**: Break `Home.tsx` into smaller, memoized sub-components (`React.memo`). Use virtualization for any long lists (e.g., leaderboards).

### 3. Auth Context & Re-renders
*   **Issue**: `AuthContext.tsx` manages user session and authentication state. If the context value changes frequently or if consumers aren't optimized, it can trigger app-wide re-renders.
*   **Impact**: Unnecessary processing when auth state settles or updates.
*   **Fix**: Ensure the context value is stable using `useMemo`. Check if `ensurePushSubscribed` or other side effects in `useEffect` are causing waterfall updates.

### 4. Waterfall Data Fetching
*   **Issue**: Components often fetch data inside `useEffect` without coordination. For example, `PredictionsBanner` fetches current GW, then fixtures, then results, then user picks—sequentially.
*   **Impact**: Slow "Time to Interactive" as the UI waits for a chain of network requests to finish one by one.
*   **Fix**: Consolidate initial data fetching (e.g., using a custom hook or `Promise.all`) to parallelize requests. Use React Query (if available) or a simple cache to prevent re-fetching static data like "Current GW" on every mount.

### 5. Unoptimized Assets & Animations
*   **Issue**: `WhatsAppBanner` and `ScrollLogo` use JS-driven animations or unoptimized re-renders on scroll events. `ScrollLogo` specifically attaches a scroll listener that updates state on *every* pixel scrolled.
*   **Impact**: Jank during scrolling (high frame drops).
*   **Fix**: Debounce scroll handlers or use CSS-only animations/transforms where possible.

---

## Action Plan

This plan is divided into three phases, prioritized by impact on the "laggy" feel.

### Phase 1: Immediate Fixes (Low Effort, High Impact)

**Goal**: Improve initial load time and scroll smoothness.

1.  **Implement Code Splitting**:
    *   Convert route imports in `src/main.tsx` to `React.lazy`.
    *   Wrap `Routes` in a `Suspense` boundary with a lightweight loading fallback.
2.  **Optimize Scroll Performance**:
    *   Refactor `ScrollLogo.tsx` to use `requestAnimationFrame` or CSS sticky positioning instead of state updates on every scroll event.
3.  **Stabilize Auth Context**:
    *   Wrap the `value` object in `AuthContext.tsx` with `useMemo` to prevent unnecessary re-renders of consumers.

### Phase 2: Architectural Refactoring (Deep Dive)

**Goal**: Fix the "laggy" runtime feel by breaking down the monolith.

1.  **Refactor `Home.tsx`**:
    *   Split the 3400-line file into smaller components (e.g., `LeaderboardSection`, `NewsFeed`, `UserStats`).
    *   Wrap heavy sub-components in `React.memo`.
2.  **Parallelize Data Fetching**:
    *   Refactor `PredictionsBanner` to fetch "Current GW", "Fixtures", and "Results" in parallel using `Promise.all`.
    *   Move shared data fetching (like "Current GW") to a higher-level context or hook to avoid duplicate requests.

### Phase 3: Observability & Prevention

**Goal**: Prevent regression.

1.  **Add Error Boundaries**:
    *   Wrap major sections (like the main content area) in Error Boundaries to prevent the whole app from crashing if one part fails.
2.  **Linting for Performance**:
    *   Ensure `eslint-plugin-react-hooks` is active and strictly followed to catch missing dependencies in `useEffect` and `useMemo`.

---

## Next Steps

I will start with **Phase 1** to give you immediate speed improvements.


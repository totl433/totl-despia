# expo-ui-carl — handoff notes for Carl

Branch **`expo-ui-carl`** (push triggers your Railway BFF deploy if this branch is selected there).

## BFF (`apps/bff`)

- **`GET /v1/profile/stats`**: Pick-based stats only count gameweeks **≤ `lastCompletedGw`** (from `app_gw_results`). That fixes misleading **“Lowest single Gameweek: 0 on GW36”** when the current GW isn’t finished yet — same cap applies to **avg/best worst GW**, **weekly par**, **correct prediction rate**, **chaos index**, and **most correct/incorrect team** picks.
- **Team accuracy cards**: Premier League fixtures only (TLA allowlist + block known non‑PL club names); stable PL display labels from canonical codes.
- Profile stats uses **Supabase service role** for reads where JWT RLS was starving fixture joins.
- **GW live** leaderboard scoring consolidated via **`liveGwScores`**.
- **Gameweek streak** ladder chips stop at **`lastCompletedGw`** (no unfinished GW in the streak count).

## Mobile (`apps/mobile`)

- **Stats** screen: streak strip, percentile hero (**View Round Up** = scoresheet → Results like streak rows), par chart, trophy cabinet touches, team stat cards.
- Supporting libs: `profileStreakRows`, trophy/month browse helpers, prediction-league average fetch, streak GW helpers (+ unit tests where noted).

## Domain (`packages/domain`)

- **`UserStatsData`** / profile stats shapes aligned with the BFF response (includes dist rebuild when committed).

---

_To see exact hashes: `git log expo-ui-carl -10 --oneline`._

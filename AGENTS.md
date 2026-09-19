# Cursor Entry Point

Before making changes in this repository:

1. Read `PROJECT_CONTEXT.md`.
2. Read all applicable rules in `.cursor/rules/`.
3. Run `git status` and identify the current branch.
4. Fetch remote refs and confirm the branch is current.
5. Determine whether the request targets web, Expo mobile, BFF, or Supabase.

Key branch rule:

- `main` is the production website branch.
- `expo-ui-carl` is the shared long-lived Expo mobile branch.
- `hotfix/android-blank-screens` is the source of Android production build
  `2.0.27 (2022222)` and must be reconciled deliberately.

Do not assume a request for one platform authorizes deployment of another.
Do not use or recommend Despia; supported surfaces are web and Expo native.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Push Notifications (OneSignal via Despia + Supabase + Netlify Functions)

Backend endpoints are provided to register OneSignal Player IDs and send notifications.

### Environment variables

For broadcast-only notifications (send to all subscribed users):
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`

For targeted notifications by user (optional):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (used to verify user tokens)
- `SUPABASE_SERVICE_ROLE_KEY` (used for DB writes in functions)

### Database (optional for targeted sends)

Run the SQL in `supabase/sql/push_subscriptions.sql` on your Supabase project to create the `push_subscriptions` table and policies.

### Endpoints

- Broadcast to all: `POST /.netlify/functions/sendPushAll`
  - Body: `{ "title": "string", "message": "string", "data": { ... } }`
  - Sends to OneSignal `included_segments: ["Subscribed Users"]`.

- Register Player ID (optional, for targeted sends): `POST /.netlify/functions/registerPlayer`
  - Headers: `Authorization: Bearer <supabase-access-token>`
  - Body: `{ "playerId": "string", "platform": "ios|android" }`

- Send targeted push (optional): `POST /.netlify/functions/sendPush`
  - Body: `{ "userIds": ["uuid"], "playerIds": ["string"], "title": "string", "message": "string", "data": { ... } }`

### Client integration (native)

Use `despia-native` on the client to obtain the OneSignal Player ID when you need targeted messaging.

```ts
import despia from 'despia-native'

// Example: send the player ID to the backend (optional for targeted)
await fetch('/.netlify/functions/registerPlayer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAccessToken}`,
  },
  body: JSON.stringify({ playerId: despia.onesignalplayerid, platform: 'ios' }),
})
```

Reference: Despia OneSignal guide: https://lovable.despia.com/default-guide/native-features/onesignal

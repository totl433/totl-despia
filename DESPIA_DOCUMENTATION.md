# Despia Native Integration Documentation

## Overview

**Despia** is a platform that transforms web applications into native mobile apps, providing seamless access to device capabilities without requiring complex native development. Despia's Runtime SDKs enable web apps to access native features using simple JavaScript commands.

**Key Principle**: The Despia SDK doesn't require any npm JavaScript libraries or dependencies to be installed on your web codebase. The SDK is directly included in the native Swift or Java/Kotlin code that Despia compiles.

## How Despia Works

### Protocol Handler System

Despia uses a streamlined protocol handler system. Each SDK feature is accessed through the global `window.despia` object using a specific protocol format:

```javascript
window.despia = "feature://parameters"
```

### Behind the Scenes

When you call a Despia SDK feature, the system:
1. Intercepts the protocol call
2. Securely routes it to the appropriate native functionality
3. Handles permissions and system interactions
4. Returns results when applicable

All complex native code integration is handled invisibly to your development process.

## Benefits

- **No Complex Libraries**: No npm packages or dependencies needed
- **No Dependency Management**: No version conflicts
- **Cross-Platform**: Works on iOS and Android
- **No-Code Compatible**: Integrates with WeWeb, Wized, and Nordcraft
- **Future-Proof**: SDK updates don't break your implementation

## Available Native Integrations

Based on the documentation, Despia provides the following native integrations:

### Push Notifications & Communication
- **OneSignal** - Fetch OneSignal Player IDs for custom push messaging
- **Push Permission** - Manually request push notification permissions
- **Local Push** - Schedule client-side local push notifications

### User Interface & Experience
- **Native Widgets** - Transform app icon into dynamic widget with live data
- **Loading Spinner** - Native loading indicators
- **Full Screen** - Control full-screen mode
- **Statusbar** - Control status bar appearance
- **Native Safe Area** - Handle device safe areas
- **Haptic Feedback** - Provide tactile feedback

### Device Features
- **Camera Roll** - Access device photo library
- **Take Screenshots** - Capture screenshots programmatically
- **Biometric** - Face ID / Touch ID authentication
- **Background Location** - Access location services
- **Adaptive Brightness** - Control device brightness
- **Device Indexing** - Access device information

### Sharing & Social
- **Social Share** - Share content via native share sheet
- **Share into App** - Receive shared content from other apps
- **App Links** - Deep linking and universal links

### Commerce & Subscriptions
- **RevenueCat** - In-app purchases and subscriptions
- **[DEV] In-App Purchases** - Direct in-app purchase handling
- **[DEV] In-App Subscriptions** - Direct subscription handling

### Contacts & Data
- **Native Contacts** - Access device contacts

### System Integration
- **AppClips** - Instant app experiences (iOS)
- **Shortcuts** - App shortcuts and workflow automation
- **App Metadata** - Access app information
- **Currency Region** - Get device currency/region
- **eSim Installation** - Install eSIM profiles
- **Factory Reboot** - Device reboot functionality
- **Apple Privacy Consent** - Handle privacy consent dialogs
- **File Downloader** - Download files to device

## OneSignal Integration (Detailed)

### Purpose
Fetch users' OneSignal Player IDs for personalized push notifications.

### Implementation

#### 1. Enable OneSignal Player ID Retrieval
```javascript
window.despia = "getonesignalplayerid://"
```

#### 2. Access the Player ID
After calling the command, the Player ID is available in a global variable:
```javascript
console.log(onesignalplayerid)
// or
console.log(window.onesignalplayerid)
```

#### 3. Send to Server
```javascript
fetch('https://your-api.example.com/register-device', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userAuthToken}`
  },
  body: JSON.stringify({ 
    playerId: onesignalplayerid 
  })
})
```

### Important Notes
- Despia already adds the native OneSignal SDK as a dependency
- **You do NOT need to install the web SDK**
- Despia uses the native SDK for a better, truly native experience
- The Player ID is immediately available after calling `getonesignalplayerid://`

### Complete Example
```javascript
// Get the OneSignal player ID
window.despia = "getonesignalplayerid://";

// Function to send the ID to your server
function sendPlayerIdToServer() {
  const authToken = getAuthToken();
  
  fetch('https://your-api.example.com/register-device', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      playerId: onesignalplayerid,
      deviceInfo: {
        platform: navigator.platform,
        userAgent: navigator.userAgent
      }
    })
  })
  .then(response => response.json())
  .then(result => {
    console.log("Registration successful:", result);
  })
  .catch(error => {
    console.error("Failed to register:", error);
  });
}

// Call the function
sendPlayerIdToServer();
```

## Push Permission Integration

### Purpose
Manually request push notification permissions from users who have previously deactivated them.

### Implementation
```javascript
window.despia = "registerpush://"
```

### Checking Push Status with OneSignal
```javascript
if (window.onesignalplayerid && window.onesignalplayerid.length > 0) {
  console.log("Push notifications are enabled");
  // Run any logic needed when the user has push notifications enabled
} else {
  console.log("Push notifications are not enabled or OneSignal is not being used");
  // Prompt the user to allow push notifications
  window.despia = "registerpush://"
}
```

### Best Practices
- Wait for user interaction before requesting
- Explain the value of notifications first
- Handle denied permissions gracefully
- Don't request too frequently
- Test on real mobile devices, not simulators

## Detection in Your Codebase

Based on your codebase, here's how Despia is currently detected:

### Type Definition
```typescript
// src/types/despia-native.d.ts
declare module 'despia-native' {
  interface Despia {
    onesignalplayerid?: string;
    oneSignalPlayerId?: string;
    (command: string, args?: any[]): any;
  }
  const despia: Despia;
  export default despia;
}
```

### Detection Logic (from Profile.tsx)
The app checks for Despia in multiple locations:
- `globalThis.despia`
- `window.despia`
- `globalThis.Despia`
- `window.Despia`
- `globalThis.DESPIA`
- `window.DESPIA`
- `globalThis.OneSignal`
- `window.OneSignal`
- `globalThis.onesignalplayerid` (direct property)
- `window.onesignalplayerid` (direct property)
- `webkit.messageHandlers.despia` (iOS-specific)

### Current Implementation (from pushNotifications.ts)
```typescript
// Try to import despia-native as documented
let despia: any = null;
try {
  const despiaModule = await import('despia-native');
  despia = despiaModule.default;
} catch (e) {
  // Fallback: check global properties (Despia may inject directly)
  despia = (globalThis as any)?.despia || (typeof window !== 'undefined' ? (window as any)?.despia : null);
}

// Also check for direct global property
const directPlayerId = (globalThis as any)?.onesignalplayerid || 
  (typeof window !== 'undefined' ? (window as any)?.onesignalplayerid : null);

const isNativeApp = !!despia || !!directPlayerId;
```

## Protocol Commands Reference

Based on the documentation, here are the protocol commands:

| Feature | Command | Description |
|--------|---------|-------------|
| OneSignal Player ID | `getonesignalplayerid://` | Retrieve OneSignal Player ID |
| Push Permission | `registerpush://` | Request push notification permission |
| Save Image | `savethisimage://?url={imageUrl}` | Save image to device |

*Note: Full command list for all features would require accessing each individual documentation page.*

## Integration with Your App

### Current Usage
Your app uses Despia primarily for:
1. **OneSignal Player ID Retrieval** - To register devices for push notifications
2. **Push Permission Requests** - To request notification permissions

### Files Using Despia
- `src/lib/pushNotifications.ts` - Main push notification integration
- `src/pages/Profile.tsx` - Despia detection and debugging
- `src/types/despia-native.d.ts` - TypeScript definitions

## Resources

- **Documentation**: https://docs.despia.com/docs/native-integrations/getting-started
- **OneSignal Docs**: https://docs.despia.com/docs/native-integrations/getting-started/onesignal
- **Push Permission Docs**: https://docs.despia.com/docs/native-integrations/getting-started/push-permission
- **Support**: support@despia.com
- **Twitter**: https://x.com/despia_native
- **Website**: https://www.despia.com

## Upcoming SDKs

According to the documentation, these features are coming soon:
1. AppClips for Apple Devices
2. Smart Widgets + Widget Engine
3. Health Kit + Google Health
4. "One Click Cancel" for CA Compliance

---

*Last Updated: Based on documentation from September 27, 2025*


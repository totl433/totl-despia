# Debugging in Despia

Despia doesn't have built-in developer tools, but you can debug your app using remote debugging.

## Remote Debugging Options

### For Android Devices

1. **Enable Developer Options:**
   - Go to **Settings** > **About phone**
   - Tap **Build number** seven times to enable Developer Options

2. **Enable USB Debugging:**
   - Go to **Settings** > **Developer options**
   - Enable **USB debugging**

3. **Connect and Debug:**
   - Connect your Android device to your computer via USB
   - Open Chrome on your computer
   - Navigate to `chrome://inspect`
   - Under **Devices**, find your device
   - Click **Inspect** next to the Despia app's webview
   - Chrome DevTools will open for debugging

### For iOS Devices

1. **Enable Web Inspector:**
   - On your iOS device: **Settings** > **Safari** > **Advanced**
   - Enable **Web Inspector**

2. **Connect and Debug:**
   - Connect your iOS device to your Mac via USB
   - Open Safari on your Mac
   - Go to **Develop** menu > Select your device > Choose Despia app
   - Web Inspector will open for debugging

## Visual Debugging (No Console Needed)

For WhatsApp sharing debugging, you can enable visual alerts:

1. Open `src/lib/whatsappShare.ts`
2. Change `const DEBUG_MODE = false;` to `const DEBUG_MODE = true;`
3. Save and rebuild
4. When you tap the WhatsApp button, you'll see alerts showing:
   - Whether Despia is detected
   - Which method is being tried
   - Any errors that occur

**Remember to set DEBUG_MODE back to false after debugging!**

## Console Logs

Even without remote debugging, console logs are still useful:
- They're stored in the app's logs
- You can check them via Despia's dashboard (if available)
- They help identify issues when combined with visual debugging



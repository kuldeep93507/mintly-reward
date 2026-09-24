import type { CapacitorConfig } from '@capacitor/cli';

// App identity. The appId becomes the Play Store package name and can never
// change after the first upload, so settle it before publishing.
const config: CapacitorConfig = {
  appId: 'com.mintly.ludo',
  appName: 'Ludo Mintly',
  webDir: 'dist',
  android: {
    // Lets a debug build talk to a plain ws:// game server on your Wi-Fi
    // (e.g. http://192.168.1.5:3000). Production servers should use https/wss.
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#1a1446',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: { backgroundColor: '#1a1446', style: 'DARK', overlaysWebView: false },
  },
};

export default config;

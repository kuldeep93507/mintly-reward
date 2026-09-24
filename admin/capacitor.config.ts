import type { CapacitorConfig } from '@capacitor/cli';

// Separate owner-only app. Never published to the Play Store; install the debug APK.
const config: CapacitorConfig = {
  appId: 'com.mintly.ludo.admin',
  appName: 'Ludo Admin',
  webDir: 'dist',
  android: { allowMixedContent: true },
  // Lets the admin app talk to a plain http:// server on your Wi-Fi.
  server: { androidScheme: 'http', cleartext: true },
};

export default config;

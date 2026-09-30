# Specification: Android App Modernization & Production Polish

## 1. Overview
Ensure the SacraLink Android mobile application (`mobile/`) is fully modern, compliant with Android 14/15 standards, equipped with production Android manifest configurations, native navigation bar color tuning, high-importance notification channels, network connectivity resilience, and clean Hermes compilation.

## 2. Key Objectives
1. **Android Configuration Hardening (`app.json`)**:
   - Explicit `versionCode: 1` integer for Google Play / APK packaging.
   - Configure `androidNavigationBar` (`barStyle: "dark-content"`, `backgroundColor: "#F8FAFC"`) to eliminate default black navigation bars on 3-button and gesture navigation Android devices.
   - Configure `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, and `VIBRATE` permissions for church map discovery and alert haptics.
2. **Android Notification Channels & Background Triggers**:
   - Ensure `setupAndroidNotificationChannels()` runs during app boot for appointments, donations, messages, and diocesan bulletins with distinct priorities, light colors, and vibration patterns.
3. **Network Resilience & Connection State Handling**:
   - Provide an offline/reconnecting banner when mobile network drops, with immediate manual retry and automatic state recovery.
4. **End-to-End Android Compilation & Verification**:
   - Zero TypeScript errors (`npx tsc --noEmit`).
   - Clean Hermes bytecode export (`npx expo export --platform android`) across all 29 routes.

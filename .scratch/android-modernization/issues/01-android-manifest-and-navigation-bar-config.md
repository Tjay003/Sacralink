# Issue 01: Android Manifest & Navigation Bar Configuration

Type: task
Status: resolved
Blocked by: 

---

## 1. Description
Harden the Android configuration in `mobile/app.json`:
1. Add `versionCode: 1` to `android` config block.
2. Add `androidNavigationBar` configuration (`barStyle: "dark-content"`, `backgroundColor: "#F8FAFC"`) to avoid jarring black bottom bars on modern Android phones.
3. Configure `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, and `VIBRATE` in permissions list for map church discovery and alerts.
4. Ensure splash screen background color matches `#F8FAFC`.

---

## 2. Acceptance Criteria
- [x] `mobile/app.json` has `versionCode` defined.
- [x] `androidNavigationBar` is themed with `#F8FAFC` and dark icons.
- [x] Permissions list includes location and vibration permissions.
- [x] `npx tsc --noEmit` and expo validation pass.

---

## 3. Resolution
- **Modified Files**:
  - `mobile/app.json`: Added `versionCode: 1`, `androidNavigationBar` (`barStyle: "dark-content"`, `backgroundColor: "#F8FAFC"`), splash config (`backgroundColor: "#F8FAFC"`, `resizeMode: "contain"`), and extended permissions (`CAMERA`, `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `POST_NOTIFICATIONS`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `VIBRATE`).
- **Verification**:
  - Ran `npx tsc --noEmit` inside `mobile/` - Clean exit code 0, 0 errors.

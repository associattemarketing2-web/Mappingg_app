# Mappingg mobile app — production readiness report

Date: 2026-10-23 · Expo SDK 58 (`expo@58.0.19`) · React Native 0.88 · Expo Router · MapLibre

## 1. Overall readiness: **Ready with limitations** (store submission is blocked by items you must do yourself)

The code and config are in good shape: typecheck, lint, all 60 tests, Expo Doctor (20/20),
the dependency check and production JS bundles for Android and iOS all pass. The release builds
themselves were **not** run here (they use your EAS credits and bump the store build number), and
no physical device or emulator testing was done in this session.

Before you submit to either store, these need your action (section 11):

1. **Map tile licensing.** The app loads tiles directly from `tile.openstreetmap.org` and Esri World Imagery.
   OpenStreetMap's tile usage policy forbids distributing an app that uses its tile servers without permission,
   and Esri imagery needs an ArcGIS account under its terms. You need a tile provider plan (e.g. MapTiler,
   Stadia Maps, Protomaps or OSM permission). This is the biggest remaining risk.
2. Remove server secrets from `.env.local` (copies already exist in `.env.website-backup`).
3. Store listings, privacy forms, the account-deletion web page and test credentials (section 11).

Legend used below: **Fixed** = changed and verified by a check or test · **Recommendation** = not changed ·
**Unverified** = needs a device or account to confirm.

---

## 2. Issues found, by severity

### Critical
| # | Issue | Status |
|---|---|---|
| C1 | Map tiles come straight from OpenStreetMap's and Esri's public servers. OSM's tile policy forbids heavy use or app distribution without permission, so the tiles could be blocked at any time, leaving a blank map. | **Recommendation:** needs a business decision or provider account (§11) |

### High
| # | Issue | Status |
|---|---|---|
| H1 | No error boundary. Any crash while rendering a screen left a blank white app in release builds. If the crash happened before the first screen, the splash screen never went away. | **Fixed:** root `ErrorBoundary` with "Try again"; it also hides the splash screen |
| H2 | The map hid the tile credit (`attribution={false}`), which OSM's licence (ODbL) and Esri's terms both require. | **Fixed:** visible, tappable credit that switches between OSM and Esri with the map style |
| H3 | Jest could not start at all on this PC ("Preset jest-expo not found"). Jest 30's resolver is a native module that needs the Microsoft Visual C++ runtime, and `vcruntime140.dll` is missing from Windows. | **Worked around locally** (see §11 for the permanent fix) |
| H4 | `.env.local` contains server credentials (Postgres URL, MongoDB URI, Google service account, SMTP password, auth secret, Google client secret). They are git-ignored and not in the app bundle (verified), but the project's own `check:env` fails, and they are loaded into every Expo CLI process. | **Your action:** my edit to this file was blocked (§11) |
| H5 | The `panelBridge` test suite crashed ("Cannot redefine property: window"). It requested a browser test environment inside the React Native preset. | **Fixed:** separate `dom` Jest project using `jest-expo/web`; the suite now runs (3 tests) |

### Medium
| # | Issue | Status |
|---|---|---|
| M1 | "Near me" waited for a GPS fix with no time limit, so the spinner could hang indoors or with GPS off. Tapping again started a second lookup. | **Fixed:** 15 s timeout, re-entry guard, falls back to the full map |
| M2 | Location permanently denied: the app only said "Location unavailable", and there was no way to fix it from the app. | **Fixed:** explains the problem and offers an "Open settings" button |
| M3 | 13 external links (WhatsApp, Call, email, Directions, YouTube, RERA, socials) called `Linking.openURL` without handling errors. On a phone without that app the tap did nothing. | **Fixed:** shared `openUrl()` helper shows "No app on this phone can open this link." |
| M4 | Sign-in could be sent twice (the keyboard "Go" key while a sign-in was in progress). The contact form had the same gap. | **Fixed:** busy guards |
| M5 | The highlighted-pin radar animation re-rendered map layers about 12 times a second, even when the map tab was hidden. | **Fixed:** pauses when the map screen is not focused |
| M6 | The session cookie set inside the panel WebView (60-day `mg_session`) stays in the WebView cookie store after sign-out. Another account is handled correctly (the boot page checks the email), but the old token stays on the device until it expires. | **Recommendation:** make sure the website's `/api/auth/logout` revokes the session on the server (not verifiable from the app repo) |
| M7 | Signed-in enquiries copy name, WhatsApp number and email to a Google Sheet webhook from the phone (`EXPO_PUBLIC_LEAD_SHEET_WEBHOOK_URL`). The URL is public in the bundle, so anyone can post to it, and this data sharing must appear in the privacy disclosures. | **Recommendation:** move this copy to the server; declare it in Data safety / App Privacy |
| M8 | Account deletion is a request flow (it sends a request to the team and signs out) rather than immediate deletion. Apple accepts this if the request is actually processed. Google Play also requires a **web** link for deletion requests. | **Your action:** publish a deletion page on mappingg.com (§11) |

### Low
| # | Issue | Status |
|---|---|---|
| L1 | `npm audit`: 6 high findings, all in Expo's build tooling (`node-forge`, `zod` via `@expo/cli` and `@expo/code-signing-certificates`, and `@maplibre/maplibre-react-native`). npm's suggested "fix" downgrades to Expo SDK 44. | **Not applied:** not in the shipped app's runtime; wait for Expo/MapLibre patch releases |
| L2 | The panel WebView accepts `postMessage` from any frame. Messages only trigger open-link, share, copy or download actions, and top-level navigation is restricted to mappingg.com panel paths. | Recommendation (low impact) |
| L3 | `react-native-web` and `react-dom` are installed although the app is native-only (`platforms: ['android','ios']`). | Recommendation: harmless; leave them unless the web build is permanently dropped |

### Checked and found OK (no change needed)
- API client: 20 s timeouts, cancellation, typed errors for 401/403/404/429/5xx, no retry on mutations, query retries only on network, timeout, 5xx and parse errors with capped exponential backoff.
- Session token in the iOS Keychain / Android Keystore (`expo-secure-store`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`), never in AsyncStorage. The platform cookie jar is not used. An expired session ends cleanly on 401.
- Offline: queries pause offline, the last map data is cached for 14 days and shown as stale, and an offline banner appears.
- Release config: HTTPS required for preview and production (enforced in `app.config.ts`), cleartext traffic only in dev builds, background location blocked, unused permissions blocked, `SYSTEM_ALERT_WINDOW` removed from release builds.
- Unique IDs per variant: `com.mappingg.app` (prod), `.preview`, `.dev`. EAS manages `versionCode` and `buildNumber` remotely (`appVersionSource: remote`, `autoIncrement`).
- Android `targetSdk 36` and `compileSdk 37` (meets Google Play's current API-level requirement), `minSdk 24` (Android 7.0).
- iOS icon is 1024×1024 with an alpha channel, which Expo removes during prebuild (`removeTransparency`), so App Store icon rules are met.
- No `console.log` calls in app code. No secrets and no LAN or dev server URLs in the production bundle (scanned; the only matches were library string-table false positives).
- `check:isolation`: nothing imported from the website project.

---

## 3. Files changed and why (this session)

| File | Change |
|---|---|
| `app.config.ts` | Added `expo-sharing` and `expo-status-bar` config plugins (requested by `expo install --fix`) |
| `package.json` / `package-lock.json` | SDK 58 patch updates (`expo install --fix`). Jest config split into `native` and `dom` projects (H5). |
| `src/components/AppErrorBoundary.tsx` (new) | Crash fallback screen (H1) |
| `src/app/_layout.tsx` | Exports the `ErrorBoundary` (H1) |
| `src/lib/mapAttribution.ts` (new), `src/components/map/LiveMap.tsx` | Visible tile credit (H2). `animate` prop pauses the radar animation (M5). |
| `src/lib/async.ts` (new), `src/app/(tabs)/index.tsx` | Location timeout, re-entry guard, "Open settings" for permanently denied permission (M1, M2). Passes `animate={focused}` (M5). |
| `src/lib/openLink.ts` (new) + `account.tsx`, `compare.tsx`, `contact.tsx`, `project/[slug].tsx`, `MapControls.tsx`, `PinSheet.tsx` | External links fail with a message instead of silently (M3) |
| `src/app/auth/sign-in.tsx`, `src/app/contact.tsx` | Double-submit guards (M4) |
| `src/lib/__tests__/panelBridge.test.ts` → `panelBridge.dom.test.ts` | Runs in the new `dom` Jest project (rename is staged with `git mv`) |
| `src/lib/__tests__/reliability.test.ts` (new) | Regression tests (section 4) |
| `MAPPINGG_PRODUCTION_READINESS.md` (new) | This report |

Your earlier uncommitted changes (`panel.tsx`, `PanelWebView.tsx`, `publicData.ts`, `rera.ts`, `projectMeta.ts`, etc.)
were left as they were. Where I edited the same files, I only touched the lines described above.

Outside the repo: I copied `vcruntime140.dll` and `vcruntime140_1.dll` (Microsoft-signed, from the
installed Edge) into `node_modules/@unrs/resolver-binding-win32-x64-msvc/` so Jest can run on this PC. They will
disappear on the next clean `npm install` (see §11).

## 4. Bugs fixed and their regression tests

`src/lib/__tests__/reliability.test.ts` (8 tests):
- `withTimeout` resolves in time, passes through errors, and rejects with `TimeoutError` when a GPS fix never arrives (M1).
- `openUrl` opens links, shows an alert instead of an unhandled rejection when no app can open the link, and ignores empty links (M3).
- `mapAttribution` credits OSM on the map and night styles and Esri on satellite (H2).
- H5 is covered by the existing `panelBridge.dom.test.ts` (3 tests), which now runs.

H1 (error boundary), M2, M4 and M5 are UI wiring. They are covered by typecheck and lint, but need a device check (section 12).

## 5. Commands run and actual results

| Command | Result |
|---|---|
| `npx expo install --check` / `--fix` | All SDK 58 packages aligned ("Dependencies are up to date") |
| `npx tsc --noEmit` | Pass (0 errors) |
| `npx eslint .` (`npx expo lint`) | Pass (0 problems) |
| `npx jest` (before) | **Failed to start** (H3). After the workaround: 4 suites passed, 1 crashed (H5). |
| `npx jest` (after) | **6 suites, 60 tests passed**, 2 projects |
| `npx expo-doctor` | 20/20 checks passed |
| `node scripts/check-isolation.mjs` | Pass (108 files) |
| `node scripts/check-env.mjs` | **Fails** on `.env.local` server credentials (H4, your action) |
| `npx expo export --platform android --platform ios` (production env) | Pass: Android bundle 3.8 MB, iOS 3.8 MB (Hermes bytecode) |
| Bundle secret scan | No secrets or private URLs found |
| `npm audit` | 6 high, build-tooling only (L1) |

## 6. Build results

- **EAS builds were not run** in this session (they use build credits and permanently increment the remote `versionCode`/`buildNumber`).
  Production JS bundles were verified with `expo export` instead.
- Because this session added native config plugins and updated native modules, you need a **new development build**
  before testing on your phone: `npx eas-cli@latest build --profile development --platform android`.

## 7. Performance

No device profiling was possible here (no device or emulator attached), so there are no before/after timings.
Changes were made where the code showed clear waste:
- Radar animation no longer re-renders map layers while the map tab is hidden (M5).
- Existing good practices confirmed: pins drawn as one GeoJSON symbol layer (not hundreds of React markers), pin logos cached on disk and fetched nearest-first at 96 px, query results persisted for instant start-up, 350 ms search debounce, `FlatList` virtualisation in the list fallback.
- Production JS bundle is 3.8 MB Hermes bytecode per platform.

Suggested measurement on a low-end Android phone (e.g. 3–4 GB RAM): cold start to map visible, and FPS while panning with all pins shown, using the
React Native DevTools performance panel or `adb shell dumpsys gfxinfo <package>`.

## 8. Security and privacy summary

- Secure session storage, HTTPS enforcement, no cleartext in release builds, no secrets in the bundle: **verified**.
- `.env.local` holds server secrets on this PC (H4). The file is not in git and not uploaded to EAS (`.gitignore` is respected, there is no `.easignore`). Even so, remove them, and **rotate the database password**: a comment in that file says it may already have been exposed.
- Lead copy to the Google Sheet from the device (M7) and the WebView session cookie after sign-out (M6): see recommendations.
- Permissions: foreground location only, with a clear explanation string on iOS and Android. No analytics, ads or crash-reporting SDKs are present, and none were added.
- Third parties contacted by the app: mappingg.com (API), tile.openstreetmap.org, server.arcgisonline.com (Esri), YouTube links, WhatsApp links, and the optional Google Apps Script webhook. List these in your privacy disclosures.

## 9. Android (Google Play) release checklist

- [x] Package `com.mappingg.app`, unique per variant
- [x] `versionCode` managed by EAS (remote, auto-increment)
- [x] targetSdk 36 (current Play requirement)
- [x] App Bundle (`.aab`) configured in the `production` profile
- [x] Adaptive icon (foreground, background, monochrome)
- [x] Only needed permissions; background location blocked
- [x] Production API is HTTPS (`https://www.mappingg.com`)
- [ ] **Map tile provider licensed** (C1)
- [ ] Run `npx eas-cli@latest build --profile production --platform android` and let EAS manage the upload key
- [ ] Play Console: store listing, screenshots (phone and 7"/10" tablet if tablets are supported), feature graphic
- [ ] Privacy policy URL (`https://www.mappingg.com/privacy`) reachable without login: confirm in a logged-out browser
- [ ] Data safety form: account info (name, email, phone), approximate/precise location (used on device only), enquiries, and sharing with Google Sheets (M7)
- [ ] **Account deletion web URL** (Play requirement for apps with accounts, M8)
- [ ] Content rating questionnaire; ads declaration ("No ads")
- [ ] New personal developer accounts: closed test with at least 12 testers for 14 days before production access
- [ ] Location permission: foreground only, no special declaration needed

## 10. iOS (App Store) release checklist

- [x] Bundle ID `com.mappingg.app`, `buildNumber` managed by EAS
- [x] `NSLocationWhenInUseUsageDescription` set; `ITSAppUsesNonExemptEncryption: false`
- [x] Icon meets rules after prebuild (alpha removed)
- [x] In-app account deletion entry point (Account → Delete account)
- [ ] **Map tile provider licensed** (C1)
- [ ] `npx eas-cli@latest build --profile production --platform ios` (needs an Apple Developer account; EAS can create certificates and profiles)
- [ ] App Store Connect: metadata, screenshots for 6.9" and 6.5" iPhone and 13" iPad (`supportsTablet: true`, so iPad screenshots are required)
- [ ] App Privacy questionnaire (same data as Play Data safety)
- [ ] Sign in with Apple: required only if the app offers third-party sign-in (e.g. Google) for the primary account. The app currently uses email and password, so it is not required. Re-check if Google sign-in is added to the app.
- [ ] Reviewer demo account (buyer role) in App Review notes. Developer and agent accounts need approval, so give the reviewer an approved one, or explain.
- [ ] Privacy manifest: Expo generates one for its modules. Confirm with the build's `PrivacyInfo.xcprivacy` (check the EAS build logs or run `npx expo prebuild` locally).
- [ ] Guideline 4.2 (minimum functionality): the panel screens are website pages in a WebView. The native map, search, project pages and enquiries make the app clearly more than a website wrapper, but call out the native features in review notes.

## 11. Needs your manual action

1. **Tile provider (C1).** Choose a licensed raster tile source and replace the two URLs in `src/components/map/LiveMap.tsx` (`RasterSource id="osm"` and `id="esri"`). Update `src/lib/mapAttribution.ts` to match.
2. **Clean `.env.local` (H4).** Delete everything from the line `# Local secrets — NOT committed` downward. Only `EXPO_PUBLIC_*` and `APP_VARIANT` belong in the app. The same values are already in `.env.website-backup`. Then run `node scripts/check-env.mjs`, which should pass. Rotate the Postgres password as the file's comment advises.
3. **Visual C++ runtime (H3).** Install the "Microsoft Visual C++ Redistributable (x64)": `winget install Microsoft.VCRedist.2015+.x64`. After that, the DLLs I copied into `node_modules` are no longer needed.
4. **New development build** (native modules and plugins changed): `npx eas-cli@latest build --profile development --platform android`.
5. **Account-deletion web page** for Google Play (M8), and make sure the team processes deletion requests within the promised 7 days.
6. Decide on the Google Sheet webhook (M7) and confirm `/api/auth/logout` revokes sessions on the server (M6). Both are website-side, which was out of scope.
7. Store consoles: listings, screenshots, privacy forms, content rating, demo account (sections 9–10).

## 12. Known limitations and remaining risks

- **No device testing in this session.** Sections 3–11 of your brief (flows, permissions, responsive layout, screen readers, offline) were checked by code review only. Highest-value manual checks on a real phone:
  1. Map tab: the tile credit is visible bottom-right and opens the copyright page; switching to satellite changes it to Esri.
  2. Near me: allow → fly to you; deny twice ("Don't ask again") → tap again → "Open settings" alert; GPS off indoors → toast within 15 s, no endless spinner.
  3. Tap WhatsApp or email on a phone without WhatsApp or a mail app → "Can't open link" alert.
  4. Sign in, then press the keyboard Go key rapidly → only one sign-in.
  5. Switch to another tab with highlighted pins on the map → no stutter on the other tab.
  6. Small phone (≈360 dp wide) and large font size: map controls, sign-up bar and credit line don't overlap.
- Production EAS builds were not run, so native compile problems would only show up there.
- `npm audit` findings remain until Expo/MapLibre publish fixes (L1).
- Tile provider risk (C1) can make the map blank in production regardless of app quality.

## 13. Commands to reproduce and release

```bash
# checks
npx expo install --check
npx tsc --noEmit
npx expo lint
npx jest
npx expo-doctor
node scripts/check-isolation.mjs
node scripts/check-env.mjs          # passes once .env.local is cleaned
npm run verify                      # all of the above in one go

# production bundle sanity check (no EAS credits)
APP_VARIANT=production EXPO_PUBLIC_APP_ENV=production npx expo export --platform android --platform ios --output-dir dist

# builds
npx eas-cli@latest build --profile development --platform android   # dev client for your phone
npx eas-cli@latest build --profile preview --platform android       # installable test APK
npx eas-cli@latest build --profile production --platform android    # Play Store .aab
npx eas-cli@latest build --profile production --platform ios        # App Store build

# submit (only when you're ready; goes to the Play internal track as a draft per eas.json)
npx eas-cli@latest submit --profile production --platform android
```

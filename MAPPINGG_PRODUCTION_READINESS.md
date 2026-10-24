# Mappingg mobile app — production readiness report

Last updated: 2026-10-23 (second pass) · Expo SDK 58 (`expo@58.0.19`) · React Native 0.88 · Expo Router · MapLibre RN 11.5

## 1. Overall readiness: **Ready with limitations — store submission still blocked by items only you can do**

The app code and config pass every automated check (§5). What still blocks store submission:

| Blocker | Who | Section |
|---|---|---|
| Website route for real account deletion + a public deletion page (Google Play) | You approve; then a website change | §6, `docs/ACCOUNT-DELETION.md` |
| Choose and approve a licensed satellite (and optionally street) tile provider, then add its key | You | §2 |
| Remove server secrets from `.env.local` and rotate the Postgres password | You | §3 |
| Real-device QA on Android and iOS (none was done here) | You / testers | §8 |
| Production EAS builds, store listings, privacy forms, reviewer account | You | §9–§10 |

Not claimed here: physical-device testing, production builds, or store compliance. None of these was performed or verified.

Legend: **Fixed** = changed and verified by a check or test · **Recommendation** = not changed · **Unverified** = needs a device or account.

---

## 2. Map tiles

### What the app loads today (verified in `src/components/map/LiveMap.tsx`)
| Layer | URL | Used for |
|---|---|---|
| Streets (also used inverted for "night") | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | Map and night styles |
| Satellite | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` (no key) | Satellite style |

256px raster tiles, no offline caching beyond MapLibre's normal HTTP cache. Same tiles as the website.

### Correction to the first report
The first report said OSM's tile policy forbids distributing an app that uses its tiles. **The current policy doesn't say that.**
It requires: a **distinct, stable User-Agent naming the app** (not a library default), **clearly visible attribution**, no offline use,
and it warns that commercial services may lose access at any time. Source: [OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

### What changed (Fixed, no provider switched)
- **Visible attribution** that follows the active provider (from the first pass, now config-driven).
- **App User-Agent** `Mappingg/<version> (+https://www.mappingg.com)` on every tile request, via MapLibre's `TransformRequestManager.addHeader`. Unverified on device: confirm with a proxy (e.g. HTTP Toolkit) that iOS and Android both send it.
- **Provider switch without code changes** (`src/constants/mapTiles.ts`). With no variables set, behaviour is identical to before. Setting a provider and its key switches tiles; a missing key falls back to the default and shows a warning on the Account screen. Placeholders are in `.env.example`:

```
EXPO_PUBLIC_MAP_STREET_TILES=      # osm (default) | maptiler
EXPO_PUBLIC_MAP_SATELLITE_TILES=   # esri-public (default) | arcgis | maptiler
EXPO_PUBLIC_MAPTILER_KEY=
EXPO_PUBLIC_ARCGIS_BASEMAP_KEY=
```
Map styling (night inversion), markers, logos, roads, boundary and all interactions are unchanged. Tests: `src/lib/__tests__/mapTiles.test.ts`.

### Provider comparison (prices checked 2026-10-23; confirm on sign-up)
| Option | Cost | Commercial use | Satellite | Key protection in a mobile app | Notes |
|---|---|---|---|---|---|
| **OSM public tiles** (current streets) | Free | Allowed, but "access may be withdrawn at any point"; no SLA | — | n/a (User-Agent identifies the app) | Now meets the policy's User-Agent and attribution rules |
| **Esri public endpoint** (current satellite) | Free, no key | Covered by the Esri Master License Agreement, intended for ArcGIS products; **not a supported path for a third-party commercial app** | Yes | none | **Main remaining tile risk** |
| **ArcGIS Location Platform** | Free tier 2,000,000 basemap tiles/month, then $0.15 per 1,000 tiles (pay-as-you-go must be enabled or service stops at the free tier) | Developer platform for apps; check the terms at sign-up | Yes (World Imagery) | API key scoped to "basemaps" only, with an expiry | Wired as `arcgis` |
| **MapTiler Cloud** | Free plan is for testing/non-commercial. **Flex $30/month**: 25k sessions + 500k tile requests; overage $0.15/1k requests | Paid plans | Yes | "Allowed user-agent" = `Mappingg/` plus a spending limit | Wired as `maptiler` (streets-v4 and satellite). A 256px tile = 1 request; a view ≈ 10–16 requests |
| **Stadia Maps** | Free is non-commercial; Starter $20/month (1M credits, no satellite); Standard $80/month (7.5M, satellite) | Paid plans | Standard and up | API key | Not wired; can be added the same way |

Sources: [MapTiler pricing](https://www.maptiler.com/cloud/pricing/), [MapTiler key protection](https://docs.maptiler.com/guides/maps-apis/maps-platform/how-to-protect-your-map-key), [MapTiler raster API](https://docs.maptiler.com/cloud/api/maps/), [ArcGIS Location Platform pricing](https://location.arcgis.com/pricing/), [ArcGIS basemap service data](https://developers.arcgis.com/rest/basemap-styles/service-data/), [Esri World Imagery item](https://goto.arcgis.com/maps/World_Imagery), [Stadia pricing](https://stadiamaps.com/pricing/).

### Recommendation (needs your approval; nothing paid was added)
- **Lowest cost:** keep OSM streets (now policy-compliant) and move **satellite to ArcGIS Location Platform** (its free 2M tiles/month probably covers launch). Set `EXPO_PUBLIC_MAP_SATELLITE_TILES=arcgis` and `EXPO_PUBLIC_ARCGIS_BASEMAP_KEY`.
- **Most robust:** **MapTiler Flex** for both layers (one vendor, SLA, key locked to the app's User-Agent, spending cap).

**Setup steps once you choose.** Create the key on the provider's dashboard and restrict it (ArcGIS: basemaps privilege only, with an expiry; MapTiler: Allowed user-agent `Mappingg/`, plus a monthly spending limit). Then add the variables to the `production` (and `preview`) profiles in `eas.json` or as EAS environment variables, and rebuild. The keys end up inside the app, like every `EXPO_PUBLIC_` value, so the restrictions and caps are what protect you.

## 3. Environment security (verified without printing any value)

| Check | Result |
|---|---|
| Env files ever committed (all branches) | Only `.env.example` |
| Secret values from `.env.website-backup` anywhere in git history (Postgres, MongoDB, auth secret, service account, Google client secret, SMTP, Maps key) | **0 commits** each |
| Database/Mongo URLs with credentials or private keys anywhere in history | 0 |
| `.env.local`, `.env.website-backup` | Git-ignored. EAS respects `.gitignore` (no `.easignore`), and the EAS upload log confirms only profile variables were used |
| Secrets in the production JS bundle | None (scanned in both passes) |
| **Confirmed exposure** | A comment in the env file says the **Postgres password "was shared in chat"**. **Rotate it** in the Prisma dashboard, then update the website's hosting env vars. |

**What the mobile app actually needs** (all public, compiled into the app):
`EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_LEAD_SHEET_WEBHOOK_URL` (optional), the optional map variables in §2, and `APP_VARIANT` (read by `app.config.ts`, not bundled).

**Website-only, must not be in the app's `.env.local`:** `DATABASE_URL`, `MONGODB_URI`, `MONGODB_DB`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `GSC_SERVICE_ACCOUNT_JSON`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SMTP_*`, `MAIL_FROM`, `ADMIN_NOTIFY_EMAIL`.
All 15 are already saved, byte for byte, in `.env.website-backup`. As requested, I did not edit or delete either file. **Your step:** in `.env.local`, delete everything from the line `# Local secrets — NOT committed` down, then run `node scripts/check-env.mjs` (it should pass).

## 4. Windows test environment

- **Runtime still missing:** `vcruntime140.dll` / `vcruntime140_1.dll` are not in `C:\Windows\System32`.
- **Temporary workaround still in place:** copies of those two DLLs (Microsoft-signed, from Edge) in
  `node_modules\@unrs\resolver-binding-win32-x64-msvc\`. Jest needs them until the runtime is installed.
- **Not done yet, by design:** a clean reinstall (`npm ci`) would delete the workaround and break Jest again, so I left it until the runtime is installed.

Once you install the runtime:
```powershell
winget install Microsoft.VCRedist.2015+.x64     # needs admin / UAC
Remove-Item node_modules\@unrs\resolver-binding-win32-x64-msvc\vcruntime140*.dll
npm ci                                            # clean install from package-lock.json
npx tsc --noEmit; npx expo lint; npx jest         # expect 71 tests passing
```

## 5. Commands run this pass and results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | Pass |
| `npx eslint .` | Pass |
| `npx jest` | **8 suites, 71 tests passed** (60 from the first pass + 7 map tile + 4 account deletion) |
| `npx expo-doctor` | 20/20 |
| `npx expo install --check` | Up to date |
| `node scripts/check-isolation.mjs` | Pass (112 files) |
| `node scripts/check-env.mjs` | **Fails** only on `.env.local` server secrets (§3, your step) |
| `npx expo export --platform android --platform ios` (production env) | Pass, 3.8 MB Hermes bundle each |
| `eas whoami` | Logged in; owner of `mapping` (matches `owner` in `app.config.ts`) |
| `eas build --profile development --platform android --non-interactive --no-wait` | Queued with existing remote keystore, see §7 |

## 6. Account deletion

- **Account creation exists** (email sign-up in the app; Google sign-up on the website).
- **Real deletion was missing.** The app only sent a request to the team, and the website has no self-service delete route (verified read-only in `../mappingg`).
- **App side built** (`src/app/delete-account.tsx`, `deleteAccount()` in `src/services/account.ts`): password plus confirmation, staff accounts refused, single-flight, signs out after deletion.
  Until the website route exists, it **automatically falls back** to the existing request flow, so nothing changes for users today. Tests in `src/services/api/__tests__/deleteAccount.test.ts`.
- **Website change awaiting your approval:** the full route code and four decisions (recycle bin, related data, developer projects, public deletion page for Google Play) are in **`docs/ACCOUNT-DELETION.md`**. Nothing on the website or in production data was changed, and no data was deleted.
- Related finding (M6): `/api/auth/logout` only clears the cookie. Tokens stay valid up to 60 days, including the copy in the panel WebView. A revocation design is in the same doc.

## 7. Development build

- `eas.json` `development` profile: dev client, internal distribution, APK, production API over HTTPS. Project ID `0f37ac60-…5972`, owner `mapping`. Android IDs unchanged (`com.mappingg.app.dev`).
- Signing: remote EAS keystore "Build Credentials baS2t4G-g3 (default)" (five earlier dev builds succeeded with it).
- **Queued:** https://expo.dev/accounts/mapping/projects/mappingg/builds/f25849d0-d32b-4ec3-a9f5-0354b8e60f37. It was still in progress when this report was written. Install the APK from that page when it finishes.
- Command for future dev builds: `npx eas-cli@latest build --profile development --platform android`
- Not run: iOS builds (need Apple Developer credentials), production builds (they increment the store version code).

## 8. Real-device QA matrix

### Automated (already running in `npx jest`, 71 tests)
API client (cookies, timeouts, error kinds, 401 handling), session cookie parsing and expiry, slug/search/geo/phone helpers, website-sync rules, panel bridge (DOM), `withTimeout`, `openUrl`, map attribution, map tile config and User-Agent, account deletion responses.

### Manual on devices (not done in this session)
Suggested devices: low-end Android (Android 8–10, 3 GB RAM), current Android (14–16), small iPhone (SE or 13 mini), current iPhone, iPad (the app declares tablet support).

| Area | Test | Expected | Android | iOS |
|---|---|---|---|---|
| Launch | Cold start, signed out | Splash → welcome; no blank screen | ☐ | ☐ |
| Login | Correct / wrong password; press keyboard Go twice | One request; clear error message | ☐ | ☐ |
| Session | Kill app, reopen; airplane mode, reopen | Still signed in; "showing your saved account" note | ☐ | ☐ |
| Session expiry | Delete the account in admin while signed in on the phone | Signed out within ~30 s with "session ended" | ☐ | ☐ |
| Navigation | Every tab; Android back button on each screen and modal; back out of the panel | No dead ends; back closes sheets before screens | ☐ | ☐ |
| Map | Pan/zoom with all pins; tap pin, infra, road; switch map/satellite/night | Smooth; correct sheets; credit text changes | ☐ | ☐ |
| Map tiles | Proxy check: tile requests carry `User-Agent: Mappingg/…` | Header present on both platforms | ☐ | ☐ |
| Images | Project page gallery and logos on slow 3G | Placeholders, no broken-image icons | ☐ | ☐ |
| Location | Allow; deny; deny permanently then tap Near me; GPS off indoors | Fly to you; toast; "Open settings"; message within 15 s | ☐ | ☐ |
| Links | WhatsApp, Call, email, Directions, YouTube with and without the app installed | Opens, or "Can't open link" | ☐ | ☐ |
| Enquiry | Enquire (signed in) twice quickly; contact form submit twice | One lead each | ☐ | ☐ |
| API errors | Server down or 500 (staging), 429 (repeat logins) | Error state with retry; rate-limit message | ☐ | ☐ |
| Slow network | Network Link Conditioner / Android emulator "GSM" | Loading states; no infinite spinner (20 s timeout) | ☐ | ☐ |
| Offline | Airplane mode on map, projects, project page | Offline banner; cached pins shown | ☐ | ☐ |
| Background/resume | Background 10 min, resume; rotate (if allowed) | Data refreshes; no crash; session renewed | ☐ | ☐ |
| Panel (staff/dev) | Open panel, download a file, share, copy | Share sheet; "Copied" | ☐ | ☐ |
| Delete account | Today (route not deployed): delete flow | Request sent, signed out. After deploy: wrong password message, then deleted | ☐ | ☐ |
| Crash recovery | Dev build: throw in a screen (temporary test) | "Something went wrong · Try again" | ☐ | ☐ |
| Accessibility | TalkBack / VoiceOver through map controls and forms; largest font size | Labels read; nothing clipped | ☐ | ☐ |
| Layout | 360 dp Android, iPhone SE, iPad | Controls don't overlap; credit line visible | ☐ | ☐ |

## 9. Android release checklist
- [x] `com.mappingg.app`, versionCode managed by EAS, targetSdk 36, AAB profile, adaptive icon, minimal permissions, HTTPS API
- [x] In-app account deletion entry point (real deletion needs the website route)
- [ ] Website deletion route + **public deletion web URL** (Play Data safety)
- [ ] Licensed satellite tiles (§2)
- [ ] `npx eas-cli@latest build --profile production --platform android`
- [ ] Store listing, screenshots, privacy policy URL works logged out, Data safety (account info, location on device, enquiries, Google Sheet copy, map tile providers), content rating, "no ads"
- [ ] New personal developer accounts: 12 testers × 14 days closed test

## 10. iOS release checklist
- [x] `com.mappingg.app`, buildNumber by EAS, location string, encryption flag, icon alpha removed at prebuild, in-app deletion entry
- [ ] Website deletion route (§6) so in-app deletion actually deletes
- [ ] Licensed satellite tiles (§2)
- [ ] Apple Developer account → `npx eas-cli@latest build --profile production --platform ios`
- [ ] Screenshots (6.9", 6.5", 13" iPad), App Privacy questionnaire, reviewer demo account, review notes describing the native features

## 11. Issues from the first pass — current status
| # | Issue | Status |
|---|---|---|
| C1 | Map tile licensing | **Partly fixed:** OSM now compliant (attribution + User-Agent). Satellite still on Esri's public endpoint until you approve a provider (§2) |
| H1 | No error boundary | Fixed |
| H2 | Hidden map attribution | Fixed |
| H3 | Jest can't start (VC++ runtime) | Workaround in place; your install pending (§4) |
| H4 | Server secrets in `.env.local` | Your step (§3); not in git or the bundle |
| H5 | DOM test suite crash | Fixed |
| M1–M5 | Location timeout, permission settings, dead links, double submit, radar battery | Fixed |
| M6 | Session not revoked on sign-out | Design in `docs/ACCOUNT-DELETION.md`; website change |
| M7 | Enquiry copy to Google Sheet from the device | Recommendation: move it server-side and declare it in privacy forms |
| M8 | No real account deletion | App side built; website route awaiting approval |
| L1 | npm audit (build tooling) | Unchanged; wait for upstream fixes |

## 12. Files changed in this pass
| File | Why |
|---|---|
| `src/constants/mapTiles.ts` (new) | Tile provider config, fallback, User-Agent |
| `src/components/map/LiveMap.tsx` | Uses the tile config; sends the User-Agent header |
| `src/lib/mapAttribution.ts` | Credit follows the active provider; current Esri credit text (Vantor) |
| `src/app/(tabs)/account.tsx` | Tile warnings and credits; "Delete my account" opens the new screen |
| `src/app/delete-account.tsx` (new), `src/app/_layout.tsx` | Deletion screen (modal route) |
| `src/services/account.ts` | `deleteAccount()` |
| `src/lib/__tests__/mapTiles.test.ts`, `src/services/api/__tests__/deleteAccount.test.ts` (new) | Regression tests |
| `.env.example` | Map tile placeholders (no values) |
| `docs/ACCOUNT-DELETION.md` (new) | Website route proposal and decisions |
| `MAPPINGG_PRODUCTION_READINESS.md` | This report |

Not touched: `.env.local`, `.env.website-backup`, the `mappingg` website repo, app identifiers, EAS credentials, production data.

## 13. Commands
```bash
npm run verify                     # typecheck + lint + tests + isolation + env + deps
npx expo-doctor
APP_VARIANT=production EXPO_PUBLIC_APP_ENV=production npx expo export --platform android --platform ios --output-dir dist
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile production --platform android
npx eas-cli@latest build --profile production --platform ios
```

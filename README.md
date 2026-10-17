# Mappingg mobile app (`mapping_app`)

The native Android / iOS app for **Mappingg** — the live, colour-coded map of real
estate projects in Pune, Mumbai/MMR and beyond. Built with **Expo SDK 58, React
Native 0.88, TypeScript (strict) and Expo Router**.

It is a **standalone project**. It lives inside the website repository for
convenience, but it has its own `package.json`, dependencies, config, assets and
docs, never imports website files, and talks to the existing website only over
HTTPS (the same `/api/*` routes the website itself uses). The folder can be
copied anywhere and run on its own.

> The website repo excludes this folder from its own build (`tsconfig.json`
> `exclude` and `.vercelignore`) — see
> [“Effect on the website build”](#effect-on-the-website-build).

---

## Contents

- [What's in the app](#whats-in-the-app)
- [Folder structure](#folder-structure)
- [Prerequisites (Windows)](#prerequisites-windows)
- [Install and run (PowerShell)](#install-and-run-powershell)
- [Choosing the API: emulator, phone, production](#choosing-the-api-emulator-phone-production)
- [Testing on a physical Android phone](#testing-on-a-physical-android-phone)
- [Expo Go vs development build vs APK vs production](#expo-go-vs-development-build-vs-apk-vs-production)
- [Checks and tests](#checks-and-tests)
- [Environment variables](#environment-variables)
- [Effect on the website build](#effect-on-the-website-build)
- [Troubleshooting](#troubleshooting)
- More docs: [`docs/DEVICE-TESTING.md`](docs/DEVICE-TESTING.md) (phone testing, step by step),
  [`docs/BUILD.md`](docs/BUILD.md) (APK / Play Store / iOS, permissions),
  [`docs/DEPENDENCY-AUDIT.md`](docs/DEPENDENCY-AUDIT.md) (npm audit review),
  [`docs/API.md`](docs/API.md) (endpoints, auth, limitations),
  [`docs/FEATURES.md`](docs/FEATURES.md) (website ↔ app feature map)

---

## What's in the app

| Tab / screen | What it does | Website equivalent |
|---|---|---|
| **Map** | Live map with every public project pin (colour by status, logos, “highlighted” radar), metro / roads / infrastructure, main boundary, search with suggestions, locality focus, Near me, Satellite / Night / Map, legend, zoom, WhatsApp & Call buttons, project card with Enquire / WhatsApp / Share / Compare / Favourite | `/map` (Leaflet live map) |
| **Projects** | All projects with search, status / city / property-type filters and sorting | `/projects` |
| **Explore** | Cities, localities (by city), developers (with logos), status and property-type hubs | `/cities`, `/locations`, `/developers`, `/status`, `/property` |
| **Project page** | Facts, MahaRERA verify, highlights, video, about, details, actions, related links & projects, FAQ | `/projects/[slug]` + map details panel |
| **Account** | Sign in / create account / forgot password, role-specific features, contact, legal pages | Sign-in modal, dashboards |
| Buyers | Compare (up to 3, synced to the account), My profile | Map compare, `/dashboard/buyer` |
| Agents / channel partners | Favourites (synced to the account) | Map favourites, `/dashboard/agent/favorites` |
| Developers | My projects (add / edit → review, request delete), notifications | `/dashboard/developer` |
| Contact | Contact form with topics, buyer needs and opt-ins | `/contact` |

The live map is for signed-in accounts, exactly like the website
(`MapAuthGate`): guests are asked to sign in; developer / channel-partner
accounts awaiting verification see a “being verified” screen; accounts
without a mobile number are asked to add one. Project pages stay public.

Full list and known gaps: [`docs/FEATURES.md`](docs/FEATURES.md).

## Folder structure

```
mapping_app/
├── app.config.ts            Expo config (variants, permissions, plugins) — no secrets
├── eas.json                 EAS build profiles: development / preview (APK) / production (AAB)
├── metro.config.js          Expo defaults (only this folder is bundled)
├── eslint.config.js         ESLint (eslint-config-expo) + alias resolver
├── tsconfig.json            strict TypeScript, @/ → src/, @assets/ → assets/
├── package.json             scripts, dependencies (independent of the website)
├── .env.example             public config template (copy to .env.local)
├── assets/                  app icon, adaptive icon, splash, logos (copied from the website)
├── docs/                    BUILD.md, API.md, FEATURES.md
├── scripts/                 check-isolation, check-env, smoke-api, eslint alias resolver
└── src/
    ├── app/                 Expo Router screens
    │   ├── _layout.tsx      fonts, providers, navigation stack
    │   ├── (tabs)/          index (Map), projects, explore, account
    │   ├── project/[slug].tsx
    │   ├── browse/[kind]/[slug].tsx   developer / locality / city / status / type pages
    │   ├── auth/            sign-in, sign-up, forgot-password, add-mobile
    │   ├── my-projects/     developer projects list + add/edit form
    │   └── compare, favorites, profile, notifications, contact, +not-found
    ├── components/          UI kit (ui/), map (map/), project cards
    ├── constants/           config (env), theme, status, infrastructure, contact, country codes
    ├── hooks/               data hooks (React Query), saved lists, project actions, network
    ├── lib/                 pure logic ported from the website (slugs, localities, cities,
    │                        phone rules, field visibility, search, geo, session cookie) + tests
    ├── providers/           Auth (secure session), React Query, toasts
    ├── services/            API client + auth / account / public data / contact services
    └── types/               data models
```

## Prerequisites (Windows)

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22.13+ or 24.3+ (tested with **24.21.0**) | `node -v` |
| npm | 10+ (tested with **11.19.0**) | comes with Node |
| Git | any | optional for running |
| Android Studio | latest | only for the emulator or local Android builds (`npx expo run:android`) |
| JDK 17 | — | bundled with Android Studio |
| Expo account | free | only for EAS cloud builds (`npx eas-cli@latest login`) |
| **Microsoft Visual C++ Redistributable (x64)** | 2015–2022 | needed by Jest 30's native resolver on Windows — see [Troubleshooting](#troubleshooting) |

No global Expo CLI is needed — always use `npx expo …`.

## Install and run (PowerShell)

Open the **`mapping_app` folder itself** in VS Code (File → Open Folder…), then in
the VS Code terminal (PowerShell):

```powershell
# 1. Install dependencies (from mapping_app, never from the website root)
npm install

# 2. Create your local environment file (git-ignored) and edit it
Copy-Item .env.example .env.local
code .env.local

# 3. Start the development server
npx expo start
```

Then:

- **Android emulator** — start an emulator in Android Studio (Device Manager → ▶), then press **`a`** in the Expo terminal.
- **Physical phone** — see [Testing on a physical Android phone](#testing-on-a-physical-android-phone).
- Edit any file under `src/` and the app reloads instantly (Fast Refresh). Press **`r`** to reload, **`j`** to open the debugger.

`npx expo start` serves a **development build** by default (`expo-dev-client`
is installed). The very first time, install a development build on the
emulator/phone:

```powershell
# Option A — build in the cloud and install the APK (no Android Studio needed)
npm run build:dev        # = npx eas-cli@latest build --profile development --platform android

# Option B — build locally (needs Android Studio: SDK, adb, JDK 17 + an emulator or USB phone)
npx expo run:android
```

Step-by-step phone guide (with a test checklist and what writes to production
data): [`docs/DEVICE-TESTING.md`](docs/DEVICE-TESTING.md).

To try the app quickly **without** a development build, use Expo Go (the map
screen then shows a project list, because Expo Go has no native map engine):

```powershell
npx expo start --go
```

## Choosing the API: emulator, phone, production

The app talks to whatever `EXPO_PUBLIC_API_BASE_URL` points to (default
`https://www.mappingg.com`). Edit `.env.local`, then restart `npx expo start`
and reload the app.

| You are testing against | `EXPO_PUBLIC_API_BASE_URL` | Notes |
|---|---|---|
| **Production / deployed site** | `https://www.mappingg.com` | Real data and real accounts. Enquiries you send create real leads. |
| A deployed **staging/preview** site | `https://<your-preview>.vercel.app` | Any HTTPS deployment of the website. |
| Local website on the **Android emulator** | `http://10.0.2.2:3000` | `10.0.2.2` is the emulator's address for your PC. Start the website with `npm run dev` in the website folder. |
| Local website on a **physical phone** (same Wi-Fi) | `http://192.168.x.x:3000` | Use your PC's Wi-Fi IPv4 (`ipconfig` → “IPv4 Address”). Start the website with `npx next dev -H 0.0.0.0` so it accepts connections from the network, and allow Node.js through Windows Firewall when asked (Private networks only). |

- `localhost` on a phone or emulator means **the phone itself**, not your PC — never use it here.
- Plain `http://` works only in **development** builds (they are debug builds, whose manifest allows cleartext so they can also load JavaScript from your PC); preview and production builds refuse to build with a non-HTTPS URL and their manifest blocks cleartext.
- If the phone can't reach your PC (guest Wi-Fi, firewall), use the deployed site instead, or a temporary HTTPS tunnel to the **website only** (e.g. `npx expo start --tunnel` tunnels the Metro bundler; for the website use a tunnel such as Cloudflare Tunnel pointed at `localhost:3000`). Never expose the database or admin services.
- The local website needs its own `.env` (database, `AUTH_SECRET` …) as usual — the app never needs or sees those values.

## Testing on a physical Android phone

1. On the phone: **Settings → About phone →** tap *Build number* 7 times → **Developer options → USB debugging** on (only needed for `npx expo run:android` over USB).
2. Put the phone and the PC on the **same Wi-Fi** network.
3. Install the app on the phone, either:
   - **Development build** (recommended): `npx eas-cli@latest build --profile development --platform android`, open the build link on the phone and install the APK (allow “Install unknown apps” for your browser), **or** connect by USB and run `npx expo run:android`; **or**
   - **Expo Go** from the Play Store (quick look only — no map engine).
4. On the PC, in `mapping_app`: `npx expo start` (or `npx expo start --go` for Expo Go).
5. On the phone, open the **Mappingg (Dev)** app (or Expo Go) and scan the QR code from the terminal. If it can't connect, run `npx expo start --tunnel`.
6. To test a standalone build without the PC, install the **preview APK** — see [`docs/BUILD.md`](docs/BUILD.md).

## Expo Go vs development build vs APK vs production

| | What it is | Map | Needs PC running? | Use it for |
|---|---|---|---|---|
| **Expo Go** | Expo's generic app from the Play Store, loads your JS from `npx expo start --go` | ❌ list fallback (no native MapLibre) | yes | quick UI checks |
| **Development build** | *Mappingg (Dev)* (`com.mappingg.app.dev`) with all native modules + dev menu, loads JS from `npx expo start` | ✅ | yes | everyday development |
| **Preview APK** | *Mappingg (Preview)* (`com.mappingg.app.preview`), release-mode, JS bundled inside, installable by testers | ✅ | no | testing / QA on real phones |
| **Production AAB** | *Mappingg* (`com.mappingg.app`), signed App Bundle for Google Play | ✅ | no | Play Store release |

All of them use the API set in their environment: development uses your
`.env.local`; preview and production use the values in `eas.json`
(`https://www.mappingg.com`).

## Checks and tests

```powershell
npm run typecheck        # TypeScript (strict)
npm run lint             # ESLint (eslint-config-expo)
npm test                 # Jest unit tests (logic + API client)
npm run check:isolation  # nothing imported from outside mapping_app; all assets present
npm run check:env        # env files: valid HTTPS API URL, no secrets in EXPO_PUBLIC_*
npm run check:deps       # Expo SDK dependency compatibility
npm run doctor           # expo-doctor
npm run export:android   # production JS bundle (Hermes) — proves the app compiles
npm run smoke:api        # read-only check of the live API endpoints the app uses
npm run verify           # typecheck + lint + test + isolation + env + deps
```

## Environment variables

All app variables are **public** (compiled into the app). See `.env.example`.

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | no (default `https://www.mappingg.com`) | `https://www.mappingg.com` | Website/API origin |
| `EXPO_PUBLIC_APP_ENV` | no | `development` | Label shown on the Account screen |
| `EXPO_PUBLIC_LEAD_SHEET_WEBHOOK_URL` | no | *(empty)* | Optional copy of signed-in enquiries to the Google Sheet the website's map also uses |
| `APP_VARIANT` | no (EAS sets it) | `development` / `preview` / `production` | Build flavour (app name, package id, cleartext rule) — read by `app.config.ts`, not bundled |
| `EAS_PROJECT_ID` | no | from `eas init` | Fallback only — paste the id into `app.config.ts` (`EAS_PROJECT_ID_FROM_INIT`), because EAS build servers don't see your local env |

Never put `DATABASE_URL`, `AUTH_SECRET`, SMTP passwords, Developer-API keys
or any other server secret in this project — the app doesn't need them, and
`npm run check:env` fails if it finds one.

## Effect on the website build

The website's root `tsconfig.json` includes every `**/*.ts(x)` file, so
`next build` would also have type-checked this folder and failed (measured: 75
app files pulled in, 1,001 type errors, because the website has React 18 types
and no React Native packages). With the website owner's approval, two lines
were added to the website on 17 Oct 2026:

```diff
// tsconfig.json (website root)
-  "exclude": ["node_modules", "migration", "scripts"]
+  "exclude": ["node_modules", "migration", "scripts", "mapping_app"]

// .vercelignore (website root)
+/mapping_app
```

After the change the website's own type-check passes with no errors and sees
no file from this folder. Nothing else in the website was changed. `next lint`
only lints `app/`, `components/`, `lib/`, `pages/` and `src/`, and
`vercel.json`'s `ignoreCommand` already skips deploys for commits that only
touch `mapping_app`. If this folder is ever renamed, update both entries.

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm test` (or ESLint's TypeScript resolver) fails with **“Cannot find native binding”** on Windows | The Microsoft Visual C++ Redistributable (x64, 2015–2022) isn't installed. Install it from Microsoft (`winget install Microsoft.VCRedist.2015+.x64`) and re-run. The project's own lint config uses a pure-JS resolver, so `npm run lint` works without it. |
| App shows **“Network request failed”** / offline banner while online | Check `EXPO_PUBLIC_API_BASE_URL`; on a phone it must be your PC's LAN IP or an HTTPS site, never `localhost`. Restart `npx expo start` after editing `.env.local`. |
| Map screen shows a **list** instead of a map | You are in Expo Go. Install the development build (`npx expo run:android` or the EAS development profile). |
| Map tiles don't load | The phone needs internet access to `tile.openstreetmap.org` and `server.arcgisonline.com`. |
| “Signed in, but the session could not be saved” | The server's sign-in response had no session cookie. Check you are pointing at the real Mappingg website and that it is up to date. See `docs/API.md`. |
| Changes to `.env.local` not picked up | Stop and restart `npx expo start`, then reload the app. For EAS builds, values come from `eas.json`. |

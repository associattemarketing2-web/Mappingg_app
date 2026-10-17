# Building the Mappingg app

All commands run in PowerShell **inside `mapping_app`**. EAS (Expo Application
Services) builds in the cloud, so no Android Studio or Mac is required for
release builds. EAS is configured only in this folder (`eas.json`,
`app.config.ts`).

## Build profiles (`eas.json`)

| Profile | Output | App name / Android package | API | Use |
|---|---|---|---|---|
| `development` | APK with dev client | Mappingg (Dev) / `com.mappingg.app.dev` | `https://www.mappingg.com` by default; your `.env.local` while running `npx expo start` | daily development |
| `preview` | installable **APK** | Mappingg (Preview) / `com.mappingg.app.preview` | `https://www.mappingg.com` | testers / QA |
| `production` | signed **AAB** (App Bundle) | Mappingg / `com.mappingg.app` | `https://www.mappingg.com` | Google Play |

The three variants have different package names, so all of them can be
installed on one phone side by side.

> **Decide the final package name before the first Play Store upload.**
> `com.mappingg.app` is a proposal; once an app is published on Google Play its
> package name can never change. Edit it in `app.config.ts` (`IDS.production`).

## One-time setup

```powershell
# Log in (free Expo account) and link the project
npx eas-cli@latest login
npx eas-cli@latest init
```

`eas init` prints the project id and says it can't write it into a dynamic
config. Paste it into `app.config.ts`:

```ts
const EAS_PROJECT_ID_FROM_INIT = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
```

It must be in the file (it is public, not a secret): the EAS build server
evaluates `app.config.ts` too and doesn't see environment variables from your
PC. Check with `npx expo config --type public` (look for `extra.eas.projectId`).

The npm scripts wrap these commands: `npm run build:dev`, `npm run build:apk`,
`npm run build:prod`, `npm run build:ios` (all `npx eas-cli@latest build …`).

## Android permissions and identity (verified with `npx expo prebuild`)

| | development | preview | production |
|---|---|---|---|
| App name | Mappingg (Dev) | Mappingg (Preview) | Mappingg |
| Package | `com.mappingg.app.dev` | `com.mappingg.app.preview` | `com.mappingg.app` |
| Build type | debug APK (dev client) | release APK | release AAB, signed by EAS |
| Cleartext `http://` | allowed (debug manifest) | blocked | blocked |
| Permissions | location (approx. + precise), internet, vibrate, draw-over-apps (dev tools) | location, internet, vibrate | location, internet, vibrate |

Removed on purpose: background location, microphone, external storage, and (release
builds) "draw over other apps". Min SDK 24 (Android 7.0), target SDK 36,
compile SDK 37 (Expo SDK 58 defaults). Icon: `assets/icon.png` +
adaptive icon (`assets/android-icon-*.png`, white background, monochrome
layer for themed icons), generated from the website's logo mark.

## Installable APK (testers)

```powershell
npx eas-cli@latest build --profile preview --platform android
# or: npm run build:apk
```

When the build finishes EAS prints a link and a QR code. Open it on the phone,
download the `.apk`, allow “Install unknown apps” for the browser, and install.
With the phone on USB you can also run:

```powershell
npx eas-cli@latest build:run -p android --latest   # installs the latest build on a connected device/emulator
adb install path\to\app.apk                         # or install a downloaded APK
```

## Development build

```powershell
npx eas-cli@latest build --profile development --platform android   # cloud
npx expo run:android                                                 # or locally (Android Studio + SDK needed)
```

Install it once, then `npx expo start` and open the app — JavaScript changes
load from your PC without rebuilding. Rebuild only after adding/upgrading a
native package or changing `app.config.ts` plugins/permissions.

## Production build for Google Play

```powershell
npx eas-cli@latest build --profile production --platform android
# or: npm run build:prod
```

- EAS creates and stores the upload keystore the first time (recommended).
  Keep the Expo account secure — it holds the signing key. Back it up with
  `npx eas-cli@latest credentials`.
- `appVersionSource: remote` + `autoIncrement` bump `versionCode` automatically.
  Change the user-visible version in `app.config.ts` (`version`).
- Upload the `.aab` in Google Play Console (the first upload must be done by
  hand), or after the first release:

```powershell
npx eas-cli@latest submit --platform android --profile production
```

`eas submit` needs a Google Play service-account JSON key (set it up in Play
Console → API access); never commit that file.

Play Console also asks for a privacy-policy URL (`https://www.mappingg.com/privacy`),
the data-safety form (account email/name/phone, approximate/precise location used
only on-device for “Near me”, enquiries), and screenshots.

## iOS (when needed)

The Android app doesn't need any of this.

```powershell
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest submit --platform ios
```

Requires an Apple Developer account (paid). The bundle id is
`com.mappingg.app` (`app.config.ts`). For an internal iPhone build, use
`--profile preview` and register test devices with
`npx eas-cli@latest device:create`.

## Before every release

```powershell
npm run verify           # typecheck, lint, tests, isolation, env, Expo dependency check
npm run doctor
npm run export:android   # make sure the production bundle compiles
npm run smoke:api        # the live API still answers the way the app expects
```

Then install the preview APK on a real phone and walk through:
sign in → map loads with pins → tap a pin → Enquire → project page →
Projects search/filters → Explore → sign out.

## Environment per build

- Local development: `.env.local` (git-ignored).
- EAS builds: the `env` block of each profile in `eas.json` (public values only).
  To point a preview build at a staging site, change `EXPO_PUBLIC_API_BASE_URL`
  in the `preview` profile (it must be `https://`).
- Secrets: the app has none. If a future feature needs a build-time secret, use
  EAS environment variables (`npx eas-cli@latest env:create`), never `eas.json`
  or `EXPO_PUBLIC_*`.

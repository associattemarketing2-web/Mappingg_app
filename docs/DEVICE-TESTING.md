# Testing on a real Android phone (Windows / PowerShell)

This PC has **no Android SDK, adb or Java** installed, so the steps below build
the app **in the cloud with EAS** and install it on the phone over the
internet. Nothing here changes the Mappingg website or its database — the app
only *calls* the existing production API, like a browser does.

> Status: these steps match the project's real configuration (`eas.json`,
> `app.config.ts`, `package.json`), but no EAS build has been run and the app has
> not yet been opened on a physical device.

## 0. What you need

- An Android phone (Android 7.0 / API 24 or newer) and a Windows PC on the **same Wi-Fi**.
- A free Expo account (https://expo.dev/signup).
- Node.js 22.13+ / 24.3+ (this PC: 24.21.0).

## 1. One-time project setup (PowerShell, in `mapping_app`)

```powershell
cd C:\Users\Pushkar\Documents\GitHub\mappingg\mapping_app
npm install
Copy-Item .env.example .env.local          # API defaults to https://www.mappingg.com
npx eas-cli@latest login                   # your Expo account
npx eas-cli@latest init                    # creates the EAS project, prints its id
```

`eas init` will say it can't write the project id into a dynamic config.
Open `app.config.ts` and paste the id it printed:

```ts
const EAS_PROJECT_ID_FROM_INIT = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
```

Check it: `npx expo config --type public` should now show `extra.eas.projectId`.

## 2. Build and install the development build (has the native map)

```powershell
npm run build:dev
# = npx eas-cli@latest build --profile development --platform android
```

- First run: EAS asks to create an Android keystore → answer **Yes** (stored by EAS).
- The build runs in the cloud (typically 10–25 min). At the end EAS prints a link + QR code.
- On the phone: open the link (or scan the QR with the camera), download the `.apk`,
  allow **Install unknown apps** for your browser, install **Mappingg (Dev)**.

This APK is a *debug* build: it contains MapLibre and every native module, plus
the Expo dev menu. It does not contain your JavaScript — that comes from your PC.

## 3. Run the app from your PC

```powershell
npx expo start
```

- Allow **Node.js** through Windows Defender Firewall when prompted — **Private networks only**.
- On the phone open **Mappingg (Dev)** → it lists the server on your network, or tap
  *Scan QR code* and scan the QR in the terminal.
- If the phone can't find the PC (guest/office Wi-Fi blocks devices), use:
  `npx expo start --tunnel` (Expo may ask to install `@expo/ngrok` — that only
  tunnels the JavaScript bundler, not the website or the database).
- Edit files in VS Code → the app reloads. Shake the phone (or `adb`-less: press
  `m` in the terminal) for the dev menu.

## 4. Which backend it uses

`EXPO_PUBLIC_API_BASE_URL` in `.env.local` (restart `npx expo start` after changing it):

| Target | Value |
|---|---|
| Production website (recommended for device tests) | `https://www.mappingg.com` |
| Your PC's local `next dev` (phone on same Wi-Fi) | `http://<PC IPv4 from ipconfig>:3000`, website started with `npx next dev -H 0.0.0.0` |

Plain `http://` works in the development build (its debug manifest allows
cleartext); the preview/production builds refuse `http://` at build time and
their manifest blocks cleartext traffic.

### What touches production data

Reading projects, the map, developers etc. is read-only. These actions **do
write to the production database / CRM**, exactly as they would from the website:

| Action in the app | Effect on production |
|---|---|
| Create account | creates a real user; a buyer also appears as a lead in the super-admin Leads; a real OTP email is sent |
| **Enquire now** | creates a real lead, pushes it to the sales CRM webhook, emails the Mappingg team and the user |
| Contact form | creates a contact lead, CRM push, emails |
| Compare / favourites / profile / add mobile | updates only that account's own user record |
| Developer: add / edit project | creates/updates a **hidden, pending-review** pin (not public until a super admin approves) |
| Developer: ask to delete | sets a delete request for the super admin |
| Sign in / sign out | records a login/logout in the account's activity log |

Use a dedicated test account and tell the sales team before testing Enquire,
or skip Enquire on production.

## 5. Checklist on the phone

**Native map (proves it's not Expo Go)**
- [ ] Map tab (after sign-in) shows OpenStreetMap tiles and coloured pins — *not*
      the yellow “Map view needs the full app build” list.
- [ ] Pins show developer logos; tapping a pin opens the project card.
- [ ] Satellite → Night → Map cycles the tiles.
- [ ] *Near me*: Android asks for location once; the map flies to nearby projects
      (or shows the full map if you deny).
- [ ] Metro / road lines and infrastructure markers appear; tapping one shows its card.
- [ ] Search “Kharadi” focuses the area; search a project name opens its card.
- [ ] Zoom buttons, WhatsApp and Call buttons work.

**Sign-in / session** (needs an account)
- [ ] Wrong password → “Invalid login credentials”, still signed out.
- [ ] Correct password → back to the app, Map opens. (If you see “Signed in, but the
      session could not be saved on this device”, stop and report it — see below.)
- [ ] Close the app completely and reopen → still signed in (session restored from secure storage).
- [ ] Turn on airplane mode, reopen → app opens with the saved account and an offline banner.
- [ ] Account → Sign out → confirm → Map shows the sign-in prompt again.
- [ ] Sign in on the app, then reset the password on the website → the app keeps
      working until the token expires (the website behaves the same; sessions are not
      revoked by a password change).

**Lists and pages**
- [ ] Projects: search, status chips, city/type/sort filters, pull-to-refresh.
- [ ] Explore: cities, localities, developers (logos), status & type pages.
- [ ] Project page: facts, RERA “Verify ↗”, video opens YouTube, Directions opens Google Maps, Share sheet.
- [ ] Large font (Android Settings → Display → Font size max) — screens remain usable.

## 6. Standalone test APK (no PC needed)

```powershell
npm run build:apk
# = npx eas-cli@latest build --profile preview --platform android
```

Installs as **Mappingg (Preview)** (`com.mappingg.app.preview`) next to the dev
build, always uses `https://www.mappingg.com`, release mode, no dev menu.
Share the EAS link with testers.

## 7. Optional: USB + logs

Only if you want `adb logcat` or `npx expo run:android` (local builds): install
Android Studio (it brings the SDK, platform-tools/adb and JDK 17), set
`ANDROID_HOME` to `%LOCALAPPDATA%\Android\Sdk`, add `%ANDROID_HOME%\platform-tools`
to `PATH`, enable *Developer options → USB debugging* on the phone, then:

```powershell
adb devices
npx expo run:android --device
```

## What cannot be verified without a real test account

The sign-in design (read `mg_session` from `Set-Cookie` → secure storage →
send as `Cookie` header) is checked against the React Native source and the
live server's real cookie format, and unit-tested — but these need a real
account on a real phone:

1. That the successful login response's `Set-Cookie` reaches the app on the device.
2. That `/api/auth/session` accepts the app's `Cookie` header and renews the session.
3. Role-specific screens with real data: buyer compare/profile, agent favourites,
   developer projects/notifications, verification-pending screen, add-mobile flow.
4. Sign-up end to end (OTP email delivery and the new account's first launch).
5. Enquire creating the lead (only test if the sales team knows).
6. Real session expiry (the token lasts 60 days and is renewed on every app
   launch/resume, so it can't be reproduced quickly). What happens on expiry —
   an expired token, a `401`, or `{ "session": null }` signs the device out with
   “Your session has ended” — is covered by the code paths and unit tests only.
   Uninstalling the app deletes its stored session.

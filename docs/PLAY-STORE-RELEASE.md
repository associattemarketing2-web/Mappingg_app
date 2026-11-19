# Google Play release — Mappingg (`com.mappingg.app`)

Last checked: 2026-11-03. Expo SDK 58, EAS project `0f37ac60-4210-47d5-8a41-4a4b4e1e5972` (owner `mapping`).

## 1. Status of the store blockers

| Blocker | Status | How it was checked |
|---|---|---|
| Account deletion in the app | **Done** | `src/app/delete-account.tsx` calls `POST /api/my/account/delete`; handles `wrong_password`, `no_password` (falls back to an email request) and a missing route |
| Account deletion on the website | **Live** | `POST https://www.mappingg.com/api/my/account/delete` answers 401 when signed out (the route exists) |
| Public deletion web page (Play requirement) | **Live** | `https://www.mappingg.com/delete-account` → 200 |
| Privacy policy URL | **Live** | `https://www.mappingg.com/privacy` → 200 (read it once and make sure it covers §3 below) |
| Licensed satellite tiles | **Pending: your ArcGIS key** | Production builds stop on the EAS server until it is set (`app.config.ts`) |
| Database password rotation | **Pending: you** | §4 |
| Real-device testing | **Pending: testers** | Checklist in `MAPPINGG_PRODUCTION_READINESS.md` §8 and `docs/DEVICE-TESTING.md` |
| Reviewer test account | **Pending: you** | §5 |

## 2. ArcGIS satellite key

1. https://location.arcgis.com → create an **API key**, privilege **Basemaps** only, set an expiry date.
   Turn on pay-as-you-go only if you expect more than 2M tiles a month.
2. Logged in as `mapping`, save it in EAS (the key ships inside the app, like every `EXPO_PUBLIC_` value; the privilege and expiry are what protect it):

```powershell
eas env:set --environment production --name EXPO_PUBLIC_MAP_SATELLITE_TILES --value arcgis --visibility plaintext
eas env:set --environment production --name EXPO_PUBLIC_ARCGIS_BASEMAP_KEY --value <your key> --visibility plaintext
# optional, to test in a tester APK first:
eas env:set --environment preview --name EXPO_PUBLIC_MAP_SATELLITE_TILES --value arcgis --visibility plaintext
eas env:set --environment preview --name EXPO_PUBLIC_ARCGIS_BASEMAP_KEY --value <your key> --visibility plaintext
eas env:list --environment production
```

## 3. Play Console → Data safety (draft from the code)

Answer from what the app does today. Confirm each line before submitting.

| Data type | Collected | Shared | Why | Notes from the code |
|---|---|---|---|---|
| Name, email, phone number | Yes | No | Account management, app functionality | Sign-up, profile, add-mobile, WhatsApp OTP (`src/services/auth.ts`) |
| User IDs | Yes | No | Account management | Session token stored in `expo-secure-store` |
| Approximate + precise location | Yes, **only for developer accounts** that set a project location | No | App functionality | Buyers: location only moves the map on the device (`(tabs)/index.tsx`). Developers: `my-projects/edit.tsx` saves the position as the project's coordinates |
| Messages / other user content | Yes | Possibly, see note | App functionality | Enquiries and contact form go to `www.mappingg.com`. If `EXPO_PUBLIC_LEAD_SHEET_WEBHOOK_URL` is set for production, the device also copies enquiries to a Google Apps Script, so declare that |
| Crash logs, analytics, ads | No | No | — | No analytics, crash reporting or ad SDKs in `package.json` |

- Data encrypted in transit: **Yes** (release builds refuse non-HTTPS API URLs, `app.config.ts`).
- Users can request deletion: **Yes**, in the app and at `https://www.mappingg.com/delete-account`.
- Map tiles are fetched from OpenStreetMap and ArcGIS, which see the device's IP address like any web request. Mention them in the privacy policy.
- Ads: **No**. Target audience: adults (real estate). Content rating questionnaire: no objectionable content.

## 4. Database password rotation plan (website)

The old readiness report notes the Postgres password was shared in chat. Rotate it without downtime:

1. In the Postgres provider's dashboard (Prisma), create a **new** password or connection string. Keep the old one for now.
2. Update `DATABASE_URL` in the website's hosting environment variables (production and preview).
3. Redeploy the website, then check sign-in, the map and an enquiry on https://www.mappingg.com.
4. Revoke the old password in the dashboard and redeploy once more to confirm nothing still uses it.
5. Update your local website `.env.local`. Never paste the value into chat, tickets or this repo.
6. Do the same for `MONGODB_URI` and `AUTH_SECRET` if they were ever shared. Note that changing `AUTH_SECRET` signs everyone out.

The mobile app needs no change: it never holds database credentials.

## 5. Reviewer test account (Play Console → App content → App access)

Google needs a working login to review signed-in features.

1. On https://www.mappingg.com create a normal **buyer** account with a password (not Google sign-in), e.g. `playreview+mappingg@<your domain>`.
2. Add a mobile number to it, so the app doesn't stop on the "add mobile" screen.
3. In Play Console choose "All or some functionality is restricted" and enter the email, the password and this note:
   *"Sign in from the Account tab. The map, project list and project pages work without signing in. Location is optional (Near me button)."*
4. Don't delete this account while a review is in progress. Change its password after the review if you like, and update Play Console.

## 6. Build and upload (logged in as `mapping`)

```powershell
eas whoami                                  # must print: mapping
eas project:info                            # must show @mapping/mappingg, 0f37ac60-…
eas credentials --platform android          # view only: confirm the existing keystore for com.mappingg.app; don't create a new one
eas build --platform android --profile production
eas submit --platform android --profile production --latest   # → Internal testing, draft
```

First upload: if the app has never been uploaded to Play, create the app in Play Console (package `com.mappingg.app`) and upload
the first AAB by hand from the build page. Set up a Google service account key for `eas submit` for later uploads
(https://docs.expo.dev/submit/android/).

New **personal** Play developer accounts must run a closed test with 12 testers for 14 days before production access.

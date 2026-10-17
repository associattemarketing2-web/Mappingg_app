# How the app uses the Mappingg API

The app reuses the website's **existing** routes over HTTPS. No new backend
code, no second database, no direct database connection. Everything below was
checked against the website source (`app/api/*`, `lib/*`) and against
`https://www.mappingg.com` with read-only requests (`npm run smoke:api`).

## Base URL

`EXPO_PUBLIC_API_BASE_URL` (default `https://www.mappingg.com`, the canonical
origin in the website's `lib/seo/config.ts`). All calls go through
`src/services/api/client.ts` (timeouts, consistent errors, session handling).

## Public data (no sign-in)

| Data | Request | Website code |
|---|---|---|
| All public projects (map + lists) | `GET /api/db?op={"table":"pins","action":"select","columns":"…","order":{"col":"number","ascending":true}}` | `app/api/db/route.ts`, `lib/db-engine.ts` (hidden pins are excluded server-side) |
| Infrastructure, roads, locality boundaries, custom infra types | `GET /api/db?op={"table":"infra_markers" \| "roads" \| "area_boundaries" \| "infra_types","action":"select"}` | same |
| Main boundary | `GET /api/db?op={"table":"map_settings","action":"select","filters":[{"op":"eq","col":"id","val":1}],"single":true}` | same |
| Developer names + logos | `GET /api/developers` | `app/api/developers/route.ts` |
| Images | `/api/media/<table>/<id>?f=…&v=…[&w=…]` | `app/api/media/[table]/[id]/route.ts` |

These are the same requests the website's live map makes (`public/legacy/public-map.json`).
The app applies the same rules as the website on top: `field_visibility`
(“Public Card Visibility”), the project / non-project filter, slugs,
localities, cities and status labels are ported unchanged into `src/lib/`.

## Account (signed in)

| Feature | Request | Who (enforced by the server) |
|---|---|---|
| Sign in | `POST /api/auth/login {email,password}` | everyone |
| Create account | `POST /api/auth/otp {email,purpose:"signup"}` → `POST /api/auth/signup {…, otp, ticket}` | buyer / developer / agent |
| Forgot password | `POST /api/auth/otp {purpose:"reset"}` → `POST /api/auth/reset-password` | everyone |
| Session check / renewal | `GET /api/auth/session` | signed in |
| Sign out | `POST /api/auth/logout` | signed in |
| Enquire now | `POST /api/my/enquire {pin_id}` | signed in (staff get details only) |
| Compare list | `GET/PUT /api/my/compare` | buyer |
| My profile | `GET/PUT /api/my/profile` | buyer |
| Add mobile number | `POST /api/my/mobile` | buyer / developer / agent |
| Favourites | `GET/PUT /api/my/favorites` | agent |
| My projects | `GET/POST/PATCH/DELETE /api/my/projects` | approved developer (editor access) |
| Notifications | `GET/POST /api/my/notifications` | developer |
| Contact form (guests too) | `POST /api/contact` | everyone |

## Authentication on mobile

The website keeps the session in an **httpOnly cookie** `mg_session` (an HS256
JWT signed with the server's `AUTH_SECRET`, 60 days, renewed by
`/api/auth/session`). Session routes read **only** that cookie; there is no
`Authorization: Bearer` support for them.

What the app does, without any backend change:

1. Sign-in / sign-up: the app reads the `mg_session` value from the response's
   `Set-Cookie` header.
2. It stores the value in **expo-secure-store** (Android Keystore / iOS
   Keychain, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). It is never written to
   AsyncStorage or logs.
3. Authenticated requests send `Cookie: mg_session=<value>` with
   `credentials: 'omit'`, so the platform cookie jar is never used.
4. When the server renews or clears the cookie (session check, logout), the
   stored value is updated or deleted.
5. A `401` on an authenticated request, an expired token, or
   `{ "session": null }` signs the device out and shows “Your session has ended”.
6. On launch and whenever the app returns to the foreground, `/api/auth/session`
   is called — the same rolling renewal the website does.

The server still verifies the signature and the account on every request (and
re-checks the account's role every 30 s), so the app cannot bypass any
permission. The app never sees `AUTH_SECRET` and never decodes the token for
anything except skipping a request with an obviously expired token.

**Untested on a device:** this relies on React Native exposing the
`Set-Cookie` response header, which it does on Android (OkHttp) and iOS
(NSURLSession). It has been unit-tested with mocked responses and the public
endpoints were checked live, but a real sign-in on a phone has not been done
yet (no test account was available). If sign-in shows “Signed in, but the
session could not be saved”, the header is not reaching the app — use the
backend change below.

### Recommended backend changes (not made — need approval)

1. **Accept `Authorization: Bearer <token>` in `lib/auth.ts` `getCurrentUser()`**
   (fallback after the cookie), and return the token in the JSON body of
   `/api/auth/login`, `/api/auth/signup` and `/api/auth/session` when the
   request carries a header such as `X-Mappingg-Client: mobile`. This removes
   the dependency on reading `Set-Cookie` on mobile. Same JWT, same checks.
2. **Google sign-in for the app**: `/api/auth/google/*` is a browser redirect
   flow that ends by setting a cookie in the browser, which the app can't
   receive. Supporting it needs a mobile variant (e.g. the app opens the flow
   with `expo-web-browser`, and the callback redirects to `mappingg://auth?…`
   with a one-time code that the app exchanges for a session). Until then,
   Google-only users can use “Forgot password?” to set a password.
3. **Agent enquiry history**: the website's `/dashboard/agent` page reads the
   agent's past enquiries directly from the database on the server; there is no
   API for it. A small `GET /api/my/enquiries` would let the app show it.
4. ~~Exclude `mapping_app` from the website build~~ — done with approval
   (`tsconfig.json` `exclude` + `.vercelignore`; see README).

## Not used by the app

- **`/api/v1/*` (Developer API)** — needs a per-application secret key
  (`Authorization: Bearer mgk_…`). Any key shipped inside an app can be
  extracted, which would bypass the API's quotas and abuse limits, so the app
  doesn't use it.
- **`/api/admin/*`, staff map editor, intake panel** — staff tools stay on the website.
- **`/api/track`** (website analytics beacon) — not sent from the app.

## Error handling

`src/services/api/errors.ts` maps every failure to one of: `network`,
`timeout` (20 s), `unauthorized`, `forbidden`, `not_found`, `rate_limited`
(the website's login/OTP/enquiry rate limits), `validation` (the server's own
message is shown, e.g. “An account with this email already exists”),
`server`, `parse`. Public data is cached by React Query and retried
(network / 5xx only, with back-off); queries pause offline and refetch when the
connection or the app comes back. Map layers fail independently, like on the
website, so pins still show if e.g. roads fail to load.

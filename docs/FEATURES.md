# Website → app feature map

✅ implemented · ◐ implemented differently (native equivalent) · ❌ not in the app (reason)

## Live map (`/map`)

| Website | App |
|---|---|
| Leaflet map, OpenStreetMap tiles, start view Mundhwa 18.5215 / 73.9140 z14.5 | ✅ MapLibre (native), same tiles, same start view |
| Satellite (Esri World Imagery) / Night mode toggle | ✅ same cycle Map → Satellite → Night (night = inverted OSM, like the website's CSS filter) |
| Pins coloured by status, project logo inside, size small/medium/large, “highlighted” radar | ✅ the website's teardrop pin (round head, tail, ground shadow — images drawn from the website CSS by `scripts/build-pin-icons.mjs`), logo on the head, size scale, pulsing radar ring for highlighted; drawn as map layers so 600+ pins stay fast |
| Infrastructure markers (emoji, colour, size, custom types), hover card | ◐ native markers; tap shows the card (no hover on phones) |
| Roads / metro lines / proposed roads (dashed), bridge casing, hover card | ✅ |
| Main boundary (dashed red polygon) | ✅ |
| Search box with suggestions (projects, locations, configurations, localities), area focus, Mundhwa special case, text filter | ✅ same algorithm (`src/lib/search.ts`) |
| Near me (6 km, fit to nearby projects, pulse closest), auto on load, full-map fallback | ✅ (foreground location permission only) |
| Shared link `?pin=<id>` opens a project | ◐ “See on live map” from project pages / compare / favourites opens the pin; shared links point to the public project page |
| Legend | ✅ |
| Zoom +/- , sticky WhatsApp & Call buttons | ✅ |
| Project card (logo, name, developer, location, status, type, RERA, configuration, price, possession/launch, USP, custom fields, video/brochure, actions) honouring “Public Card Visibility” | ✅ bottom sheet |
| Project video autoplays (muted) in the card | ◐ YouTube thumbnail; tap opens YouTube (no embedded player) |
| Enquire now — signed-in one-tap lead + details panel | ✅ → project page with “Enquiry sent / already enquired” note |
| Enquiry form for guests on the map | ◐ guests see the live map (front page + full map) with 3 free pins and 3 free project views, then a sign-up popup (`src/providers/GuestGateProvider.tsx`); guests enquire via the contact form |
| Share | ✅ native share sheet (link to the public project page) |
| Compare (buyers, max 3, saved to account) + compare table | ✅ |
| Favourites (agents, saved to account) + popup | ✅ |
| Sign-in gate, verification-pending screen, add-mobile step | ✅ |
| Live refresh when the admin edits a pin | ◐ data refreshes when the app returns to the foreground (if older than 3 minutes) and on pull-to-refresh in lists (no realtime channel) |
| Intro video panel (map_settings.youtube_video_url) | ❌ omitted on mobile (autoplaying video over the map; currently not set in production) |
| Google Tag Manager events, Google-Sheet copy of guest leads | ◐ no analytics in the app; optional Sheet copy for signed-in enquiries via `EXPO_PUBLIC_LEAD_SHEET_WEBHOOK_URL` |

## Public pages

| Website | App |
|---|---|
| `/projects` list | ✅ + search, status/city/type filters, sorting |
| `/projects/[slug]` | ✅ (facts, MahaRERA verify, highlights, video, about, details, related, FAQ, actions) |
| `/developers`, `/developers/[slug]` (with logos) | ✅ |
| `/locations`, `/locations/[slug]` | ✅ (grouped by city) |
| `/cities/[city]` | ✅ |
| `/status/[status]`, `/property/[type]` | ✅ |
| `/contact` | ✅ (topics, buyer needs, opt-ins) |
| Privacy, Terms, Disclaimer, Cookies, Map data | ◐ open the website pages in the in-app browser |
| Home/landing page, blog, about, FAQ, careers, advertise, features, how-it-works, developer-API docs, 3D Mundhwa map | ❌ marketing/content pages — not part of the app's scope (reachable on the website) |

## Accounts

| Website | App |
|---|---|
| Email + password sign-in | ✅ |
| Create account (buyer / developer / agent, role fields, email code) | ✅ same fields, options and validation |
| Forgot password (email code) | ✅ |
| Continue with Google | ❌ needs a backend change (see `docs/API.md`) |
| Stay signed in (rolling 60-day session), sign out | ✅ secure storage |
| Buyer: My profile, compare list | ✅ |
| Agent: favourites | ✅ · ❌ “projects I enquired about” (no API) |
| Approved developer: Dashboard, Map Editor, Projects Intake (incl. Excel/CSV upload, pictures), Profile, notifications | ✅ the website's developer panel inside the app (`/panel`), app-style frame |
| Super-admin / team panel: Dashboard, Map Editor, Developers, Developer projects, Projects Intake, Leads, Accounts, Blogs, Employees, Backups, Developer API, SEO & Health, Settings, Profile — tabs per role/permissions | ✅ the website's own panel inside the app (`/panel`) — same options and permissions; app bottom bar, “More” sheet, Profile at the bottom right (Profile / Settings / Live map / Sign out) |

## App frame for the panels

- Front page (`/welcome`): real live map, stats, featured projects, sign-up popup on launch (closable) → Sign in → each account opens its own home: buyers, agents and view-only developers the live map; approved developers and staff their panel.
- Panels are the website pages in a WebView (`src/components/panel`, `src/lib/panelBridge.ts`). The bridge signs the WebView in with the app session, hides the website header / tab row / account menu, reports the tabs (with badges) to the app's bottom bar, and passes downloads (CSV exports, backups, map image), copy, share and links to the phone. “View on map” links open the app's live map.
- The Map Editor and the admin Projects Intake open full screen and stay loaded once opened.
- New native modules: `react-native-webview`, `expo-file-system`, `expo-sharing`, `expo-clipboard` — a new build (APK / dev client) is needed.

## Quality notes

- Loading, empty, error (with retry), offline banner and pull-to-refresh on every data screen.
- Touch targets ≥ 44–48 dp, accessibility labels/roles on controls, text scaling capped (1.3–1.6×) so layouts don't break, safe areas and keyboard avoidance on forms.
- No mock data: every project, developer, locality and RERA number comes from the live API.

## Website changes of 17–20 Oct 2026, synced on 23 Oct 2026

| Website change | App |
|---|---|
| “Official project page” custom fields hidden from the card and Compare | ✅ hidden on the pin card, project page and Compare (`isPublicCustomField`) |
| “MahaRERA No.” → “RERA No.”; each number linked to its own state registry (MahaRERA, RERA Karnataka, Haryana RERA, UP RERA, Telangana RERA) | ✅ pin card, Compare, project page (`src/lib/rera.ts`); numbers from other states are no longer dropped, and unknown formats get no Verify link |
| Map: “Couldn’t load the projects. Retrying…” while the first load fails | ✅ shown on the loading screen while the request is retried |
| Project page: facts-only overview, new FAQs (price, configurations, RERA, possession), fields hidden by the admin left out | ✅ same text (`src/lib/projectMeta.ts`) |
| ALL-CAPS project, developer and locality names shown in title case (“M/s.”, Pvt/Ltd kept) | ✅ display only; slugs unchanged |
| Two projects sharing a pin number each keep their own page | ✅ `findPinBySlug` |
| Super admin: “Edit all details” (Dashboard day list, Developers, Developer projects, Map Editor) opens the project’s full Projects Intake form | ✅ the panel reports the requested intake screen; the app opens it in its own Intake view. The Map Editor’s new-window fallback opens there too instead of the phone’s (signed-out) browser |
| Dashboard: click a day in “Projects created day by day” | ✅ website panel (WebView); its “Project page” links open the app’s project screen |
| Developer intake, scraped data, admin fixes, login role default | ✅ automatic — the panels are the website’s own pages, and auth is server-side |
| SEO-only changes (pagination, page titles, crawler text, blog, landing copy) | ❌ not applicable to the app |

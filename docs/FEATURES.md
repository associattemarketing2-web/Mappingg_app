# Website → app feature map

✅ implemented · ◐ implemented differently (native equivalent) · ❌ not in the app (reason)

## Live map (`/map`)

| Website | App |
|---|---|
| Leaflet map, OpenStreetMap tiles, start view Mundhwa 18.5215 / 73.9140 z14.5 | ✅ MapLibre (native), same tiles, same start view |
| Satellite (Esri World Imagery) / Night mode toggle | ✅ same cycle Map → Satellite → Night (night = inverted OSM, like the website's CSS filter) |
| Pins coloured by status, project logo inside, size small/medium/large, “highlighted” radar | ◐ round pins drawn as map layers (fast with 500+ pins): status colour ring, logo inside, size scale, soft radar ring for highlighted |
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
| Enquiry form for guests on the map | ◐ the map is sign-in only (as on the website); guests enquire from project pages via the contact form, like the website's project pages |
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
| Developer: projects list, add/edit (held for review), ask to delete, notifications | ✅ · ❌ Excel/CSV bulk upload and picture upload (use the website) · ❌ developer Map Editor (desktop tool) |
| Super-admin, team editor, intake panel | ❌ staff tools stay on the website |

## Quality notes

- Loading, empty, error (with retry), offline banner and pull-to-refresh on every data screen.
- Touch targets ≥ 44–48 dp, accessibility labels/roles on controls, text scaling capped (1.3–1.6×) so layouts don't break, safe areas and keyboard avoidance on forms.
- No mock data: every project, developer, locality and RERA number comes from the live API.

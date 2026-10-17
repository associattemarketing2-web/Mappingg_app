# Dependency audit (`npm audit`, 17 Oct 2026)

`npm audit` in `mapping_app` reports **55 entries (29 high, 26 moderate, 0 critical)**.
(The first install reported 28, before Jest/ESLint were added.) Almost all of
them are *propagated* entries — packages flagged only because something below
them is flagged. There are only **four actual advisories**:

| Advisory | Severity | Vulnerable package (installed) | Path from this project | Where it runs | Patched release? |
|---|---|---|---|---|---|
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) — stack-exhaustion DoS on deeply nested brace patterns | high | `braces` 3.0.3 | `expo` → `@expo/metro` → `metro-file-map` → `micromatch` → `braces` | Metro bundler / Jest on the developer PC (glob patterns are the project's own config) | **No** — 3.0.3 is the latest release |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) — RSA PKCS#1 v1.5 signature check accepts extra nested DigestAlgorithm | high | `node-forge` 1.4.0 | `expo` → `@expo/cli` → `@expo/code-signing-certificates` → `node-forge` | Expo CLI, only for EAS Update code signing — `expo-updates` is not installed, so not used | **No** — 1.4.0 is the latest release |
| [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) — DoS via unbounded precision specifiers | moderate | `sprintf-js` 1.0.3 | `jest-expo` → `babel-jest` → `babel-plugin-istanbul` → `@istanbuljs/load-nyc-config` → `js-yaml@3` → `argparse@1` → `sprintf-js` | Jest coverage config loading (tests only) | **No** — 1.1.3 (latest) is also in the affected range |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) — missing buffer bounds check in v3/v5/v6 when `buf` is passed | moderate | `uuid` 7.0.3 | `expo-splash-screen` → `@expo/config-plugins` → `xcode@3.0.1` → `uuid` | `npx expo prebuild` editing the iOS project (`xcode` calls `uuid.v4()` only, no `buf`) | Yes (≥ 11.1.1), but only by forcing an `overrides` entry |

### Direct dependencies that appear in the report

`expo`, `react-native`, `@maplibre/maplibre-react-native`, `expo-splash-screen`,
`jest`, `jest-expo` are listed only because they depend on the packages above.
None of them has its own advisory.

### Is any of this in the app on the phone?

No. All four packages are Node.js build/test tooling (bundler, CLI, test
runner, iOS project editor). The exported Android bundle contains only the
app's runtime JavaScript; none of these packages is a runtime import of the app.

### Why `npm audit fix --force` must not be run

Its "fixes" are downgrades to versions that are years old and incompatible
with this project: `expo@44.0.6`, `react-native@0.72.17`, `jest-expo@56.0.0`,
`jest@25.0.0`, `@maplibre/maplibre-react-native@11.3.2`,
`expo-splash-screen@55.0.25`. That would break the SDK 58 dependency set
(`npx expo install --check` must stay clean).

`react-native-reanimated` is shown with a "non-breaking" fix, but it has no
advisory of its own (it is flagged through `react-native`); changing it would
move it off the version Expo SDK 58 expects. Not applied.

### Recommendation

- **No action needed now**: no patched versions exist for 3 of 4 advisories,
  none of them ships in the app, and the inputs that could trigger them are
  under our control.
- Re-run `npm audit` and `npx expo install --check` when upgrading to the next
  Expo SDK patch/minor (`npx expo install expo@~58 --fix`); fixes will arrive
  through Expo's own dependency updates.
- Optional (not applied): an npm `overrides` entry `"uuid": "^11.1.1"` would
  clear the `uuid` advisory. It forces a major version on `xcode`, which only
  matters for iOS prebuild, so it should be tested with an iOS build first.

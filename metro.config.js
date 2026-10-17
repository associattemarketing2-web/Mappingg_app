// Metro config for the standalone Mappingg mobile app (Expo defaults).
//
// This project lives inside the website repository but never uses its files:
// the parent folder has no npm "workspaces", so Expo treats mapping_app as its
// own project root and Metro only watches (and can only bundle) files inside
// this folder — the website's node_modules (React 18, Next.js…) are never seen.
// `npm run check:isolation` and `npm run export:android` verify this.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);

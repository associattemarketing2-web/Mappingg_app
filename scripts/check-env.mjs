// Checks the app's environment files before a build:
//  - EXPO_PUBLIC_API_BASE_URL is a valid URL (https:// unless it is a local dev address),
//  - nothing that looks like a server secret is in an EXPO_PUBLIC_* variable
//    (those are compiled into the app and readable by anyone).
// Usage: npm run check:env
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local'];
const SECRET_NAME = /(SECRET|PASSWORD|PASS|PRIVATE|TOKEN|DATABASE_URL|MONGODB_URI|SMTP|AUTH_SECRET|API_KEY|ACCESS_KEY)/i;
const SECRET_VALUE = /(postgres(ql)?:\/\/|mongodb(\+srv)?:\/\/|-----BEGIN|mgk_[0-9a-f]{16}_|sk_live_|AKIA[0-9A-Z]{16})/;
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

const problems = [];
const warnings = [];
let found = 0;

for (const name of FILES) {
  const file = path.join(root, name);
  if (!existsSync(file)) continue;
  found++;
  for (const [i, line] of readFileSync(file, 'utf8').split(/\r?\n/).entries()) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const [, key, rawValue] = m;
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    const where = `${name}:${i + 1}`;
    if (key.startsWith('EXPO_PUBLIC_') && (SECRET_NAME.test(key) || SECRET_VALUE.test(value))) {
      problems.push(`${where}: ${key} looks like a secret — EXPO_PUBLIC_ values are public. Remove it.`);
    }
    if (!key.startsWith('EXPO_PUBLIC_') && SECRET_VALUE.test(value)) {
      problems.push(`${where}: ${key} contains a server credential. The app never needs one — remove it.`);
    }
    if (key === 'EXPO_PUBLIC_API_BASE_URL' && value) {
      if (!/^https?:\/\/[^\s/]+(:\d+)?\/?$/.test(value)) problems.push(`${where}: EXPO_PUBLIC_API_BASE_URL "${value}" must be an origin like https://www.mappingg.com`);
      else if (value.startsWith('http://') && !LOCAL.test(value.replace(/\/$/, ''))) problems.push(`${where}: use https:// for non-local APIs (got "${value}")`);
      else if (value.startsWith('http://')) warnings.push(`${where}: http:// API — only development builds allow this (preview/production builds will refuse).`);
    }
  }
}

if (!found) warnings.push('No .env / .env.local file found — the app will use https://www.mappingg.com.');
for (const w of warnings) console.warn(`! ${w}`);
if (problems.length) {
  console.error(`✖ Environment check failed:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log('✔ Environment check passed.');

// Verifies that mapping_app stays a standalone project:
//  1. no source/config file imports or requires anything outside this folder,
//  2. every local asset the code references exists inside ./assets,
//  3. no file reaches into the website's folders (app/, lib/, components/ of the parent).
// Usage: npm run check:isolation
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.expo', 'dist', 'android', 'ios', 'coverage', '.git']);
const EXT = /\.(tsx?|jsx?|mjs|cjs|json)$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.test(name)) out.push(full);
  }
  return out;
}

const SPEC = /(?:import\s[^'"]*?from\s*|import\s*\(\s*|require\s*\(\s*|export\s[^'"]*?from\s*)['"]([^'"]+)['"]/g;
const problems = [];
let checked = 0;
let assets = 0;

for (const file of walk(root)) {
  if (file.endsWith('package-lock.json')) continue;
  const text = readFileSync(file, 'utf8');
  checked++;
  for (const m of text.matchAll(SPEC)) {
    const spec = m[1];
    const rel = path.relative(root, file);
    if (spec.startsWith('.')) {
      const target = path.resolve(path.dirname(file), spec);
      if (!target.startsWith(root + path.sep) && target !== root) problems.push(`${rel}: imports "${spec}" from outside mapping_app`);
    } else if (/^[A-Za-z]:[\\/]|^\//.test(spec)) {
      problems.push(`${rel}: absolute import "${spec}"`);
    } else if (spec.startsWith('@assets/')) {
      assets++;
      const target = path.join(root, 'assets', spec.slice('@assets/'.length));
      if (!existsSync(target)) problems.push(`${rel}: missing asset "${spec}"`);
    }
  }
}

// Asset paths in the Expo config.
const appConfig = readFileSync(path.join(root, 'app.config.ts'), 'utf8');
for (const m of appConfig.matchAll(/['"](\.\/assets\/[^'"]+)['"]/g)) {
  assets++;
  if (!existsSync(path.join(root, m[1]))) problems.push(`app.config.ts: missing asset "${m[1]}"`);
}

if (problems.length) {
  console.error(`✖ Isolation check failed (${problems.length}):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✔ Isolation check passed: ${checked} files, ${assets} asset references, nothing imported from outside mapping_app.`);

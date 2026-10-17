// eslint-plugin-import resolver for this app, used instead of the default
// TypeScript resolver. That resolver depends on a native binary (unrs-resolver)
// which needs the Microsoft Visual C++ runtime, not installed on every Windows PC.
//
// It resolves like TypeScript + Metro do:
//   - the tsconfig path aliases  @/... → src/...  and  @assets/... → assets/...
//   - a package's "types" entry and .d.ts files first (so exports are visible),
//   - React Native platform files (.native.*) before web/default files,
//   - only from this project's own node_modules.
const path = require('path');
const resolve = require('resolve/sync');
const isCoreModule = require('is-core-module');

const root = path.resolve(__dirname, '..');
const EXTENSIONS = ['.native.tsx', '.native.ts', '.tsx', '.ts', '.d.ts', '.native.js', '.js', '.jsx', '.mjs', '.cjs', '.json'];

function preferTypes(pkg) {
  const types = pkg.types || pkg.typings;
  return types ? { ...pkg, main: types } : pkg;
}

exports.interfaceVersion = 2;

exports.resolve = function resolveImport(source, file) {
  if (isCoreModule(source)) return { found: true, path: null };
  let target = source;
  if (source.startsWith('@/')) target = path.join(root, 'src', source.slice(2));
  else if (source.startsWith('@assets/')) target = path.join(root, 'assets', source.slice('@assets/'.length));
  try {
    const found = resolve(target, {
      basedir: path.dirname(path.resolve(file)),
      extensions: EXTENSIONS,
      paths: [path.join(root, 'node_modules')],
      packageFilter: preferTypes,
      preserveSymlinks: true,
    });
    return { found: true, path: found };
  } catch {
    return { found: false };
  }
};

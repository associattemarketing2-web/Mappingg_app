// Read-only smoke test of the API endpoints the app depends on.
// Makes only GET requests to public endpoints (no sign-in, nothing is written).
// Usage: node scripts/smoke-api.mjs [baseUrl]     (default https://www.mappingg.com)
const base = (process.argv[2] || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://www.mappingg.com').replace(/\/+$/, '');
const results = [];

async function get(path) {
  const started = Date.now();
  const res = await fetch(base + path, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, ms: Date.now() - started };
}

const db = (op) => `/api/db?op=${encodeURIComponent(JSON.stringify(op))}`;

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push(['PASS', name, detail]);
  } catch (e) {
    results.push(['FAIL', name, e.message]);
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

await check('public pins (/api/db pins)', async () => {
  const r = await get(db({ table: 'pins', action: 'select', columns: 'id,number,lat,lng,title,status,image,field_visibility', order: { col: 'number', ascending: true } }));
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(Array.isArray(r.json?.data) && r.json.data.length > 0, 'no pins');
  const p = r.json.data[0];
  assert(typeof p.id === 'string' && 'lat' in p && 'title' in p, 'unexpected pin shape');
  return `${r.json.data.length} pins, ${r.ms} ms`;
});
for (const table of ['infra_markers', 'roads', 'infra_types', 'area_boundaries']) {
  await check(`map layer (${table})`, async () => {
    const r = await get(db({ table, action: 'select' }));
    assert(r.status === 200 && Array.isArray(r.json?.data), `HTTP ${r.status}`);
    return `${r.json.data.length} rows`;
  });
}
await check('map settings (map_settings id 1)', async () => {
  const r = await get(db({ table: 'map_settings', action: 'select', filters: [{ op: 'eq', col: 'id', val: 1 }], single: true }));
  assert(r.status === 200 && r.json?.data && typeof r.json.data === 'object', `HTTP ${r.status}`);
  return `boundary points: ${Array.isArray(r.json.data.boundary) ? r.json.data.boundary.length : 0}`;
});
await check('private tables stay private (/api/db leads)', async () => {
  const r = await get(db({ table: 'leads', action: 'select', limit: 1 }));
  assert(r.status === 401, `expected 401, got HTTP ${r.status}`);
  return 'HTTP 401 as expected';
});
await check('developer directory (/api/developers)', async () => {
  const r = await get('/api/developers');
  assert(r.status === 200 && Array.isArray(r.json?.data), `HTTP ${r.status}`);
  return `${r.json.data.length} developers`;
});
await check('session without a cookie (/api/auth/session)', async () => {
  const r = await get('/api/auth/session');
  assert(r.status === 200 && r.json && r.json.session === null, 'expected { session: null }');
  return 'signed out as expected';
});
await check('account API requires sign-in (/api/my/compare)', async () => {
  const r = await get('/api/my/compare');
  assert(r.status === 401, `expected 401, got HTTP ${r.status}`);
  return 'HTTP 401 as expected';
});
await check('stored media is reachable (/api/media)', async () => {
  const r = await get(db({ table: 'pins', action: 'select', columns: 'id,image', limit: 20 }));
  const img = (r.json?.data || []).map((p) => p.image).find((u) => typeof u === 'string' && u.startsWith('/api/media/'));
  assert(img, 'no /api/media image found in the first pins');
  const res = await fetch(`${base}${img}&w=96`);
  assert(res.ok && /^image\//.test(res.headers.get('content-type') || ''), `HTTP ${res.status} ${res.headers.get('content-type')}`);
  return `${res.headers.get('content-type')}`;
});

console.log(`API smoke test against ${base}\n`);
for (const [s, name, d] of results) console.log(`${s === 'PASS' ? '✔' : '✖'} ${name} — ${d}`);
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

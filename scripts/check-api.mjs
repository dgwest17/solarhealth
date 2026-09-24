/**
 * FILE: scripts/check-api.mjs
 *
 * DOES THE API ACTUALLY LOAD? Run before every build.
 *
 * `vite build` never imports anything under api/. It bundles the browser app,
 * and the serverless functions are Vercel's problem at deploy time — so a
 * broken API import passes the build cleanly and takes the whole site's
 * back end down in production.
 *
 * That is not hypothetical. `src/project/intakeSchema.js` imported
 * '../pricing/commission' with no file extension. Vite resolves that; Node's
 * ESM, which is what runs on Vercel, does not. Because the router imports every
 * route module up front, ONE missing extension 500'd every endpoint in the
 * app — clients, settings, proposals, all of it — and the build that shipped it
 * was green.
 *
 * So this script does the one thing the build does not: import the router, and
 * check that every endpoint the browser calls actually resolves to a function.
 *
 * It needs no environment and touches no network. A handler that reads
 * process.env at call time is fine — this only imports and dispatches an
 * OPTIONS request, which every handler answers without configuration.
 *
 * Run by: npm run build (as a pre-step), and npm run check-api on its own.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;

/** Every /api/<name> the browser actually calls, read from the source. */
function callsFromSource(dir, found = new Set()) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { callsFromSource(path, found); continue; }
    if (!/\.(js|jsx)$/.test(entry.name)) continue;
    const src = readFileSync(path, 'utf8');
    for (const m of src.matchAll(/['"`]\/api\/([a-z0-9-]+)/g)) found.add(m[1]);
  }
  return found;
}

const fail = (msg) => { console.error(`\n  FAIL  ${msg}\n`); process.exitCode = 1; };

let router;
try {
  router = (await import(join(ROOT, 'api', '[...path].js'))).default;
} catch (e) {
  // The failure this script exists to catch.
  fail(`the API router does not import: ${e.message}`);
  console.error('  Every endpoint would 500 in production. A missing .js on a');
  console.error('  relative import is the usual cause — Vite resolves those,');
  console.error('  Node does not.');
  process.exit(1);
}

const wanted = [...callsFromSource(join(ROOT, 'src'))].sort();
const missing = [];

for (const name of wanted) {
  const res = {
    _s: 0,
    status(c) { this._s = c; return this; },
    json() { return this; },
    setHeader() {}, end() {}
  };
  try {
    await router({ url: `/api/${name}`, method: 'OPTIONS', headers: {}, query: {} }, res);
    if (res._s === 404) missing.push(name);
  } catch (e) {
    fail(`/api/${name} threw on dispatch: ${e.message}`);
  }
}

if (missing.length) {
  fail(`the browser calls these, and the router has no route for them:\n          ${missing.join(', ')}`);
  console.error('  Add each to the ROUTES map in api/[...path].js.');
}

if (!process.exitCode) {
  console.log(`  api ok — router imports, ${wanted.length} called endpoints all resolve`);
}

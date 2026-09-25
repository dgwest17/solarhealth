/**
 * FILE: scripts/check-beach.mjs
 *
 * WHOSE DEALS ARE THESE? Run before every build.
 *
 * Drives the real /api/beach handler against a stubbed CRM and asserts who is
 * allowed to see what. It exists because two bugs in this route were invisible
 * from the browser and cost real money:
 *
 *   COQL REFUSES AN `IN` LIST LONGER THAN 100. With more than a hundred
 *   contacts the projects query returned LIMIT_EXCEEDED, the retry loop found
 *   no field name in the message, and fell through to `projects = []`. The
 *   whole-company view showed ONE deal while each individual rep's view was
 *   fine. A cap being hit is indistinguishable from an empty book, so the stub
 *   below throws on an oversized IN exactly as Zoho does.
 *
 *   PROJECT_STATUS IS NOT EVIDENCE OF A SALE. Roughly two hundred bulk-imported
 *   service clients carry "PTO-Approved" and no sales stage. tideFor called
 *   every one an installed deal, so fixing the cap alone would have replaced an
 *   empty Beach with a false one — two hundred banked jobs nobody sold.
 *
 * And it pins the access rules, which are the ones with a financial motive
 * behind them: a rep gets their own book, no rep list, no pool, and none of the
 * override seats, whatever they ask for.
 *
 * Run by: npm run build, and npm run check-beach on its own.
 */
import { build } from 'esbuild';
import { writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const TMP = join(ROOT, '.beach-check');
mkdirSync(TMP, { recursive: true });

/* ----------------------------- the fake CRM -----------------------------
   Shapes taken from the live org, including the two that caused the bugs:
   Created_By_Rep holding a display name on imported rows and an email on rows
   this app created, and a wall of PTO-Approved service clients. */
const CONTACTS = [
  { id: '1', Full_Name: 'Tom Roberts',  Email: 't@x.com', Created_By_Rep: 'davidgwest17@gmail.com', Last_Activity_Time: null },
  { id: '2', Full_Name: 'Eric Bean',    Email: 'e@x.com', Created_By_Rep: 'David West',             Last_Activity_Time: null },
  { id: '3', Full_Name: 'Sunil Rawal',  Email: 's@x.com', Created_By_Rep: 'davidgwest17@gmail.com', Last_Activity_Time: null },
  { id: '9', Full_Name: 'Imported Guy', Email: 'i@x.com', Created_By_Rep: 'David West',             Last_Activity_Time: null }
];
/**
 * 150 REAL DEALS ACROSS 150 DISTINCT CONTACTS.
 *
 * This number is the whole point of the fixture. The contacts lookup has to be
 * chunked at 100, and a fixture with a handful of distinct contacts never
 * reaches the cap — so the test passed with the chunk size set to 500, which is
 * to say it was not testing the bug it exists for. Anything over 100 distinct
 * deal-owning contacts forces at least two chunks.
 */
const BULK = Array.from({ length: 150 }, (_, i) => ({
  id: `b${i}`,
  Full_Name: `Bulk Client ${i}`,
  Email: `b${i}@x.com`,
  // Half under the email spelling, half under the display name, because both
  // are in the live data and both have to fold onto one rep.
  Created_By_Rep: i % 2 ? 'David West' : 'davidgwest17@gmail.com',
  Last_Activity_Time: null
}));
CONTACTS.push(...BULK);

const PROJECTS = [
  { id: 'p1', Contact: { id: '1' }, Sales_Stage: 'Project', Project_Status: null },
  { id: 'p2', Contact: { id: '2' }, Sales_Stage: 'Project', Project_Status: null },
  { id: 'p3', Contact: { id: '3' }, Sales_Stage: 'Met',     Project_Status: null },
  ...BULK.map((c) => ({ id: `bp${c.id}`, Contact: { id: c.id }, Sales_Stage: 'Met', Project_Status: null })),
  ...Array.from({ length: 180 }, (_, i) => ({
    id: `imp${i}`, Contact: { id: '9' }, Sales_Stage: null, Project_Status: 'PTO-Approved'
  }))
];
const RECRUITS = [
  { id: 'r1', Name: 'David',  Last_Name: 'West',      Email: 'davidgwest17@gmail.com', Status: 'Hired',   Role: 'Admin' },
  { id: 'r2', Name: 'Kenson', Last_Name: 'Manassero', Email: 'kenmanassero@gmail.com', Status: 'Hired',   Role: 'Rep' },
  { id: 'r3', Name: 'Nobody', Last_Name: 'Yet',       Email: 'nobody@x.com',           Status: 'Hired',   Role: 'Rep' },
  { id: 'r4', Name: 'Just',   Last_Name: 'Applied',   Email: 'applied@x.com',          Status: 'Applied', Role: null }
];
const splitRows = (total) => [
  { key: 'builder',   label: 'Builder',   pct: 42, amount: total * 0.42 },
  { key: 'engineer',  label: 'Engineer',  pct: 42, amount: total * 0.42 },
  { key: 'captain',   label: 'Captain',   pct: 12, amount: total * 0.12 },
  { key: 'recruiter', label: 'Recruiter', pct: 4,  amount: total * 0.04 }
];
// Kenson set two of these; one has signed.
const PROPOSALS = [
  { contact_id: '2', proposal: { stage: 'Project', internal: { total: 5500,
      builderEmail: 'kenmanassero@gmail.com', builderName: 'Kenson Manassero', rows: splitRows(5500) } } },
  { contact_id: '3', proposal: { stage: 'Met', internal: { total: 3500,
      builderEmail: 'kenmanassero@gmail.com', builderName: 'Kenson Manassero', rows: splitRows(3500) } } }
];

writeFileSync(join(TMP, 'zoho.js'), `
const CONTACTS = ${JSON.stringify(CONTACTS)};
const PROJECTS = ${JSON.stringify(PROJECTS)};
const RECRUITS = ${JSON.stringify(RECRUITS)};
export const zohoFetch = async (_p, opts) => {
  const q = JSON.parse(opts.body).select_query;
  const m = /limit (\\d+), (\\d+)/.exec(q);
  const off = m ? Number(m[1]) : 0, size = m ? Number(m[2]) : 200;
  if (/from Recruits/.test(q)) return { data: RECRUITS.slice(off, off + size) };
  if (/from Solar_Projects/.test(q)) return { data: PROJECTS.slice(off, off + size) };
  if (/from Contacts/.test(q)) {
    const ids = [...q.matchAll(/'([^']+)'/g)].map((x) => x[1]);
    // THE REAL CONSTRAINT. Zoho answers LIMIT_EXCEEDED, not an empty set.
    if (ids.length > 100) throw new Error('value limit exceeded');
    return { data: CONTACTS.filter((c) => ids.includes(c.id)).slice(off, off + size) };
  }
  return { data: [] };
};
`);
writeFileSync(join(TMP, 'auth.js'), `
export const requireUser = async () => ({ email: process.env.T_EMAIL, role: process.env.T_ROLE });
export const sendError = (res, e) => res.status(500).json({ error: e.message });
`);

global.fetch = async (url) => ({
  ok: true, status: 200,
  text: async () => JSON.stringify(String(url).includes('client_data') ? PROPOSALS : [])
});

await build({
  entryPoints: [join(ROOT, 'api/_routes/beach.js')],
  outfile: join(TMP, 'beach.mjs'),
  bundle: true, format: 'esm', platform: 'node', logLevel: 'silent',
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'stub', setup(b) {
    b.onResolve({ filter: /_zoho\.js$/ }, () => ({ path: join(TMP, 'zoho.js') }));
    b.onResolve({ filter: /_auth\.js$/ }, () => ({ path: join(TMP, 'auth.js') }));
  } }]
});

process.env.SUPABASE_URL = 'https://stub.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'stub';
const handler = (await import(`file://${join(TMP, 'beach.mjs')}?v=${Date.now()}`)).default;

const call = async (role, email, rep) => {
  process.env.T_ROLE = role; process.env.T_EMAIL = email;
  let body = null;
  const res = { status() { return this; }, json(b) { body = b; return this; }, setHeader() {} };
  await handler({ method: 'GET', url: '/api/beach', headers: {}, query: rep ? { rep } : {} }, res);
  return body;
};

let failed = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed++; console.error(`  FAIL  ${label}\n        got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); }
  return ok;
};

const DAVE = 'davidgwest17@gmail.com';
const KENSON = 'kenmanassero@gmail.com';

// ------------------------------- Everyone -------------------------------
const everyone = await call('admin', DAVE, '');
eq('Everyone shows every real deal, past the 100-value IN cap',
   everyone.deals.length, 153);
eq('imported service clients are not deals',
   everyone.deals.filter((d) => d.name === 'Imported Guy').length, 0);
eq('a clean read reports no error', everyone.sourceError, null);

// ------------------------------ the roster ------------------------------
eq('every hired rep is selectable, sellers first',
   everyone.reps.map((r) => r.name), ['David West', 'Kenson Manassero', 'Nobody Yet']);
eq('a setter is on the list', everyone.reps.some((r) => r.email === KENSON), true);
eq('an applicant is not', everyone.reps.some((r) => r.email === 'applied@x.com'), false);
eq('options carry emails', everyone.reps.every((r) => r.email.includes('@')), true);

// --------------------------- scoped to a setter --------------------------
const kenson = await call('admin', DAVE, KENSON);
eq('a setter’s book holds the deals they SET', kenson.deals.length, 2);
eq('...with one signed', kenson.deals.filter((d) => d.tide === 'project').length, 1);
eq('...and "mine" is THEIR half, not the closer’s',
   kenson.deals.map((d) => d.commission).sort((a, b) => a - b), [1470, 2310]);
eq('...seated as the builder', [...new Set(kenson.deals.map((d) => d.commissionSeat))], ['builder']);
eq('an admin still sees the pool while scoped',
   kenson.deals.map((d) => d.commissionTotal).sort((a, b) => a - b), [3500, 5500]);

// ------------------- one person, two spellings of a name ------------------
const dave = await call('admin', DAVE, DAVE);
eq('a name and an email fold onto one rep', dave.deals.length, 153);

// ------------------------------ rep lockdown ------------------------------
const repSelf = await call('rep', KENSON, '');
eq('a rep gets their own book', repSelf.deals.length, 2);
eq('a rep gets no rep list', repSelf.reps, []);
eq('a rep never receives the pool', repSelf.deals.every((d) => d.commissionTotal === null), true);
eq('a rep never receives the override seats',
   repSelf.deals.flatMap((d) => d.commissionRows || [])
     .some((r) => r.key === 'captain' || r.key === 'recruiter'), false);

const repSnoop = await call('rep', KENSON, DAVE);
eq('a rep asking for another book gets their own', repSnoop.deals.length, 2);
eq('...scoped to themselves', repSnoop.scope, KENSON);
eq('...and still no pool', repSnoop.deals.every((d) => d.commissionTotal === null), true);

rmSync(TMP, { recursive: true, force: true });

if (failed) {
  console.error(`\n  ${failed} beach assertion${failed === 1 ? '' : 's'} failed.\n`);
  process.exit(1);
}
console.log('  beach ok — scoping, the roster and the rep lockdown all hold');

/**
 * FILE: src/tech/reportEligibility.js
 *
 * REPORT ELIGIBILITY GATE.
 *
 * Decides whether a client can be sent an automated report, and if not, why.
 *
 * This exists because an automated send is the one place where bad CRM data
 * stops being an internal annoyance and becomes an email to a real customer
 * with wrong numbers in it. A rep opening the tool manually can see that a
 * field is blank and use judgement. A cron job cannot. So the gate is
 * deliberately conservative: anything that would produce a misleading figure
 * blocks the send rather than degrading quietly.
 *
 * Verified against the live book (Aug 2026, 35-project sample):
 *   - 4 test/junk records that must never receive mail
 *   - 6 records missing production and/or usage entirely (the NEM 3.0
 *     recent-install cohort — system size and utility only)
 *   - 1 record with no NEM version
 *   - 2 near-duplicate projects for the same person (Pantarotto), which would
 *     send two different reports to one household
 *   - 0 records with a PTO date on file, so every NEM expiry is currently
 *     estimated from the install date
 *
 * Severity levels:
 *   'block' - do not send. The report would be wrong or meaningless.
 *   'warn'  - send is allowed, but the figure is soft and the report should
 *             say so rather than presenting an estimate as fact.
 */

/**
 * Records that are clearly internal tests rather than customers.
 * Deliberately narrow — matching too broadly would silently drop a real
 * person. Anything caught here should be reviewed, not trusted blindly.
 */
const TEST_PATTERNS = [
  /^test\d*$/i,                    // "Test1"
  /\btest\b.*\bsandbox\b/i,        // "TEST — Delmar Recharge Sandbox"
  /\bsandbox\b/i,
  /\bdemo\b/i,
  /last\s*nam\b/i,                 // "Joe Last nam" — placeholder surname
  /\bx\s*system$/i,                // "Pam and chris X System"
  /^\s*$/                          // empty name
];

export const looksLikeTestRecord = (name) =>
  TEST_PATTERNS.some((re) => re.test((name || '').trim()));

/**
 * @param project  raw-ish project fields (already mapped to app shape)
 * @param options  { requirePto } - tighten the gate for high-stakes sends
 * @returns { eligible, severity, reasons[], softFactors[] }
 */
export const checkReportEligibility = (project = {}, options = {}) => {
  const { requirePto = false } = options;
  const reasons = [];      // blocking
  const soft = [];         // caveats

  const name = project.name || project.projectName || '';
  const production = Number(project.annualProduction);
  const usage = Number(project.currentAnnualUsage);
  const installDate = project.installDate || project.installedYear || null;
  const ptoDate = project.ptoDate || null;

  // ---- Blocking conditions ----
  if (looksLikeTestRecord(name)) {
    reasons.push('Looks like a test or placeholder record');
  }
  if (!project.email) {
    reasons.push('No email address on the contact');
  }
  if (!Number.isFinite(production) || production <= 0) {
    reasons.push('No annual production on record');
  }
  if (!Number.isFinite(usage) || usage <= 0) {
    reasons.push('No current usage on record');
  }
  if (!project.nemVersion) {
    reasons.push('No NEM version — compensation rules unknown');
  }
  if (!installDate && !ptoDate) {
    reasons.push('No install or PTO date — cannot build a savings history');
  }
  if (requirePto && !ptoDate) {
    reasons.push('No PTO date (required for this send)');
  }

  // ---- Soft factors: send, but caveat the numbers ----
  if (!ptoDate && installDate) {
    soft.push('NEM expiry estimated from install date (no PTO on file)');
  }
  if (typeof project.installDate === 'string' && /-01-01$/.test(project.installDate)) {
    soft.push('Install date is a Jan-1 placeholder — savings history approximate');
  }
  if (Number.isFinite(production) && Number.isFinite(usage) && usage > 0) {
    const offset = (production / usage) * 100;
    if (offset > 200) soft.push(`Offset ${offset.toFixed(0)}% — unusually high, verify production`);
    if (offset < 40) soft.push(`Offset ${offset.toFixed(0)}% — unusually low, verify usage`);
  }
  if (!project.systemSize) {
    soft.push('No system size — performance ratio unavailable');
  }

  return {
    eligible: reasons.length === 0,
    severity: reasons.length ? 'block' : (soft.length ? 'warn' : 'clean'),
    reasons,
    softFactors: soft
  };
};

/**
 * Find households that would receive more than one report.
 *
 * Two projects on one contact is legitimate (a second array, a battery retrofit
 * filed separately). Two reports to one inbox on the same day is not. Callers
 * should send the most recently updated and suppress the rest.
 */
export const findDuplicateSends = (projects = []) => {
  const byKey = new Map();
  for (const p of projects) {
    const key = (p.email || p.contactId || '').toLowerCase().trim();
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(p);
  }
  const dupes = [];
  for (const [key, list] of byKey) {
    if (list.length > 1) dupes.push({ key, count: list.length, projects: list });
  }
  return dupes;
};

/**
 * Batch triage for a whole book. Returns the three buckets a send needs plus
 * the duplicate households, so a cron can act and a human can go fix the CRM.
 */
export const triageBook = (projects = [], options = {}) => {
  const clean = [], warn = [], blocked = [];
  for (const p of projects) {
    const r = checkReportEligibility(p, options);
    const entry = { project: p, ...r };
    if (!r.eligible) blocked.push(entry);
    else if (r.softFactors.length) warn.push(entry);
    else clean.push(entry);
  }
  const eligible = [...clean, ...warn];
  return {
    clean,
    warn,
    blocked,
    eligible,
    duplicates: findDuplicateSends(eligible.map((e) => e.project)),
    summary: {
      total: projects.length,
      sendable: eligible.length,
      blocked: blocked.length,
      needsCaveat: warn.length
    }
  };
};

/**
 * Roll blocking reasons up across the book so the CRM cleanup can be
 * prioritised by how many customers each missing field is costing.
 */
export const summariseBlockers = (blocked = []) => {
  const counts = new Map();
  for (const b of blocked) {
    for (const r of b.reasons) counts.set(r, (counts.get(r) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count }));
};

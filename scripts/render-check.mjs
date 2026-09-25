/**
 * FILE: scripts/render-check.mjs
 *
 * DO THE SCREENS ACTUALLY RENDER? Run before handing over a patch.
 *
 * `vite build` type-checks nothing and executes nothing. It bundles, and a
 * bundle is perfectly happy to contain code that throws the instant React
 * calls it. Three separate failures have shipped past a green build in this
 * project:
 *
 *   a missing STEP_STATUS export      — undefined at render, blank screen
 *   `comm` read before its const      — ReferenceError, blank screen
 *   an extensionless relative import  — fine in Vite, 500 in Node
 *
 * The third is caught by scripts/check-api.mjs. The first two are caught here,
 * by doing the one thing the build does not: bundling each screen with esbuild
 * and actually rendering it with react-dom/server.
 *
 * DO NOT REACH FOR A React.useState STUB to drive a component into a particular
 * state. Every component here does `import React, { useState } from 'react'`,
 * which captures the binding at import time — patching React.useState after that
 * changes nothing, and the case renders the DEFAULT state while reporting a pass.
 * That has produced a false green twice: once for the Storage deck's seven slides
 * and once for this file's optional columns, both times as byte-identical output
 * across cases that were supposed to differ. Use an explicit prop instead, and
 * check that the character counts actually differ between cases.
 *
 * WHAT IT CANNOT CATCH: anything that only happens after a click or an effect.
 * renderToString runs one synchronous pass, so useEffect never fires. A screen
 * with internal tab state therefore needs one case PER TAB — rendering slide 1
 * and calling the deck tested is exactly the mistake that let two of the three
 * bugs above through. See the STORAGE cases below.
 *
 * Run: node scripts/render-check.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;

/**
 * Each case is a snippet of module source. It imports what it needs from the
 * real app and default-exports the element to render, so a case can set up
 * whatever props that screen actually requires instead of this harness
 * guessing at a universal shape.
 */
const CASES = [
  // ---------------------------------------------------------------- STORAGE
  // One case per slide. The deck renders one panel at a time, so a single
  // case only ever proves that ONE of seven components works.
  ...['usage', 'nem', 'tou', 'spiral', 'economics', 'timeline', 'home'].map((slide, i) => ({
    name: `Storage slide ${i + 1} (${slide})`,
    src: `
      import React from 'react';
      import BatteryAnalysis from '${ROOT}src/battery/BatteryAnalysis.jsx';
      import { DEFAULT_INPUTS } from '${ROOT}src/constants/defaults.js';
      import { calculateComprehensiveSavings } from '${ROOT}src/utils/calculations.js';

      const inputs = { ...DEFAULT_INPUTS };
      let calculations = null;
      try { calculations = calculateComprehensiveSavings(inputs); } catch { calculations = null; }

      export default React.createElement(BatteryAnalysis, {
        initialSlide: ${i},
        inputs,
        calculations,
        extraUsage: { addedKwh: 0, billableKwh: 0, cost: 0, daytimePct: 0 },
        measured: null,
        clientContext: null,
        clientLabel: 'Render Check'
      });
    `
  })),

  // --------------------------------------------------------------- BIG WAVE
  {
    name: 'Big Wave (no client)',
    src: `
      import React from 'react';
      import BigWave from '${ROOT}src/proposal/BigWave.jsx';
      export default React.createElement(BigWave, { clientData: null });
    `
  },

  // ------------------------------------------------------- CUSTOMER PROPOSAL
  // Both shapes: battery-only, and solar added. The solar branch went a whole
  // release without rendering once because nothing ever populated it.
  ...[
    { label: 'battery only', solar: 'null' },
    {
      label: 'with solar',
      solar: `{
        adding: true, panels: 20, wattsPerPanel: 440, addedKw: 8.8,
        annualProductionKwh: 13640, nonExport: false,
        keepsNemStatus: false, nemAtRisk: true, nemVersion: 'NEM2'
      }`
    }
  ].map(({ label, solar }) => ({
    name: `Customer proposal (${label})`,
    /**
     * THE COMMISSION MUST NOT BE ON THE PAGE THE CUSTOMER KEEPS.
     *
     * The fixture deliberately carries `internal: { total: 5500, redline: 14500 }`
     * so this is a real test and not a test of an absent field.
     *
     * Matched on the COMMA-FORMATTED forms. An earlier version of this check
     * searched for the bare digits "5500" and reported a leak: it had matched
     * inside the inline style `opacity:0.9550000000000001`. A substring test
     * against a number is a coin flip on a page full of generated CSS.
     */
    mustNotContain: ['$5,500', '5,500', '$14,500', '14,500', 'Redline', 'redline', 'Commission'],
    src: `
      import React from 'react';
      import CustomerProposal from '${ROOT}src/proposal/CustomerProposal.jsx';
      const proposal = {
        version: 3, id: 'prop_test', createdAt: new Date().toISOString(), stage: 'Met',
        client: { name: 'Render Check', contactId: 'c1', projectId: null },
        parties: {},
        system: { make: 'Tesla', model: 'Powerwall 3', usableKwh: 13.5, rebateKwh: 13.5,
                  rebateEligible: true, units: [] },
        financing: { purchaseType: 'loan', termYears: 20, apr: 0.0399, monthlyPayment: 98.63,
                     dailyEquivalent: 3.24, prepaymentPenalty: false, lenderName: 'Test' },
        pricing: { contractWithAdders: 22222, netInvestment: 14350, storageRebate: 3375,
                   federalCredit: 4500, adders: { lines: [] } },
        savings: { monthlyBillToday: 240, connectionFee: 15, estMonthlySavings: 180,
                   rateEscalationPct: 6, newMonthlyAllIn: 133, twentyYearUtility: 98000,
                   lifetimeDifference: 42000, breakEvenYear: 9 },
        solar: ${solar},
        context: { utility: 'SDGE', nemVersion: 'NEM2', systemSizeKw: 6, annualProduction: 10000,
                   annualUsage: 13000, projectionRows: [] },
        steps: {},
        internal: { total: 5500, redline: 14500, rows: [] }
      };
      export default React.createElement(CustomerProposal, { proposal });
    `
  })),

  // -------------------------------------------------------------- THE BEACH

  // --------------------------------------------------- SOLAR ADD-ON SUMMARY
  // Extracted from BatteryStabilization precisely so it can be reached. The
  // NEM 2.0 exporting case is the one that must render the warning.
  ...[
    { label: 'NEM2, exporting',  nem: 'NEM2', nonExport: false },
    { label: 'NEM2, non-export', nem: 'NEM2', nonExport: true },
    { label: 'NEM3, no roof yet', nem: 'NEM3', nonExport: false, bare: true }
  ].map(({ label, nem, nonExport, bare }) => ({
    name: `Solar add-on summary (${label})`,
    src: `
      import React from 'react';
      import SolarAddOnSummary from '${ROOT}src/battery/SolarAddOnSummary.jsx';
      export default React.createElement(SolarAddOnSummary, {
        panels: 20,
        panelWatts: 440,
        nonExport: ${nonExport},
        inputs: ${bare
          ? `{ nemVersion: '${nem}' }`
          : `{ nemVersion: '${nem}', systemSize: 6, annualProduction: 9600 }`}
      });
    `
  })),

  // -------------------------------------------------------- CLIENT DASHBOARD
  // Rendered WITH rows, so the table, its optional columns and every cell are
  // actually exercised. Two clients so the Created By filter appears (it hides
  // itself when there is only one creator) and both the battery-target and the
  // no-figure paths render.
  ...[
    { label: 'default columns', cols: '' },
    { label: 'all optional columns on', cols: 'status,savings,finance,kw' }
  ].map(({ label, cols }) => ({
    name: `Client dashboard (${label})`,
    src: `
      import React from 'react';
      import ClientDashboard from '${ROOT}src/components/ClientDashboard.jsx';

      const clients = [
        { id: 'c1', fullName: 'Owes A Lot', lastName: 'Lot', email: 'a@x.com', city: 'Encinitas',
          street: '123 Neptune Ave', zip: '92024', ptoDate: '2019-05-10', installDate: '2019-04-01',
          nemType: 'trueup', nemAmount: 1240, opportunityType: 'Solar Owner – Add Battery',
          projectStatus: 'PTO-Approved', leftReview: true, annualSavings: 2100,
          financeProvider: 'Mosaic', systemSizeKw: 6, lastReportSent: '2026-09-01',
          lastModified: '2026-09-20', createdBy: 'austin@example.com', lifecycleStage: 'Client',
          annualProduction: 9600, currentAnnualUsage: 13000, nemVersion: 'NEM2' },
        { id: 'c2', fullName: 'Gets A Check', lastName: 'Check', email: 'b@x.com', city: 'Carlsbad',
          street: '9 Ocean St', zip: '92008', ptoDate: null, installDate: null,
          nemType: 'credit', nemAmount: 80, opportunityType: null,
          projectStatus: 'Pre-PTO', leftReview: false, annualSavings: null,
          financeProvider: null, systemSizeKw: null, lastReportSent: null,
          lastModified: '2026-09-18', createdBy: 'kenson@example.com', lifecycleStage: 'Prospect',
          annualProduction: null, currentAnnualUsage: null, nemVersion: null }
      ];

      const wanted = '${cols}'.split(',').filter(Boolean);
      const showCols = Object.fromEntries(wanted.map((k) => [k, true]));

      export default React.createElement(ClientDashboard, {
        initialClients: clients, initialShowCols: showCols,
        role: 'admin', userEmail: 'dave@example.com',
        onOpen: () => {}, hideHeader: true
      });
    `
  })),

  // ------------------------------------------------------------------ BEACH
  // Pipeline and Treasure in BOTH roles. The rep/admin split is the whole
  // point of these screens, so one role proves half of each.
  //
  // The rep fixture carries NO pool and NO captain/recruiter rows, because that
  // is what the server now sends a rep — a fixture with them would test a
  // payload that cannot occur and would hide a crash on the real one.
  ...(() => {
    const repDeal = (over) => JSON.stringify({
      id: '1', contactId: 'c1', name: 'Rep Deal', tide: 'installed',
      contractValue: 22222, battery: 'Tesla Powerwall 3', batteryKwh: 13.5,
      solarKw: 6, addedKw: 0, addedKwhPerYear: 0, panels: 0,
      commission: 2940, commissionTotal: null, commissionSeat: 'self', selfGen: true,
      commissionRows: [{ key: 'self', label: 'Self-gen', pct: 84, amount: 2940 }],
      lastContact: null, soldDate: '2026-09-02', installDate: '2026-09-15',
      originalInstallDate: '2019-04-01', ptoDate: '2019-05-10',
      rep: 'rep@example.com', summary: 'Cash · $22,222', ...JSON.parse(over || '{}')
    });
    const adminDeals = JSON.stringify([
      { id: '1', contactId: 'c1', name: 'Team Deal', tide: 'installed', contractValue: 48000,
        battery: 'Tesla Powerwall 3', batteryKwh: 13.5, solarKw: 4, addedKw: 8.8,
        addedKwhPerYear: 13640, panels: 20, commission: 5500, commissionTotal: 5500,
        commissionSeat: 'engineer', selfGen: false,
        commissionRows: [
          { key: 'builder', label: 'Builder', pct: 42, amount: 2310 },
          { key: 'engineer', label: 'Engineer', pct: 42, amount: 2310 },
          { key: 'captain', label: 'Captain', pct: 12, amount: 660 },
          { key: 'recruiter', label: 'Recruiter', pct: 4, amount: 220 }
        ],
        builderRecruitId: '123', builderName: 'Kenson Manassero',
        builderEmail: 'kenson@example.com',
        lastContact: '2026-07-01', soldDate: '2026-09-04', installDate: '2026-09-20',
        originalInstallDate: '2018-03-01', ptoDate: '2018-04-02',
        rep: 'austin@example.com', summary: 'Loan · 25 yr · $48,000' },
      { id: '2', contactId: 'c2', name: 'Open Deal', tide: 'met', contractValue: 20000,
        battery: 'Enphase IQ 10C', batteryKwh: 10, solarKw: 7, addedKw: 0,
        addedKwhPerYear: 0, panels: 0, commission: 3500, commissionTotal: 3500,
        commissionSeat: 'self', selfGen: true,
        commissionRows: [{ key: 'self', label: 'Self-gen', pct: 84, amount: 2940 }],
        lastContact: null, soldDate: null, installDate: null,
        originalInstallDate: null, ptoDate: null,
        rep: 'dave@example.com', summary: 'Loan · 20 yr · $20,000' }
    ]);

    const cases = [];
    for (const [label, role, deals] of [
      ['rep', 'rep', `[${repDeal()}]`],
      ['admin', 'admin', adminDeals]
    ]) {
      cases.push({
        name: `Pipeline (${label})`,
        src: `
          import React from 'react';
          import Pipeline from '${ROOT}src/beach/Pipeline.jsx';
          export default React.createElement(Pipeline, {
            deals: ${deals}, role: '${role}', viewerEmail: '${label}@example.com'
          });
        `
      });
      cases.push({
        name: `Treasure (${label})`,
        // mustNotContain guards the rule that matters: a rep never sees the
        // override seats. Checked against the RENDERED page, not the intent.
        mustNotContain: label === 'rep' ? ['Captain', 'Recruiter', 'Override'] : [],
        src: `
          import React from 'react';
          import TreasurePanel from '${ROOT}src/beach/Treasure.jsx';
          const deals = ${deals};
          const byTide = {
            met: deals.filter((d) => d.tide === 'met'),
            project: deals.filter((d) => d.tide === 'project'),
            installed: deals.filter((d) => d.tide === 'installed')
          };
          export default React.createElement(TreasurePanel, {
            deals, byTide, role: '${role}'
          });
        `
      });
    }
    return cases;
  })(),

  // -------------------------------------------------------------------- HOME
  // Three states, and one rule: none of the reference design's placeholder
  // figures may ever appear. They are a designer's sample numbers, and a rep
  // would quote "we've offset 1.8 million pounds" to a customer because the
  // screen said so.
  ...[
    { label: 'admin, populated', role: 'admin', data: 'full' },
    { label: 'rep, populated', role: 'rep', data: 'full' },
    { label: 'new rep, nothing yet', role: 'rep', data: 'empty' }
  ].map(({ label, role, data }) => ({
    name: `Home (${label})`,
    mustNotContain: ['142', '1.8M', '$3.4M', '12.6', '$186,400', '18%', '24%', '21%', '28%', '32%'],
    src: `
      import React from 'react';
      import Dashboard from '${ROOT}src/home/Dashboard.jsx';
      const clients = '${data}' === 'empty' ? [] : [
        { id: 'a', systemSizeKw: 7, annualProduction: 10000, ptoDate: '2019-05-01', annualSavings: 2100 },
        { id: 'b', systemSizeKw: 5, annualProduction: 7800, ptoDate: '2023-03-01', annualSavings: 1500 },
        { id: 'c', systemSizeKw: 0, annualProduction: 0, ptoDate: null, annualSavings: null }
      ];
      const deals = '${data}' === 'empty' ? [] : [
        { id: 1, tide: 'project', contractValue: 21250, soldDate: new Date().toISOString() },
        { id: 2, tide: 'met', contractValue: 20500 },
        { id: 3, tide: 'installed', contractValue: 22400, soldDate: '2026-06-02' }
      ];
      export default React.createElement(Dashboard, {
        role: '${role}', userEmail: 'x@example.com', onNavigate: () => {},
        initialData: { clients, deals }
      });
    `
  })),

  // -------------------------------------------------------------- REP PICKER
  // Self-gen and a selected builder. Keyed on the recruit id, so a value that
  // matched no option would silently show as self-gen.
  ...[
    { label: 'self-gen', value: "''" },
    { label: 'a builder selected', value: "'123'" }
  ].map(({ label, value }) => ({
    name: `Rep picker (${label})`,
    src: `
      import React from 'react';
      import RepPicker from '${ROOT}src/proposal/RepPicker.jsx';
      export default React.createElement(RepPicker, { value: ${value}, onChange: () => {} });
    `
  })),

  // ---------------------------------------------------------------- DROP IN
  {
    name: 'Drop In',
    src: `
      import React from 'react';
      import DropIn from '${ROOT}src/proposal/DropIn.jsx';
      export default React.createElement(DropIn, {
        proposal: {
          financing: { purchaseType: 'loan', termYears: 20, monthlyPayment: 98.63 },
          pricing: { netInvestment: 14350 }
        }
      });
    `
  }
];

/**
 * The scratch directory lives INSIDE the repo, not in /tmp.
 *
 * React and Recharts are left external so the installed copies render, and
 * Node resolves a bare specifier by walking up from the importing file. A
 * bundle in /tmp walks up to /tmp and finds no node_modules, so every case
 * failed with "Cannot find package 'react'" — an error about the harness, not
 * about the app.
 */
const dir = mkdtempSync(join(ROOT, '.render-check-'));
let failed = 0;

for (const [i, testCase] of CASES.entries()) {
  const entry = join(dir, `case${i}.jsx`);
  const out = join(dir, `case${i}.mjs`);
  writeFileSync(entry, testCase.src);

  try {
    await build({
      entryPoints: [entry],
      outfile: out,
      bundle: true,
      format: 'esm',
      platform: 'node',
      jsx: 'automatic',
      loader: { '.js': 'jsx' },
      logLevel: 'silent',
      // Vite injects import.meta.env; Node does not, so anything reading a
      // VITE_ variable at module scope throws on import. Stubbed empty rather
      // than populated: a render check must not depend on real credentials,
      // and a screen that only renders when Supabase is configured is a screen
      // that breaks for the first person who clones the repo.
      define: { 'import.meta.env': '{}' },
      // Everything real is bundled; only node_modules stays external so the
      // installed React is the one that renders.
      external: ['react', 'react-dom', 'react-dom/server', 'recharts',
                 'lucide-react', 'three', '@react-three/*', '@supabase/*', 'exceljs']
    });

    const { renderToString } = await import('react-dom/server');
    const element = (await import(`file://${out}?v=${Date.now()}`)).default;
    const html = renderToString(element);
    if (!html || html.length < 20) throw new Error(`rendered only ${html.length} chars`);

    /**
     * Checked against the VISIBLE TEXT, not the markup.
     *
     * Markup is full of numbers nobody reads — SVG path coordinates, inline
     * style values — and a bare-digit search hits them: "142" matched a path
     * in the Home illustrations, and an earlier "5500" matched
     * `opacity:0.9550000000000001`. Both were false alarms that would have
     * trained anyone reading the output to ignore it. Drawings and tags are
     * stripped first, so only words a person would see are searched.
     */
    const visibleText = html
      .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ');
    const leaks = (testCase.mustNotContain || []).filter((needle) => visibleText.includes(needle));
    if (leaks.length) {
      throw new Error(`FORBIDDEN text on the rendered page: ${leaks.join(', ')}`);
    }
    console.log(`  ok    ${testCase.name}  (${html.length.toLocaleString()} chars)`);
  } catch (e) {
    failed++;
    console.error(`  FAIL  ${testCase.name}`);
    // esbuild puts the useful part in `errors`, not in `message` — printing
    // only the first line of message reports "Build failed with 1 error:" and
    // throws away which error it was.
    const detail = (e.errors || []).map((x) => {
      const at = x.location ? ` (${x.location.file}:${x.location.line})` : '';
      return x.text + at;
    });
    for (const line of detail.length ? detail : [String(e.message).split('\n')[0]]) {
      console.error(`        ${line}`);
    }
  }
}

rmSync(dir, { recursive: true, force: true });

if (failed) {
  console.error(`\n  ${failed} of ${CASES.length} screens do not render.\n`);
  process.exit(1);
}
console.log(`\n  render ok — ${CASES.length} screens all render\n`);

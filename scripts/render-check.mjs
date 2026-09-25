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
  {
    name: 'Pipeline (one battery deal, one solar add-on)',
    src: `
      import React from 'react';
      import Pipeline from '${ROOT}src/beach/Pipeline.jsx';
      const deals = [
        { id: '1', contactId: 'c1', name: 'Battery Only', tide: 'met', contractValue: 22222,
          battery: 'Tesla Powerwall 3', batteryKwh: 13.5, solarKw: 6, addedKw: 0,
          addedKwhPerYear: 0, lastContact: new Date().toISOString(), commission: 2940,
          commissionRows: [], summary: 'Loan · 20 yr' },
        { id: '2', contactId: 'c2', name: 'Solar Add On', tide: 'project', contractValue: 48000,
          battery: 'Tesla Powerwall 3', batteryKwh: 13.5, solarKw: 4, addedKw: 8.8,
          addedKwhPerYear: 13640, lastContact: null, commission: 5200,
          commissionRows: [], summary: 'Loan · 25 yr',
          // A deal with a builder on it, which the row must carry through to the
          // editor. It did not, and saving the row silently cleared the builder.
          builderRecruitId: '123', builderName: 'Kenson Manassero',
          builderEmail: 'kenson@example.com' }
      ];
      export default React.createElement(Pipeline, { deals, role: 'admin' });
    `
  },

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

    const leaks = (testCase.mustNotContain || []).filter((needle) => html.includes(needle));
    if (leaks.length) {
      throw new Error(`LEAKED rep-only content into customer output: ${leaks.join(', ')}`);
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

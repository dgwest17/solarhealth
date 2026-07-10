/**
 * Consultation Report — the sellable leave-behind.
 *
 * Dark, high-tech document following the consultation flow:
 *   Hero (glowing home + storage) → System Snapshot → Equipment & Warranty
 *   schedule → Savings history + 10-yr projection → NEM expiration outlook →
 *   Measured data → Load simulation → Battery impact → Recommendations
 *   (incl. inspection timeline) → Manufacturer contacts → Contact banner →
 *   Disclaimer.
 */
import { TOU_RATES, UTILITY_OPTIONS, NEM_OPTIONS, TOU_WINDOWS, getEvTouPlan } from '../utils/rateData';
import {
  CONSUMPTION_PROFILES,
  buildDailyOverlay,
  calculateExportEconomics,
  calculateCreditsRecovered,
  NEM3_EXPORT_RATE
} from '../battery/BatteryModel';
import { buildEquipmentSchedule, replacementCostFor, projectedEquipmentExposure } from '../tech/equipmentData';
import { calculateSystemScore } from '../tech/systemScore';
import { getBatteryIncentives } from '../tech/incentives';
import { BRANDING } from '../config/branding';

const DISCLAIMER =
  'This report is provided for informational and educational purposes only. All figures are estimates ' +
  'based on information provided by the customer and publicly available utility rate data, and do not ' +
  'represent actual money received, saved, or owed. Actual utility charges, credits, savings, and ' +
  'true-up amounts are determined solely by your utility provider and will vary with rates, weather, ' +
  'usage patterns, equipment performance, and program rules. Equipment lifetimes and warranty terms are ' +
  'typical industry figures — consult your equipment documentation for your exact coverage. Nothing in ' +
  'this report constitutes a guarantee of savings or financial performance, nor financial, tax, or ' +
  'legal advice. Consult your utility and a qualified professional before making financial decisions.';

const money = (v) => '$' + Math.round(Math.abs(Number(v) || 0)).toLocaleString();
const kwh = (v) => (Number(v) || 0).toLocaleString() + ' kWh';
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function labelFor(list, value) {
  const o = list.find((x) => x.value === value);
  return o ? o.label : value;
}

/** Inline SVG: gold bars = past cumulative savings, cyan dashed = 10-yr projection. */
function savingsChartSvg(yearlyData, futureYears) {
  const past = (yearlyData || []).map((y) => ({ year: y.year, v: y.cumulativeSavings }));
  const all = past.concat(futureYears);
  if (all.length < 2) return '';
  const W = 660, H = 180, P = 34;
  const maxV = Math.max(...all.map((d) => d.v), 1);
  const x = (i) => P + (i * (W - P * 2)) / (all.length - 1);
  const y = (v) => H - P + 6 - (v / maxV) * (H - P * 2);
  const bars = past.map((d, i) =>
    `<rect x="${x(i) - 7}" y="${y(d.v)}" width="14" height="${Math.max(1, H - P + 6 - y(d.v))}" rx="2" fill="url(#gbar)"/>`).join('');
  const futPts = futureYears.map((d, i) => `${x(past.length + i)},${y(d.v)}`);
  const line = futPts.length
    ? `<polyline points="${x(past.length - 1)},${y(past[past.length - 1].v)} ${futPts.join(' ')}" fill="none" stroke="#22d3ee" stroke-width="2.5" stroke-dasharray="6 4"/>` +
      futureYears.map((d, i) => `<circle cx="${x(past.length + i)}" cy="${y(d.v)}" r="3" fill="#22d3ee"/>`).join('')
    : '';
  const labels = all.map((d, i) => (i % 2 === 0 || i === all.length - 1)
    ? `<text x="${x(i)}" y="${H - 8}" font-size="8.5" fill="#7d8aa0" text-anchor="middle">${d.year}</text>` : '').join('');
  const gridlines = [0.25, 0.5, 0.75, 1].map((f) =>
    `<line x1="${P}" y1="${y(maxV * f)}" x2="${W - P}" y2="${y(maxV * f)}" stroke="#233450" stroke-width="0.6"/>` +
    `<text x="${P - 4}" y="${y(maxV * f) + 3}" font-size="8" fill="#7d8aa0" text-anchor="end">$${Math.round(maxV * f / 1000)}k</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%">
    <defs><linearGradient id="gbar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f0c75e"/><stop offset="100%" stop-color="#8a6a1d"/></linearGradient></defs>
    ${gridlines}${bars}${line}${labels}
    <text x="${P}" y="14" font-size="9" fill="#c9982a">■ SAVINGS TO DATE</text>
    <text x="${P + 120}" y="14" font-size="9" fill="#22d3ee">- - PROJECTED NEXT 10 YEARS</text>
  </svg>`;
}

/** Futuristic hero: glowing home, solar roof, home battery, EV, energy arcs. */
function heroSvg() {
  return `<svg viewBox="0 0 700 190" style="width:100%">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#22d3ee" stop-opacity="0.55"/><stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>
    <radialGradient id="bglow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#c9982a" stop-opacity="0.65"/><stop offset="100%" stop-color="#c9982a" stop-opacity="0"/></radialGradient>
    <linearGradient id="roofg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1c3b63"/><stop offset="100%" stop-color="#122844"/></linearGradient>
    <radialGradient id="sung" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffe9a8"/><stop offset="100%" stop-color="#e0a82e"/></radialGradient>
  </defs>
  <circle cx="628" cy="38" r="20" fill="url(#sung)"/>
  <circle cx="628" cy="38" r="34" fill="url(#bglow)"/>
  <ellipse cx="330" cy="168" rx="300" ry="14" fill="#0d1b30"/>
  <ellipse cx="330" cy="120" rx="150" ry="70" fill="url(#glow)"/>
  <rect x="250" y="92" width="160" height="76" rx="4" fill="#10233d" stroke="#2b4a72" stroke-width="1.6"/>
  <polygon points="242,94 330,42 418,94" fill="url(#roofg)" stroke="#2b4a72" stroke-width="1.6"/>
  ${[0,1].map((r)=>[0,1,2,3].map((c)=>`<rect x="${282+c*22}" y="${60+r*13}" width="19" height="11" rx="1.5" fill="#0e7490" stroke="#67e8f9" stroke-width="0.8" transform="skewX(-16)"/>`).join('')).join('')}
  <rect x="318" y="128" width="24" height="40" rx="2" fill="#0b1930" stroke="#2b4a72"/>
  <circle cx="337" cy="149" r="1.8" fill="#67e8f9"/>
  <rect x="262" y="108" width="26" height="20" rx="2" fill="#123252" stroke="#22d3ee" stroke-width="0.9" opacity="0.9"/>
  <rect x="372" y="108" width="26" height="20" rx="2" fill="#123252" stroke="#22d3ee" stroke-width="0.9" opacity="0.9"/>
  <circle cx="470" cy="142" r="34" fill="url(#bglow)"/>
  <rect x="452" y="112" width="36" height="56" rx="6" fill="#141f14" stroke="#c9982a" stroke-width="2"/>
  <rect x="459" y="122" width="22" height="8" rx="2" fill="#c9982a" opacity="0.9"/>
  <rect x="459" y="134" width="22" height="8" rx="2" fill="#c9982a" opacity="0.7"/>
  <rect x="459" y="146" width="22" height="8" rx="2" fill="#c9982a" opacity="0.5"/>
  <text x="470" y="182" font-size="9" fill="#c9982a" text-anchor="middle" letter-spacing="1">HOME POWER PLANT</text>
  <path d="M610 46 Q520 20 400 56" fill="none" stroke="#e8b93e" stroke-width="1.6" stroke-dasharray="5 4" opacity="0.85"/>
  <path d="M410 92 Q444 96 456 116" fill="none" stroke="#67e8f9" stroke-width="1.6" stroke-dasharray="5 4" opacity="0.9"/>
  <rect x="146" y="140" width="66" height="22" rx="8" fill="#123252" stroke="#22d3ee" stroke-width="1.4"/>
  <circle cx="160" cy="164" r="6" fill="#0b1622" stroke="#67e8f9" stroke-width="1.4"/>
  <circle cx="198" cy="164" r="6" fill="#0b1622" stroke="#67e8f9" stroke-width="1.4"/>
  <path d="M214 148 Q234 140 250 130" fill="none" stroke="#22d3ee" stroke-width="1.6" stroke-dasharray="4 3"/>
  </svg>`;
}

export function buildConsultationReportHtml({ clientName, clientAddress, repName, inputs, calculations, extraUsage, gbProfile, contact = {} }) {
  const utilLabel = labelFor(UTILITY_OPTIONS, inputs.utility);
  const utilShort = (/\(([^)]+)\)/.exec(utilLabel) || [null, utilLabel])[1];
  const nemLabel = labelFor(NEM_OPTIONS, inputs.nemVersion);
  const nem = calculations.currentNEMImpact;
  const isCredit = nem && nem.type === 'credit';
  const touRates = TOU_RATES[inputs.utility] || TOU_RATES.SCE;
  const nowYear = new Date().getFullYear();

  const measured = gbProfile && gbProfile.ok ? gbProfile : null;
  const overlay = buildDailyOverlay('evening_heavy', inputs.currentAnnualUsage, inputs.annualProduction);
  const expKwh = measured ? measured.annualExportKwh : overlay.annualDaytimeOverproduction;
  const impKwh = measured ? measured.annualImportKwh : overlay.annualNighttimeImport;
  const econ = calculateExportEconomics(touRates, expKwh, impKwh, inputs.utility);
  const roundTripKwh = Math.min(expKwh, impKwh);
  const spreadLoss = Math.max(0, roundTripKwh * (econ.nightBuyRate - econ.daytimeSellRate));
  const batteryCap = inputs.batteryCapacity || 13.5;
  const recovery = calculateCreditsRecovered(touRates, expKwh, impKwh, batteryCap, inputs.batteryEfficiency || 90, inputs.utility);

  const schedule = buildEquipmentSchedule({
    installedYear: inputs.installedYear,
    panelManufacturer: inputs.panelManufacturer,
    inverterManufacturer: inputs.inverterManufacturer,
    batteryManufacturer: inputs.batteryManufacturer,
    hasBattery: inputs.hasBattery,
    batteryInstalledYear: inputs.installedYear
  });

  const score = calculateSystemScore(calculations, inputs);
  const incentives = getBatteryIncentives(inputs.utility);

  // "If you never went solar" bill comparison: usage x utility rate, then vs now.
  const initRate = parseFloat(calculations.initialUtilityRate) || 0;
  const nowRate = parseFloat(calculations.currentUtilityRate) || 0;
  const billAtInstall = (Number(inputs.annualUsageAtInstall) || 0) * initRate / 12;
  const billNowNoSolar = (Number(inputs.currentAnnualUsage) || 0) * nowRate / 12;
  const billJumpPct = billAtInstall > 0 ? Math.round(((billNowNoSolar - billAtInstall) / billAtInstall) * 100) : 0;

  const exposure = projectedEquipmentExposure(schedule.items, 10);

  const evPlan = extraUsage && extraUsage.ratePlan === 'SDGE_EVTOU5' ? getEvTouPlan('SDGE_EVTOU5') : null;
  const touWin = evPlan ? evPlan.windows : (TOU_WINDOWS[inputs.utility] || TOU_WINDOWS.SDGE);
  const touDisp = evPlan ? { peak: evPlan.peak, offPeak: evPlan.offPeak, superOffPeak: evPlan.superOffPeak } : touRates;
  const touSvg = (() => {
    const W = 660, H = 200, P = 30, baseY = 158;
    const CB = { peak: '#ef4444', off: '#f59e0b', sop: '#10b981' };
    const bandKey = (h) => (h >= touWin.peak[0] && h < touWin.peak[1]) ? 'peak'
      : ((h >= touWin.superOffPeak[0] && h < touWin.superOffPeak[1]) ||
         (touWin.sopWeekdayMidday && h >= touWin.sopWeekdayMidday[0] && h < touWin.sopWeekdayMidday[1])) ? 'sop' : 'off';
    const rateOf = { peak: touDisp.peak, off: touDisp.offPeak, sop: touDisp.superOffPeak };
    const maxRate = Math.max(touDisp.peak, touDisp.offPeak, touDisp.superOffPeak);
    const x = (h) => P + (h / 24) * (W - P * 2);
    // Buy/sell price bars — height proportional to price (taller = pricier)
    const priceBars = Array.from({ length: 24 }, (_, h) => {
      const k = bandKey(h);
      const bh = Math.max(8, (rateOf[k] / maxRate) * 100);
      return `<rect x="${x(h)}" y="${baseY - bh}" width="${(W - P * 2) / 24 - 1.5}" height="${bh}" rx="1.5" fill="${CB[k]}" opacity="0.45"/>`;
    }).join('');
    // Consumption profile curve (evening-heavy household shape)
    const prof = (CONSUMPTION_PROFILES.evening_heavy || { hourly: [] }).hourly;
    const maxP = Math.max(...prof, 1);
    const consPts = prof.map((v, h) => `${x(h) + 6},${baseY - (v / maxP) * 112}`).join(' ');
    // Solar production bell (roughly 7am–6pm, peak 12:30)
    const solarPts = Array.from({ length: 24 }, (_, h) => {
      const v = Math.max(0, Math.exp(-Math.pow((h - 12.5) / 3.1, 2)));
      return `${x(h) + 6},${baseY - v * 100}`;
    }).join(' ');
    const ticks = [0, 6, 12, 18, 24].map((h) =>
      `<text x="${x(h)}" y="${baseY + 14}" font-size="8.5" fill="#7d8aa0" text-anchor="middle">${h === 0 || h === 24 ? '12a' : h === 12 ? '12p' : h < 12 ? h + 'a' : (h - 12) + 'p'}</text>`).join('');
    const legendY = baseY + 30;
    const legend = [
      [`Buy/sell price — Peak $${touDisp.peak}`, CB.peak, 0, 'rect'],
      [`Off-peak $${touDisp.offPeak}`, CB.off, 175, 'rect'],
      [`Super off-peak $${touDisp.superOffPeak}`, CB.sop, 290, 'rect'],
      ['Home consumption', '#22d3ee', 440, 'line'],
      ['Solar production', '#e8b93e', 555, 'line']
    ].map(([label, color, lx, kind]) =>
      (kind === 'rect'
        ? `<rect x="${lx}" y="${legendY - 8}" width="9" height="9" rx="2" fill="${color}" opacity="0.6"/>`
        : `<line x1="${lx}" y1="${legendY - 4}" x2="${lx + 12}" y2="${legendY - 4}" stroke="${color}" stroke-width="2.5"/>`) +
      `<text x="${lx + 15}" y="${legendY}" font-size="8" fill="#c9d4e3">${label}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%">
      <text x="${P}" y="12" font-size="9" fill="#8a97ab">YOUR DAY vs THE PRICE OF POWER — ${evPlan ? esc(evPlan.label).toUpperCase() + ' <tspan fill=\"#e8b93e\">(verify current tariff)</tspan>' : inputs.utility}</text>
      ${priceBars}
      <polyline points="${solarPts}" fill="none" stroke="#e8b93e" stroke-width="2" stroke-dasharray="5 3" opacity="0.9"/>
      <polyline points="${consPts}" fill="none" stroke="#22d3ee" stroke-width="2.5"/>
      ${ticks}${legend}
    </svg>`;
  })();

  const nemExpires = inputs.nemVersion === 'NEM3' ? null : inputs.installedYear + 20;
  const postNemTrueUp = Math.max(0, impKwh * touRates.peak - expKwh * NEM3_EXPORT_RATE);

  const lastCum = (calculations.yearlyData && calculations.yearlyData.length)
    ? calculations.yearlyData[calculations.yearlyData.length - 1].cumulativeSavings : 0;
  const grossAnnual = parseFloat(calculations.avgMonthlySavings) * 12 || 0;
  const futureYears = [];
  let cum = lastCum;
  for (let i = 1; i <= 10; i++) {
    cum += grossAnnual * Math.pow(1.05, i);
    futureYears.push({ year: nowYear + i, v: Math.round(cum) });
  }

  const hasSim = extraUsage && extraUsage.addedKwh > 0;
  const extraCost = hasSim ? extraUsage.cost : 0;

  const recs = [];
  recs.push({ title: `Recommended inspection: ${schedule.inspectionYear}`, body: schedule.inspectionYear <= nowYear
    ? 'Based on the age and warranty status of the equipment below, a professional system inspection is recommended now. Batteries in particular should have capacity and thermal checks from year 7.'
    : `Based on the equipment schedule below, plan a professional inspection by ${schedule.inspectionYear} — ahead of the first expected service window${inputs.hasBattery ? ', with battery capacity checks beginning at year 7' : ''}.` });
  const owedNow = !isCredit && nem ? nem.amount : 0;
  const totalExposure = owedNow + extraCost;
  if (calculations.systemHealth && calculations.systemHealth.status === 'poor') {
    recs.push({ title: 'Investigate under-production', body: `Production is at ${calculations.systemHealth.performanceRatio.toFixed(0)}% of expected for a ${inputs.systemSize} kW system — shading, soiling, or an equipment fault may be costing real production.` });
  }
  if (totalExposure > 1000) {
    recs.push({ title: 'Battery + additional solar recommended', body: `Projected annual exposure of ${money(totalExposure)}${hasSim ? ` (including ${money(extraCost)} from planned added usage)` : ''} exceeds what storage alone typically recovers — pairing storage with added panels closes the gap.` });
  } else if (totalExposure > 0) {
    recs.push({ title: 'Battery recommended', body: `Storage that shifts evening usage onto stored solar could recover most of the projected ${money(totalExposure)} annual cost.` });
  } else if (isCredit) {
    recs.push({ title: 'System performing well — protect the position', body: `The system over-produces today (${money(nem.amount)}/yr credit), but ${money(spreadLoss)}/yr is still lost to the sell-low/buy-high spread — recoverable with storage.` });
  }
  if (nemExpires) {
    recs.push({ title: `Prepare for NEM expiration (${nemExpires})`, body: `When the current ${nemLabel} agreement expires, exports are expected to be credited near $${NEM3_EXPORT_RATE.toFixed(3)}/kWh. Without changes, the estimated annual true-up becomes ${money(postNemTrueUp)}. Storage installed before then converts that cliff into self-consumption.` });
  }
  const defunctItems = schedule.items.filter((i) => i.manufacturer.defunct);
  if (defunctItems.length) {
    recs.push({ title: 'Orphaned equipment coverage', body: `${defunctItems.map((i) => i.manufacturer.label).join(' and ')} ${defunctItems.length > 1 ? 'have' : 'has'} exited the business — factory warranty support is uncertain. A service plan provides coverage the manufacturer no longer reliably can. Contact details below for a service plan.` });
  }

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const row = (label, value) => `<tr><td>${esc(label)}</td><td>${value}</td></tr>`;
  const statusColor = (s) => s === 'Healthy' ? '#3ddc84' : s === 'Plan for service' ? '#e8b93e' : '#ff6b5e';

  let sec = 0;
  const S = () => ++sec;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Solar System Analysis${clientName ? ' — ' + esc(clientName) : ''}</title>
<style>
  :root { --bg:#0a1424; --panel:#0f1e36; --line:#22344f; --gold:#c9982a; --cyan:#22d3ee; --ink:#dbe4f0; --dim:#8a97ab; }
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { background:var(--bg); color:var(--ink); font-family:'Segoe UI', -apple-system, Helvetica, Arial, sans-serif; font-size:12.5px; line-height:1.55; padding:30px 40px; }
  header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:8px; }
  h1 { font-size:23px; color:#fff; letter-spacing:.4px; }
  .brand { font-size:11px; color:var(--gold); font-weight:800; text-transform:uppercase; letter-spacing:3px; }
  .meta { text-align:right; font-size:11px; color:var(--dim); }
  h2 { font-size:12.5px; color:var(--gold); text-transform:uppercase; letter-spacing:1.6px; border-bottom:1px solid var(--line); padding-bottom:5px; margin:20px 0 10px; }
  table { width:100%; border-collapse:collapse; }
  td, th { padding:5px 8px; border-bottom:1px solid var(--line); vertical-align:top; text-align:left; }
  td:first-child { color:var(--dim); width:44%; }
  td:last-child { font-weight:600; color:var(--ink); }
  th { font-size:10px; color:var(--dim); text-transform:uppercase; letter-spacing:1px; }
  .eq td { width:auto; color:var(--ink); font-weight:500; }
  .eq td:first-child { color:var(--ink); font-weight:700; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:0 26px; }
  .hero { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:8px 0 2px; }
  .cell { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:10px 12px; text-align:center; }
  .cell .v { font-size:19px; font-weight:800; color:#fff; }
  .green { color:#3ddc84 !important; } .red { color:#ff6b5e !important; }
  .panelbox { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin:6px 0; }
  .rec { border:1px solid var(--line); border-left:4px solid var(--gold); border-radius:8px; padding:9px 12px; margin-bottom:8px; background:var(--panel); }
  .rec b { color:#fff; display:block; margin-bottom:2px; }
  .badge { display:inline-block; padding:1px 8px; border-radius:10px; font-size:9.5px; font-weight:700; }
  .note { font-size:10.5px; color:var(--dim); }
  .contactbar { margin-top:22px; border-radius:14px; padding:18px 22px; background:linear-gradient(90deg,#122a49,#0f1e36 60%); border:1px solid var(--gold); position:relative; overflow:hidden; }
  .contactbar:before { content:''; position:absolute; inset:-40%; background:radial-gradient(circle at 85% 30%, rgba(201,152,42,.28), transparent 45%); }
  .contactbar h3 { color:#fff; font-size:16px; margin-bottom:3px; letter-spacing:.4px; position:relative; }
  .contactbar p { color:var(--ink); font-size:12px; position:relative; }
  .contactbar .cta { color:var(--gold); font-weight:800; letter-spacing:1px; text-transform:uppercase; font-size:11px; margin-top:6px; display:block; position:relative; }
  .disclaimer { margin-top:16px; padding:11px 13px; border:1px solid var(--line); border-radius:8px; background:var(--panel); font-size:9.3px; color:var(--dim); }
  footer { margin-top:12px; font-size:10px; color:var(--dim); display:flex; justify-content:space-between; }
  @media print { body { padding:10mm 12mm; } .noprint { display:none; } }
  .printbar { position:fixed; top:10px; right:10px; z-index:9; }
  .printbar button { background:var(--gold); color:#0a1424; border:none; border-radius:8px; padding:9px 18px; font-weight:800; cursor:pointer; }
</style></head><body>
<div class="noprint printbar"><button onclick="window.print()">Save as PDF</button></div>
<header>
  <div><div class="brand">${esc(BRANDING.appName)}</div><h1>Solar System Analysis</h1></div>
  <div class="meta">
    ${clientName ? `Prepared for: <strong style="color:#fff">${esc(clientName)}</strong>${clientAddress ? ', ' + esc(clientAddress) : ''}<br>` : ''}
    Developed by: <strong style="color:#fff">${esc(repName || BRANDING.brandName)}</strong> — ${esc(contact.company || BRANDING.brandName)}${(contact.phone || BRANDING.phone) ? ' · ' + esc(contact.phone || BRANDING.phone) : ''}${(contact.email || BRANDING.email) ? ' · ' + esc(contact.email || BRANDING.email) : ''}<br>
    ${today} · ${esc(utilShort)} · ${esc(nemLabel)}
  </div>
</header>

${heroSvg()}

<div class="hero">
  <div class="cell"><div class="v ${isCredit ? 'green' : 'red'}">${isCredit ? '+' : '\u2212'}${money(nem ? nem.amount : 0)}/yr</div><div class="note">CURRENT ${isCredit ? 'ANNUAL CREDIT' : 'ANNUAL TRUE-UP'}</div></div>
  <div class="cell"><div class="v">${calculations.offsetPercentage}%</div><div class="note">SOLAR OFFSET OF USAGE</div></div>
  <div class="cell"><div class="v green">${money(calculations.cumulativeSavings)}</div><div class="note">EST. SAVINGS TO DATE</div></div>
</div>

<div class="panelbox" style="display:flex;align-items:center;gap:16px;border-color:${score.hex}">
  <div style="min-width:84px;height:84px;border-radius:16px;background:${score.hex}22;border:2px solid ${score.hex};display:flex;align-items:center;justify-content:center;">
    <span style="font-size:44px;font-weight:900;color:${score.hex}">${score.grade}</span>
  </div>
  <div>
    <div style="font-size:14px;font-weight:800;color:#fff;letter-spacing:.5px">SYSTEM SCORE: ${esc(score.label).toUpperCase()} ${score.icon}</div>
    <p class="note" style="margin-top:3px">${esc(score.recommendation)}</p>
  </div>
</div>

<h2>${S()} · System Snapshot</h2>
<div class="grid">
<table>
${row('System size', inputs.systemSize + ' kW')}
${row('Installed', inputs.installedMonth + '/' + inputs.installedYear)}
${row('Utility', esc(utilShort))}
${row('NEM program', esc(nemLabel))}
${row('Financing', esc(inputs.program))}
</table>
<table>
${row('Annual production', kwh(inputs.annualProduction))}
${row('Annual consumption', kwh(inputs.currentAnnualUsage))}
${row('Performance', calculations.systemHealth ? calculations.systemHealth.performanceRatio.toFixed(0) + '% of expected' : '—')}
${row('Current utility rate', '$' + calculations.currentUtilityRate + '/kWh')}
${row('Payback', calculations.paybackYears + ' years')}
</table>
</div>

<div class="hero" style="margin-top:14px">
  <div class="cell"><div class="v">${money(billAtInstall)}/mo</div><div class="note">UTILITY BILL AT INSTALL (${inputs.installedYear}, NO SOLAR)</div></div>
  <div class="cell"><div class="v red">${money(billNowNoSolar)}/mo</div><div class="note">WHAT YOU'D PAY TODAY WITHOUT SOLAR</div></div>
  <div class="cell"><div class="v red">+${billJumpPct}%</div><div class="note">RATE & USAGE INCREASE SINCE INSTALL</div></div>
</div>
<p class="note" style="margin-bottom:2px">Based on your usage at each point in time and ${esc(utilShort)}'s published rates ($${initRate.toFixed(3)} → $${nowRate.toFixed(3)}/kWh). Every month without solar, this is the bill.</p>

${schedule.items.length ? `
<h2>${S()} · Equipment, Warranty & Service Schedule</h2>
<table class="eq">
<tr><th>Component</th><th>Manufacturer</th><th>Warranty ends</th><th>Expected service / replacement</th><th>Est. replacement (parts + labor)</th><th>Status</th></tr>
${schedule.items.map((i) => { const rc = replacementCostFor(i.kind); return `<tr>
<td>${esc(i.kind)}</td>
<td>${esc(i.manufacturer.label)}${i.manufacturer.defunct ? ' <span class="badge" style="background:#3a1512;color:#ff6b5e">OUT OF BUSINESS</span>' : ''}</td>
<td>${i.warrantyEnds}</td>
<td>${i.serviceYear}</td>
<td>${rc ? money(rc.parts + rc.labor) + ' <span class="note">(' + esc(rc.note) + ')</span>' : '—'}</td>
<td><span class="badge" style="background:#12233c;color:${statusColor(i.status)}">${i.status.toUpperCase()}</span></td>
</tr>`; }).join('')}
</table>
<p class="note">Recommended professional inspection: <strong style="color:var(--gold)">${schedule.inspectionYear}</strong>. Lifetimes are typical industry figures for planning purposes.</p>
${exposure.total > 0 ? `
<div class="panelbox" style="border-color:#ff6b5e;display:flex;justify-content:space-between;align-items:center">
  <div>
    <div style="font-weight:800;color:#fff">Projected out-of-warranty equipment costs (next ${exposure.horizonYears} years)</div>
    <div class="note">${exposure.items.map((e) => `${esc(e.kind)} ~${e.year}: ${money(e.cost)}`).join(' · ')}</div>
    <div class="note" style="color:#e8b93e">A service plan spreads this into a predictable monthly cost — and covers the labor.</div>
  </div>
  <div style="font-size:22px;font-weight:900;color:#ff6b5e;white-space:nowrap">${money(exposure.total)}</div>
</div>` : ''}
` : ''}

<h2>${S()} · Savings — History & 10-Year Outlook</h2>
<div class="panelbox">${savingsChartSvg(calculations.yearlyData, futureYears)}</div>
<p class="note">Projection assumes the current gross annual benefit escalating ~5%/yr with utility rates. Estimates only.</p>

${nemExpires ? `
<h2>${S()} · NEM Expiration Outlook</h2>
<table>
${row('Current agreement', esc(nemLabel) + ' (20-year lock-in)')}
${row('Expected expiration', String(nemExpires) + (nemExpires - nowYear > 0 ? ` (${nemExpires - nowYear} years away)` : ' (expired)'))}
${row('Export credit after expiration', '~$' + NEM3_EXPORT_RATE.toFixed(3) + '/kWh')}
${row('Estimated annual true-up after expiration', '\u2212' + money(postNemTrueUp) + '/yr if nothing changes')}
</table>
<p class="note">When the lock-in ends, exports lose most of their value — stored self-consumption becomes the way to keep it.</p>
` : ''}

${measured ? `
<h2>${S()} · Measured Usage (Green Button)</h2>
<table>
${row('Data range', esc(measured.meta.readingStart) + ' \u2192 ' + esc(measured.meta.readingEnd) + ' (' + measured.days + ' days)')}
${row('Grid purchases (annualized)', kwh(measured.annualImportKwh))}
${row('Solar exports (annualized)', measured.hasGeneration ? kwh(measured.annualExportKwh) : 'No generation channel in file')}
${row('Share of purchases at peak rates', Math.round(measured.touImportShare.peak * 100) + '%')}
</table>
` : ''}

${hasSim ? `
<h2>${S()} · Planned Usage Changes (Load Simulation)</h2>
<table class="eq">
<tr><th>Addition</th><th>Details</th><th>Added usage</th><th>Daytime share</th></tr>
${(extraUsage.loads || []).map((l) => `<tr><td>${esc(l.label)}</td><td>${esc(l.detail || '—')}</td><td>${kwh(l.kwh)}/yr</td><td>${l.daytimePct}%</td></tr>`).join('')}
</table>
<table style="margin-top:6px">
${row('Total added usage', kwh(extraUsage.addedKwh) + '/yr')}
${extraUsage.creditBefore > 0 ? row('Credit impact', money(extraUsage.creditBefore) + ' → ' + money(extraUsage.creditAfter) + '/yr (−' + money(extraUsage.creditReduction) + ')') : ''}
${extraUsage.surplusLeftKwh > 0
  ? row('Surplus production remaining', kwh(extraUsage.surplusLeftKwh) + '/yr still available for future loads')
  : row('Surplus production', 'fully consumed — additional usage is billed at time-of-use rates')}
${row('Portion above current production', kwh(extraUsage.billableKwh) + '/yr')}
${extraUsage.ratePlan === 'SDGE_EVTOU5'
  ? row('Estimated added annual cost (EV-TOU-5 super off-peak)', '\u2212' + money(extraCost) + '/yr')
    + (extraUsage.standardCost != null ? row('Same usage on the standard plan', '\u2212' + money(extraUsage.standardCost) + '/yr') : '')
  : row('Estimated added annual cost', '\u2212' + money(extraCost) + '/yr at time-of-use rates')}
</table>
<p class="note">Added-usage costs apply only to consumption beyond current production, priced by when the power is used.</p>
${extraUsage.ratePlan === 'SDGE_EVTOU5' && extraUsage.evTouFallbackCost != null ? `
<div class="panelbox" style="border-color:#e8b93e">
  <div style="font-weight:800;color:#e8b93e">⚠ Rate-plan risk</div>
  <div class="note" style="color:#dbe4f0">This plan depends on SDG&E's super off-peak window. <strong>If SDG&E removes super off-peak, your added-usage true-up would be ${money(extraUsage.evTouFallbackCost)}/yr at off-peak rates</strong> — a battery removes that dependency by storing your own solar instead.</div>
</div>` : ''}
` : ''}

<h2>${S()} · Battery Impact</h2>
<div class="panelbox">${touSvg}</div>
<table>
${row('Energy sold to the grid' + (measured ? ' (measured)' : ' (modeled)'), kwh(expKwh) + '/yr')}
${row('Energy bought back' + (measured ? ' (measured)' : ' (modeled)'), kwh(impKwh) + '/yr')}
${row('Est. value lost to sell-low / buy-high spread', money(spreadLoss) + '/yr')}
${row('Est. recoverable with a ' + batteryCap + ' kWh battery', money(recovery.creditsRecovered) + '/yr')}
</table>

<h2>${S()} · Battery Incentives Available Now</h2>
<div class="panelbox" style="border-color:var(--gold)">
${incentives.map((p) => `<div style="display:flex;justify-content:space-between;gap:14px;padding:7px 2px;border-bottom:1px solid var(--line)">
  <div>
    <div style="font-weight:800;color:#fff">${esc(p.name)}</div>
    <div class="note">${esc(p.blurb)}</div>
    <div class="note" style="color:#e8b93e">⏳ ${esc(p.urgency)}</div>
  </div>
  <div style="min-width:170px;text-align:right;font-weight:800;color:var(--gold)">${esc(p.value)}${p.approx ? '<div class="note" style="font-weight:400">verify current amount</div>' : ''}</div>
</div>`).join('')}
</div>
<p class="note">Incentive amounts and funding availability change frequently and are subject to program rules and eligibility — confirm current figures before relying on them.</p>

<h2>${S()} · Recommendations</h2>
${recs.map((r) => `<div class="rec"><b>${esc(r.title)}</b>${esc(r.body)}</div>`).join('')}

${schedule.items.length ? `
<h2>${S()} · Manufacturer Contacts</h2>
<table class="eq">
<tr><th>Component</th><th>Manufacturer</th><th>Support</th><th>Notes</th></tr>
${schedule.items.map((i) => `<tr>
<td>${esc(i.kind)}</td>
<td>${esc(i.manufacturer.label)}</td>
<td>${i.manufacturer.website ? esc(i.manufacturer.website) : '—'}${i.manufacturer.phone ? ' · ' + esc(i.manufacturer.phone) : ''}</td>
<td>${i.manufacturer.defunct ? '<span class="red">' + esc(i.manufacturer.defunctNote || 'Out of business — warranty support uncertain.') + '</span> Contact details below for a service plan.' : 'Active manufacturer support.'}</td>
</tr>`).join('')}
</table>
` : ''}

<div class="contactbar">
  <h3>⚡ ${esc(BRANDING.tagline)}</h3>
  <p>Monitoring, inspections, orphaned-warranty coverage, battery health checks, and end-of-life recycling — one plan, everything handled.</p>
  <span class="cta">${esc(contact.company || BRANDING.brandName)} · ${esc(contact.phone || BRANDING.phone || 'Call or text to schedule your service consultation')}${(contact.email || BRANDING.email) ? ' · ' + esc(contact.email || BRANDING.email) : ''}</span>
</div>

<div class="disclaimer"><strong style="color:var(--ink)">Important — estimates only.</strong> ${DISCLAIMER}</div>
<footer><span>${esc(BRANDING.appName)} · System Analysis · Prepared by ${esc(BRANDING.brandName)}, a service of ${esc(BRANDING.legalName)}</span><span>${today}</span></footer>
</body></html>`;

  return html;
}

export function openConsultationReport(params) {
  const html = buildConsultationReportHtml(params);
  const w = window.open('', '_blank');
  if (!w) { alert('Pop-up blocked — please allow pop-ups to generate the report.'); return html; }
  w.document.write(html);
  w.document.close();
  return html;
}

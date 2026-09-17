/**
 * FILE: src/incentives/TideTab.jsx
 *
 * TIDE CHECK — what a battery is worth, and what it costs to wait for one.
 *
 * Ported from the standalone Tide Check deployment, with three additions asked
 * for here: a real CARE on/off toggle, a utility selector that swaps in that
 * territory's incentive program and rates, and a battery-model picker (rebates
 * scale on USABLE kWh, so the model choice moves the money directly).
 *
 * The model, unchanged from the original:
 *   - Year splits 212 winter / 153 summer days = 365, not 375.
 *   - Round-trip efficiency applied, so more is bought than discharged.
 *   - Performance payment runs weekdays only, and stops after its term.
 *   - The rebate is set by program funding and CARE status ON THE DAY THE
 *     PROJECT STARTS, not today. An exhausted fund pays nothing — not a lower
 *     tier. This is the point of the whole tool.
 *   - Federal credit zeroed on cash/financed purchases: 25D ended for systems
 *     placed in service after 31 Dec 2025. Only third-party-owned reaches 48E,
 *     and only through end of 2027.
 *
 * What it still doesn't know: whether the array actually makes enough surplus
 * in December to fill the battery. The Eligibility tab answers that from real
 * data; the "average daily cycle" input here is the manual stand-in.
 *
 * Rendered by: src/SolarCalculator.jsx (Tide tab)
 */
import React, { useState, useMemo } from 'react';
import { BATTERY_MODELS, getBattery, getProgram, getRateDefaults } from './programData';

const WINTER_DAYS = 212, SUMMER_DAYS = 153, WEEKDAYS = 261;
const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const money = (v) => (v < 0 ? '−$' : '$') + Math.abs(Math.round(Number(v) || 0)).toLocaleString();

const TideTab = ({ inputs }) => {
  const utility = inputs.utility || 'SDGE';
  const rateDefaults = getRateDefaults(utility);
  const program = getProgram(utility);

  const [batteryId, setBatteryId] = useState('tesla_pw3');
  const [qty, setQty] = useState(1);
  const [careOn, setCareOn] = useState(!!inputs.onCareProgram);
  const [s, setS] = useState({
    util: 88, rte: 89, warranty: 10, cost: 19500,
    wpeak: rateDefaults.wpeak, wsop: rateDefaults.wsop,
    speak: rateDefaults.speak, ssop: rateDefaults.ssop,
    esc: 8, care: 32, careEnd: 12,
    path: 'tpo', fed: 30,
    rebCare: program.rebateCare, rebNoCare: program.rebateStandard,
    enrolled: 100, perf: program.perfPerKwh, perfYears: program.perfYears, sdcpEnd: 3,
    delay: 6, equip: 3, opp: 5, horizon: 20
  });

  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));

  // Swapping utility reloads that territory's rates and program terms.
  const applyUtility = (u) => {
    const rd = getRateDefaults(u);
    const pg = getProgram(u);
    setS((p) => ({
      ...p,
      wpeak: rd.wpeak, wsop: rd.wsop, speak: rd.speak, ssop: rd.ssop,
      rebCare: pg.rebateCare, rebNoCare: pg.rebateStandard,
      perf: pg.perfPerKwh, perfYears: pg.perfYears
    }));
    setSelUtil(u);
  };
  const [selUtil, setSelUtil] = useState(utility);
  const activeProgram = getProgram(selUtil);

  const battery = getBattery(batteryId);
  const usable = battery.usableKwh * qty;

  const NOW = useMemo(() => new Date(), []);
  const FED_MONTHS = Math.max(0, (2027 - NOW.getFullYear()) * 12 + (12 - (NOW.getMonth() + 1)));
  const stamp = (mo) => {
    const d = new Date(NOW.getFullYear(), NOW.getMonth() + mo, 1);
    return MONTH[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);
  };

  const m = useMemo(() => {
    const util = s.util / 100, rte = s.rte / 100;
    const wSpread = s.wpeak - s.wsop, sSpread = s.speak - s.ssop;
    const esc = s.esc / 100, care = s.care / 100;
    const careMo = careOn ? Math.max(0, Math.round(s.careEnd)) : 0;
    const sdcpMo = Math.max(0, Math.round(s.sdcpEnd));
    const enrolled = s.enrolled / 100;
    const perfYears = Math.max(0, Math.round(s.perfYears));
    const delayMo = Math.max(0, Math.round(s.delay));
    const equip = s.equip / 100, opp = s.opp / 100;
    const horizon = Math.max(3, Math.round(s.horizon));
    const tpo = s.path === 'tpo', fedPct = s.fed / 100;

    // The deal as it stands if the contract is signed `mo` months from today.
    const price = (mo) => {
      const g = s.cost * Math.pow(1 + equip, mo / 12);
      const sdcpOpen = mo < sdcpMo;
      const onCareThen = careOn && mo < careMo;
      const rebRate = !sdcpOpen ? 0 : (onCareThen ? s.rebCare : s.rebNoCare);
      const rebate = rebRate * usable;
      const fedOk = tpo && mo <= FED_MONTHS;
      const fed = fedOk ? g * fedPct : 0;
      return { gross: g, sdcpOpen, onCare: onCareThen, rebRate, rebate, fed, fedOk, net: g - rebate - fed, mo };
    };

    const run = (startMo, netCost) => {
      const start = startMo / 12;
      let cum = 0, rows = [], be = null, fund = netCost;
      for (let y = 1; y <= horizon; y++) {
        const onCareY = careOn && (y - 0.5) * 12 < careMo;
        if (y <= start) { fund *= 1 + opp; rows.push({ y, cap: null, save: 0, sdcp: 0, care: onCareY, net: fund - netCost }); continue; }
        const age = y - start;
        const cap = usable * (1 - 0.30 * Math.min(Math.max(age - 1, 0), s.warranty) / s.warranty);
        const cycled = cap * util * Math.min(age, 1);
        const careMult = onCareY ? (1 - care) : 1;
        const infl = Math.pow(1 + esc, y - 1);
        const save = (wSpread * WINTER_DAYS + sSpread * SUMMER_DAYS) * cycled * rte * careMult * infl;
        const sdcp = age <= perfYears ? cycled * enrolled * s.perf * WEEKDAYS : 0;
        cum += save + sdcp;
        const forgone = netCost * (Math.pow(1 + opp, age) - 1);
        const net = cum - netCost - forgone;
        if (be === null && net >= 0) be = y;
        rows.push({ y, cap, save, sdcp, care: onCareY, net });
      }
      return { rows, be, cum };
    };

    const pNow = price(0), pLater = price(delayMo);
    return { now: run(0, pNow.net), wait: run(delayMo, pLater.net), pNow, pLater, horizon, delayMo, careMo, sdcpMo };
  }, [s, careOn, usable, FED_MONTHS]);

  const endNow = m.now.rows[m.horizon - 1].net;
  const endWait = m.wait.rows[m.horizon - 1].net;
  const gap = endNow - endWait;
  const swing = m.pLater.net - m.pNow.net;

  // --- chart geometry ---
  const W = 900, H = 260, P = { l: 58, r: 14, t: 14, b: 26 };
  const all = [...m.now.rows.map((r) => r.net), ...m.wait.rows.map((r) => r.net)];
  const lo = Math.min(0, ...all), hi = Math.max(...all);
  const X = (i) => P.l + (i / (m.horizon - 1)) * (W - P.l - P.r);
  const Y = (v) => P.t + (1 - (v - lo) / (hi - lo || 1)) * (H - P.t - P.b);
  const line = (rows) => rows.map((r, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(r.net).toFixed(1)}`).join(' ');
  const zeroY = Y(0);

  const marks = [
    { mo: m.sdcpMo, label: `${activeProgram.short} funds gone` },
    ...(careOn ? [{ mo: m.careMo, label: 'CARE requalification' }] : []),
    { mo: FED_MONTHS, label: 'Federal 30% ends' }
  ].sort((a, b) => a.mo - b.mo);

  const Num = ({ k, label, step = 1, suffix }) => (
    <div className="flex items-center justify-between gap-3 mb-2">
      <label className="text-[12px] text-slate-400 flex-1">{label}</label>
      <input
        type="number" step={step} value={s[k]}
        onChange={(e) => set(k, parseFloat(e.target.value) || 0)}
        className="w-[92px] px-2 py-1 text-right font-mono text-[12.5px] rounded bg-slate-900/70 border border-slate-600 text-slate-100"
      />
      <span className="w-[30px] text-[11px] text-slate-500 font-mono">{suffix}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ---- headline ---- */}
      <div className="rounded-xl border border-cyan-500/25 bg-slate-800/50 p-5">
        <div className="flex items-baseline justify-between gap-5 flex-wrap mb-3">
          <h3 className="text-2xl font-bold text-slate-100 max-w-[30ch] leading-tight">
            {gap > 0 ? (
              <>Starting {m.delayMo} month{m.delayMo === 1 ? '' : 's'} from now costs{' '}
                <span className="text-amber-400">{money(gap)}</span> over {m.horizon} years.</>
            ) : (
              <>On these numbers, waiting comes out <span className="text-amber-400">{money(-gap)}</span> ahead.</>
            )}
          </h3>
          <div className="flex gap-4 text-[12px] text-slate-400 whitespace-nowrap">
            <span><span className="inline-block w-5 h-[2px] bg-emerald-400 mr-1.5 align-middle" />Install now</span>
            <span><span className="inline-block w-5 h-[2px] bg-red-400 mr-1.5 align-middle" />Wait</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
          {[0, 1, 2, 3, 4].map((i) => {
            const v = lo + (hi - lo) * i / 4, yy = Y(v);
            return (
              <g key={i}>
                <line x1={P.l} y1={yy} x2={W - P.r} y2={yy} stroke="rgba(143,176,184,.22)" strokeWidth="1" />
                <text x={P.l - 8} y={yy + 3.5} textAnchor="end" fill="#8FB0B8" fontSize="10.5" fontFamily="monospace">{money(v)}</text>
              </g>
            );
          })}
          <line x1={P.l} y1={zeroY} x2={W - P.r} y2={zeroY} stroke="#8FB0B8" strokeWidth="1" strokeDasharray="3 3" opacity=".55" />
          <path d={line(m.wait.rows)} fill="none" stroke="#B3564A" strokeWidth="2" strokeLinejoin="round" />
          <path d={line(m.now.rows)} fill="none" stroke="#2F9E8F" strokeWidth="2.5" strokeLinejoin="round" />
          {m.now.be && (
            <>
              <circle cx={X(m.now.be - 1)} cy={zeroY} r="4" fill="#F0A03C" />
              <text x={X(m.now.be - 1)} y={zeroY - 11} textAnchor="middle" fill="#F0A03C" fontSize="10.5" fontFamily="monospace">breaks even</text>
            </>
          )}
          {Array.from({ length: m.horizon }, (_, i) => i).filter((i) => i % Math.ceil(m.horizon / 8) === 0).map((i) => (
            <text key={i} x={X(i)} y={H - 6} textAnchor="middle" fill="#8FB0B8" fontSize="10.5" fontFamily="monospace">{i + 1}</text>
          ))}
        </svg>
      </div>

      {/* ---- deadline timeline ---- */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5">
        <h4 className="text-sm font-bold text-slate-200 mb-3">When you start the project matters</h4>
        <input
          type="range" min={0} max={36} step={1} value={s.delay}
          onChange={(e) => set('delay', Number(e.target.value))}
          className="w-full accent-amber-400"
        />
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3">
          {marks.map((k) => (
            <div key={k.label} className={`text-[11px] ${m.delayMo >= k.mo ? 'text-red-400 line-through' : 'text-amber-300'}`}>
              {k.label} <span className="text-slate-500 font-mono not-italic no-underline">· {stamp(k.mo)}</span>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-slate-200 font-mono mt-2">
          {m.delayMo === 0 ? 'Start now' : `Start in ${m.delayMo} month${m.delayMo === 1 ? '' : 's'}`}
          <span className="text-slate-500"> · {stamp(m.delayMo)}</span>
        </p>
      </div>

      {/* ---- price stack ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[['Start now', m.pNow, 'emerald'], [m.delayMo === 0 ? 'Start now' : `Start in ${m.delayMo} mo`, m.pLater, 'red']].map(([title, p, tone], i) => (
          <div key={i} className={`rounded-xl border p-4 ${tone === 'emerald' ? 'border-emerald-400/40 bg-emerald-900/10' : 'border-slate-700 bg-slate-900/40'}`}>
            <h5 className={`text-[13px] font-semibold mb-2 ${tone === 'emerald' ? 'text-emerald-300' : 'text-red-300'}`}>
              {title} · {stamp(p.mo)}
            </h5>
            <dl className="font-mono text-[12.5px] space-y-1">
              <div className="flex justify-between"><dt className="text-slate-400 font-sans">Installed cost</dt><dd>{money(p.gross)}</dd></div>
              <div className="flex justify-between">
                <dt className="text-slate-400 font-sans">
                  {p.sdcpOpen ? `${activeProgram.short} rebate, ${p.onCare ? 'CARE' : 'standard'} tier` : `${activeProgram.short} rebate`}
                </dt>
                <dd className={p.rebate > 0 ? '' : 'text-red-400/75'}>{p.rebate ? '− ' + money(p.rebate) : 'fund exhausted'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400 font-sans">Federal 30%</dt>
                <dd className={p.fedOk ? '' : 'text-red-400/75'}>{p.fed ? '− ' + money(p.fed) : 'expired'}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-700 mt-2 pt-2 text-[17px]">
                <dt className="text-slate-300 font-sans text-[13px] self-center">Out of pocket</dt><dd>{money(p.net)}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      {/* ---- readouts ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-slate-700 border border-slate-700 rounded-xl overflow-hidden">
        {[
          ['Break-even', m.now.be ? `Year ${m.now.be}` : 'Not reached', 'starting now', m.now.be ? 'text-emerald-300' : 'text-red-300'],
          ['Out of pocket', money(m.pNow.net), `${money(m.pLater.net)} if they wait`, 'text-slate-100'],
          ['Price of waiting', money(swing), 'more, on day one', swing > 0 ? 'text-red-300' : 'text-slate-100'],
          ['Year 1 return', money(m.now.rows[0].save + m.now.rows[0].sdcp), 'bill savings + rebate', 'text-slate-100'],
          [`Net at year ${m.horizon}`, money(endNow), 'starting now', endNow >= 0 ? 'text-emerald-300' : 'text-red-300']
        ].map(([l, v, sub, cls]) => (
          <div key={l} className="bg-slate-900 p-4">
            <span className="block text-[11.5px] text-slate-400 mb-1">{l}</span>
            <b className={`font-mono text-[21px] font-medium ${cls}`}>{v}</b>
            <small className="block text-[11px] text-slate-500 mt-0.5">{sub}</small>
          </div>
        ))}
      </div>

      {/* ---- inputs ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-6 items-start">
        <div className="space-y-5">
          {/* battery + utility + CARE — the three additions */}
          <div className="border-t border-slate-700 pt-4">
            <h4 className="text-[15px] font-semibold text-slate-100 mb-3">The battery</h4>
            <div className="mb-2">
              <label className="block text-[11px] text-slate-400 mb-1">Model</label>
              <select
                value={batteryId} onChange={(e) => setBatteryId(e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-slate-900/70 border border-slate-600 text-slate-100 text-[12.5px]"
              >
                {BATTERY_MODELS.map((b) => <option key={b.id} value={b.id}>{b.make} {b.model} · {b.usableKwh} kWh</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="text-[12px] text-slate-400 flex-1">Quantity</label>
              <select value={qty} onChange={(e) => setQty(Number(e.target.value))}
                className="w-[92px] px-2 py-1 rounded bg-slate-900/70 border border-slate-600 text-slate-100 text-[12.5px]">
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>×{n}</option>)}
              </select>
              <span className="w-[30px] text-[11px] text-purple-300 font-mono">{usable}</span>
            </div>
            <Num k="util" label="Average daily cycle" suffix="%" />
            <Num k="rte" label="Round-trip efficiency" suffix="%" />
            <Num k="warranty" label="Reaches 70% capacity at" suffix="yr" />
            <Num k="cost" label="Installed cost, before rebate" step={500} suffix="$" />
          </div>

          <div className="border-t border-slate-700 pt-4">
            <h4 className="text-[15px] font-semibold text-slate-100 mb-1">Utility &amp; rates</h4>
            <p className="text-[11.5px] text-slate-500 mb-3">All-in peak = generation + delivery.</p>
            <div className="mb-2">
              <label className="block text-[11px] text-slate-400 mb-1">Utility</label>
              <select
                value={selUtil} onChange={(e) => applyUtility(e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-slate-900/70 border border-slate-600 text-slate-100 text-[12.5px]"
              >
                <option value="SDGE">SDG&amp;E — San Diego Community Power</option>
                <option value="SMUD">SMUD — storage incentive</option>
                <option value="PGE">PG&amp;E — no community program</option>
                <option value="SCE">SCE — no community program</option>
              </select>
              {!activeProgram.verified && (
                <p className="text-[10px] text-amber-400/80 mt-1">Unverified program figures — confirm before quoting.</p>
              )}
            </div>
            <Num k="wpeak" label="Winter peak, all-in" step={0.001} suffix="$" />
            <Num k="wsop" label="Winter super off-peak" step={0.001} suffix="$" />
            <Num k="speak" label="Summer peak, all-in" step={0.001} suffix="$" />
            <Num k="ssop" label="Summer super off-peak" step={0.001} suffix="$" />
            <Num k="esc" label="Rate escalation" step={0.1} suffix="%" />
          </div>

          <div className="border-t border-slate-700 pt-4">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-[15px] font-semibold text-slate-100">CARE</h4>
              <label className="flex items-center gap-1.5 cursor-pointer text-[12px]">
                <input type="checkbox" checked={careOn} onChange={(e) => setCareOn(e.target.checked)} className="w-3.5 h-3.5 accent-cyan-400" />
                <span className={careOn ? 'text-cyan-200' : 'text-slate-500'}>{careOn ? 'Enrolled' : 'Not enrolled'}</span>
              </label>
            </div>
            <p className="text-[11.5px] text-slate-500 mb-3">
              Losing CARE raises every rate — which makes the battery worth more, not less.
            </p>
            {careOn ? (
              <>
                <Num k="care" label="Discount while enrolled" suffix="%" />
                <Num k="careEnd" label="CARE ends in" suffix="mo" />
              </>
            ) : (
              <p className="text-[11.5px] text-slate-500">
                Not on CARE — the standard rebate tier ({money(s.rebNoCare)}/kWh) applies and rates carry no discount.
              </p>
            )}
          </div>

          <div className="border-t border-slate-700 pt-4">
            <h4 className="text-[15px] font-semibold text-slate-100 mb-1">Federal credit</h4>
            <p className="text-[11.5px] text-slate-500 mb-3">
              Section 25D ended for owned systems on 31 Dec 2025. Only third-party-owned reaches the 30% via 48E,
              and it has to be in service by end of 2027.
            </p>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="text-[12px] text-slate-400 flex-1">How it&rsquo;s bought</label>
              <select value={s.path} onChange={(e) => set('path', e.target.value)}
                className="px-2 py-1 rounded bg-slate-900/70 border border-slate-600 text-slate-100 text-[12px]">
                <option value="cash">Cash or loan — no credit</option>
                <option value="tpo">Lease or PPA — 30% via 48E</option>
              </select>
            </div>
            <Num k="fed" label="Credit passed through" suffix="%" />
          </div>

          <div className="border-t border-slate-700 pt-4">
            <h4 className="text-[15px] font-semibold text-slate-100 mb-1">{activeProgram.name}</h4>
            <p className="text-[11.5px] text-slate-500 mb-3">{activeProgram.note}</p>
            <Num k="rebCare" label="Rebate, on CARE" step={25} suffix="$/kWh" />
            <Num k="rebNoCare" label="Rebate, off CARE" step={25} suffix="$/kWh" />
            <Num k="enrolled" label="Capacity enrolled" step={10} suffix="%" />
            <Num k="perf" label="Performance payment" step={0.01} suffix="$/kWh" />
            <Num k="perfYears" label="Payments run for" suffix="yr" />
            <Num k="sdcpEnd" label="Funds run out in" suffix="mo" />
          </div>

          <div className="border-t border-slate-700 pt-4">
            <h4 className="text-[15px] font-semibold text-slate-100 mb-3">Waiting</h4>
            <Num k="delay" label="Start in" suffix="mo" />
            <Num k="equip" label="Equipment/labor inflation" step={0.5} suffix="%" />
            <Num k="opp" label="Return on money not spent" step={0.5} suffix="%" />
            <Num k="horizon" label="Compare over" suffix="yr" />
          </div>
        </div>

        {/* ---- year by year ---- */}
        <div>
          <h4 className="text-[15px] font-semibold text-slate-100 mb-1">Year by year</h4>
          <p className="text-[11.5px] text-slate-500 mb-3">
            Net position = everything the battery has returned, minus what it cost, minus what that money
            would have earned sitting in an index fund.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[12px]">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  {['Year', 'Capacity', 'Bill savings', `${activeProgram.short} payment`, 'Net — now', 'Net — wait'].map((h, i) => (
                    <th key={h} className={`font-sans font-medium text-[11.5px] pb-2 ${i ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.now.rows.map((r, i) => {
                  const w = m.wait.rows[i];
                  const careYr = Math.ceil(m.careMo / 12);
                  const hl = r.y === m.now.be ? 'text-emerald-300' : (careOn && r.y === careYr ? 'text-amber-300' : '');
                  return (
                    <tr key={r.y} className={`border-b border-slate-800 ${hl}`}>
                      <td className="text-left text-slate-400 py-1">{r.y}{careOn && r.y === careYr ? ' · CARE ends' : ''}</td>
                      <td className="text-right">{r.cap ? r.cap.toFixed(1) + ' kWh' : '—'}</td>
                      <td className="text-right">{r.save ? money(r.save) : '—'}</td>
                      <td className="text-right">{r.sdcp ? money(r.sdcp) : '—'}</td>
                      <td className={`text-right ${r.net >= 0 ? 'text-emerald-300' : ''}`}>{money(r.net)}</td>
                      <td className={`text-right ${w.net >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{money(w.net)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="text-[11.5px] text-slate-500 leading-relaxed mt-5 border-t border-slate-700 pt-4 space-y-2">
            <p>
              <b className="text-slate-300">What this model does differently.</b> Splits the year 212 winter / 153
              summer days, which is 365 — not 375. Applies round-trip efficiency, so about 12% more is bought than
              discharged. Runs the performance payment on weekdays only and stops it after its term. Sets the rebate
              from program funding and CARE status on the day the project starts, not today — an exhausted fund pays
              nothing, not a lower tier.
            </p>
            <p>
              <b className="text-slate-300">What it still doesn&rsquo;t know.</b> Whether the array actually makes
              enough surplus in December to fill the battery. That is the largest source of error here — the
              Eligibility tab answers it from real interval data, and &ldquo;average daily cycle&rdquo; above is the
              manual stand-in.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TideTab;

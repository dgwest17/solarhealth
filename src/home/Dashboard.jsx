/**
 * FILE: src/home/Dashboard.jsx
 *
 * HOME — where a rep lands, and the four places they go from here.
 *
 * ---------------------------------------------------------------------------
 * EVERY FIGURE ON THIS PAGE IS REAL OR ABSENT
 *
 * The design this is built from carries numbers — 142 systems, 1.8M lbs of CO2,
 * $3.4M saved, 12.6 GWh, +18%. Those are a designer's placeholders. Hard-coding
 * them would produce a screen that looks authoritative and says nothing, and it
 * is the kind of wrong nobody checks: a rep would tell a customer "we have
 * offset 1.8 million pounds" because the tool said so.
 *
 * So every tile is computed from the endpoints the rest of the app already
 * reads, and a figure with no source renders as a dash rather than a guess.
 * The only movement shown is one that can actually be measured from our own
 * records — systems added this year, and this month's sales against last
 * month's. The reference's other percentage arrows are gone: this app keeps no
 * history of totals to compare against.
 *
 * ---------------------------------------------------------------------------
 * WHOSE NUMBERS
 *
 * /api/clients and /api/beach are both scoped on the server. An admin sees the
 * company; a rep sees their own book. The labels say which, so a rep is never
 * shown "Total systems" over a count that is only theirs.
 *
 * ---------------------------------------------------------------------------
 * THE FOUR DOORS
 *
 *   Run Energy Audit  -> the Sandbox
 *   Design System     -> the Sandbox, opened on Storage
 *   View Clients      -> the client list
 *   The Beach         -> the rep centre
 *
 * Rendered by: src/App.jsx (view === 'home')
 */
import React, { useEffect, useId, useMemo, useState } from 'react';
import { Sun, Leaf, DollarSign, Zap, LayoutGrid, Users, RefreshCw, ArrowUpRight, ArrowRight } from 'lucide-react';
import { SURF } from '../surf/theme';
import { Glass, StatTile, ActionCard, UserChip } from '../surf/Skin';
import { CardArt } from '../surf/Scenes';
import { Beach as BeachIcon } from '../surf/SurfIcons';
import { apiFetch } from '../lib/supabaseClient';

/**
 * Pounds of CO2 per kWh on the California grid — what a kWh of solar displaces.
 *
 * 0.4285 is the CAMX (WECC California) subregion's total output emission rate,
 * 428.5 lb/MWh, from the EPA's eGRID2023 summary tables (published 2025).
 *
 * The average rate, not the marginal one, on purpose: it is the lower and more
 * defensible figure. The national average (767.2 lb/MWh) is about 1.8 times
 * this, and quoting it for a California system would overstate every
 * customer's offset by 80%.
 *
 * Check it against the current eGRID release before a customer-facing campaign
 * leans on it — the grid gets cleaner every year, so this number falls.
 */
export const CO2_LBS_PER_KWH = 0.4285;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v) => '$' + Math.round(num(v)).toLocaleString();

/** Big figures, shortened the way somebody would say them out loud. */
const compact = (v) => {
  const n = num(v);
  if (n >= 1e9) return { v: (n / 1e9).toFixed(1), u: 'B' };
  if (n >= 1e6) return { v: (n / 1e6).toFixed(1), u: 'M' };
  if (n >= 1e4) return { v: String(Math.round(n / 1e3)), u: 'K' };
  return { v: Math.round(n).toLocaleString(), u: '' };
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const parse = (d) => {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t) : null;
};
const monthKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;

/** Years a system has been producing, from PTO (or install when PTO is blank). */
const yearsProducing = (c, now) => {
  const from = parse(c.ptoDate) || parse(c.installDate);
  if (!from) return 0;
  return Math.max(0, (now - from) / (365.25 * 24 * 3600 * 1000));
};

const Dashboard = ({
  userEmail = '',
  role = 'rep',
  onNavigate,
  onRole = null,
  /** Test seam: skips the fetch so the populated page can be rendered. */
  initialData = null
}) => {
  const [clients, setClients] = useState((initialData && initialData.clients) || null);
  const [deals, setDeals] = useState((initialData && initialData.deals) || null);
  const [loading, setLoading] = useState(!initialData);

  const load = async () => {
    setLoading(true);
    // Settled, not raced: one endpoint being unavailable must not blank the
    // other half of the page.
    const [c, b] = await Promise.allSettled([apiFetch('/api/clients'), apiFetch('/api/beach')]);
    if (c.status === 'fulfilled') {
      setClients(c.value.clients || []);
      if (onRole && c.value.role) onRole(c.value.role);
    } else {
      setClients(null);
    }
    setDeals(b.status === 'fulfilled' ? (b.value.deals || []) : null);
    setLoading(false);
  };

  useEffect(() => { if (!initialData) load(); /* eslint-disable-next-line */ }, []);

  const isAdmin = role === 'admin';

  /* ----------------------------- the four tiles ----------------------------- */
  const stats = useMemo(() => {
    if (!clients) return null;
    const now = new Date();
    // A SYSTEM is a record with hardware on it. The client list also holds
    // prospects with nothing installed, and counting those as systems would
    // inflate the first number on the page by the size of the prospect list.
    const systems = clients.filter((c) => num(c.systemSizeKw) > 0 || num(c.annualProduction) > 0);
    const addedThisYear = systems.filter((c) => {
      const d = parse(c.ptoDate) || parse(c.installDate);
      return d && d.getFullYear() === now.getFullYear();
    }).length;

    // Energy TO DATE: each system's annual production times the years it has
    // been producing. Physical quantities, so accumulating them is honest.
    const producing = systems.filter((c) => num(c.annualProduction) > 0 && yearsProducing(c, now) > 0);
    const kwhToDate = producing.reduce((a, c) => a + num(c.annualProduction) * yearsProducing(c, now), 0);

    // Savings stay ANNUAL. They are priced at today's utility rates, and
    // multiplying them back over past years would bill 2019 at 2026 prices.
    const withSavings = systems.filter((c) => num(c.annualSavings) > 0);
    const savingsPerYear = withSavings.reduce((a, c) => a + num(c.annualSavings), 0);

    return {
      systems: systems.length,
      addedThisYear,
      producing: producing.length,
      kwhToDate: producing.length ? kwhToDate : null,
      co2Lbs: producing.length ? kwhToDate * CO2_LBS_PER_KWH : null,
      savingsPerYear: withSavings.length ? savingsPerYear : null,
      clientCount: clients.length
    };
  }, [clients]);

  /* ------------------------- the pipeline and the month ------------------------- */
  const book = useMemo(() => {
    if (!deals) return null;
    const count = (t) => deals.filter((d) => d.tide === t).length;
    const now = new Date();
    const thisKey = monthKey(now);
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastKey = monthKey(last);

    // Contract value by the month it SOLD — signed or installed deals only.
    // A priced deal at Met has not sold.
    const byMonth = new Map();
    for (const d of deals) {
      if (d.tide === 'met') continue;
      const sold = parse(d.soldDate);
      if (!sold) continue;
      const k = monthKey(sold);
      byMonth.set(k, (byMonth.get(k) || 0) + num(d.contractValue));
    }
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: monthKey(m),
        label: m.toLocaleDateString('en-US', { month: 'short' }),
        value: byMonth.get(monthKey(m)) || 0,
        current: i === 0
      });
    }
    const thisMonth = byMonth.get(thisKey) || 0;
    const lastMonth = byMonth.get(lastKey) || 0;
    return {
      met: count('met'),
      signed: count('project'),
      installed: count('installed'),
      months,
      thisMonth,
      soldThisMonth: deals.filter((d) => d.tide !== 'met' && parse(d.soldDate)
        && monthKey(parse(d.soldDate)) === thisKey).length,
      // Only when there IS a last month to compare against. A percentage over
      // zero is either infinity or a lie.
      change: lastMonth > 0 ? (thisMonth - lastMonth) / lastMonth : null
    };
  }, [deals]);

  const go = (view) => onNavigate && onNavigate(view);
  const co2 = stats && stats.co2Lbs != null ? compact(stats.co2Lbs) : null;
  const savings = stats && stats.savingsPerYear != null ? compact(stats.savingsPerYear) : null;

  return (
    <div className="px-5 sm:px-10 pt-7 pb-12 max-w-[1180px]">
      {/* ------------------------------- the headline ------------------------------- */}
      <div className="flex items-start justify-between gap-4 skin-rise">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.34em] mb-3"
             style={{ color: 'rgba(255,255,255,.82)' }}>
            {greeting()}
          </p>
          <h1 className="font-display font-bold leading-[1.02]"
              style={{ fontSize: 'clamp(34px, 4.6vw, 60px)', color: '#fff', textShadow: '0 4px 30px rgba(0,0,0,.35)' }}>
            Build a Cleaner
            <br />
            <span style={{
              background: 'linear-gradient(90deg, #7ff0e6 0%, #3fe0d4 60%, #8fd6c0 100%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'
            }}>
              Brighter Tomorrow
            </span>
          </h1>
          <p className="text-[17px] mt-3" style={{ color: 'rgba(255,255,255,.85)' }}>
            Solar. Storage. Energy Freedom.
          </p>
          <div className="mt-5 rounded-full" style={{ width: 64, height: 3, background: SURF.sun }} />
        </div>
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg"
            style={{ background: 'rgba(0,0,0,.28)', border: '1px solid rgba(255,255,255,.18)', color: '#fff' }}
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <UserChip email={userEmail} role={role} />
        </div>
      </div>

      {/* --------------------------------- the tiles --------------------------------
          Held to the left two-thirds on a wide screen, as in the reference, so
          the wave stays in view on the right. */}
      <div className="mt-8 max-w-[900px]">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 skin-rise" style={{ animationDelay: '.08s' }}>
          <StatTile
            icon={Sun}
            label={isAdmin ? 'Total systems' : 'Your systems'}
            value={stats ? stats.systems.toLocaleString() : '—'}
            delta={stats && stats.addedThisYear > 0
              ? { up: true, label: `${stats.addedThisYear} this year` } : null}
          />
          <StatTile
            icon={Leaf}
            label="CO₂ offset"
            value={co2 ? `${co2.v}${co2.u}` : '—'}
            unit={co2 ? 'lbs' : null}
            tone="#3fe0d4"
          />
          <StatTile
            icon={DollarSign}
            label="Client savings"
            value={savings ? `$${savings.v}${savings.u}` : '—'}
            unit={savings ? '/yr' : null}
          />
          <StatTile
            icon={Zap}
            label="Clean energy"
            value={stats && stats.kwhToDate != null
              ? (stats.kwhToDate >= 1e6 ? (stats.kwhToDate / 1e6).toFixed(1) : Math.round(stats.kwhToDate / 1e3).toLocaleString())
              : '—'}
            unit={stats && stats.kwhToDate != null ? (stats.kwhToDate >= 1e6 ? 'GWh' : 'MWh') : null}
          />
        </div>

        {/* How the three derived tiles are worked out, said once, quietly. */}
        {stats && stats.producing > 0 && (
          <p className="text-[11px] mt-2 max-w-[640px]" style={{ color: 'rgba(202,228,231,.7)' }}
             title={`CO₂ at ${CO2_LBS_PER_KWH} lb/kWh — EPA eGRID2023, California average. Savings are per year at today's rates.`}>
            {isAdmin ? 'Across the book' : 'Across your book'} · energy and CO₂ to date from {stats.producing}{' '}
            system{stats.producing === 1 ? '' : 's'} with production on file · CO₂ at EPA eGRID2023 California rate
          </p>
        )}

        {/* ------------------------ the pipeline and the month ------------------------ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-3 mt-4 skin-rise" style={{ animationDelay: '.16s' }}>
          <Glass className="p-5">
            <button onClick={() => go('beach')} className="w-full flex items-center justify-between gap-3 mb-2">
              <span className="text-[17px] font-bold font-display" style={{ color: '#fff' }}>Pipeline</span>
              <span className="rounded-full flex items-center justify-center"
                    style={{ width: 28, height: 28, background: 'rgba(255,255,255,.08)', color: '#fff' }}>
                <ArrowUpRight size={15} />
              </span>
            </button>
            {book && stats ? (
              <PipelineCurve
                stages={[
                  { label: 'Clients', value: stats.clientCount },
                  { label: 'Priced', value: book.met },
                  { label: 'Signed', value: book.signed },
                  { label: 'Installed', value: book.installed }
                ]}
              />
            ) : (
              <p className="text-[13px] py-8 text-center" style={{ color: SURF.textMuted }}>
                {loading ? 'Reading the water…' : 'The pipeline could not be read just now.'}
              </p>
            )}
          </Glass>

          <Glass className="p-5">
            <button onClick={() => go('beach')} className="w-full flex items-center justify-between gap-3 mb-3">
              <span className="text-[17px] font-bold font-display" style={{ color: '#fff' }}>This Month</span>
              <ArrowRight size={17} style={{ color: '#fff' }} />
            </button>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12.5px]" style={{ color: SURF.textMuted }}>Contract value sold</div>
                <div className="font-display font-bold leading-none mt-1.5"
                     style={{ fontSize: 'clamp(28px, 3vw, 38px)', color: '#fff' }}>
                  {book ? money(book.thisMonth) : '—'}
                </div>
                <div className="text-[13px] font-semibold mt-2.5"
                     style={{ color: book && book.change != null ? (book.change >= 0 ? SURF.good : SURF.danger) : SURF.textMuted }}>
                  {book && book.change != null
                    ? `${book.change >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(book.change * 100))}% vs last month`
                    : book ? `${book.soldThisMonth} deal${book.soldThisMonth === 1 ? '' : 's'} signed` : ''}
                </div>
              </div>
              {book && <MonthBars months={book.months} />}
            </div>
          </Glass>
        </div>
      </div>

      {/* -------------------------------- the four doors -------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-4 skin-rise" style={{ animationDelay: '.24s' }}>
        <ActionCard
          icon={Sun}
          title="Run Energy Audit"
          sub="Open the sandbox"
          onClick={() => go('sandbox')}
          art={<CardArt kind="house" className="w-full h-full" />}
        />
        <ActionCard
          icon={LayoutGrid}
          title="Design System"
          sub="Straight to Storage"
          onClick={() => go('storage')}
          art={<CardArt kind="storage" className="w-full h-full" />}
        />
        <ActionCard
          icon={Users}
          title="View Clients"
          sub={isAdmin ? 'The whole book' : 'Your clients'}
          onClick={() => go('clients')}
          art={<CardArt kind="clients" className="w-full h-full" />}
        />
        <ActionCard
          icon={BeachIcon}
          title="The Beach"
          sub="Pipeline, forecast, treasure"
          onClick={() => go('beach')}
          art={<CardArt kind="beach" className="w-full h-full" />}
        />
      </div>
    </div>
  );
};

/**
 * The pipeline as a curve through the real stage counts.
 *
 * The reference draws a decorative wave. This one's heights ARE the counts —
 * square-rooted, because the first stage is the whole client list and would
 * otherwise flatten the other three into the floor. The shape still falls
 * where the numbers fall; the labels underneath carry the exact figures.
 */
const PipelineCurve = ({ stages }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const W = 420, H = 96, pad = 10;
  const max = Math.max(1, ...stages.map((s) => Math.sqrt(Math.max(0, s.value))));
  const xs = stages.map((_, i) => pad + (i * (W - pad * 2)) / (stages.length - 1));
  const ys = stages.map((s) => H - 8 - (Math.sqrt(Math.max(0, s.value)) / max) * (H - 28));
  // Smooth curve: horizontal-tangent cubic segments between the points.
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < xs.length; i++) {
    const mx = (xs[i - 1] + xs[i]) / 2;
    d += ` C ${mx} ${ys[i - 1]}, ${mx} ${ys[i]}, ${xs[i]} ${ys[i]}`;
  }
  const area = `${d} L ${xs[xs.length - 1]} ${H} L ${xs[0]} ${H} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 96 }} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}l`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3fe0d4" />
            <stop offset="60%" stopColor="#3fe0d4" />
            <stop offset="100%" stopColor="#f7c95c" />
          </linearGradient>
          <linearGradient id={`${uid}f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3fe0d4" stopOpacity=".30" />
            <stop offset="100%" stopColor="#3fe0d4" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${uid}f)`} />
        <path d={d} fill="none" stroke={`url(#${uid}l)`} strokeWidth="3" strokeLinecap="round"
              vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="grid grid-cols-4 gap-2 mt-1">
        {stages.map((s) => (
          <div key={s.label}>
            <div className="text-[12px]" style={{ color: SURF.textMuted }}>{s.label}</div>
            <div className="text-[22px] font-bold font-display leading-tight" style={{ color: '#fff' }}>
              {Number(s.value || 0).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Six months of contract value sold, this month lit. Bars are scaled to the
 * largest month shown, so an empty history draws as six stubs, not as nothing.
 */
const MonthBars = ({ months }) => {
  const max = Math.max(1, ...months.map((m) => m.value));
  return (
    <div className="flex items-end gap-1.5 shrink-0" style={{ height: 88 }} aria-label="Contract value sold, last six months">
      {months.map((m) => (
        <div key={m.key} className="flex flex-col items-center justify-end gap-1" style={{ height: '100%' }}
             title={`${m.label}: ${money(m.value)}`}>
          <div style={{
            width: 14,
            height: `${Math.max(6, (m.value / max) * 72)}px`,
            borderRadius: '4px 4px 1px 1px',
            background: m.current
              ? 'linear-gradient(180deg, #ffd36b 0%, #e8a33d 100%)'
              : 'linear-gradient(180deg, rgba(247,201,92,.75) 0%, rgba(232,163,61,.45) 100%)',
            boxShadow: m.current ? '0 0 16px -2px rgba(247,201,92,.7)' : 'none'
          }} />
          <span className="text-[9.5px]" style={{ color: 'rgba(202,228,231,.55)' }}>{m.label.slice(0, 1)}</span>
        </div>
      ))}
    </div>
  );
};

export default Dashboard;

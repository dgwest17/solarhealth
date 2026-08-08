/**
 * FILE: src/tech/WarrantyPanel.jsx
 *
 * Equipment warranty & end-of-life tracker.
 *
 * Panels and the inverter run off the SOLAR install date; the battery runs off
 * its OWN install date (Battery_Install_Date in Zoho), which on a retrofit is
 * often years later. That split is the entire reason the field exists — a 2015
 * array with a 2024 battery has one component out of coverage and another with
 * seven years left, and a single install date would report both wrong.
 *
 * Status meanings:
 *   covered   - in warranty, manufacturer still trading
 *   expiring  - under 2 years left; service/replacement conversation
 *   at-risk   - term still running but the manufacturer is gone (bankrupt or
 *               exited). A warranty from a company that no longer exists is
 *               not really a warranty.
 *   expired   - term has run out
 *
 * Rendered by: src/SolarCalculator.jsx (Audit tab)
 */
import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldOff, Clock, FileText, ArrowRightLeft } from 'lucide-react';
import { getSystemWarrantyStatus } from './warrantyData';

const STATUS_STYLE = {
  covered:  { ring: 'border-emerald-400/35 bg-emerald-900/12', text: 'text-emerald-300', Icon: ShieldCheck,  label: 'In warranty' },
  expiring: { ring: 'border-amber-400/45 bg-amber-900/15',     text: 'text-amber-300',   Icon: Clock,       label: 'Expiring soon' },
  'at-risk':{ ring: 'border-orange-400/45 bg-orange-900/15',   text: 'text-orange-300',  Icon: ShieldAlert, label: 'Manufacturer gone' },
  expired:  { ring: 'border-red-400/40 bg-red-900/15',         text: 'text-red-300',     Icon: ShieldOff,     label: 'Out of warranty' }
};

const Row = ({ title, w }) => {
  if (!w) return null;
  const st = STATUS_STYLE[w.status] || STATUS_STYLE.covered;
  const { Icon } = st;
  return (
    <div className={`rounded-lg border p-3 ${st.ring}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] font-bold text-slate-100">{title}</div>
          <div className="text-[10.5px] text-slate-400 truncate">{w.product}</div>
        </div>
        <Icon size={15} className={`${st.text} shrink-0 mt-0.5`} />
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        {w.expired ? (
          <span className={`text-lg font-extrabold ${st.text}`}>Expired {w.endYear}</span>
        ) : (
          <>
            <span className={`text-2xl font-extrabold ${st.text}`}>{w.yearsRemaining}</span>
            <span className="text-[11px] text-slate-300">
              yr{w.yearsRemaining === 1 ? '' : 's'}
              {w.monthsRemainder > 0 && `, ${w.monthsRemainder} mo`} left
            </span>
          </>
        )}
      </div>

      <div className="text-[10px] text-slate-500 mt-0.5">
        {w.termYears}-yr term from {w.installYear} · ends {w.endYear}
      </div>

      {w.note && (
        <p className="text-[10px] text-orange-300/80 mt-1.5 leading-relaxed">{w.note}</p>
      )}
      {w.needsVerification && !w.note && (
        <p className="text-[10px] text-slate-500 mt-1.5">
          Typical term — confirm against the warranty certificate.
        </p>
      )}
    </div>
  );
};

const WarrantyPanel = ({ inputs }) => {
  const solarDate = inputs.ptoDate || (inputs.installedYear
    ? `${inputs.installedYear}-${String(inputs.installedMonth || 1).padStart(2, '0')}-01`
    : null);

  if (!solarDate) return null;

  const sys = getSystemWarrantyStatus({
    solarInstallDate: solarDate,
    batteryInstallDate: inputs.batteryInstallDate || null,
    panelManufacturer: inputs.panelManufacturer || null,
    inverterManufacturer: inputs.inverterManufacturer || null,
    batteryManufacturer: inputs.hasBattery ? (inputs.batteryManufacturer || null) : null,
    program: inputs.program || null,
    extendedWarranty: !!inputs.extendedWarranty
  });

  if (!sys.summary.componentsTracked) {
    return (
      <div className="bg-slate-900/40 border border-slate-700 rounded-xl p-4 mb-6 text-[11.5px] text-slate-400">
        Add panel, inverter, or battery manufacturer above to track warranty coverage and end-of-life.
      </div>
    );
  }

  const s = sys.summary;
  const headlineTone = s.anyExpired ? 'text-red-300'
    : s.anyAtRisk ? 'text-orange-300'
    : s.anyExpiring ? 'text-amber-300'
    : 'text-emerald-300';

  return (
    <div className="bg-slate-800/50 border border-cyan-500/25 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="text-base font-bold text-cyan-300">Equipment Warranty &amp; End of Life</h3>
        <span className={`text-[11.5px] font-semibold ${headlineTone}`}>{s.headline}</span>
      </div>
      <p className="text-[11px] text-slate-500 mb-3">
        Panels and inverter date from the system turn-on
        {inputs.batteryInstallDate ? '; the battery dates from its own install' : ''}.
      </p>

      {sys.ppa && !sys.ppa.expired && (
        <div className="rounded-lg border border-blue-400/40 bg-blue-900/15 p-3 mb-3">
          <div className="flex items-start gap-2">
            <FileText size={15} className="text-blue-300 mt-0.5 shrink-0" />
            <div>
              <div className="text-[12px] font-semibold text-blue-200">
                Third-party owned — covered by your agreement for {sys.ppa.yearsRemaining} more
                year{sys.ppa.yearsRemaining === 1 ? '' : 's'} (through {sys.ppa.endYear})
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                Your provider carries maintenance and repair for the full term, whatever the component
                warranties below say. Equipment can still fail — the difference is who pays for it, and
                how quickly they respond.
              </p>
              {sys.ppa.underlyingExpiredComponents.length > 0 && (
                <p className="text-[11px] text-amber-300 mt-1.5 leading-relaxed">
                  ⚠ On buyout or at end of term you inherit the hardware with the manufacturer warranty
                  already expired on: {sys.ppa.underlyingExpiredComponents.join(', ')}.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Row title="Panels" w={sys.panel} />
        <Row title="Inverter" w={sys.inverter} />
        <Row title="Battery" w={sys.battery} />
      </div>

      {inputs.hasBattery && !inputs.batteryInstallDate && (
        <p className="text-[10.5px] text-amber-300/80 mt-3">
          No battery install date on record — the battery is being dated from the solar install,
          which understates remaining coverage on a retrofit. Add the date above for an accurate figure.
        </p>
      )}

      <div className="flex items-center gap-1.5 mt-3 text-[10.5px] text-slate-400">
        <ArrowRightLeft size={12} className="text-slate-500" />
        Warranties follow the system, not the owner — coverage transfers if the home is sold.
      </div>

      <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
        Terms are typical published US residential figures. Actual coverage varies with installer
        certification, product registration, and any extended warranty purchased at install — verify
        against the certificate before quoting.
      </p>
    </div>
  );
};

export default WarrantyPanel;

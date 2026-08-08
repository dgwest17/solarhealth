import React, { useState, useMemo, useEffect } from 'react';
import { calculateComprehensiveSavings } from './utils/calculations';
import { DEFAULT_INPUTS, DEFAULT_API_STATUS } from './constants/defaults';
import InputSection from './components/InputSection';
import ResultsDashboard from './components/ResultsDashboard';
import NEMStatusCard from './components/NEMStatusCard';
import WarrantyPanel from './tech/WarrantyPanel';
import SystemHealthAlert from './components/SystemHealthAlert';
import ChartsSection from './components/ChartsSection';
import SummaryTables from './components/SummaryTables';
import SystemScore from './components/SystemScore';
import PDFReportGenerator from './components/PDFReportGenerator';
import SaveToCRM from './components/SaveToCRM';
import { apiFetch } from './lib/supabaseClient';
import ContactFormModal from './components/ContactFormModal';
import GuideTour from './components/GuideTour';
import AINarrative from './components/AINarrative';
import { openConsultationReport } from './report/ConsultationReport';
import { deriveAnnualUsage } from './greenbutton/GreenButtonParser';
import SystemSpecsSheet from './components/SystemSpecsSheet';
import BatteryAnalysis from './battery/BatteryAnalysis';
import LoadSimulator from './simulator/LoadSimulator';
import GreenButtonUpload from './greenbutton/GreenButtonUpload';

const SolarCalculator = ({ prefilledInputs = null, clientLabel = '', onBack = null, clientContext = null, canSaveClient = false, onOpenClient = null }) => {
  // Merge Zoho data over defaults, but keep explicit nulls as EMPTY so the UI
  // shows "—" instead of a fabricated default the rep might trust.
  const mergeClient = (base, incoming) => {
    if (!incoming) return base;
    const out = { ...base };
    for (const [k, v] of Object.entries(incoming)) {
      out[k] = v === null ? '' : v;
    }
    return out;
  };
  const [inputs, setInputs] = useState(mergeClient(DEFAULT_INPUTS, prefilledInputs));
  const [dataSource, setDataSource] = useState('manual');
  const [apiStatus, setApiStatus] = useState(DEFAULT_API_STATUS);
  const [showHistoricalRates, setShowHistoricalRates] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Phase 2: AI-generated narrative (shared between the UI card and the PDF)
  const [narrative, setNarrative] = useState(null);

  // Client name shown on the printed report header
  const [clientName, setClientName] = useState(clientLabel || '');
  const [clientAddress, setClientAddress] = useState('');
  const [repName, setRepName] = useState('');

  // Tab switcher: 'audit' | 'battery' | 'simulator'
  const [activeTab, setActiveTab] = useState('audit');

  // The Load Simulator is NON-DESTRUCTIVE. It never changes currentAnnualUsage.
  // Instead it reports an additive "extra usage" result, shown as a separate
  // line on the audit + battery tabs. Baselines/profile stay static.
  const [extraUsage, setExtraUsage] = useState({ addedKwh: 0, billableKwh: 0, cost: 0, daytimePct: 0 });
  const [simLoads, setSimLoads] = useState(null);
  const [batteryRateOverride, setBatteryRateOverride] = useState(null);
  const simLoadsTimer = React.useRef(null);

  // Green Button measured profile. STATIC once applied — the authoritative
  // consumption baseline (the thing the simulator layers extra usage onto).
  const [saveClientOpen, setSaveClientOpen] = useState(false);
  const [showPersonalized, setShowPersonalized] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [contactOverride, setContactOverride] = useState(null);
  const [ratePlan, setRatePlan] = useState('standard');

  // ---- Persistence: auto-load saved Green Button profile + settings ----
  useEffect(() => {
    if (!clientContext || !clientContext.contactId) return;
    (async () => {
      try {
        const data = await apiFetch(`/api/gb-profile?contactId=${encodeURIComponent(clientContext.contactId)}`);
        if (data.settings && data.settings.ratePlan) setRatePlan(data.settings.ratePlan);
        if (data.settings && data.settings.simLoads) setSimLoads(data.settings.simLoads);
        if (data.settings && data.settings.batteryRateOverride) setBatteryRateOverride(data.settings.batteryRateOverride);
        if (data.settings && data.settings.consumptionProfile) {
          setInputs((prev) => ({ ...prev, consumptionProfile: data.settings.consumptionProfile }));
        }
        if (data.gbProfile && data.gbProfile.ok) {
          setGbProfile(data.gbProfile);
          setGbApplied(true);
          setInputs((prev) => ({ ...prev, measuredImportKwh: data.gbProfile.annualImportKwh || 0, measuredExportKwh: data.gbProfile.annualExportKwh || 0 }));
          const derived = deriveAnnualUsage(data.gbProfile, inputs.annualProduction);
          if (derived != null) setInputs((prev) => ({ ...prev, currentAnnualUsage: derived }));
          const when = data.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : 'previously';
          setGbNote({ ok: true, message: `Loaded saved measured data (uploaded ${when}). Battery figures use the meter data${derived != null ? `; Current Annual Usage set to ${derived.toLocaleString()} kWh` : ''}. Recommendation: make sure the original installed production or current annual production is correct.` });
        }
      } catch (e) { /* no saved profile or persistence not configured — silent */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientContext && clientContext.contactId]);

  const persistSimLoads = (loads) => {
    setSimLoads(loads);
    if (!(clientContext && clientContext.contactId)) return;
    if (simLoadsTimer.current) clearTimeout(simLoadsTimer.current);
    simLoadsTimer.current = setTimeout(() => {
      apiFetch('/api/gb-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: clientContext.contactId, settings: { simLoads: loads } })
      }).catch(() => {});
    }, 1200);
  };

  const persistBatteryRateOverride = (payload) => {
    setBatteryRateOverride(payload);
    if (clientContext && clientContext.contactId) {
      apiFetch('/api/gb-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: clientContext.contactId, settings: { batteryRateOverride: payload } })
      }).catch(() => {});
    }
  };

  const persistConsumptionProfile = (key) => {
    setInputs((prev) => ({ ...prev, consumptionProfile: key }));
    if (clientContext && clientContext.contactId) {
      apiFetch('/api/gb-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: clientContext.contactId, settings: { consumptionProfile: key } })
      }).catch(() => {});
    }
  };

  const persistRatePlan = (plan) => {
    setRatePlan(plan);
    if (clientContext && clientContext.contactId) {
      apiFetch('/api/gb-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: clientContext.contactId, settings: { ratePlan: plan } })
      }).catch(() => {});
    }
  };

  const sendAuditReport = () => {
    // Opens the preview tab AND returns { reportHtml, summary } for emailing.
    const html = openConsultationReport({
      clientName: (clientContext && clientContext.name) || clientName,
      clientAddress: (clientContext && clientContext.address) || clientAddress,
      repName,
      inputs, calculations, extraUsage,
      gbProfile: gbApplied ? gbProfile : null
    });
    const nem = calculations.currentNEMImpact;
    return {
      reportHtml: html,
      summary: {
        cumulativeSavings: calculations.cumulativeSavings,
        avgMonthlySavings: calculations.avgMonthlySavings,
        nemLine: nem ? (nem.type === 'credit'
          ? `Earning ~$${Math.round(nem.amount).toLocaleString()}/yr in credits`
          : `~$${Math.round(nem.amount).toLocaleString()}/yr annual true-up`) : null
      }
    };
  };

  const [gbProfile, setGbProfile] = useState(null);
  const [gbApplied, setGbApplied] = useState(false);

  const [gbNote, setGbNote] = useState(null); // rep guidance after apply

  const handleGreenButtonApply = (profile, derivedUsage) => {
    setGbProfile(profile);
    setGbApplied(true);
    // Feed measured grid flows into the true-up math.
    setInputs((prev) => ({ ...prev, measuredImportKwh: profile.annualImportKwh || 0, measuredExportKwh: profile.annualExportKwh || 0 }));
    if (clientContext && clientContext.contactId) {
      apiFetch('/api/gb-profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: clientContext.contactId, gbProfile: profile })
      }).catch(() => {});
    }
    if (derivedUsage != null) {
      // Total house consumption derived from measured grid flows + production.
      setInputs((prev) => ({ ...prev, currentAnnualUsage: derivedUsage }));
      setGbNote({
        ok: true,
        message: `Current Annual Usage overwritten with ${derivedUsage.toLocaleString()} kWh — taken from Green Button data, assuming the system is functioning properly. Battery figures now use the meter data. Recommendation: make sure the original installed production or current annual production is correct.`
      });
    } else {
      setGbNote({
        ok: false,
        message: 'Measured data applied to the battery tool only — Current Annual Usage was NOT updated because Annual Production is missing or zero. Enter the system\u2019s Annual Production above, then click "Re-apply measured data" so usage connects to the meter data.'
      });
    }
  };

  // Auto-update current date on mount
  useEffect(() => {
    const now = new Date();
    setInputs(prev => ({
      ...prev,
      nowYear: now.getFullYear(),
      nowMonth: now.getMonth() + 1
    }));
  }, []);

  const calculations = useMemo(
    () => calculateComprehensiveSavings(inputs),
    [inputs]
  );

  const handleInputChange = (field, value) => {
    setInputs(prev => ({ ...prev, [field]: value }));
    // Audit data changed — any existing narrative is now stale
    setNarrative(null);
  };

  const handleApiConnect = () => {
    setApiStatus({ connected: false, lastSync: null, error: 'Connecting...' });
    setTimeout(() => {
      if (inputs.apiKey && inputs.systemId) {
        setApiStatus({ connected: true, lastSync: new Date().toISOString(), error: null });
      } else {
        setApiStatus({ connected: false, lastSync: null, error: 'Invalid API credentials' });
      }
    }, 1500);
  };

  const handleUpdateSystem = () => {
    setIsUpdating(true);
    const now = new Date();
    setInputs(prev => ({
      ...prev,
      nowYear: now.getFullYear(),
      nowMonth: now.getMonth() + 1
    }));
    setTimeout(() => setIsUpdating(false), 1500);
  };

  return (
    <div className="app-root min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <GuideTour />
      <div className="max-w-7xl mx-auto">
        {/* Print-only report header */}
        <div className="hidden print:block mb-4 pb-3 border-b-2 border-amber-500">
          <div className="flex justify-between items-end">
            <h1 className="text-2xl font-bold text-slate-900">California Solar Audit</h1>
            <div className="text-right text-xs text-slate-600">
              {clientName && <p>Prepared for: <strong>{clientName}</strong></p>}
              <p>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </div>

        {/* Tab navigation (hidden in print) */}
        <div className="print:hidden flex gap-2 mb-6 bg-slate-900/60 p-1.5 rounded-xl border border-slate-700/50 w-fit">
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'audit'
                ? 'bg-amber-400 text-slate-900'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Financial Audit
          </button>
          <button
            onClick={() => setActiveTab('battery')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'battery'
                ? 'bg-amber-400 text-slate-900'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Battery Analysis
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              activeTab === 'simulator'
                ? 'bg-amber-400 text-slate-900'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Load Simulator
          </button>
        </div>

        {/* BATTERY ANALYSIS TAB */}
        {activeTab === 'battery' && (
          <div className="print:hidden">
            <BatteryAnalysis inputs={inputs} nemImpact={calculations.currentNEMImpact} extraUsage={extraUsage} measured={gbApplied ? gbProfile : null} calculations={calculations} rateOverride={batteryRateOverride} onRateOverrideChange={persistBatteryRateOverride} />
          </div>
        )}

        {/* LOAD SIMULATOR TAB */}
        {activeTab === 'simulator' && (
          <div className="print:hidden">
            <LoadSimulator
              baseUsage={inputs.currentAnnualUsage}
              production={inputs.annualProduction}
              utility={inputs.utility}
              currentNemImpact={calculations.currentNEMImpact}
              ratePlan={ratePlan}
              onRatePlanChange={persistRatePlan}
              onExtraUsageChange={setExtraUsage}
              initialLoads={simLoads}
              onLoadsChange={persistSimLoads}
            />
          </div>
        )}

        {/* FINANCIAL AUDIT TAB */}
        <div style={{ display: activeTab === 'audit' ? 'block' : 'none' }}>
        <div className="print:hidden">
        {clientContext && (() => {
          const need = [
            [!inputs.systemSize, 'system size'],
            [!inputs.annualProduction, 'annual production'],
            [!inputs.currentAnnualUsage, 'current usage'],
            [!inputs.utility, 'utility'],
            [!inputs.nemVersion, 'NEM version'],
            [!inputs.program, 'financing type'],
            [!inputs.installedYear, 'PTO / install date']
          ].filter(([missing]) => missing).map(([, label]) => label);
          if (!need.length) return null;
          return (
            <div className="mb-4 print:hidden bg-amber-900/20 border border-amber-400/40 rounded-lg px-4 py-2.5 text-sm text-amber-200">
              <span className="font-semibold">Missing from the CRM:</span> {need.join(' · ')}.
              <span className="text-amber-300/70"> Fill these in below and hit Save to CRM — blanks show as “—” rather than guesses.</span>
            </div>
          );
        })()}

        {clientContext && clientContext.name && (
          <div className="mb-4 print:hidden flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-100 flex items-center gap-2">
                {(contactOverride && contactOverride.name) || clientContext.name}
                {clientContext.contact && (
                  <button
                    type="button"
                    onClick={() => setEditContactOpen(true)}
                    className="text-sm font-normal text-slate-500 hover:text-amber-300 border border-slate-700 rounded-lg px-2 py-1"
                    title="Edit client info (name, address, phone, email, review)"
                  >✎ Edit info</button>
                )}
              </h1>
              {((contactOverride && contactOverride.address) || clientContext.address) && (
                <p className="text-sm text-slate-400 mt-0.5">{(contactOverride && contactOverride.address) || clientContext.address}</p>
              )}
            </div>
            <div className="flex gap-2 items-end">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Project Status</label>
                <select
                  value={inputs.projectStatus || ''}
                  onChange={(e) => handleInputChange('projectStatus', e.target.value)}
                  className="px-2 py-1.5 text-xs rounded-lg bg-slate-800/80 border border-slate-600 text-slate-200"
                >
                  <option value="">— not set —</option>
                  {['Pre-PTO', 'PTO-Approved', 'Service Client', 'Battery Installed', 'HVAC Installed', 'Abandoned', 'Cancelled/Lost'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Opportunity</label>
                <select
                  value={inputs.opportunityType || ''}
                  onChange={(e) => handleInputChange('opportunityType', e.target.value)}
                  className="px-2 py-1.5 text-xs rounded-lg bg-slate-800/80 border border-slate-600 text-slate-200"
                >
                  <option value="">Audit / Review (default)</option>
                  {['New Solar Install','Solar Owner – Add Battery','Solar Owner – Audit / Review','Solar Owner – Service / Repair','Solar Owner – Under Service Plan','HVAC Only (future-proofing)','Other'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {editContactOpen && clientContext && clientContext.contact && (
          <ContactFormModal
            mode="edit"
            initial={contactOverride ? { ...clientContext.contact, ...contactOverride.raw } : clientContext.contact}
            onClose={() => setEditContactOpen(false)}
            onSaved={(_result, updated) => {
              setEditContactOpen(false);
              const u = { ...clientContext.contact, ...(updated || {}) };
              setContactOverride({
                raw: updated || {},
                name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.fullName || clientContext.name,
                address: [u.street, u.city, u.state, u.zip].filter(Boolean).join(', ')
              });
            }}
          />
        )}

        <SaveToCRM inputs={inputs} clientContext={clientContext} clientLabel={clientLabel} onSendAudit={sendAuditReport} />

        {!clientContext && canSaveClient && (
          <div className="print:hidden mb-4 flex justify-end">
            <button
              onClick={() => setSaveClientOpen(true)}
              className="px-5 py-2 rounded-lg font-semibold text-sm bg-emerald-500 hover:bg-emerald-400 text-[#0a1628] flex items-center gap-2"
              title="Save this sandbox audit as a new client in your CRM"
            >
              + Save Client
            </button>
          </div>
        )}

        {saveClientOpen && (
          <ContactFormModal
            mode="create"
            auditInputs={inputs}
            onClose={() => setSaveClientOpen(false)}
            onSaved={(result) => {
              setSaveClientOpen(false);
              if (result && result.contactId && onOpenClient) onOpenClient(result.contactId);
            }}
          />
        )}

        <InputSection
          inputs={inputs}
          onInputChange={handleInputChange}
          dataSource={dataSource}
          setDataSource={setDataSource}
          apiStatus={apiStatus}
          onApiConnect={handleApiConnect}
          calculations={calculations}
          onUpdate={handleUpdateSystem}
          isUpdating={isUpdating}
          ratePlan={ratePlan}
          onRatePlanChange={persistRatePlan}
          gbApplied={gbApplied}
          systemLocked={clientContext && clientContext.viewerRole === 'client'}
        />

        {/* Green Button measured data — upload + apply */}
        <GreenButtonUpload
          utility={inputs.utility}
          annualProduction={inputs.annualProduction}
          onApply={handleGreenButtonApply}
          applied={gbApplied}
        />
        {gbNote && (
          <div className={`print:hidden -mt-3 mb-6 rounded-lg border p-3 text-sm ${
            gbNote.ok ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-200' : 'bg-amber-500/10 border-amber-400/50 text-amber-200'
          }`}>
            {gbNote.ok ? '✓ ' : '⚠ '}{gbNote.message}
          </div>
        )}
        </div>

        {/* Sections render in natural source order. In print, page breaks
            (.print-break-before) split them into the client-facing PDF pages
            without affecting the on-screen layout. */}

        {/* System Score */}
        <SystemScore
          calculations={calculations}
          inputs={inputs}
        />

        {/* NEM Analysis */}
        <NEMStatusCard
          currentNEMImpact={calculations.currentNEMImpact}
          nemVersion={inputs.nemVersion}
          nemExpiry={calculations.nemExpiry}
          cumulativeNEMCredits={calculations.cumulativeNEMCredits}
          cumulativeTrueUpCharges={calculations.cumulativeTrueUpCharges}
        />

        {/* Equipment warranty / EOL — uses battery's own install date when present */}
        <WarrantyPanel inputs={inputs} />

        {/* Extra Usage True-Up — from the Load Simulator, shown SEPARATELY so it
            never alters the real current true-up/credit above. */}
        {extraUsage && extraUsage.cost > 0 && (
          <div className="bg-red-500/10 border-2 border-red-400/40 rounded-xl p-5 mb-6 flex items-center justify-between print:hidden">
            <div>
              <div className="text-xs uppercase tracking-wider text-red-300 flex items-center gap-1.5 mb-1">
                ⚡ Extra Usage True-Up (from Load Simulator)
              </div>
              <p className="text-sm text-slate-300">
                {extraUsage.addedKwh.toLocaleString()} kWh of added load · {extraUsage.billableKwh.toLocaleString()} kWh billed at time-of-use
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-red-400">
                −${Math.round(extraUsage.cost).toLocaleString()}<span className="text-sm font-normal text-slate-400">/yr</span>
              </div>
              <div className="text-[11px] text-slate-500">on top of your current position</div>
            </div>
          </div>
        )}

        {/* Savings/Payback summary (the 4 KPI cards) — last thing on PDF page 1 */}
        <ResultsDashboard calculations={calculations} />

        {/* AI Narrative — on screen only, excluded from the PDF (print:hidden) */}
        <div className="print:hidden">
        </div>

        {/* PDF: hidden (config UI, not for clients) */}
        <PDFReportGenerator
          clientName={clientName}
          setClientName={setClientName}
          clientAddress={clientAddress}
          setClientAddress={setClientAddress}
          repName={repName}
          setRepName={setRepName}
          inputs={inputs}
          calculations={calculations}
          extraUsage={extraUsage}
          gbProfile={gbApplied ? gbProfile : null}
          onTogglePersonalized={() => setShowPersonalized((v) => !v)}
        />

        {showPersonalized && (
          <AINarrative inputs={inputs} calculations={calculations} narrative={narrative} onNarrativeGenerated={setNarrative} />
        )}

        {/* Charts — priority two on page 1, rest flow to page 2 (handled in print CSS) */}
        <ChartsSection
          yearlyData={calculations.yearlyData}
          inputs={inputs}
          showHistoricalRates={showHistoricalRates}
          setShowHistoricalRates={setShowHistoricalRates}
        />

        {/* PDF page 2: Financial Summary + System Metrics */}
        <SummaryTables calculations={calculations} inputs={inputs} />

        {/* PDF page 3: System Specifications (print-only, has its own page break) */}
        <SystemSpecsSheet inputs={inputs} />

        <div className="print:hidden bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4 text-sm text-cyan-300/80">
          <p className="font-semibold mb-2 text-cyan-400">Data Sources:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Utility rates: CPUC reports with updated 2025 rates (PG&E: $0.48/kWh, SDG&E: $0.52/kWh, SCE: $0.314/kWh)</li>
            <li>NEM calculations: Retail rate (NEM 1.0), wholesale rate (NEM 2.0), reduced rate (NEM 3.0)</li>
            <li>CARE Program: 30% discount applied to all utility rates</li>
            <li>Performance: California average 1400 kWh/kW/year</li>
          </ul>
        </div>
        </div>
      </div>
    </div>
  );
};

export default SolarCalculator;

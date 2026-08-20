/**
 * POST /api/save-project — Write-back A.
 *
 * Saves audit edits to the client's Solar_Project record in Zoho.
 *
 * Security model (v1):
 *   - ADMIN ONLY. Clients and reps get 403. (Rep write access arrives with
 *     ownership stamping in write-back B.)
 *   - Ownership check: the project is fetched first and must belong to the
 *     provided contactId — prevents writing to an arbitrary record id.
 *   - Field whitelist: only the mapped audit fields below can ever be
 *     written. Anything else in the payload is ignored.
 *
 * Install_Date is written as YYYY-MM-01 (year+month only; day is always 01
 * so a session reload can't lose the install year). Equipment picklists
 * (Battery_Manufacturer, Inverter_Type) are matched against Zoho's accepted
 * values before writing so an unknown value never errors the whole update.
 */
import { zohoFetch } from './_zoho.js';
import { requireUser, sendError } from './_auth.js';

const UTILITY_TO_ZOHO = { SDGE: 'SDG&E', PGE: 'PG&E', SCE: 'SCE', SMUD: 'SMUD' };
const NEM_TO_ZOHO = { NEM1: 'NEM 1.0', NEM2: 'NEM 2.0', NEM3: 'NEM 3.0' };

function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
function int(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }

/** Map audit inputs -> whitelisted Zoho Solar_Projects fields. */
function mapInputsToZoho(inputs) {
  const out = {};
  const sz = num(inputs.systemSize); if (sz != null) out.System_Size_kW = sz;
  const prod = int(inputs.annualProduction); if (prod != null) out.Annual_System_Production = prod;
  const uai = int(inputs.annualUsageAtInstall); if (uai != null) out.Annual_Usage_at_Install_kWh = uai;
  const cur = int(inputs.currentAnnualUsage); if (cur != null) out.Current_Annual_Usage_kWh = cur;
  if (inputs.utility && UTILITY_TO_ZOHO[inputs.utility]) out.Utility_Provider = UTILITY_TO_ZOHO[inputs.utility];
  if (inputs.nemVersion && NEM_TO_ZOHO[inputs.nemVersion]) out.NEM_Version = NEM_TO_ZOHO[inputs.nemVersion];
  const exp = num(inputs.exportRate); if (exp != null) out.Export_Rate = exp;
  if (typeof inputs.onCareProgram === 'boolean') out.On_CARE_Program = inputs.onCareProgram;
  if (inputs.hasBattery) {
    const cap = num(inputs.batteryCapacity);
    if (cap != null) out.Battery_Capacity_kWh = cap;
  }

  // ---- Install/turn-on date (THE revert bug) ----
  // The audit only knows year + month. Reconstruct a stable YYYY-MM-01 so the
  // year survives a session reload. Never write a fabricated day-of-month.
  // We write Install_Date (not PTO_Date) — client.js prefers PTO, falls back to
  // Install_Date, so this fills the fallback without clobbering a real PTO date.
  const iy = int(inputs.installedYear);
  const im = int(inputs.installedMonth);
  if (iy != null && iy >= 2000 && iy <= 2100) {
    const mm = (im != null && im >= 1 && im <= 12) ? im : 1;
    out.Install_Date = `${iy}-${String(mm).padStart(2, '0')}-01`;
  }

  // ---- Battery install date (separate from solar Install_Date) ----
  // Retrofits land years after the array; NEM 3.0 installs are usually same-day.
  // Tracking them apart is what makes warranty/EOL and retrofit campaigns work.
  if (typeof inputs.batteryInstallDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inputs.batteryInstallDate)) {
    out.Battery_Install_Date = inputs.batteryInstallDate;
  }

  // ---- Potential extra usage (Load Simulator rollup) ----
  // Written on explicit Save only, so the CRM audit trail stays readable.
  const peu = num(inputs.potentialExtraUsageKwh);
  if (peu != null && peu >= 0) out.Potential_Extra_Usage_kWh = Math.round(peu);
  if (typeof inputs.potentialExtraUsageNote === 'string') {
    const n = inputs.potentialExtraUsageNote.trim().slice(0, 255);
    if (n) out.Potential_Extra_Usage_Note = n;
  }

  // ---- Equipment (all verified writable in Zoho 2026-07) ----
  // Installer + panel model are free text.
  if (typeof inputs.installer === 'string') {
    const v = inputs.installer.trim().slice(0, 255);
    if (v) out.Install_Company = v;
  }
  if (typeof inputs.panelManufacturer === 'string') {
    const v = inputs.panelManufacturer.trim().slice(0, 255);
    if (v) out.Panel_Model = v;
  }
  // Battery manufacturer + inverter are RESTRICTED picklists — only write a
  // value Zoho already accepts, or the update errors. Case-normalized to match.
  const BATTERY_MAKERS = ['Tesla', 'Franklin', 'Enphase', 'Solaredge', 'Generac', 'Other', 'NONE'];
  const INVERTER_TYPES = ['Enphase', 'Solaredge', 'Tesla', 'Solark', 'Sunpower', 'SMA', 'Other'];
  // The UI stores slugs ('tesla_inv', 'other_battery'); Zoho picklists want exact
  // labels ('Tesla', 'Other'). Without this map those writes are silently dropped
  // and the field appears to "revert" on the next session.
  const SLUG_TO_ZOHO = {
    enphase: 'Enphase', solaredge: 'Solaredge', sma: 'SMA',
    tesla_inv: 'Tesla', generac_inv: 'Other', fronius: 'Other',
    apsystems: 'Other', delta: 'Other', other_inverter: 'Other',
    solark: 'Solark', sunpower: 'Sunpower',
    tesla_pw: 'Tesla', enphase_bat: 'Enphase', franklinwh: 'Franklin',
    generac_pwr: 'Generac', sonnen: 'Other', lg_ess: 'Other',
    panasonic_ev: 'Other', other_battery: 'Other'
  };

  const matchPick = (val, list) => {
    if (typeof val !== 'string' || !val.trim()) return null;
    const raw = val.trim();
    const mapped = SLUG_TO_ZOHO[raw.toLowerCase()];
    if (mapped && list.includes(mapped)) return mapped;
    const hit = list.find((o) => o.toLowerCase() === raw.toLowerCase());
    return hit || null;
  };
  const bm = matchPick(inputs.batteryManufacturer, BATTERY_MAKERS);
  if (bm) out.Battery_Manufacturer = bm;
  const iv = matchPick(inputs.inverterManufacturer, INVERTER_TYPES);
  if (iv) out.Inverter_Type = iv;
  const nm = int(inputs.numberOfModules);
  if (nm != null && nm > 0) out.Number_of_Modules = nm;

  // ---- Financial product (verified writable in Zoho 2026-07) ----
  // Purchase_Type is an unrestricted picklist; only known programs written.
  if (['Cash', 'Loan', 'PPA'].includes(inputs.program)) {
    out.Purchase_Type = inputs.program;
  }
  // Verified picklists (pulled live 2026-07-15)
  const OK_STATUS = ['Pre-PTO', 'PTO-Approved', 'Service Client', 'Battery Installed', 'HVAC Installed', 'Abandoned', 'Cancelled/Lost'];
  const OK_OPP = ['New Solar Install', 'Solar Owner – Add Battery', 'Solar Owner – Audit / Review', 'Solar Owner – Service / Repair', 'Solar Owner – Under Service Plan', 'HVAC Only (future-proofing)', 'Other'];
  if (OK_STATUS.includes(inputs.projectStatus)) out.Project_Status = inputs.projectStatus;
  if (OK_OPP.includes(inputs.opportunityType)) out.Opportunity_Type = inputs.opportunityType;
  // Finance Provider is a free-text field in Zoho — trim and cap at field length.
  if (typeof inputs.financeProvider === 'string') {
    const fp = inputs.financeProvider.trim().slice(0, 255);
    if (fp) out.Finance_Provider = fp;
  }
  {
    const term = int(inputs.loanTerm);
    const rate = num(inputs.loanInterestRate);
    const esc = num(inputs.escalator);
    if (inputs.program === 'Loan') {
      const principal = num(inputs.loanPrincipal);
      if (principal != null && principal > 0) out.Contract_Value = principal;
      if (term != null && term > 0) out.Term = term; // stored in YEARS
      if (rate != null && rate > 0) out.Escalator_or_Interest = rate;
    } else if (inputs.program === 'Cash') {
      const gross = num(inputs.cashGrossCost);
      if (gross != null && gross > 0) out.Contract_Value = gross;
    } else if (inputs.program === 'PPA') {
      // 0% is a real escalator value, so accept >= 0 rather than truthy.
      if (esc != null && esc >= 0) out.Escalator_or_Interest = esc;
      if (term != null && term > 0) out.Term = term;
    }

    // Monthly payment — the figure the client actually recognises off their
    // statement. Nothing was writing this, so it came back null on every
    // reload no matter how many times a rep entered it.
    const pay = num(
      inputs.program === 'PPA'
        ? (inputs.ppaCurrentPayment != null && inputs.ppaCurrentPayment !== ''
            ? inputs.ppaCurrentPayment
            : inputs.monthlyPayment)
        : (inputs.loanInitialPayment != null && inputs.loanInitialPayment !== ''
            ? inputs.loanInitialPayment
            : inputs.monthlyPayment)
    );
    if (pay != null && pay >= 0) out.Monthly_Payment = pay;
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireUser(req);

    // v1: admin only. Reps get write access with ownership in a later phase.
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Saving to the CRM is limited to admins for now.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { contactId, projectId, inputs } = body;
    if (!contactId || !projectId || !inputs) {
      return res.status(400).json({ error: 'contactId, projectId, and inputs are required.' });
    }

    // Ownership check: the project must belong to this contact.
    const projRes = await zohoFetch(`/crm/v2/Solar_Projects/${encodeURIComponent(projectId)}`);
    const project = projRes.data && projRes.data[0];
    if (!project) {
      return res.status(404).json({ error: 'Project not found in Zoho.' });
    }
    const linkedContact = project.Contact && (project.Contact.id || project.Contact);
    if (String(linkedContact) !== String(contactId)) {
      return res.status(403).json({ error: 'Project does not belong to this client.' });
    }

    // Whitelisted mapping only.
    const fields = mapInputsToZoho(inputs);
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'No writable fields in payload.' });
    }

    const result = await zohoFetch(`/crm/v2/Solar_Projects/${encodeURIComponent(projectId)}`, {
      method: 'PUT',
      body: JSON.stringify({ data: [{ id: projectId, ...fields }] })
    });

    const status = result.data && result.data[0];
    if (!status || status.code !== 'SUCCESS') {
      return res.status(502).json({
        error: `Zoho rejected the update: ${status ? status.message || status.code : 'unknown response'}`
      });
    }

    res.status(200).json({
      ok: true,
      projectId,
      updatedFields: Object.keys(fields),
      message: `Saved ${Object.keys(fields).length} fields to Zoho.`
    });
  } catch (e) {
    sendError(res, e);
  }
}

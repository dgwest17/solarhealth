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
 * Deliberately NOT written in v1:
 *   - Install_Date: the audit only knows year+month; writing a reconstructed
 *     day would corrupt the real install date.
 *   - Purchase_Type / Monthly_Payment / contract fields: picklist values not
 *     yet verified against your Zoho; writing unverified picklists can error
 *     or pollute the picklist. Add after confirming values.
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
      if (esc != null && esc >= 0) out.Escalator_or_Interest = esc;
    }
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

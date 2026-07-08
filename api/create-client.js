/**
 * POST /api/create-client — "Save Client" from the sandbox.
 * Creates a new Contact + linked Solar_Project from the sandbox audit.
 * Admin only in v1 (reps gain this with ownership stamping in write-back B).
 */
import { zohoFetch } from './_zoho.js';
import { requireUser, sendError } from './_auth.js';

const UTILITY_TO_ZOHO = { SDGE: 'SDG&E', PGE: 'PG&E', SCE: 'SCE', SMUD: 'SMUD' };
const NEM_TO_ZOHO = { NEM1: 'NEM 1.0', NEM2: 'NEM 2.0', NEM3: 'NEM 3.0' };
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    if (user.role !== 'admin' && user.role !== 'rep') return res.status(403).json({ error: 'Saving new clients requires an admin or rep login.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { contact = {}, inputs = {} } = body;
    if (!contact.lastName || !String(contact.lastName).trim()) {
      return res.status(400).json({ error: 'Last name is required.' });
    }

    // 1) Create the Contact
    const contactFields = {
      Last_Name: String(contact.lastName).trim(),
      First_Name: (contact.firstName || '').trim(),
      Email: (contact.email || '').trim() || null,
      Phone: (contact.phone || '').trim() || null,
      Mailing_Street: (contact.street || '').trim() || null,
      Mailing_City: (contact.city || '').trim() || null,
      Mailing_State: (contact.state || '').trim() || null,
      Mailing_Zip: (contact.zip || '').trim() || null,
      Send_Annual_Report: !!contact.sendAnnualReport
    };
    // Rep ownership stamp — lets reps see their own leads on the dashboard.
    // If the Created_By_Rep field doesn't exist in Zoho yet, retry without it.
    let repStampWarning = null;
    if (user.role === 'rep' || user.role === 'admin') {
      contactFields.Created_By_Rep = (user.email || '').toLowerCase();
    }
    let cRes = await zohoFetch('/crm/v2/Contacts', {
      method: 'POST',
      body: JSON.stringify({ data: [contactFields] })
    });
    let cStatus = cRes.data && cRes.data[0];
    if (cStatus && cStatus.code !== 'SUCCESS' && contactFields.Created_By_Rep) {
      delete contactFields.Created_By_Rep;
      repStampWarning = 'Created_By_Rep field missing in Zoho — lead saved without rep stamp. Add a single-line field with API name Created_By_Rep to Contacts.';
      cRes = await zohoFetch('/crm/v2/Contacts', {
        method: 'POST',
        body: JSON.stringify({ data: [contactFields] })
      });
      cStatus = cRes.data && cRes.data[0];
    }
    if (!cStatus || cStatus.code !== 'SUCCESS') {
      return res.status(502).json({ error: `Zoho rejected the contact: ${cStatus ? cStatus.message || cStatus.code : 'unknown'}` });
    }
    const contactId = cStatus.details.id;

    // 2) Create the linked Solar_Project from the sandbox audit
    const projectFields = {
      Name: `${contactFields.First_Name ? contactFields.First_Name + ' ' : ''}${contactFields.Last_Name} System`.trim(),
      Contact: contactId
    };
    const sz = num(inputs.systemSize); if (sz != null) projectFields.System_Size_kW = sz;
    const prod = int(inputs.annualProduction); if (prod != null) projectFields.Annual_System_Production = prod;
    const uai = int(inputs.annualUsageAtInstall); if (uai != null) projectFields.Annual_Usage_at_Install_kWh = uai;
    const cur = int(inputs.currentAnnualUsage); if (cur != null) projectFields.Current_Annual_Usage_kWh = cur;
    if (inputs.utility && UTILITY_TO_ZOHO[inputs.utility]) projectFields.Utility_Provider = UTILITY_TO_ZOHO[inputs.utility];
    if (inputs.nemVersion && NEM_TO_ZOHO[inputs.nemVersion]) projectFields.NEM_Version = NEM_TO_ZOHO[inputs.nemVersion];
    const exp = num(inputs.exportRate); if (exp != null) projectFields.Export_Rate = exp;
    if (typeof inputs.onCareProgram === 'boolean') projectFields.On_CARE_Program = inputs.onCareProgram;
    if (inputs.hasBattery) { const cap = num(inputs.batteryCapacity); if (cap != null) projectFields.Battery_Capacity_kWh = cap; }
    // Financial product (verified writable fields)
    if (['Cash', 'Loan', 'PPA'].includes(inputs.program)) {
      projectFields.Purchase_Type = inputs.program;
      const term = int(inputs.loanTerm);
      const rate = num(inputs.loanInterestRate);
      const esc = num(inputs.escalator);
      if (inputs.program === 'Loan') {
        const principal = num(inputs.loanPrincipal);
        if (principal != null && principal > 0) projectFields.Contract_Value = principal;
        if (term != null && term > 0) projectFields.Term = term; // YEARS
        if (rate != null && rate > 0) projectFields.Escalator_or_Interest = rate;
      } else if (inputs.program === 'Cash') {
        const gross = num(inputs.cashGrossCost);
        if (gross != null && gross > 0) projectFields.Contract_Value = gross;
      } else if (inputs.program === 'PPA') {
        if (esc != null && esc >= 0) projectFields.Escalator_or_Interest = esc;
      }
    }

    // New record → safe to write Install_Date from year/month (day defaults to 1st)
    const iy = int(inputs.installedYear); const im = int(inputs.installedMonth);
    if (iy && im) projectFields.Install_Date = `${iy}-${String(im).padStart(2, '0')}-01`;

    const pRes = await zohoFetch('/crm/v2/Solar_Projects', {
      method: 'POST',
      body: JSON.stringify({ data: [projectFields] })
    });
    const pStatus = pRes.data && pRes.data[0];
    if (!pStatus || pStatus.code !== 'SUCCESS') {
      return res.status(502).json({
        error: `Contact created (id ${contactId}) but Zoho rejected the project: ${pStatus ? pStatus.message || pStatus.code : 'unknown'}`,
        contactId
      });
    }
    res.status(200).json({ ok: true, contactId, projectId: pStatus.details.id, message: 'Client and system saved to Zoho.', warning: repStampWarning });
  } catch (e) { sendError(res, e); }
}

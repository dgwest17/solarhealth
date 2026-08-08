/**
 * GET /api/client?id=<contactId>
 * Returns one Contact + their linked Solar_Projects, mapped into the
 * input shape the audit engine (calculations.js / DEFAULT_INPUTS) expects.
 *
 * Security: a 'client' role may ONLY fetch the contact whose Email matches
 * their login. Admin may fetch anyone. Enforced server-side below.
 *
 * Read-only.
 */
import { zohoFetch } from './_zoho.js';
import { requireUser, sendError } from './_auth.js';

// Map Zoho Utility_Provider picklist -> audit engine utility keys
const UTILITY_MAP = {
  'PG&E': 'PGE', 'PGE': 'PGE',
  'SCE': 'SCE',
  'SDG&E': 'SDGE', 'SDGE': 'SDGE',
  'SMUD': 'SMUD',
  'LADWP': 'SCE', // no LADWP model yet; fall back so math still runs
  'IID': 'SCE'
};
const NEM_MAP = {
  'NEM 1.0': 'NEM1', 'NEM1': 'NEM1',
  'NEM 2.0': 'NEM2', 'NEM2': 'NEM2',
  'NEM 3.0': 'NEM3', 'NEM3': 'NEM3'
};
const PURCHASE_MAP = {
  'Cash': 'Cash', 'PPA': 'PPA', 'Lease': 'PPA', 'Loan': 'Loan', 'Hybrid': 'Loan'
};

function num(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseYearMonth(dateStr) {
  // Zoho dates are YYYY-MM-DD
  if (!dateStr) return { year: null, month: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return { year: null, month: null };
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireUser(req);
    const contactId = (req.query.id || '').trim();
    if (!contactId) {
      return res.status(400).json({ error: 'Missing client id' });
    }

    // Fetch the contact
    const contactRes = await zohoFetch(`/crm/v2/Contacts/${encodeURIComponent(contactId)}`);
    const contact = (contactRes.data && contactRes.data[0]) || null;
    if (!contact) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // SECURITY: enforce per-role access.
    //  - admin: any contact
    //  - rep:   only the designated test client (REP_TEST_CLIENT_EMAIL)
    //  - client: only the contact whose email matches their login
    if (user.role !== 'admin') {
      const contactEmail = (contact.Email || '').toLowerCase();
      let allowed = false;
      if (user.role === 'rep') {
        const testEmail = (process.env.REP_TEST_CLIENT_EMAIL || '').toLowerCase();
        allowed = testEmail && contactEmail === testEmail;
      } else {
        allowed = contactEmail === user.email;
      }
      if (!allowed) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }
    }

    // Fetch linked Solar_Projects via COQL on the Contact lookup
    const projQuery = `select id, Name, System_Size_kW, Annual_System_Production, ` +
      `Annual_Usage_at_Install_kWh, Current_Annual_Usage_kWh, Utility_Provider, ` +
      `NEM_Version, Export_Rate, On_CARE_Program, Battery_Capacity_kWh, ` +
      `Monthly_Payment, Term, Escalator_or_Interest, Purchase_Type, ` +
      `Contract_Value, Install_Date, PTO_Date, Project_Status, Opportunity_Type, Finance_Provider, Install_Company, ` +
      `Battery_Install_Date, Potential_Extra_Usage_kWh, Potential_Extra_Usage_Note, ` +
      `Battery_Manufacturer, Inverter_Type, Number_of_Modules, Panel_Model ` +
      `from Solar_Projects where Contact = ${contactId}`;

    let projects = [];
    try {
      const projRes = await zohoFetch('/crm/v2/coql', {
        method: 'POST',
        body: JSON.stringify({ select_query: projQuery })
      });
      projects = projRes.data || [];
    } catch (e) {
      // No projects is fine — return contact with empty project
      projects = [];
    }

    const primary = projects[0] || {};
    // Turn-on date: PTO is the truth; fall back to Install_Date when PTO is blank.
    const install = parseYearMonth(primary.PTO_Date) || parseYearMonth(primary.Install_Date) || {};
    const dateSource = primary.PTO_Date ? 'pto' : (primary.Install_Date ? 'install' : null);

    // Map into the audit engine input shape (mirrors DEFAULT_INPUTS keys)
    // Empty in Zoho stays EMPTY here (null) — the tool shows "—" and the rep
    // fills it in. Never invent a default that looks like real client data.
    const orNull = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const auditInputs = {
      projectStatus: primary.Project_Status || '',
      opportunityType: primary.Opportunity_Type || '',
      financeProvider: primary.Finance_Provider || '',
      installCompany: primary.Install_Company || '',
      panelModel: primary.Panel_Model || '',
      batteryManufacturer: primary.Battery_Manufacturer && primary.Battery_Manufacturer !== 'NONE' ? primary.Battery_Manufacturer : '',
      inverterType: primary.Inverter_Type || '',
      numberOfModules: orNull(primary.Number_of_Modules),
      ptoDate: primary.PTO_Date || null,
      batteryInstallDate: primary.Battery_Install_Date || null,
      potentialExtraUsageKwh: orNull(primary.Potential_Extra_Usage_kWh),
      potentialExtraUsageNote: primary.Potential_Extra_Usage_Note || '',
      installedYear: install.year || null,
      installedMonth: install.month || null,
      installDateSource: dateSource,
      utility: UTILITY_MAP[primary.Utility_Provider] || '',
      systemSize: orNull(primary.System_Size_kW),
      annualUsageAtInstall: orNull(primary.Annual_Usage_at_Install_kWh),
      currentAnnualUsage: orNull(primary.Current_Annual_Usage_kWh),
      annualProduction: orNull(primary.Annual_System_Production),
      program: PURCHASE_MAP[primary.Purchase_Type] || '',
      nemVersion: NEM_MAP[primary.NEM_Version] || '',
      exportRate: orNull(primary.Export_Rate),
      onCareProgram: !!primary.On_CARE_Program,
      // Battery presence is DERIVED, never a separate stored flag — a third
      // boolean would create a state where the three fields disagree.
      hasBattery: (orNull(primary.Battery_Capacity_kWh) || 0) > 0 || !!primary.Battery_Install_Date,
      batteryCapacity: orNull(primary.Battery_Capacity_kWh),
      monthlyPayment: orNull(primary.Monthly_Payment),
      loanInitialPayment: orNull(primary.Monthly_Payment),
      contractValue: orNull(primary.Contract_Value)
    };

    // ---- Financial product round-trip (Zoho -> audit inputs) ----
    // Term is stored in YEARS (e.g. 25). Guard: values > 50 are months.
    const rawTerm = num(primary.Term, 0);
    if (rawTerm > 0) auditInputs.loanTerm = rawTerm > 50 ? Math.round(rawTerm / 12) : Math.round(rawTerm);
    const rawRate = num(primary.Escalator_or_Interest, 0);
    const rawValue = num(primary.Contract_Value, 0);
    if (auditInputs.program === 'Loan') {
      if (rawValue > 0) auditInputs.loanPrincipal = rawValue;
      if (rawRate > 0) auditInputs.loanInterestRate = rawRate;
    } else if (auditInputs.program === 'PPA') {
      if (rawRate > 0) auditInputs.escalator = rawRate;
    } else if (auditInputs.program === 'Cash' && rawValue > 0) {
      auditInputs.cashGrossCost = rawValue;
      auditInputs.taxCredit = Math.round(rawValue * 0.30);
      auditInputs.cashNetCost = Math.round(rawValue * 0.70);
    }

    res.status(200).json({
      role: user.role,
      contact: {
        id: contact.id,
        firstName: contact.First_Name || '',
        lastName: contact.Last_Name || '',
        fullName: contact.Full_Name || '',
        email: contact.Email || '',
        phone: contact.Phone || '',
        street: contact.Mailing_Street || '',
        city: contact.Mailing_City || '',
        state: contact.Mailing_State || '',
        zip: contact.Mailing_Zip || '',
        sendAnnualReport: !!contact.Send_Annual_Report,
        lastReportSent: contact.Last_Report_Sent || null
      },
      project: primary.id ? {
        id: primary.id,
        name: primary.Name || '',
        status: primary.Project_Status || '',
        ptoDate: primary.PTO_Date || null,
      batteryInstallDate: primary.Battery_Install_Date || null,
      potentialExtraUsageKwh: orNull(primary.Potential_Extra_Usage_kWh),
      potentialExtraUsageNote: primary.Potential_Extra_Usage_Note || '',
        installDate: primary.Install_Date || null,
        batteryManufacturer: primary.Battery_Manufacturer || '',
        inverterType: primary.Inverter_Type || '',
        numberOfModules: primary.Number_of_Modules || null,
        panelModel: primary.Panel_Model || ''
      } : null,
      projectCount: projects.length,
      auditInputs
    });
  } catch (e) {
    sendError(res, e);
  }
}

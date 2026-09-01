/**
 * GET /api/clients   — SERVERLESS BACKEND (Node). NOT a React component.
 * Returns the client list scoped by role, with each client's primary
 * Solar_Project joined and financial sort fields computed server-side.
 * Read-only.
 */
import { zohoFetch } from './_zoho.js';
import { requireUser, sendError } from './_auth.js';

const CONTACT_FIELDS = [
  'id', 'First_Name', 'Last_Name', 'Full_Name', 'Email', 'Phone',
  'Mailing_Street', 'Mailing_City', 'Mailing_State', 'Mailing_Zip', 'Lifecycle_Stage', 'Ownership_Status',
  'Send_Annual_Report', 'Last_Report_Sent'
, 'Left_Review', 'Created_By_Rep'];

const PROJECT_FIELDS = [
  'id', 'Contact', 'Install_Date', 'PTO_Date', 'System_Size_kW',
  'Annual_System_Production', 'Current_Annual_Usage_kWh', 'Utility_Provider',
  'NEM_Version', 'Export_Rate', 'On_CARE_Program', 'Project_Status', 'Modified_Time'
, 'Finance_Provider', 'Opportunity_Type'];

const UTILITY_RATE_2026 = { PGE: 0.495, SCE: 0.341, SDGE: 0.540, SMUD: 0.253 };
const UTILITY_MAP = {
  'PG&E': 'PGE', 'PGE': 'PGE', 'SCE': 'SCE', 'SDG&E': 'SDGE', 'SDGE': 'SDGE',
  'SMUD': 'SMUD', 'LADWP': 'SCE', 'IID': 'SCE'
};
const NEM_MAP = { 'NEM 1.0': 'NEM1', 'NEM 2.0': 'NEM2', 'NEM 3.0': 'NEM3' };

function num(v, d = 0) { const n = parseFloat(v); return Number.isFinite(n) ? n : d; }

function annualNemImpact(p) {
  const production = num(p.Annual_System_Production);
  const usage = num(p.Current_Annual_Usage_kWh);
  if (!production && !usage) return null;
  const utilKey = UTILITY_MAP[p.Utility_Provider] || 'SCE';
  let rate = UTILITY_RATE_2026[utilKey] || 0.341;
  if (p.On_CARE_Program) rate *= 0.7;
  const nem = NEM_MAP[p.NEM_Version] || 'NEM2';
  const net = production - usage;
  if (net > 0) {
    const compRate = nem === 'NEM1' ? rate : nem === 'NEM2' ? num(p.Export_Rate, 0.07) : 0.05;
    return { type: 'credit', amount: net * compRate };
  }
  return { type: 'trueup', amount: Math.abs(net) * rate };
}

function annualSavingsEstimate(p, nem) {
  const usage = num(p.Current_Annual_Usage_kWh);
  if (!usage) return 0;
  const utilKey = UTILITY_MAP[p.Utility_Provider] || 'SCE';
  let rate = UTILITY_RATE_2026[utilKey] || 0.341;
  if (p.On_CARE_Program) rate *= 0.7;
  const utilityWouldHavePaid = usage * rate;
  if (!nem) return utilityWouldHavePaid;
  return nem.type === 'credit'
    ? utilityWouldHavePaid + nem.amount
    : utilityWouldHavePaid - nem.amount;
}

async function coqlAll(selectFields, moduleAndWhere) {
  const out = [];
  let offset = 0;
  const pageSize = 200;
  for (let page = 0; page < 10; page++) {
    const query = `select ${selectFields} ${moduleAndWhere} limit ${offset}, ${pageSize}`;
    const result = await zohoFetch('/crm/v2/coql', {
      method: 'POST',
      body: JSON.stringify({ select_query: query })
    });
    const batch = result.data || [];
    out.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireUser(req);

    let whereClause;
    if (user.role === 'admin') {
      whereClause = 'Last_Name is not null'; // mandatory field — includes clients without email
    } else if (user.role === 'rep') {
      // Reps don't yet own real clients (ownership + write-back come later).
      // For now each rep sees a shared TEST client so they can exercise the
      // dashboard → audit flow. Point REP_TEST_CLIENT_EMAIL at a demo Contact.
      const testEmail = (process.env.REP_TEST_CLIENT_EMAIL || '').replace(/'/g, '').toLowerCase();
      if (!testEmail) {
        // No test client configured yet — return an empty, friendly list.
        return res.status(200).json({ role: user.role, count: 0, clients: [] });
      }
      const safeRep = user.email.replace(/'/g, '').toLowerCase();
      // Test client + leads this rep created. If the Created_By_Rep field
      // doesn't exist in Zoho yet, COQL will error — we fall back below.
      whereClause = `(Email = '${testEmail}' or Created_By_Rep = '${safeRep}')`;
    } else {
      // client: only their own record by email match
      const safeEmail = user.email.replace(/'/g, '');
      whereClause = `Email = '${safeEmail}'`;
    }

    let contacts;
    try {
      contacts = await coqlAll(
      CONTACT_FIELDS.join(', '),
      `from Contacts where ${whereClause} order by Last_Name`
    );
    } catch (e) {
      // Created_By_Rep may not exist yet in Zoho — retry rep query without it.
      if (user.role === 'rep' && /Created_By_Rep/i.test(whereClause)) {
        const testEmail2 = (process.env.REP_TEST_CLIENT_EMAIL || '').replace(/'/g, '').toLowerCase();
        whereClause = `Email = '${testEmail2}'`;
        contacts = await coqlAll(
      CONTACT_FIELDS.join(', '),
      `from Contacts where ${whereClause} order by Last_Name`
    );
      } else { throw e; }
    }

    const projectsByContact = {};
    try {
      const projects = await coqlAll(
        PROJECT_FIELDS.join(', '),
        'from Solar_Projects where Contact is not null'
      );
      for (const p of projects) {
        const cid = p.Contact && (p.Contact.id || p.Contact);
        if (!cid) continue;
        const prev = projectsByContact[cid];
        if (!prev || (p.Install_Date || '') > (prev.Install_Date || '')) {
          projectsByContact[cid] = p;
        }
      }
    } catch (e) {
      // financial sort fields stay null if project read fails
    }

    const clients = contacts.map((c) => {
      const p = projectsByContact[c.id] || null;
      const nem = p ? annualNemImpact(p) : null;
      const savings = p ? annualSavingsEstimate(p, nem) : null;
      return {
        id: c.id,
        firstName: c.First_Name || '',
        lastName: c.Last_Name || '',
        fullName: c.Full_Name || `${c.First_Name || ''} ${c.Last_Name || ''}`.trim(),
        email: c.Email || '',
        phone: c.Phone || '',
        street: c.Mailing_Street || '',
        state: c.Mailing_State || '',
        city: c.Mailing_City || '',
        zip: c.Mailing_Zip || '',
        lifecycleStage: c.Lifecycle_Stage || '',
        ownershipStatus: c.Ownership_Status || '',
        sendAnnualReport: !!c.Send_Annual_Report,
        leftReview: !!c.Left_Review,
        createdBy: c.Created_By_Rep || '',
        lastReportSent: c.Last_Report_Sent || null,
        // When the project record was last touched — powers the default
        // "most recently worked on first" ordering.
        lastModified: p ? (p.Modified_Time || null) : null,
        installDate: p ? (p.Install_Date || null) : null,
        ptoDate: p ? (p.PTO_Date || null) : null,
        systemSizeKw: p ? num(p.System_Size_kW) : null,
        projectStatus: p ? (p.Project_Status || '') : '',
        financeProvider: p ? (p.Finance_Provider || '') : '',
        opportunityType: p ? (p.Opportunity_Type || '') : '',
        annualSavings: savings != null ? Math.round(savings) : null,
        nemType: nem ? nem.type : null,
        nemAmount: nem ? Math.round(nem.amount) : null,
        // Raw fields the report-eligibility gate needs. Returned unmapped and
        // un-defaulted so the dashboard can tell "blank in Zoho" from "zero".
        annualProduction: p ? num(p.Annual_System_Production) : null,
        currentAnnualUsage: p ? num(p.Current_Annual_Usage_kWh) : null,
        nemVersion: p ? (p.NEM_Version || '') : ''
      };
    });

    res.status(200).json({ role: user.role, count: clients.length, clients });
  } catch (e) {
    sendError(res, e);
  }
}

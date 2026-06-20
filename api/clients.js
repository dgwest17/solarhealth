/**
 * GET /api/clients
 * Returns the client list for the logged-in user, scoped by role:
 *   - admin  : all Contacts that have at least an email
 *   - client : only the Contact whose Email matches their login
 *   - rep    : (future) only owned Contacts — currently treated as client
 *
 * Read-only. No Zoho writes happen here.
 */
import { zohoFetch } from './_zoho.js';
import { requireUser, sendError } from './_auth.js';

// COQL lets us pull exactly the fields we want in one call.
const CONTACT_FIELDS = [
  'id', 'First_Name', 'Last_Name', 'Full_Name', 'Email',
  'Mailing_City', 'Mailing_Zip', 'Lifecycle_Stage', 'Ownership_Status',
  'Send_Annual_Report', 'Last_Report_Sent'
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireUser(req);

    let whereClause;
    if (user.role === 'admin') {
      whereClause = "Email is not null";
    } else {
      // client / rep(for now): only their own record by email match
      const safeEmail = user.email.replace(/'/g, "");
      whereClause = `Email = '${safeEmail}'`;
    }

    // COQL query — paginated; pull up to 200 at a time.
    const select = CONTACT_FIELDS.join(', ');
    const all = [];
    let offset = 0;
    const pageSize = 200;
    // Cap pages to avoid runaway; 211 clients fits in 2 pages.
    for (let page = 0; page < 10; page++) {
      const query = `select ${select} from Contacts where ${whereClause} order by Last_Name limit ${offset}, ${pageSize}`;
      const result = await zohoFetch('/crm/v2/coql', {
        method: 'POST',
        body: JSON.stringify({ select_query: query })
      });
      const batch = result.data || [];
      all.push(...batch);
      if (batch.length < pageSize) break;
      offset += pageSize;
    }

    const clients = all.map((c) => ({
      id: c.id,
      firstName: c.First_Name || '',
      lastName: c.Last_Name || '',
      fullName: c.Full_Name || `${c.First_Name || ''} ${c.Last_Name || ''}`.trim(),
      email: c.Email || '',
      city: c.Mailing_City || '',
      zip: c.Mailing_Zip || '',
      lifecycleStage: c.Lifecycle_Stage || '',
      ownershipStatus: c.Ownership_Status || '',
      sendAnnualReport: !!c.Send_Annual_Report,
      lastReportSent: c.Last_Report_Sent || null
    }));

    res.status(200).json({ role: user.role, count: clients.length, clients });
  } catch (e) {
    sendError(res, e);
  }
}

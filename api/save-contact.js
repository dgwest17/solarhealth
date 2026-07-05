/**
 * POST /api/save-contact — update a Contact's basic info in Zoho.
 * Admin only. Whitelisted fields only (name / contact info / address / newsletter).
 */
import { zohoFetch } from './_zoho.js';
import { requireUser, sendError } from './_auth.js';

function mapContact(c) {
  const out = {};
  const set = (key, val) => { if (val !== undefined && val !== null) out[key] = String(val).trim(); };
  set('First_Name', c.firstName);
  set('Last_Name', c.lastName);
  set('Email', c.email);
  set('Phone', c.phone);
  set('Mailing_Street', c.street);
  set('Mailing_City', c.city);
  set('Mailing_State', c.state);
  set('Mailing_Zip', c.zip);
  if (typeof c.sendAnnualReport === 'boolean') out.Send_Annual_Report = c.sendAnnualReport;
  // Never allow empty Last_Name (Zoho requires it)
  if (out.Last_Name === '') delete out.Last_Name;
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    if (user.role !== 'admin') return res.status(403).json({ error: 'Editing contacts is limited to admins for now.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { contactId, contact } = body;
    if (!contactId || !contact) return res.status(400).json({ error: 'contactId and contact are required.' });

    const fields = mapContact(contact);
    if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'No writable fields in payload.' });

    const result = await zohoFetch(`/crm/v2/Contacts/${encodeURIComponent(contactId)}`, {
      method: 'PUT',
      body: JSON.stringify({ data: [{ id: contactId, ...fields }] })
    });
    const status = result.data && result.data[0];
    if (!status || status.code !== 'SUCCESS') {
      return res.status(502).json({ error: `Zoho rejected the update: ${status ? status.message || status.code : 'unknown'}` });
    }
    res.status(200).json({ ok: true, updatedFields: Object.keys(fields) });
  } catch (e) { sendError(res, e); }
}

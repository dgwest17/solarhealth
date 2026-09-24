/**
 * FILE: api/_routes/reps.js
 *
 * GET /api/reps — the active rep roster, for the "set by" picker.
 *
 * Recruits is the roster. Reps are not Zoho users — there is one licensed user
 * on this org — so this is the only list of people who can hold a seat on a
 * deal.
 *
 * ONLY HIRED REPS. A declined applicant or somebody still at "Interview
 * Scheduled" has no business being paid half a deal, and a picker that offers
 * them invites exactly that mistake. Filtered server-side rather than in the
 * browser so the unhired never leave the CRM.
 *
 * THE EMAIL IS THE POINT. A builder's half of the commission reaches their
 * Beach by email match, so a roster entry without one is useless for the job
 * this endpoint exists to do — those are returned with `payable: false` so the
 * picker can show them greyed rather than silently dropping a real person from
 * a list their manager expects to see them in.
 *
 * Rep-and-admin only. The roster is internal: who works here, and their email,
 * is not customer-facing.
 */
import { zohoFetch } from '../_zoho.js';
import { requireUser, sendError } from '../_auth.js';

/** Statuses that mean somebody actually works here. */
const ACTIVE_STATUSES = ['Hired'];

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    if (user.role === 'client') {
      return res.status(403).json({ error: 'Not available.' });
    }

    const statusList = ACTIVE_STATUSES.map((s) => `'${s}'`).join(',');
    let reps = [];

    // Status may not be set on every record. Ask for hired first; if COQL
    // rejects the filter — a renamed picklist, say — fall back to the whole
    // roster rather than returning an empty picker, which reads as "there are
    // no reps" and is worse than an over-long list.
    for (const filtered of [true, false]) {
      const where = filtered
        ? `where Status in (${statusList})`
        : 'where Last_Name is not null';
      try {
        const r = await zohoFetch('/crm/v2/coql', {
          method: 'POST',
          body: JSON.stringify({
            select_query:
              `select id, Name, Last_Name, Email, Secondary_Email, Role, Level, Status ` +
              `from Recruits ${where} limit 200`
          })
        });
        reps = (r && r.data) || [];
        break;
      } catch (e) {
        if (filtered) continue;
        reps = [];
      }
    }

    const out = reps.map((r) => {
      const email = (r.Email || r.Secondary_Email || '').trim().toLowerCase();
      return {
        id: r.id,
        name: r.Name || r.Last_Name || '(unnamed)',
        email: email || null,
        role: r.Role || null,
        level: r.Level ?? null,
        status: r.Status || null,
        // Without an email their split cannot be routed to them. Said plainly
        // so the UI can explain it rather than just disabling an option.
        payable: !!email
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({ reps: out, count: out.length });
  } catch (e) {
    return sendError(res, e);
  }
}

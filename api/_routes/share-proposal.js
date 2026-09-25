/**
 * FILE: api/_routes/share-proposal.js
 *
 * POST /api/share-proposal — mint or revoke a customer's proposal link.
 *
 * Rep-and-admin, scoped to deals they own or set. Minting a link to somebody
 * else's customer would be handing out another rep's pricing.
 *
 * THE TOKEN IS MINTED SERVER-SIDE with crypto randomness. A browser-generated
 * token would be as good as Math.random makes it, and Math.random is guessable
 * from a handful of samples. `randomBytes` is not.
 *
 * MINTING IS IDEMPOTENT. Asking twice returns the existing link rather than
 * rotating it, because a rep who shares, then re-opens the panel and shares
 * again, must not have quietly killed the link already in the customer's inbox.
 * Rotation is explicit: `rotate: true`, for when a link has gone somewhere it
 * should not have.
 *
 * `revoke: true` clears it. That is the whole access-control story — there is no
 * expiry, on purpose: a proposal read three weeks later at the kitchen table
 * with a spouse is exactly what the link is for, and a link that dies takes the
 * deal with it.
 */
import { randomBytes } from 'crypto';
import { zohoFetch } from '../_zoho.js';
import { requireUser, sendError } from '../_auth.js';
import { builderOf } from '../../src/proposal/proposalModel.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function sbFetch(path, options = {}) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Supabase ${resp.status}: ${text.slice(0, 250)}`);
  return text ? JSON.parse(text) : null;
}

/** Owner, or the builder who set it. Resolved from Zoho and the stored split. */
async function assertCanShare(user, contactId, proposal) {
  if (user.role === 'admin') return;
  if (user.role !== 'rep') {
    throw Object.assign(new Error('Sharing a proposal requires a rep or admin login.'), { status: 403 });
  }
  const me = (user.email || '').toLowerCase();

  // One reader of the stored builder, shared with everything else.
  const builder = builderOf((proposal && proposal.internal) || null);
  if (builder && builder.email && builder.email === me) return;

  const r = await zohoFetch(`/crm/v2/Contacts/${encodeURIComponent(contactId)}?fields=Created_By_Rep`);
  const c = (r.data && r.data[0]) || null;
  if (c && (c.Created_By_Rep || '').toLowerCase() === me) return;

  throw Object.assign(new Error('That is not your deal.'), { status: 403 });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const user = await requireUser(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { contactId, revoke = false, rotate = false, days = null } = body;

    if (!contactId) return res.status(400).json({ error: 'contactId required' });
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: 'Storage is not configured.' });
    }

    const rows = await sbFetch(
      `/client_data?contact_id=eq.${encodeURIComponent(contactId)}&select=proposal`
    );
    const proposal = rows && rows[0] && rows[0].proposal;
    if (!proposal) return res.status(404).json({ error: 'No saved proposal for this client.' });

    await assertCanShare(user, contactId, proposal);

    let token = proposal.shareToken || null;
    if (revoke) {
      token = null;
    } else if (!token || rotate) {
      token = randomBytes(32).toString('hex');
    }

    /**
     * HOW LONG THE LINK LIVES.
     *
     * 30 days by default, 7 to 90 accepted. Long enough that a customer reading
     * it a fortnight later at the kitchen table still can — which is the whole
     * reason the link exists — and short enough that a forwarded URL does not
     * sit live in somebody's inbox for a year.
     *
     * Clamped, because a caller asking for 3650 days has misunderstood what
     * this is for, and a caller asking for 0 would break the link they just
     * made.
     */
    const SHARE_DEFAULT_DAYS = 30;
    const span = Math.max(7, Math.min(90, Math.round(Number(days) || SHARE_DEFAULT_DAYS)));

    const next = { ...proposal, shareToken: token };
    if (token) {
      next.sharedAt = proposal.sharedAt && !rotate ? proposal.sharedAt : new Date().toISOString();
      next.sharedBy = user.email || null;
      // Re-sharing extends from NOW rather than from the original share, so a
      // rep re-sending a link a month later does not hand over a dead one.
      next.shareExpiresAt = new Date(Date.now() + span * 86400000).toISOString();
    } else {
      delete next.sharedAt;
      delete next.sharedBy;
      delete next.shareExpiresAt;
    }

    await sbFetch('/client_data', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{
        contact_id: contactId, proposal: next, updated_at: new Date().toISOString()
      }])
    });

    return res.status(200).json({
      ok: true,
      token,
      // The path only. The origin is the browser's business — hard-coding one
      // here breaks every preview deployment and gets noticed in production.
      path: token ? `/?proposal=${token}` : null,
      sharedAt: next.sharedAt || null,
      expiresAt: next.shareExpiresAt || null,
      days: token ? span : null
    });
  } catch (e) {
    return sendError(res, e);
  }
}

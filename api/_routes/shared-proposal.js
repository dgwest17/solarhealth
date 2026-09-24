/**
 * FILE: api/_routes/shared-proposal.js
 *
 * GET /api/shared-proposal?token=… — the customer's own proposal, by link.
 *
 * The ONLY unauthenticated endpoint in this app. Everything about it is built
 * around that fact.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS STRIPPED, AND WHY IT IS STRIPPED HERE
 *
 * `proposal.internal` carries the commission pool, every seat's share, the
 * redline and who set the deal. None of it may reach a customer. The stripping
 * happens on the SERVER, not in the component, because a link is a link: paste
 * it into curl and you get whatever this endpoint returns, regardless of what
 * CustomerProposal.jsx chooses to render. A client-side omission is a rendering
 * decision; this is the control.
 *
 * The allow-list is explicit rather than a delete of `internal`. A future field
 * added to the proposal object is then invisible by default instead of
 * published by default — the safe direction for a shape that will keep growing.
 *
 * ---------------------------------------------------------------------------
 * THE TOKEN
 *
 * 32 bytes of crypto randomness, generated when a rep shares, stored on the
 * proposal. Not the contact id: those are sequential-ish Zoho ids, and an
 * endpoint keyed on them would let anybody walk the customer base.
 *
 * Lookup is by exact token match inside the jsonb. A token that does not match
 * returns 404 with no detail — no "expired" versus "wrong", because the
 * difference tells a guesser they are close.
 *
 * Revocation is clearing the token. Expiry is deliberately NOT implemented: a
 * proposal link the customer opens three weeks later, at the kitchen table,
 * with their spouse, is the entire point of it existing. A link that dies is a
 * deal that dies with it. The rep can revoke, which is the control that matches
 * the actual risk.
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function sbFetch(path) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Supabase ${resp.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

/**
 * Everything a customer may see, named explicitly.
 *
 * Adding a field here is a decision to publish it. That is the point of the
 * list: the default for anything new is private.
 */
const CUSTOMER_SAFE_KEYS = [
  'version', 'id', 'createdAt', 'stage',
  'client', 'parties',
  'system', 'financing', 'pricing', 'savings', 'solar',
  'steps', 'context'
];

const toCustomerView = (proposal) => {
  const out = {};
  for (const key of CUSTOMER_SAFE_KEYS) {
    if (proposal[key] !== undefined) out[key] = proposal[key];
  }
  return out;
};

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    // TOKEN SHAPE FIRST, before anything that could describe this deployment.
    // An unauthenticated caller sending junk got "Storage is not configured"
    // back, which is a free report on our infrastructure in exchange for a
    // guess. A token is 64 hex characters; anything else is a 404 and nothing
    // more. The config check follows, and only for a caller who at least sent
    // something token-shaped.
    const token = String((req.query && req.query.token) || '').trim();
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(404).json({ error: 'Not found' });
    }

    const rows = await sbFetch(
      `/client_data?proposal->>shareToken=eq.${encodeURIComponent(token)}&select=proposal&limit=1`
    );
    const proposal = rows && rows[0] && rows[0].proposal;
    if (!proposal) {
      // No detail. "Expired" versus "wrong" tells a guesser they are close.
      return res.status(404).json({ error: 'Not found' });
    }

    /**
     * EXPIRY, checked here rather than trusted from the link.
     *
     * A token past its date is a 404 with no explanation — the same response as
     * a wrong one. Telling a caller "expired" confirms the token was real,
     * which is the one thing worth knowing to somebody guessing.
     *
     * A proposal with no expiry recorded is one shared before expiry existed.
     * It still works: silently killing links already in customers' inboxes to
     * enforce a rule invented afterwards would cost live deals.
     */
    if (proposal.shareExpiresAt) {
      const until = Date.parse(proposal.shareExpiresAt);
      if (Number.isFinite(until) && Date.now() > until) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    // Not indexed, not cached by a shared proxy — this is one person's private
    // pricing, even though the URL needs no login.
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    return res.status(200).json({ proposal: toCustomerView(proposal) });
  } catch (e) {
    // Nothing about the storage layer goes to an unauthenticated caller.
    console.error('[shared-proposal]', e.message);
    return res.status(404).json({ error: 'Not found' });
  }
}

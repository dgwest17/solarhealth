/**
 * Server-side auth + role resolution.
 *
 * Every data endpoint calls requireUser(req) FIRST. It:
 *   1. Reads the Supabase access token from the Authorization header.
 *   2. Verifies it against Supabase (so a forged token is rejected).
 *   3. Resolves the caller's role and the email we scope their data to.
 *
 * Roles:
 *   - admin  : sees everything. Identified by ADMIN_EMAILS env (comma-separated).
 *   - rep    : sees only their owned clients (enforced later via Zoho owner field).
 *   - client : sees only the Contact whose Email == their login email.
 *
 * This runs on the SERVER. The browser cannot change its own role —
 * role is derived here from the verified token, never trusted from the client.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export async function requireUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    const err = new Error('Not authenticated');
    err.status = 401;
    throw err;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const err = new Error('Supabase is not configured in environment variables.');
    err.status = 500;
    throw err;
  }

  // Verify the token by asking Supabase who it belongs to.
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY
    }
  });

  if (!resp.ok) {
    let detail = '';
    try {
      const body = await resp.json();
      detail = body.msg || body.message || body.error_description || body.error || '';
    } catch {
      try { detail = await resp.text(); } catch {}
    }
    const err = new Error(`Session check failed (${resp.status})${detail ? ': ' + detail : ''}`);
    err.status = 401;
    throw err;
  }

  const user = await resp.json();
  const email = (user.email || '').toLowerCase();
  if (!email) {
    const err = new Error('No email on account');
    err.status = 403;
    throw err;
  }

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  let role = 'client';
  if (adminEmails.includes(email)) {
    role = 'admin';
  }
  // NOTE: rep detection (Zoho Recruits Engineer==true) is wired in a later
  // phase. For now, non-admins are treated as 'client' and scoped to their
  // own email. Until you create rep/client users, only your admin login exists.

  return { email, role, supabaseUserId: user.id };
}

/**
 * Standard error responder so endpoints stay tidy.
 */
export function sendError(res, e) {
  const status = e.status || 500;
  res.status(status).json({ error: e.message || 'Server error' });
}

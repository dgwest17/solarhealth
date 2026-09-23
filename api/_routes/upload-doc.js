/**
 * FILE: api/upload-doc.js
 *
 * POST /api/upload-doc — store a document against a client.
 * GET  /api/upload-doc?contactId=…&path=… — signed URL to read one back.
 *
 * Files go to Supabase Storage in a PRIVATE bucket, one folder per contact.
 * Private is the whole point: a utility bill carries a name, an address, an
 * account number and a consumption history. A public bucket with guessable
 * paths would be a data leak wearing a convenience costume, so reads always
 * go through a short-lived signed URL minted here after the same ownership
 * check every other endpoint uses.
 *
 * Uploads arrive base64 in JSON rather than multipart. It keeps the client
 * simple, works identically from the rep's laptop and the customer's phone,
 * and Vercel's body limit is the real constraint either way — which is why
 * MAX_BYTES is enforced before anything is decoded.
 *
 * ONE-TIME SETUP, in the Supabase dashboard:
 *   Storage → New bucket → name: project-docs → Public: OFF
 */
import { zohoFetch } from '../_zoho.js';
import { requireUser, sendError } from '../_auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.DOCS_BUCKET || 'project-docs';

/** 12 MB. Above this a phone photo of a bill should be resized, not rejected late. */
const MAX_BYTES = 12 * 1024 * 1024;

const ALLOWED = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/heic', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword', 'text/plain'
]);

/** Strip anything that could climb out of the contact's folder. */
const safeName = (name) => String(name || 'file')
  .replace(/[^\w.\- ]+/g, '_')
  .replace(/\.{2,}/g, '.')
  .slice(-120);

async function assertDocAccess(user, contactId) {
  if (user.role === 'admin') return null;
  const r = await zohoFetch(
    `/crm/v2/Contacts/${encodeURIComponent(contactId)}?fields=Email,Full_Name,Created_By_Rep`
  );
  const c = (r.data && r.data[0]) || null;
  if (!c) throw Object.assign(new Error('Client not found'), { status: 404 });
  const me = (user.email || '').toLowerCase();
  if (user.role === 'rep' && (c.Created_By_Rep || '').toLowerCase() === me) return c;
  if (user.role === 'client' && (c.Email || '').toLowerCase() === me) return c;
  throw Object.assign(new Error('Not authorized for this client.'), { status: 403 });
}

async function sbStorage(path, options = {}) {
  const resp = await fetch(`${SUPABASE_URL}/storage/v1${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...(options.headers || {})
    }
  });
  const text = await resp.text();
  if (!resp.ok) {
    const err = new Error(`Storage ${resp.status}: ${text.slice(0, 250)}`);
    err.status = resp.status;
    err.storage = true;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

const missingBucket = (e) =>
  e && e.storage && (e.status === 404 || /bucket not found/i.test(e.message));

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: 'Storage is not configured.' });
    }

    // --------------------------------------------------------------- READ
    if (req.method === 'GET') {
      const { contactId, path } = req.query;
      if (!contactId || !path) return res.status(400).json({ error: 'contactId and path required' });
      await assertDocAccess(user, contactId);
      // Paths are always rebuilt from the contact id here, so a caller cannot
      // ask for a file belonging to somebody else by passing a full path.
      const objectPath = `${contactId}/${safeName(String(path).split('/').pop())}`;
      const signed = await sbStorage(`/object/sign/${BUCKET}/${objectPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 60 * 15 })
      });
      return res.status(200).json({
        ok: true,
        url: signed && signed.signedURL ? `${SUPABASE_URL}/storage/v1${signed.signedURL}` : null
      });
    }

    // -------------------------------------------------------------- WRITE
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { contactId, docId, filename, contentB64, contentType } = body;

    if (!contactId) return res.status(400).json({ error: 'contactId required' });
    if (!docId) return res.status(400).json({ error: 'docId required' });
    if (!contentB64) return res.status(400).json({ error: 'No file content' });

    const type = contentType || 'application/octet-stream';
    if (!ALLOWED.has(type)) {
      return res.status(415).json({
        error: `That file type isn't accepted (${type}). Use a PDF, photo, Word or Excel file.`
      });
    }

    // Length check BEFORE decoding — base64 is ~4/3 of the real size.
    const approxBytes = Math.floor(contentB64.length * 0.75);
    if (approxBytes > MAX_BYTES) {
      return res.status(413).json({
        error: `That file is about ${(approxBytes / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_BYTES / 1024 / 1024} MB — a photo of a bill usually fits if you use your phone's smaller size.`
      });
    }

    await assertDocAccess(user, contactId);

    const clean = safeName(filename || `${docId}`);
    const objectPath = `${contactId}/${docId}__${clean}`;
    const buffer = Buffer.from(contentB64, 'base64');

    try {
      await sbStorage(`/object/${BUCKET}/${objectPath}`, {
        method: 'POST',
        headers: { 'Content-Type': type, 'x-upsert': 'true' },
        body: buffer
      });
    } catch (e) {
      if (missingBucket(e)) {
        return res.status(503).json({
          error: `The "${BUCKET}" storage bucket doesn't exist yet. In Supabase: Storage → New bucket → name "${BUCKET}", Public OFF.`
        });
      }
      throw e;
    }

    return res.status(200).json({
      ok: true,
      doc: {
        id: docId,
        path: objectPath,
        filename: clean,
        contentType: type,
        bytes: buffer.length,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.email || null
      }
    });
  } catch (e) {
    return sendError(res, e);
  }
}

/**
 * Fetch a stored object's bytes. Used server-side by api/intake.js to attach
 * documents to the submission email — it never goes near the browser, so it
 * takes the full object path rather than rebuilding one.
 */
export async function readObject(objectPath) {
  const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  });
  if (!resp.ok) throw new Error(`Could not read ${objectPath} (${resp.status})`);
  const arr = await resp.arrayBuffer();
  return Buffer.from(arr);
}

/**
 * FILE: api/intake.js
 *
 * POST /api/intake — submit the New Project Intake Form to the contractor.
 *
 * What goes out: the contractor's own workbook, generated from the saved
 * figures, plus every uploaded document, emailed to their submission
 * addresses. What stays behind: the whole intake on the proposal, because an
 * inbox is not a database and a bounced email should never be the only copy.
 *
 * ORDER MATTERS. Store first, then build, then send. If the email fails the
 * rep has lost nothing and can retry; if it succeeded but the store failed,
 * the contractor would be working from a document the platform cannot
 * reproduce.
 *
 * COMMISSION APPEARS ON THIS DOCUMENT. That is correct and deliberate — the
 * contractor's own form has a Commission line, and this packet is trade-facing.
 * The rule this codebase holds is narrower than "never show commission": it is
 * never on anything the CUSTOMER sees, which is enforced in
 * src/proposal/CustomerProposal.jsx and tested there.
 *
 * Submission addresses live on the contractor party in settings, so a change
 * of installer is a settings edit rather than a deploy.
 */
import { zohoFetch } from '../_zoho.js';
import { requireUser, sendError } from '../_auth.js';
import { sendMail, tableEmail, mailConfigured } from '../_mail.js';
import { buildIntakeWorkbook } from '../_intakeWorkbook.js';
import { readObject } from './upload-doc.js';
import {
  SERVICE_LINES, REQUIRED_DOCUMENTS, computeIntakeCosts, validateIntake
} from '../../src/project/intakeSchema.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

/** Attachments above this are dropped with a link note rather than failing the send. */
const MAX_ATTACH_TOTAL = 18 * 1024 * 1024;

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

async function assertIntakeAccess(user, contactId) {
  if (user.role === 'admin') return null;
  const r = await zohoFetch(
    `/crm/v2/Contacts/${encodeURIComponent(contactId)}?fields=Email,Full_Name,Created_By_Rep,Phone,Mailing_Street,Mailing_City,Mailing_State,Mailing_Zip`
  );
  const c = (r.data && r.data[0]) || null;
  if (!c) throw Object.assign(new Error('Client not found'), { status: 404 });
  const me = (user.email || '').toLowerCase();
  if (user.role === 'rep' && (c.Created_By_Rep || '').toLowerCase() === me) return c;
  // A homeowner does not submit a trade handoff carrying a commission line.
  throw Object.assign(
    new Error('Only the rep who owns this client, or an admin, can submit an intake.'),
    { status: 403 }
  );
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const user = await requireUser(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { contactId, projectId, intake, parties = {}, submitTo = [] } = body;

    if (!contactId) return res.status(400).json({ error: 'contactId required' });
    if (!intake || typeof intake !== 'object') return res.status(400).json({ error: 'intake required' });

    await assertIntakeAccess(user, contactId);

    const costs = computeIntakeCosts(intake);
    const problems = validateIntake(intake, costs);
    if (problems.length) {
      return res.status(400).json({
        error: 'This intake is not ready to submit.',
        missing: problems
      });
    }

    // ---------------------------------------------------------- 1. store
    let stored = false;
    let storeError = null;
    if (SUPABASE_URL && SERVICE_KEY) {
      try {
        const rows = await sbFetch(
          `/client_data?contact_id=eq.${encodeURIComponent(contactId)}&select=proposal`
        );
        const existing = (rows && rows[0] && rows[0].proposal) || {};
        await sbFetch('/client_data', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify([{
            contact_id: contactId,
            proposal: {
              ...existing,
              intake: {
                ...intake,
                costs,
                submittedAt: new Date().toISOString(),
                submittedBy: user.email || null
              }
            },
            updated_at: new Date().toISOString()
          }])
        });
        stored = true;
      } catch (e) { storeError = e.message; }
    } else {
      storeError = 'Supabase is not configured.';
    }

    // ---------------------------------------------------------- 2. build
    const sellerName = (parties.seller && parties.seller.name) || '';
    const contractorName = (parties.contractor && parties.contractor.name) || '';

    let workbook;
    try {
      workbook = await buildIntakeWorkbook({
        intake, costs, services: SERVICE_LINES, sellerName, contractorName
      });
    } catch (e) {
      return res.status(500).json({
        ok: false, stored,
        error: `Saved, but the intake form could not be generated: ${e.message}`
      });
    }

    const safeSurname = String(intake.customerName || 'Project').trim().split(/\s+/).pop();
    const attachments = [{
      filename: `New Project Intake - ${safeSurname}.xlsx`,
      contentB64: workbook.toString('base64'),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }];

    // Pull the uploaded documents back out of storage and attach them.
    let running = workbook.length;
    const skipped = [];
    for (const doc of Object.values(intake.documents || {})) {
      if (!doc || !doc.path) continue;
      try {
        const buf = await readObject(doc.path);
        if (running + buf.length > MAX_ATTACH_TOTAL) { skipped.push(doc.label || doc.id); continue; }
        running += buf.length;
        attachments.push({
          filename: doc.filename || `${doc.id}`,
          contentB64: buf.toString('base64'),
          mimeType: doc.contentType || 'application/octet-stream'
        });
      } catch (e) {
        skipped.push(`${doc.label || doc.id} (${e.message})`);
      }
    }

    // ---------------------------------------------------------- 3. send
    const recipients = (Array.isArray(submitTo) && submitTo.length)
      ? submitTo
      : String(process.env.INTAKE_EMAIL || '').split(',').map((x) => x.trim()).filter(Boolean);

    if (!recipients.length) {
      return res.status(200).json({
        ok: stored, stored, costs, skipped,
        warning: 'Saved, but no submission addresses are set. Add them to the contractor in Admin → Your companies.'
      });
    }
    if (!mailConfigured()) {
      return res.status(200).json({
        ok: stored, stored, costs, skipped,
        warning: 'Saved, but no email provider is configured so nothing was sent.'
      });
    }

    const fmtMoney = (v) => '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const serviceItems = SERVICE_LINES
      .map((l) => {
        const e = (intake.services || {})[l.id] || {};
        if (!e.cost && !e.type && !e.quantity) return null;
        const bits = [e.type, e.quantity ? `×${e.quantity}` : null, e.cost ? fmtMoney(e.cost) : null]
          .filter(Boolean).join(' · ');
        return { label: l.label, value: bits || '—' };
      })
      .filter(Boolean);

    const html = tableEmail({
      title: `New Project Intake — ${intake.customerName}`,
      intro: `Submitted by ${intake.repName || user.email}. The completed intake form and all required documents are attached.`,
      sections: [
        { title: 'Customer', items: [
          { label: 'Name', value: intake.customerName },
          { label: 'Address', value: intake.homeAddress },
          { label: 'Phone', value: intake.customerPhone },
          { label: 'Email', value: intake.customerEmail }
        ] },
        { title: 'Payment', items: [
          { label: 'Type', value: intake.paymentType },
          { label: 'Finance company', value: intake.financeCompany },
          { label: 'Interest rate', value: intake.interestRate ? `${(Number(intake.interestRate) * 100).toFixed(2)}%` : '' }
        ] },
        { title: 'Services', items: serviceItems },
        { title: 'Cost', items: [
          { label: 'Services', value: fmtMoney(costs.servicesTotal) },
          ...(costs.feeApplies ? [{ label: 'Loan fees', value: fmtMoney(costs.loanFees) }] : []),
          { label: 'Commission', value: fmtMoney(costs.commission) },
          { label: 'Total project cost', value: fmtMoney(costs.totalProjectCost) },
          ...(costs.prepaid ? [{ label: 'PE prepaid', value: fmtMoney(costs.prepaid) }] : []),
          ...(costs.rebate ? [{ label: 'SDCP / SGIP', value: fmtMoney(costs.rebate) }] : []),
          { label: 'Net total', value: fmtMoney(costs.netTotal) }
        ] },
        { title: 'Attached', items: attachments.map((a) => ({ label: a.filename, value: '✓' })) }
      ],
      footer: skipped.length
        ? `Not attached (too large or unreadable): ${skipped.join(', ')}. Ask the rep to send these separately.`
        : 'Sent by SolarHealth. Reply to reach the submitting rep.'
    });

    let sent = null;
    const failures = [];
    for (const to of recipients) {
      try {
        sent = await sendMail({
          to,
          subject: `New Project Intake — ${intake.customerName}${intake.homeAddress ? ` · ${intake.homeAddress}` : ''}`,
          html,
          replyTo: user.email || null,
          attachments
        });
      } catch (e) { failures.push(`${to}: ${e.message}`); }
    }

    if (failures.length === recipients.length) {
      return res.status(200).json({
        ok: stored, stored, costs, skipped,
        warning: `Saved, but nothing could be emailed. ${failures.join('; ')}`
      });
    }

    // ------------------------------------------- 4. mark the step complete
    let stepUpdated = false;
    if (projectId) {
      try {
        await zohoFetch(`/crm/v2/Solar_Projects/${encodeURIComponent(projectId)}`, {
          method: 'PUT',
          body: JSON.stringify({ data: [{ Intake_Step: 'Completed' }] })
        });
        stepUpdated = true;
      } catch { /* the field may not exist yet; the submission stands */ }
    }

    return res.status(200).json({
      ok: true, stored, storeError, costs, sent,
      recipients, skipped, stepUpdated,
      partialFailures: failures.length ? failures : undefined,
      attachmentCount: attachments.length
    });
  } catch (e) {
    return sendError(res, e);
  }
}

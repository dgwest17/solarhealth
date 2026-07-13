/**
 * POST /api/send-audit — emails the Consultation Report to the client and
 * stamps Last_Report_Sent (+ optional newsletter) in Zoho.
 *
 * PROVIDER: ZeptoMail (Zoho's transactional email service) — one vendor,
 * built for exactly this, ~$2.50 per 10k emails at scale.
 *   ZEPTOMAIL_TOKEN — Send Mail Token from the ZeptoMail Mail Agent
 *   EMAIL_FROM      — sender on your VERIFIED domain, e.g.
 *                     "Your Energy Best <reports@yourdomain.com>"
 *   EMAIL_COMPANY   — brand name shown in the email header
 *
 * TRANSITION: if ZEPTOMAIL_TOKEN is absent but RESEND_API_KEY is set, it
 * sends via Resend instead — so testing can continue while the ZeptoMail
 * domain verification completes. Remove RESEND_API_KEY when done.
 *
 * The full report travels as an .html attachment (opens in any browser →
 * Save as PDF); the email body is a clean, email-safe summary. Admin only.
 */
import { zohoFetch } from './_zoho.js';
import { requireUser, sendError } from './_auth.js';

const esc = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (v) => '$' + Math.round(Math.abs(Number(v) || 0)).toLocaleString();

function parseFrom(raw, fallbackName) {
  // "Name <addr@x.com>" or bare address
  const m = /^(.*)<([^>]+)>\s*$/.exec(raw || '');
  if (m) return { name: m[1].trim() || fallbackName, address: m[2].trim() };
  return { name: fallbackName, address: (raw || '').trim() };
}

function emailBody({ firstName, summary = {}, company }) {
  const rows = [
    summary.score ? ['System score', esc(summary.score)] : null,
    summary.cumulativeSavings != null ? ['Estimated savings to date', money(summary.cumulativeSavings)] : null,
    summary.avgMonthlySavings != null ? ['Average monthly savings', money(summary.avgMonthlySavings) + '/mo'] : null,
    summary.nemLine ? ['Current NEM position', esc(summary.nemLine)] : null
  ].filter(Boolean).map(([k, v]) =>
    `<tr><td style="padding:8px 12px;color:#64748b;border-bottom:1px solid #e2e8f0">${k}</td><td style="padding:8px 12px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0">${v}</td></tr>`).join('');
  return `<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#0a1424;padding:22px 26px">
      <div style="color:#c9982a;font-size:11px;letter-spacing:3px;font-weight:800">${esc(company)}</div>
      <div style="color:#ffffff;font-size:20px;font-weight:800;margin-top:4px">Your Solar System Analysis</div>
    </div>
    <div style="padding:22px 26px">
      <p style="color:#334155;font-size:14px;line-height:1.6">Hi ${esc(firstName || 'there')},</p>
      <p style="color:#334155;font-size:14px;line-height:1.6">Attached is your complete solar system analysis — open it in any browser and use "Save as PDF" to keep a copy. Here are the headlines:</p>
      ${rows ? `<table style="width:100%;border-collapse:collapse;margin:14px 0">${rows}</table>` : ''}
      <p style="color:#334155;font-size:14px;line-height:1.6">Questions about anything in the report — or the service plan and battery options it covers? Just reply to this email.</p>
      <p style="color:#94a3b8;font-size:11px;line-height:1.5;margin-top:18px">All figures are estimates for informational purposes only — see the disclaimer in the attached report.</p>
    </div>
  </div></body></html>`;
}

async function sendViaZeptoMail({ token, from, toEmail, toName, subject, html, attachmentB64 }) {
  const resp = await fetch('https://api.zeptomail.com/v1.1/email', {
    method: 'POST',
    headers: { Authorization: `Zoho-enczapikey ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: { address: from.address, name: from.name },
      to: [{ email_address: { address: toEmail, name: toName || '' } }],
      subject,
      htmlbody: html,
      attachments: [{ name: 'Solar-System-Analysis.html', mime_type: 'text/html', content: attachmentB64 }]
    })
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (json.error && (json.error.details?.[0]?.message || json.error.message)) || `status ${resp.status}`;
    throw new Error(`ZeptoMail rejected the email: ${msg}`);
  }
  return { provider: 'zeptomail', id: json.request_id || null };
}

async function sendViaResend({ apiKey, fromRaw, toEmail, subject, html, attachmentB64 }) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromRaw || 'SolarHealth <onboarding@resend.dev>',
      to: [toEmail],
      subject,
      html,
      attachments: [{ filename: 'Solar-System-Analysis.html', content: attachmentB64 }]
    })
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`Resend rejected the email: ${json.message || resp.status}`);
  return { provider: 'resend', id: json.id || null };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    if (user.role !== 'admin') return res.status(403).json({ error: 'Sending audits is limited to admins for now.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { contactId, reportHtml, summary, newsletter } = body;
    if (!contactId || !reportHtml) return res.status(400).json({ error: 'contactId and reportHtml are required.' });

    const zeptoToken = process.env.ZEPTOMAIL_TOKEN;
    const resendKey = process.env.RESEND_API_KEY;
    if (!zeptoToken && !resendKey) {
      return res.status(500).json({ error: 'No email provider configured (ZEPTOMAIL_TOKEN) — see EMAIL-SETUP.md. Report was NOT emailed.' });
    }

    const cRes = await zohoFetch(`/crm/v2/Contacts/${encodeURIComponent(contactId)}?fields=Email,First_Name,Full_Name`);
    const contact = cRes.data && cRes.data[0];
    if (!contact) return res.status(404).json({ error: 'Contact not found in Zoho.' });
    if (!contact.Email) return res.status(400).json({ error: 'This contact has no email address in the CRM — add one first.' });

    const company = process.env.EMAIL_COMPANY || 'Your Energy Best';
    const from = parseFrom(process.env.EMAIL_FROM, company);
    const subject = `Your Solar System Analysis — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    const html = emailBody({ firstName: contact.First_Name, summary, company });
    const attachmentB64 = Buffer.from(reportHtml, 'utf8').toString('base64');

    let sent;
    if (zeptoToken) {
      if (!from.address) return res.status(500).json({ error: 'EMAIL_FROM must be set to an address on your ZeptoMail-verified domain.' });
      sent = await sendViaZeptoMail({ token: zeptoToken, from, toEmail: contact.Email, toName: contact.Full_Name, subject, html, attachmentB64 });
    } else {
      sent = await sendViaResend({ apiKey: resendKey, fromRaw: process.env.EMAIL_FROM, toEmail: contact.Email, subject, html, attachmentB64 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const fields = { Last_Report_Sent: today };
    if (newsletter === true) fields.Send_Annual_Report = true;
    await zohoFetch(`/crm/v2/Contacts/${encodeURIComponent(contactId)}`, {
      method: 'PUT',
      body: JSON.stringify({ data: [{ id: contactId, ...fields }] })
    });

    res.status(200).json({ ok: true, emailedTo: contact.Email, provider: sent.provider, emailId: sent.id, lastReportSent: today, newsletter: newsletter === true });
  } catch (e) { sendError(res, e); }
}

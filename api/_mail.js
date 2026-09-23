/**
 * FILE: api/_mail.js
 *
 * ONE WAY TO SEND AN EMAIL.
 *
 * send-audit.js carried its own ZeptoMail and Resend senders. Intake needs to
 * send mail too, and a third copy is how the provider fallback quietly stops
 * matching in one place — the same duplicate-path failure that produced the
 * EV-TOU rate mismatch and the rep read-vs-list divergence in this codebase.
 * So there is one sender, and callers pass content.
 *
 * Provider choice: ZeptoMail when its token is present, Resend otherwise. That
 * order is deliberate — Resend is the transitional fallback while domain
 * verification completes, not a peer.
 *
 * Attachments are optional and take a [{ filename, contentB64, mimeType }]
 * shape that both providers can be given, so a caller never writes
 * provider-specific code.
 */

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export { esc };

/** Is any provider configured at all? Lets a caller fail early and clearly. */
export const mailConfigured = () =>
  !!(process.env.ZEPTOMAIL_TOKEN || process.env.RESEND_API_KEY);

/**
 * Send an email.
 *
 * @param {object}   o
 * @param {string}   o.to            Recipient address.
 * @param {string}   [o.toName]
 * @param {string}   o.subject
 * @param {string}   o.html
 * @param {object}   [o.from]        { address, name }. Falls back to env.
 * @param {string}   [o.replyTo]
 * @param {Array}    [o.attachments] [{ filename, contentB64, mimeType }]
 * @returns {{provider:string, id:string|null}}
 */
export async function sendMail({
  to, toName = '', subject, html, from = null, replyTo = null, attachments = []
} = {}) {
  if (!to) throw Object.assign(new Error('No recipient for this email.'), { status: 400 });

  const zeptoToken = process.env.ZEPTOMAIL_TOKEN;
  const resendKey = process.env.RESEND_API_KEY;
  if (!zeptoToken && !resendKey) {
    throw Object.assign(
      new Error('No email provider configured (ZEPTOMAIL_TOKEN) — see EMAIL-SETUP.md. Nothing was sent.'),
      { status: 500 }
    );
  }

  const sender = from || {
    address: process.env.MAIL_FROM_ADDRESS || 'noreply@yourenergybest.com',
    name: process.env.MAIL_FROM_NAME || 'SolarHealth'
  };

  if (zeptoToken) {
    const resp = await fetch('https://api.zeptomail.com/v1.1/email', {
      method: 'POST',
      headers: { Authorization: `Zoho-enczapikey ${zeptoToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: { address: sender.address, name: sender.name },
        to: [{ email_address: { address: to, name: toName } }],
        ...(replyTo ? { reply_to: [{ address: replyTo }] } : {}),
        subject,
        htmlbody: html,
        ...(attachments.length ? {
          attachments: attachments.map((a) => ({
            name: a.filename,
            mime_type: a.mimeType || 'application/octet-stream',
            content: a.contentB64
          }))
        } : {})
      })
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = (json.error && ((json.error.details && json.error.details[0] && json.error.details[0].message) || json.error.message))
        || `status ${resp.status}`;
      throw new Error(`ZeptoMail rejected the email: ${msg}`);
    }
    return { provider: 'zeptomail', id: json.request_id || null };
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || `${sender.name} <onboarding@resend.dev>`,
      to: [to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      html,
      ...(attachments.length ? {
        attachments: attachments.map((a) => ({ filename: a.filename, content: a.contentB64 }))
      } : {})
    })
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`Resend rejected the email: ${json.message || resp.status}`);
  return { provider: 'resend', id: json.id || null };
}

/**
 * A plain, readable table email. Used by intake and anything else that needs
 * to hand a human a set of field/value pairs without inventing a layout.
 */
export function tableEmail({ title, intro, sections = [], footer = '' }) {
  const rows = (items) => items
    .filter((i) => i && i.value !== '' && i.value != null)
    .map((i) => `<tr>
      <td style="padding:7px 12px 7px 0;color:#64748b;font-size:13px;vertical-align:top;white-space:nowrap">${esc(i.label)}</td>
      <td style="padding:7px 0;color:#0f172a;font-size:13px;font-weight:600">${esc(i.value)}</td>
    </tr>`).join('');

  const blocks = sections.map((s) => `
    <div style="margin-top:20px">
      <div style="color:#0e7490;font-size:11px;letter-spacing:2px;font-weight:800;text-transform:uppercase;padding-bottom:6px;border-bottom:1px solid #e2e8f0">${esc(s.title)}</div>
      <table style="width:100%;border-collapse:collapse;margin-top:8px">${rows(s.items || [])}</table>
    </div>`).join('');

  return `<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif">
  <div style="max-width:620px;margin:24px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#0b2a3d;padding:20px 26px">
      <div style="color:#f7c95c;font-size:11px;letter-spacing:3px;font-weight:800">SOLARHEALTH</div>
      <div style="color:#fff;font-size:19px;font-weight:800;margin-top:3px">${esc(title)}</div>
    </div>
    <div style="padding:20px 26px">
      ${intro ? `<p style="color:#334155;font-size:14px;line-height:1.6;margin:0">${esc(intro)}</p>` : ''}
      ${blocks}
      ${footer ? `<p style="color:#94a3b8;font-size:11px;line-height:1.5;margin-top:22px">${esc(footer)}</p>` : ''}
    </div>
  </div></body></html>`;
}

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filename) {
  const filepath = path.resolve(__dirname, '..', filename);
  if (!fs.existsSync(filepath)) return;
  for (const rawLine of fs.readFileSync(filepath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile('.env.server');

const PORT = Number(process.env.CRM_EMAIL_PORT || 8787);
const apiKey = process.env.RESEND_API_KEY || '';
const fromEmail = process.env.RESEND_FROM_EMAIL || 'Gary Commercial Rail & Fence <onboarding@resend.dev>';
const replyTo = process.env.RESEND_REPLY_TO || '';
const allowedOrigins = (process.env.CRM_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((value) => value.trim());
const resendUserAgent = 'gary-commercial-railing-crm/2.1';

function extractEmail(value = '') {
  const match = String(value).match(/<([^>]+)>/);
  return (match ? match[1] : String(value)).trim();
}

const senderAddress = extractEmail(fromEmail);
const senderDomain = senderAddress.includes('@') ? senderAddress.split('@').pop().toLowerCase() : '';
const senderUsesTestDomain = senderDomain === 'resend.dev' || senderDomain.endsWith('.resend.dev');
const senderUsesPlaceholder = senderDomain.includes('your-verified-domain.com');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
const money = (cents = 0) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((Number(cents) || 0) / 100);
const dateLabel = (value) => value ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : 'Not set';
const labelize = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function isAllowedOrigin(origin = '') {
  return allowedOrigins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function corsHeaders(origin = '') {
  const allowed = isAllowedOrigin(origin) ? origin : allowedOrigins[0];
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
}

function sendJson(response, status, body, origin) {
  response.writeHead(status, { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error('Request is too large.');
  }
  return JSON.parse(body || '{}');
}

function renderEmail({ type, document, client, job, settings }) {
  const isInvoice = type === 'invoice';
  const title = isInvoice ? 'Invoice' : 'Quote';
  const number = isInvoice ? document.invoice_number : document.quote_number;
  const dueLabel = isInvoice ? 'Payment due' : 'Quote valid through';
  const dueValue = isInvoice ? document.due_on : document.expires_on;
  const items = Array.isArray(document.items) ? document.items.slice(0, 100) : [];
  const company = settings?.legal_name || 'Gary Commercial Rail & Fence';
  const balance = isInvoice ? Number(document.balance_due_cents ?? document.total_cents ?? 0) : Number(document.total_cents || 0);
  const rows = items.map((item) => `<tr><td style="padding:12px 8px;border-bottom:1px solid #e4e7e8">${escapeHtml(item.description)}</td><td style="padding:12px 8px;border-bottom:1px solid #e4e7e8;text-align:center">${escapeHtml(item.quantity)} ${escapeHtml(item.unit || '')}</td><td style="padding:12px 8px;border-bottom:1px solid #e4e7e8;text-align:right">${money(Math.round((Number(item.quantity) || 0) * (Number(item.unit_price_cents) || 0)))}</td></tr>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#eef1f2;color:#17232a;font-family:Arial,sans-serif"><div style="padding:28px 14px"><div style="max-width:760px;margin:auto;background:#fff"><div style="padding:30px;background:#17232a;color:#fff"><div style="font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:#f29a5c">${escapeHtml(company)}</div><h1 style="margin:8px 0 0;font-size:38px">${title} ${escapeHtml(number)}</h1></div><div style="padding:30px"><p style="font-size:16px">Hello ${escapeHtml(client?.primary_contact_name || client?.company_name || 'there')},</p><p>${isInvoice ? 'Please find your invoice summary below.' : 'Thank you for the opportunity to provide a quote for your project.'}</p><div style="margin:24px 0;padding:18px;background:#f5f7f7"><strong>${escapeHtml(client?.company_name || client?.primary_contact_name || 'Client')}</strong>${job?.title ? `<br>${escapeHtml(job.title)}` : ''}<br><span style="color:#66747c">Issued ${dateLabel(document.issued_on)} · ${dueLabel} ${dateLabel(dueValue)}</span></div><table style="width:100%;border-collapse:collapse"><thead><tr><th style="padding:10px 8px;background:#17232a;color:white;text-align:left">Description</th><th style="padding:10px 8px;background:#17232a;color:white">Quantity</th><th style="padding:10px 8px;background:#17232a;color:white;text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table><div style="margin:24px 0 0 auto;max-width:330px"><div style="display:flex;justify-content:space-between;padding:7px 0"><span>Subtotal</span><strong>${money(document.subtotal_cents)}</strong></div>${document.discount_cents ? `<div style="display:flex;justify-content:space-between;padding:7px 0"><span>Discount</span><strong>-${money(document.discount_cents)}</strong></div>` : ''}${document.tax_cents ? `<div style="display:flex;justify-content:space-between;padding:7px 0"><span>Tax</span><strong>${money(document.tax_cents)}</strong></div>` : ''}<div style="display:flex;justify-content:space-between;padding:14px 0;border-top:2px solid #17232a;font-size:20px"><span>Total</span><strong>${money(document.total_cents)}</strong></div>${isInvoice ? `<div style="display:flex;justify-content:space-between;padding:14px;background:#fff2e8;color:#8a4718"><span>Balance due</span><strong>${money(balance)}</strong></div>` : ''}</div>${document.notes ? `<div style="margin-top:28px"><strong>Notes</strong><p style="white-space:pre-wrap;color:#526068">${escapeHtml(document.notes)}</p></div>` : ''}${document.terms ? `<div style="margin-top:20px"><strong>Terms</strong><p style="white-space:pre-wrap;color:#526068">${escapeHtml(document.terms)}</p></div>` : ''}${isInvoice && settings?.payment_instructions ? `<div style="margin-top:20px;padding:16px;background:#f5f7f7"><strong>Payment instructions</strong><p style="white-space:pre-wrap">${escapeHtml(settings.payment_instructions)}</p></div>` : ''}<p style="margin-top:30px">Questions? Reply to this email or contact us at ${escapeHtml(settings?.phone || '')}.</p></div><div style="padding:18px 30px;background:#f5f7f7;color:#66747c;font-size:12px">${escapeHtml(company)} · ${escapeHtml(settings?.email || '')}</div></div></div></body></html>`;
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin || '';
  if (request.method === 'OPTIONS') { response.writeHead(204, corsHeaders(origin)); response.end(); return; }

  if ((request.url === '/' || request.url === '/index.html') && request.method === 'GET') {
    response.writeHead(200, {
      ...corsHeaders(origin),
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Gary CRM Email Server</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #eef1f2; color: #17232a; font-family: Arial, sans-serif; }
    main { width: min(560px, calc(100% - 32px)); padding: 32px; box-sizing: border-box; background: white; border-radius: 18px; box-shadow: 0 20px 60px rgba(23,35,42,.12); }
    .status { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: #eaf8ef; color: #17683a; font-weight: 700; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: currentColor; }
    h1 { margin: 18px 0 8px; }
    p { line-height: 1.6; color: #526068; }
    code { display: block; margin-top: 14px; padding: 12px; border-radius: 10px; background: #f5f7f7; color: #17232a; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <div class="status"><span class="dot"></span>Email server online</div>
    <h1>Gary CRM email service</h1>
    <p>The local Resend service is listening on port ${PORT}.</p>
    <p>Resend configuration: <strong>${apiKey ? 'API key detected' : 'API key missing'}</strong></p>
    <p>Configured sender: <strong>${escapeHtml(fromEmail)}</strong></p>
    <p>Sender mode: <strong>${senderUsesPlaceholder ? 'Placeholder domain — update .env.server' : senderUsesTestDomain ? 'Resend test domain — only your Resend account email can receive tests' : 'Custom sender domain'}</strong></p>
    <code>Health check: /api/health</code>
    <code>Send endpoint: /api/resend/send-document</code>
  </main>
</body>
</html>`);
    return;
  }

  if (request.url === '/api/health' && request.method === 'GET') return sendJson(response, 200, {
    ok: true,
    resendConfigured: Boolean(apiKey),
    sender: fromEmail,
    senderDomain,
    senderMode: senderUsesPlaceholder ? 'placeholder' : senderUsesTestDomain ? 'test' : 'custom',
  }, origin);
  if (request.url !== '/api/resend/send-document' || request.method !== 'POST') return sendJson(response, 404, { error: 'Not found.' }, origin);
  try {
    if (!isAllowedOrigin(origin)) return sendJson(response, 403, { error: 'Origin is not allowed.' }, origin);
    if (!apiKey) return sendJson(response, 503, { error: 'RESEND_API_KEY is missing from .env.server.', action: 'Add your Resend API key and restart npm run dev.' }, origin);
    if (senderUsesPlaceholder) return sendJson(response, 422, {
      error: 'RESEND_FROM_EMAIL still uses the placeholder domain.',
      action: 'Replace quotes@your-verified-domain.com in .env.server with onboarding@resend.dev for self-testing, or an address at a domain verified in Resend.',
      sender: fromEmail,
    }, origin);
    const payload = await readJson(request);
    if (!['quote', 'invoice'].includes(payload.type)) return sendJson(response, 400, { error: 'Document type must be quote or invoice.' }, origin);
    if (!payload.client?.email || !/^\S+@\S+\.\S+$/.test(payload.client.email)) return sendJson(response, 400, { error: 'A valid client email is required.' }, origin);
    const number = payload.type === 'quote' ? payload.document?.quote_number : payload.document?.invoice_number;
    if (!number || !Array.isArray(payload.document?.items)) return sendJson(response, 400, { error: 'Document data is incomplete.' }, origin);
    const subject = `${payload.type === 'quote' ? 'Quote' : 'Invoice'} ${number} from ${payload.settings?.legal_name || 'Gary Commercial Rail & Fence'}`;
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': resendUserAgent,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [payload.client.email],
        subject,
        html: renderEmail(payload),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const rawResult = await resendResponse.text();
    let result = {};
    try { result = rawResult ? JSON.parse(rawResult) : {}; } catch { result = { message: rawResult }; }

    if (!resendResponse.ok) {
      const resendMessage = result.message || result.error || result.name || 'Resend rejected the email.';
      let action = 'Check the API key and sender configuration in .env.server, then restart npm run dev.';
      if (senderUsesTestDomain) action = 'onboarding@resend.dev can only send to the email address that owns your Resend account. Send this test to that address, or verify your own domain and update RESEND_FROM_EMAIL.';
      if (/not verified|domain/i.test(resendMessage)) action = `Verify ${senderDomain || 'your sender domain'} in Resend and make RESEND_FROM_EMAIL use that exact verified domain or subdomain.`;
      if (/api key|invalid_api_key/i.test(`${resendMessage} ${result.name || ''}`)) action = 'Create or copy a valid Resend API key into .env.server, with no quotes or trailing spaces, then restart npm run dev.';
      if (/1010|access denied/i.test(`${resendMessage} ${result.code || ''}`)) action = 'The request was blocked before reaching Resend. The server now sends the required User-Agent header; restart npm run dev and retry.';

      console.error('[CRM email] Resend rejected request', {
        status: resendResponse.status,
        sender: fromEmail,
        recipient: payload.client.email,
        result,
      });

      return sendJson(response, resendResponse.status, {
        error: resendMessage,
        action,
        code: result.name || result.code || null,
        sender: fromEmail,
        recipient: payload.client.email,
      }, origin);
    }
    return sendJson(response, 200, { ok: true, id: result.id }, origin);
  } catch (error) { return sendJson(response, 500, { error: error.message || 'Email failed.' }, origin); }
});

server.listen(PORT, () => {
  console.log(`[CRM email] listening on http://localhost:${PORT}`);
  console.log(apiKey ? '[CRM email] Resend configured.' : '[CRM email] Add RESEND_API_KEY to .env.server before sending.');
});

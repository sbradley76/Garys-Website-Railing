export const money = (cents = 0) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((Number(cents) || 0) / 100);
export const dateLabel = (value) => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : '—';
export const dateTimeLabel = (value) => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '—';
export const labelize = (value) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function calculateDocument(items = [], discountCents = 0, taxRate = 0) {
  const subtotal = items.reduce((sum, item) => sum + Math.round((Number(item.quantity) || 0) * (Number(item.unit_price_cents) || 0)), 0);
  const discount = Math.max(0, Number(discountCents) || 0);
  const taxableSubtotal = items.filter((item) => item.taxable !== false).reduce((sum, item) => sum + Math.round((Number(item.quantity) || 0) * (Number(item.unit_price_cents) || 0)), 0);
  const discountedTaxable = subtotal > 0 ? Math.max(0, taxableSubtotal - discount * (taxableSubtotal / subtotal)) : 0;
  const tax = Math.round(discountedTaxable * ((Number(taxRate) || 0) / 100));
  const total = Math.max(0, subtotal - discount + tax);
  return { subtotal_cents: subtotal, discount_cents: discount, tax_cents: tax, total_cents: total };
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));

export function buildDocumentHtml({ type, document, client, job, settings }) {
  const isInvoice = type === 'invoice';
  const title = isInvoice ? 'Invoice' : 'Quote';
  const number = isInvoice ? document.invoice_number : document.quote_number;
  const dueLabel = isInvoice ? 'Due date' : 'Valid through';
  const dueValue = isInvoice ? document.due_on : document.expires_on;
  const items = document.items || [];
  const balance = isInvoice ? Number(document.balance_due_cents ?? document.total_cents ?? 0) : Number(document.total_cents || 0);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(number)}</title><style>
    *{box-sizing:border-box}body{margin:0;padding:36px;background:#eef1f2;color:#17232a;font:14px/1.5 Arial,sans-serif}.sheet{max-width:900px;margin:auto;background:white;padding:48px;box-shadow:0 12px 40px rgba(0,0,0,.12)}
    header{display:flex;justify-content:space-between;gap:30px;padding-bottom:28px;border-bottom:3px solid #17232a}.brand h1{margin:0;font-size:26px}.brand p,.muted{color:#66747c}.doc-title{text-align:right}.doc-title h2{margin:0;font-size:44px;text-transform:uppercase}.doc-title strong{display:block;margin-top:6px}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin:32px 0}.meta h3{margin:0 0 8px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#ef7d2c}.meta p{margin:2px 0}.dates{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px}.dates div{padding:12px;background:#f4f6f6}.dates span{display:block;color:#66747c;font-size:10px;text-transform:uppercase}.dates strong{display:block;margin-top:4px}
    table{width:100%;border-collapse:collapse}th{padding:12px 10px;background:#17232a;color:white;text-align:left;font-size:10px;text-transform:uppercase}td{padding:14px 10px;border-bottom:1px solid #dde2e4;vertical-align:top}.right{text-align:right}.totals{width:min(360px,100%);margin:24px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:8px 0}.totals .grand{margin-top:6px;padding:14px 0;border-top:2px solid #17232a;font-size:20px;font-weight:bold}.balance{padding:14px;background:#fff2e8;color:#8a4718}
    .notes{margin-top:34px;padding-top:24px;border-top:1px solid #dde2e4}.notes h3{font-size:11px;text-transform:uppercase;letter-spacing:.1em}.notes p{white-space:pre-wrap}.footer{margin-top:38px;padding-top:20px;border-top:1px solid #dde2e4;color:#66747c;font-size:11px}@media print{body{padding:0;background:white}.sheet{max-width:none;box-shadow:none;padding:24px}}
  </style></head><body><main class="sheet"><header><div class="brand"><h1>${escapeHtml(settings.legal_name)}</h1><p>${escapeHtml(settings.address_line_1)}${settings.address_line_2 ? `<br>${escapeHtml(settings.address_line_2)}` : ''}<br>${escapeHtml(settings.phone)} · ${escapeHtml(settings.email)}</p></div><div class="doc-title"><h2>${title}</h2><strong>${escapeHtml(number)}</strong><span class="muted">${escapeHtml(labelize(document.status))}</span></div></header>
  <section class="meta"><div><h3>Prepared for</h3><p><strong>${escapeHtml(client?.company_name || client?.primary_contact_name || 'Client')}</strong></p><p>${escapeHtml(client?.primary_contact_name || '')}</p><p>${escapeHtml(client?.email || '')}</p><p>${escapeHtml(client?.phone || '')}</p><p>${escapeHtml([client?.billing_address_line_1, client?.billing_address_line_2, client?.billing_city, client?.billing_state, client?.billing_zip].filter(Boolean).join(', '))}</p></div><div><h3>Project</h3><p><strong>${escapeHtml(job?.title || document.project_title || 'Commercial railing/fence work')}</strong></p><p>${escapeHtml([job?.project_address, job?.city, job?.state, job?.zip_code].filter(Boolean).join(', '))}</p>${document.po_number ? `<p>PO: ${escapeHtml(document.po_number)}</p>` : ''}</div></section>
  <section class="dates"><div><span>Issued</span><strong>${dateLabel(document.issued_on)}</strong></div><div><span>${dueLabel}</span><strong>${dateLabel(dueValue)}</strong></div><div><span>Total</span><strong>${money(document.total_cents)}</strong></div></section>
  <table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(item.unit || '')}</td><td class="right">${money(item.unit_price_cents)}</td><td class="right">${money(Math.round((Number(item.quantity)||0)*(Number(item.unit_price_cents)||0)))}</td></tr>`).join('')}</tbody></table>
  <section class="totals"><div><span>Subtotal</span><strong>${money(document.subtotal_cents)}</strong></div>${document.discount_cents ? `<div><span>Discount</span><strong>-${money(document.discount_cents)}</strong></div>` : ''}${document.tax_cents ? `<div><span>Tax (${escapeHtml(document.tax_rate)}%)</span><strong>${money(document.tax_cents)}</strong></div>` : ''}<div class="grand"><span>Total</span><span>${money(document.total_cents)}</span></div>${isInvoice ? `<div><span>Paid</span><strong>${money(document.amount_paid_cents)}</strong></div><div class="balance"><span>Balance due</span><strong>${money(balance)}</strong></div>` : ''}</section>
  ${(document.notes || document.terms || (isInvoice && settings.payment_instructions)) ? `<section class="notes">${document.notes ? `<h3>Notes</h3><p>${escapeHtml(document.notes)}</p>` : ''}${document.terms ? `<h3>Terms</h3><p>${escapeHtml(document.terms)}</p>` : ''}${isInvoice && settings.payment_instructions ? `<h3>Payment instructions</h3><p>${escapeHtml(settings.payment_instructions)}</p>` : ''}</section>` : ''}
  <div class="footer">Thank you for the opportunity to work with you. Questions? Contact ${escapeHtml(settings.email)} or ${escapeHtml(settings.phone)}.</div></main></body></html>`;
}

export function openPrintWindow(payload) {
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) return false;
  popup.document.open();
  popup.document.write(buildDocumentHtml(payload));
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 250);
  return true;
}

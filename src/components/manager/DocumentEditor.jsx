import { useEffect, useMemo, useState } from 'react';
import Icon from '../Icon';
import { calculateDocument, money } from '../../lib/documentUtils';
import { makeId } from '../../lib/crmDemo';

const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired'];
const INVOICE_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'];

const blankItem = () => ({
  id: makeId(),
  description: '',
  quantity: 1,
  unit: 'LS',
  unit_price_cents: 0,
  unit_price_dollars: 0,
  taxable: true,
});

function normalizeItem(item = {}) {
  return {
    id: item.id || makeId(),
    description: String(item.description ?? ''),
    quantity: item.quantity ?? 1,
    unit: String(item.unit ?? 'LS'),
    unit_price_cents: Number(item.unit_price_cents) || 0,
    unit_price_dollars: item.unit_price_dollars ?? (Number(item.unit_price_cents) || 0) / 100,
    taxable: item.taxable !== false,
  };
}

function normalizeDocument(record, isInvoice, settings) {
  const sourceItems = Array.isArray(record?.items) && record.items.length
    ? record.items
    : [blankItem()];

  return {
    ...record,
    id: record?.id || makeId(),
    client_id: String(record?.client_id ?? ''),
    job_id: String(record?.job_id ?? ''),
    status: String(record?.status || 'draft'),
    issued_on: String(record?.issued_on ?? ''),
    expires_on: String(record?.expires_on ?? ''),
    due_on: String(record?.due_on ?? ''),
    po_number: String(record?.po_number ?? ''),
    tax_rate: record?.tax_rate ?? settings?.default_tax_rate ?? 0,
    discount_dollars: record?.discount_dollars ?? (Number(record?.discount_cents) || 0) / 100,
    notes: String(record?.notes ?? ''),
    terms: String(record?.terms ?? (isInvoice ? settings?.invoice_terms : settings?.quote_terms) ?? ''),
    amount_paid_cents: Number(record?.amount_paid_cents) || 0,
    balance_due_cents: Number(record?.balance_due_cents) || 0,
    items: sourceItems.map(normalizeItem),
  };
}

export default function DocumentEditor({ open, type, record, clients, jobs, settings, onClose, onSave }) {
  const isInvoice = type === 'invoice';
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !record) {
      setDraft(null);
      return;
    }
    setDraft(normalizeDocument(record, isInvoice, settings));
    setError('');
  }, [open, record, isInvoice, settings]);

  const totals = useMemo(() => {
    if (!draft) return calculateDocument([], 0, 0);
    const items = draft.items.map(({ unit_price_dollars, ...item }) => ({
      ...item,
      quantity: Number(item.quantity) || 0,
      unit_price_cents: Math.round((Number(unit_price_dollars) || 0) * 100),
    }));
    return calculateDocument(
      items,
      Math.round((Number(draft.discount_dollars) || 0) * 100),
      Number(draft.tax_rate) || 0,
    );
  }, [draft]);

  if (!open || !draft) return null;

  function patchDraft(patch) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updateItem(index, patch) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    }));
  }

  function removeItem(index) {
    setDraft((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!draft.client_id) {
      setError('Choose a client before saving.');
      return;
    }

    const cleanItems = draft.items
      .map(({ unit_price_dollars, ...item }) => ({
        ...item,
        description: String(item.description ?? '').trim(),
        quantity: Number(item.quantity) || 0,
        unit: String(item.unit ?? 'LS').trim() || 'LS',
        unit_price_cents: Math.round((Number(unit_price_dollars) || 0) * 100),
        taxable: item.taxable !== false,
      }))
      .filter((item) => item.description && item.quantity > 0);

    if (!cleanItems.length) {
      setError('Add at least one valid line item.');
      return;
    }

    setSaving(true);
    try {
      const discountCents = Math.round((Number(draft.discount_dollars) || 0) * 100);
      await onSave({
        ...draft,
        tax_rate: Number(draft.tax_rate) || 0,
        items: cleanItems,
        discount_cents: discountCents,
        ...calculateDocument(cleanItems, discountCents, Number(draft.tax_rate) || 0),
      });
      onClose();
    } catch (saveError) {
      const detail = saveError?.details || saveError?.hint || '';
      setError([saveError?.message || 'Unable to save this document.', detail].filter(Boolean).join(' '));
    } finally {
      setSaving(false);
    }
  }

  const eligibleJobs = jobs.filter((job) => !draft.client_id || job.client_id === draft.client_id);
  const statuses = isInvoice
    ? [...new Set([...INVOICE_STATUSES, draft.status || 'draft'])]
    : [...new Set([...QUOTE_STATUSES, draft.status || 'draft'])];

  return <div className="crm-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="crm-modal document-editor" onSubmit={submit}>
      <header className="crm-modal-head">
        <div><p className="eyebrow">{record.id ? 'Edit' : 'Create'} {isInvoice ? 'invoice' : 'quote'}</p><h2>{isInvoice ? draft.invoice_number : draft.quote_number}</h2></div>
        <button type="button" className="crm-icon-button" onClick={onClose} aria-label="Close"><Icon name="close"/></button>
      </header>

      <div className="crm-modal-body">
        {error ? <div className="manager-error">{error}</div> : null}
        <section className="crm-form-section">
          <h3>Document details</h3>
          <div className="crm-form-grid three">
            <label>Client<select value={draft.client_id} onChange={(event) => patchDraft({ client_id: event.target.value, job_id: '' })} required><option value="">Choose client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name || client.primary_contact_name}</option>)}</select></label>
            <label>Project / job<select value={draft.job_id} onChange={(event) => patchDraft({ job_id: event.target.value })}><option value="">No linked job</option>{eligibleJobs.map((job) => <option key={job.id} value={job.id}>{job.job_number} · {job.title}</option>)}</select></label>
            <label>Status<select value={draft.status} onChange={(event) => patchDraft({ status: event.target.value })}>{statuses.map((status) => <option value={status} key={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
            <label>Issued on<input type="date" value={draft.issued_on} onChange={(event) => patchDraft({ issued_on: event.target.value })} required/></label>
            <label>{isInvoice ? 'Due on' : 'Expires on'}<input type="date" value={isInvoice ? draft.due_on : draft.expires_on} onChange={(event) => patchDraft({ [isInvoice ? 'due_on' : 'expires_on']: event.target.value })} required/></label>
            {isInvoice ? <label>PO / reference<input value={draft.po_number} onChange={(event) => patchDraft({ po_number: event.target.value })} placeholder="Optional"/></label> : <label>Tax rate (%)<input type="number" min="0" max="100" step="0.01" value={draft.tax_rate} onChange={(event) => patchDraft({ tax_rate: event.target.value })}/></label>}
          </div>
          {isInvoice ? <div className="crm-form-grid two"><label>Tax rate (%)<input type="number" min="0" max="100" step="0.01" value={draft.tax_rate} onChange={(event) => patchDraft({ tax_rate: event.target.value })}/></label><label>Discount ($)<input type="number" min="0" step="0.01" value={draft.discount_dollars} onChange={(event) => patchDraft({ discount_dollars: event.target.value })}/></label></div> : <label className="crm-inline-field">Discount ($)<input type="number" min="0" step="0.01" value={draft.discount_dollars} onChange={(event) => patchDraft({ discount_dollars: event.target.value })}/></label>}
        </section>

        <section className="crm-form-section">
          <div className="crm-section-heading"><h3>Line items</h3><button type="button" className="crm-secondary-button" onClick={() => setDraft((current) => ({ ...current, items: [...current.items, blankItem()] }))}><Icon name="plus"/> Add line</button></div>
          <div className="document-lines">
            <div className="document-line labels"><span>Description</span><span>Qty</span><span>Unit</span><span>Rate</span><span>Tax</span><span/></div>
            {draft.items.map((item, index) => <div className="document-line" key={item.id || index}>
              <input value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} placeholder="Labor, material, mobilization…" aria-label="Description"/>
              <input type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} aria-label="Quantity"/>
              <input value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value })} placeholder="LF" aria-label="Unit"/>
              <input type="number" min="0" step="0.01" value={item.unit_price_dollars} onChange={(event) => updateItem(index, { unit_price_dollars: event.target.value })} aria-label="Unit price"/>
              <label className="crm-check"><input type="checkbox" checked={item.taxable} onChange={(event) => updateItem(index, { taxable: event.target.checked })}/><span>Taxable</span></label>
              <button type="button" className="crm-icon-button danger" onClick={() => removeItem(index)} disabled={draft.items.length === 1} aria-label="Remove line"><Icon name="close" size={16}/></button>
            </div>)}
          </div>
          <div className="document-totals-editor">
            <div><span>Subtotal</span><strong>{money(totals.subtotal_cents)}</strong></div>
            <div><span>Discount</span><strong>-{money(totals.discount_cents)}</strong></div>
            <div><span>Tax</span><strong>{money(totals.tax_cents)}</strong></div>
            <div className="grand"><span>Total</span><strong>{money(totals.total_cents)}</strong></div>
          </div>
        </section>

        <section className="crm-form-section">
          <div className="crm-form-grid two">
            <label>Customer-facing notes<textarea value={draft.notes} onChange={(event) => patchDraft({ notes: event.target.value })} placeholder="Clarifications, exclusions, next steps…"/></label>
            <label>Terms<textarea value={draft.terms} onChange={(event) => patchDraft({ terms: event.target.value })}/></label>
          </div>
        </section>
      </div>
      <footer className="crm-modal-actions"><button type="button" className="crm-secondary-button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : `Save ${isInvoice ? 'invoice' : 'quote'}`} <Icon name="arrow"/></button></footer>
    </form>
  </div>;
}

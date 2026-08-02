import { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getDemoLeads, updateDemoLead } from '../lib/demoData';
import { DEFAULT_CRM_SETTINGS, getDemoCrm, makeId, nextDocumentNumber, resetDemoCrm, saveDemoCrm } from '../lib/crmDemo';
import { dateLabel, dateTimeLabel, labelize, money, openPrintWindow } from '../lib/documentUtils';
import { SITE } from '../config/site';
import Icon from './Icon';
import DocumentEditor from './manager/DocumentEditor';
import RecordModal from './manager/RecordModal';

const LEAD_STATUSES = ['new', 'contacted', 'site_visit', 'estimating', 'quoted', 'won', 'lost', 'on_hold'];
const PRIORITIES = ['normal', 'high', 'hot'];
const JOB_STATUSES = ['planning', 'scheduled', 'in_progress', 'waiting', 'completed', 'canceled'];
const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired'];
const INVOICE_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'];
const TABLES = {
  clients: 'railing_clients', jobs: 'railing_jobs', quotes: 'railing_quotes', invoices: 'railing_invoices', payments: 'railing_payments', activities: 'railing_activities',
};

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date, days) => { const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + Number(days || 0)); return next.toISOString().slice(0, 10); };
const fullName = (lead) => `${lead?.first_name || ''} ${lead?.last_name || ''}`.trim();
const clientName = (client) => client?.company_name || client?.primary_contact_name || 'Unnamed client';
const jobAddress = (job) => [job?.project_address, job?.city, job?.state, job?.zip_code].filter(Boolean).join(', ');
const isPast = (date) => date && String(date).slice(0, 10) < today();
const effectiveInvoiceStatus = (invoice) => {
  if (invoice.status === 'void') return 'void';
  if ((Number(invoice.balance_due_cents) || 0) <= 0 || invoice.status === 'paid') return 'paid';
  if (isPast(invoice.due_on)) return 'overdue';
  if ((Number(invoice.amount_paid_cents) || 0) > 0) return 'partial';
  return invoice.status || 'draft';
};
const cleanRecord = (record, omit = []) => Object.fromEntries(Object.entries(record).filter(([key, value]) => !omit.includes(key) && value !== undefined));

function useManagerSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session || null); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, loading };
}

function Login({ onBack, onDemo }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function login(event) {
    event.preventDefault(); setBusy(true); setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError(authError.message);
    setBusy(false);
  }
  return <main className="manager-login"><button className="back-site" onClick={onBack}><Icon name="arrow" className="reverse-icon"/> Back to website</button><section><div className="manager-logo"><span className="brand-mark"><i/><i/><i/></span></div><p className="eyebrow">Private business manager</p><h1>{SITE.shortName} CRM</h1><p>Manage inquiries, clients, jobs, quotes, invoices, payments, and communication from one lightweight workspace.</p>{isSupabaseConfigured ? <form onSubmit={login}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required/></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required/></label>{error ? <div className="manager-error">{error}</div> : null}<button className="button button-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <Icon name="arrow"/></button></form> : <><div className="demo-banner"><strong>Supabase is not connected.</strong><span>Demo mode includes seeded clients, active and completed jobs, quotes, invoices, payments, and activity history.</span></div><button className="button button-primary full-button" onClick={onDemo}>Open demo CRM <Icon name="arrow"/></button></>}</section></main>;
}

function EmptyState({ title, copy, action, onAction }) {
  return <div className="crm-empty"><span className="brand-mark"><i/><i/><i/></span><h3>{title}</h3><p>{copy}</p>{action ? <button className="crm-secondary-button" onClick={onAction}><Icon name="plus"/>{action}</button> : null}</div>;
}

function Badge({ value, type = 'status' }) { return <span className={`crm-badge ${type} ${String(value || '').replaceAll('_', '-')}`}>{labelize(value)}</span>; }

function PageHeader({ eyebrow, title, copy, actions }) {
  return <div className="crm-page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{copy ? <p>{copy}</p> : null}</div><div className="crm-page-actions">{actions}</div></div>;
}

function Kpi({ label, value, copy, alert = false }) {
  return <article className={alert ? 'crm-kpi alert' : 'crm-kpi'}><span>{label}</span><strong>{value}</strong><small>{copy}</small></article>;
}

function DataToolbar({ search, setSearch, placeholder, status, setStatus, options = [], extra }) {
  return <div className="crm-toolbar"><label className="crm-search"><Icon name="search"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder}/></label>{setStatus ? <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option>{options.map((option) => <option value={option} key={option}>{labelize(option)}</option>)}</select> : null}{extra}</div>;
}

function ActivityList({ activities, crm, limit }) {
  const rows = [...activities].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit || activities.length);
  return <div className="crm-activity-list">{rows.length ? rows.map((activity) => {
    const client = crm.clients.find((item) => item.id === activity.client_id);
    return <article key={activity.id}><span className={`activity-icon ${activity.activity_type}`}><Icon name={activity.activity_type === 'email' ? 'mail' : activity.activity_type === 'call' ? 'phone' : activity.activity_type === 'payment' ? 'check' : 'clock'} size={16}/></span><div><strong>{activity.summary}</strong><p>{activity.details || clientName(client)}</p><small>{dateTimeLabel(activity.created_at)}{client ? ` · ${clientName(client)}` : ''}</small></div></article>;
  }) : <p className="crm-muted">No activity recorded yet.</p>}</div>;
}

export default function Manager({ onBack }) {
  const { session, loading } = useManagerSession();
  const [demoActive, setDemoActive] = useState(false);
  const [view, setView] = useState('dashboard');
  const [leads, setLeads] = useState([]);
  const [crm, setCrm] = useState({ clients: [], jobs: [], quotes: [], invoices: [], payments: [], activities: [], settings: DEFAULT_CRM_SETTINGS });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [leadDraft, setLeadDraft] = useState(null);
  const [leadFiles, setLeadFiles] = useState([]);
  const [recordModal, setRecordModal] = useState(null);
  const [documentModal, setDocumentModal] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [emailing, setEmailing] = useState(null);

  const active = Boolean(session || demoActive);
  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) || null;
  const selectedClient = crm.clients.find((client) => client.id === selectedClientId) || null;
  const selectedJob = crm.jobs.find((job) => job.id === selectedJobId) || null;

  const persistDemo = (next) => { setCrm(next); saveDemoCrm(next); };

  async function loadAll() {
    setBusy(true); setMessage('');
    try {
      if (demoActive || !isSupabaseConfigured) {
        const demoCrm = getDemoCrm();
        const demoLeads = getDemoLeads().map((lead) => {
          const client = demoCrm.clients.find((item) => item.source_lead_id === lead.id);
          return client ? { ...lead, client_id: client.id, converted_at: lead.converted_at || client.created_at } : lead;
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setCrm(demoCrm); setLeads(demoLeads);
        setSelectedLeadId((id) => id || demoLeads[0]?.id || null);
        setSelectedClientId((id) => id || demoCrm.clients[0]?.id || null);
        setSelectedJobId((id) => id || demoCrm.jobs[0]?.id || null);
        return;
      }
      const [leadResult, clientsResult, jobsResult, quotesResult, invoicesResult, paymentsResult, settingsResult] = await Promise.all([
        supabase.from('railing_leads').select('*').order('created_at', { ascending: false }),
        supabase.from(TABLES.clients).select('*').order('updated_at', { ascending: false }),
        supabase.from(TABLES.jobs).select('*').order('updated_at', { ascending: false }),
        supabase.from(TABLES.quotes).select('*').order('created_at', { ascending: false }),
        supabase.from(TABLES.invoices).select('*').order('created_at', { ascending: false }),
        supabase.from(TABLES.payments).select('*').order('paid_on', { ascending: false }),
        supabase.from('railing_crm_settings').select('data').eq('settings_key', 'default').maybeSingle(),
      ]);
      const firstError = [leadResult, clientsResult, jobsResult, quotesResult, invoicesResult, paymentsResult].find((result) => result.error)?.error;
      if (firstError) throw firstError;

      // Activity history is useful, but it should never prevent the rest of the CRM from loading.
      // A newly created or partially migrated table can briefly be absent from PostgREST's schema cache.
      const activitiesResult = await supabase.from(TABLES.activities).select('*').order('created_at', { ascending: false });
      const activityWarning = activitiesResult.error
        ? `CRM loaded, but activity history is unavailable: ${activitiesResult.error.message}. Run supabase/fix_railing_activities.sql.`
        : '';

      const next = {
        clients: clientsResult.data || [], jobs: jobsResult.data || [], quotes: quotesResult.data || [], invoices: invoicesResult.data || [], payments: paymentsResult.data || [], activities: activitiesResult.data || [],
        settings: { ...DEFAULT_CRM_SETTINGS, ...(settingsResult.data?.data || {}) },
      };
      setLeads(leadResult.data || []); setCrm(next); setMessage(activityWarning);
      setSelectedLeadId((id) => id || leadResult.data?.[0]?.id || null);
      setSelectedClientId((id) => id || next.clients[0]?.id || null);
      setSelectedJobId((id) => id || next.jobs[0]?.id || null);
    } catch (error) { setMessage(error.message || 'Unable to load CRM data. Run the CRM Supabase migration first.'); }
    finally { setBusy(false); }
  }

  useEffect(() => { if (active) loadAll(); }, [active, demoActive]);
  useEffect(() => { setSearch(''); setStatusFilter('all'); setSelectedDocumentId(null); }, [view]);
  useEffect(() => {
    const modalOpen = Boolean(recordModal || documentModal);
    document.body.classList.toggle('modal-open', modalOpen);
    return () => document.body.classList.remove('modal-open');
  }, [recordModal, documentModal]);
  useEffect(() => { setLeadDraft(selectedLead ? { ...selectedLead, quote_dollars: selectedLead.quote_amount_cents == null ? '' : selectedLead.quote_amount_cents / 100 } : null); }, [selectedLeadId, leads]);
  useEffect(() => {
    let cancelled = false;
    async function loadFiles() {
      if (!selectedLead) { setLeadFiles([]); return; }
      if (demoActive || !isSupabaseConfigured) { setLeadFiles((selectedLead.uploaded_file_names || []).map((name) => ({ original_name: name, demo: true }))); return; }
      const { data, error } = await supabase.from('railing_lead_images').select('*').eq('lead_id', selectedLead.id).order('created_at');
      if (error || cancelled) { if (!cancelled) setLeadFiles([]); return; }
      const signed = await Promise.all((data || []).map(async (file) => { const { data: signedData } = await supabase.storage.from('railing-lead-images').createSignedUrl(file.storage_path, 900); return { ...file, signed_url: signedData?.signedUrl || '' }; }));
      if (!cancelled) setLeadFiles(signed);
    }
    loadFiles(); return () => { cancelled = true; };
  }, [selectedLeadId, demoActive]);

  async function upsertCollection(kind, record) {
    const timestamped = { ...record, updated_at: new Date().toISOString(), created_at: record.created_at || new Date().toISOString() };
    if (demoActive || !isSupabaseConfigured) {
      setCrm((current) => {
        const exists = current[kind].some((item) => item.id === timestamped.id);
        const next = { ...current, [kind]: exists ? current[kind].map((item) => item.id === timestamped.id ? timestamped : item) : [timestamped, ...current[kind]] };
        saveDemoCrm(next);
        return next;
      });
      return timestamped;
    }
    const { data, error } = await supabase.from(TABLES[kind]).upsert(timestamped).select().single();
    if (error) throw error;
    setCrm((current) => ({ ...current, [kind]: current[kind].some((item) => item.id === data.id) ? current[kind].map((item) => item.id === data.id ? data : item) : [data, ...current[kind]] }));
    return data;
  }

  async function deleteCollection(kind, id) {
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    if (demoActive || !isSupabaseConfigured) {
      setCrm((current) => { const next = { ...current, [kind]: current[kind].filter((item) => item.id !== id) }; saveDemoCrm(next); return next; });
      return;
    }
    const { error } = await supabase.from(TABLES[kind]).delete().eq('id', id); if (error) throw error;
    setCrm((current) => ({ ...current, [kind]: current[kind].filter((item) => item.id !== id) }));
  }

  async function addActivity(activity) {
    const now = new Date().toISOString();
    const localRecord = {
      id: activity.id || makeId('activity'),
      created_at: activity.created_at || now,
      activity_type: String(activity.activity_type || 'note').trim() || 'note',
      summary: String(activity.summary || 'Activity').trim().slice(0, 300) || 'Activity',
      details: activity.details == null || activity.details === '' ? null : String(activity.details).slice(0, 20000),
      client_id: activity.client_id || null,
      lead_id: activity.lead_id || null,
      job_id: activity.job_id || null,
      quote_id: activity.quote_id || null,
      invoice_id: activity.invoice_id || null,
    };

    if (demoActive || !isSupabaseConfigured) {
      setCrm((current) => {
        const next = { ...current, activities: [localRecord, ...current.activities.filter((item) => item.id !== localRecord.id)] };
        saveDemoCrm(next);
        return next;
      });
      return localRecord;
    }

    // Activity records intentionally bypass the generic upsert helper. That
    // helper adds updated_at, but railing_activities has no updated_at column.
    // Let PostgreSQL generate id, created_at, and created_by instead.
    const payload = {
      activity_type: localRecord.activity_type,
      summary: localRecord.summary,
      details: localRecord.details,
      client_id: localRecord.client_id,
      lead_id: localRecord.lead_id,
      job_id: localRecord.job_id,
      quote_id: localRecord.quote_id,
      invoice_id: localRecord.invoice_id,
    };

    let { error } = await supabase.from(TABLES.activities).insert(payload);

    // A stale relationship should never make quote/invoice saving or email
    // delivery look like it failed. Preserve the timeline entry without links
    // when a referenced record was removed or migrated under a different ID.
    if (error?.code === '23503') {
      const fallbackPayload = {
        activity_type: payload.activity_type,
        summary: payload.summary,
        details: payload.details,
        client_id: null,
        lead_id: null,
        job_id: null,
        quote_id: null,
        invoice_id: null,
      };
      const retry = await supabase.from(TABLES.activities).insert(fallbackPayload);
      error = retry.error;
    }

    if (error) {
      // Activity history is useful, but it is secondary. Do not throw here or
      // turn a successful quote save / invoice email into a false failure.
      console.warn('[CRM] Activity timeline entry was skipped', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload,
      });
      return null;
    }

    setCrm((current) => ({ ...current, activities: [localRecord, ...current.activities] }));
    return localRecord;
  }

  async function updateLead(update, lead = selectedLead) {
    if (!lead) return null;
    const next = { ...lead, ...update, updated_at: new Date().toISOString() };
    if (demoActive || !isSupabaseConfigured) updateDemoLead(next);
    else { const { error } = await supabase.from('railing_leads').update(update).eq('id', lead.id); if (error) throw error; }
    setLeads((current) => current.map((item) => item.id === lead.id ? next : item));
    return next;
  }

  async function saveLeadControls() {
    if (!leadDraft) return; setBusy(true); setMessage('');
    try {
      await updateLead({ status: leadDraft.status, priority: leadDraft.priority, quote_amount_cents: leadDraft.quote_dollars === '' ? null : Math.round(Number(leadDraft.quote_dollars) * 100), internal_notes: leadDraft.internal_notes || '', follow_up_at: leadDraft.follow_up_at || null, scheduled_site_visit_at: leadDraft.scheduled_site_visit_at || null });
      setMessage('Lead updated.');
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  async function ensureClientFromLead(lead) {
    const existing = crm.clients.find((client) => client.id === lead.client_id || client.source_lead_id === lead.id);
    if (existing) return existing;
    const client = await upsertCollection('clients', {
      id: makeId('client'), company_name: lead.company_name || '', primary_contact_name: fullName(lead), email: lead.email, phone: lead.phone,
      billing_address_line_1: lead.project_address || '', billing_address_line_2: '', billing_city: lead.city || '', billing_state: lead.state || 'FL', billing_zip: lead.zip_code || '',
      status: 'active', notes: `Converted from website inquiry.\n\nOriginal scope: ${lead.project_scope || ''}`, source_lead_id: lead.id,
    });
    await updateLead({ client_id: client.id, converted_at: new Date().toISOString(), status: lead.status === 'lost' ? 'lost' : 'won' }, lead);
    await addActivity({ client_id: client.id, lead_id: lead.id, activity_type: 'client_created', summary: 'Lead converted to client', details: clientName(client) });
    return client;
  }

  async function convertSelectedLead() {
    if (!selectedLead) return; setBusy(true);
    try { const client = await ensureClientFromLead(selectedLead); setSelectedClientId(client.id); setMessage(`${clientName(client)} is now an active client.`); setView('clients'); } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  function blankClient() { return { id: makeId('client'), company_name: '', primary_contact_name: '', email: '', phone: '', billing_address_line_1: '', billing_address_line_2: '', billing_city: '', billing_state: 'FL', billing_zip: '', status: 'active', notes: '', source_lead_id: null }; }
  function blankJob(clientId = '') { return { id: makeId('job'), job_number: nextDocumentNumber('JOB', crm.jobs, 'job_number'), client_id: clientId, source_lead_id: null, quote_id: null, title: '', description: '', project_address: '', city: '', state: 'FL', zip_code: '', status: 'planning', start_date: '', target_completion_date: '', completed_at: null, contract_amount_cents: 0, contract_amount_dollars: '', notes: '' }; }
  function blankQuote(clientId = '', leadId = null) { const issued = today(); return { id: makeId('quote'), quote_number: nextDocumentNumber('Q', crm.quotes, 'quote_number'), client_id: clientId, lead_id: leadId, job_id: '', status: 'draft', issued_on: issued, expires_on: addDays(issued, crm.settings.quote_expiration_days), items: [], subtotal_cents: 0, discount_cents: 0, tax_rate: crm.settings.default_tax_rate, tax_cents: 0, total_cents: 0, notes: '', terms: crm.settings.quote_terms }; }
  function blankInvoice(clientId = '', jobId = '', quoteId = null, items = []) { const issued = today(); return { id: makeId('invoice'), invoice_number: nextDocumentNumber('INV', crm.invoices, 'invoice_number'), client_id: clientId, job_id: jobId, quote_id: quoteId, status: 'draft', issued_on: issued, due_on: addDays(issued, crm.settings.invoice_due_days), po_number: '', items, subtotal_cents: 0, discount_cents: 0, tax_rate: crm.settings.default_tax_rate, tax_cents: 0, total_cents: 0, amount_paid_cents: 0, balance_due_cents: 0, notes: '', terms: crm.settings.invoice_terms, sent_at: null, paid_at: null }; }

  async function startQuoteFromLead() {
    if (!selectedLead) return;
    try { const client = await ensureClientFromLead(selectedLead); setDocumentModal({ type: 'quote', record: blankQuote(client.id, selectedLead.id) }); } catch (error) { setMessage(error.message); }
  }

  async function saveClient(record) {
    const saved = await upsertCollection('clients', cleanRecord(record)); setSelectedClientId(saved.id);
    await addActivity({ client_id: saved.id, activity_type: record.created_at ? 'client_update' : 'client_created', summary: record.created_at ? 'Client details updated' : 'Client added', details: clientName(saved) });
  }

  async function saveJob(record) {
    const clean = cleanRecord({ ...record, contract_amount_cents: Math.round((Number(record.contract_amount_dollars ?? record.contract_amount_cents / 100) || 0) * 100), completed_at: record.status === 'completed' ? (record.completed_at || new Date().toISOString()) : null }, ['contract_amount_dollars']);
    const saved = await upsertCollection('jobs', clean); setSelectedJobId(saved.id);
    await addActivity({ client_id: saved.client_id, job_id: saved.id, activity_type: saved.status === 'completed' ? 'job_completed' : 'job_update', summary: saved.status === 'completed' ? 'Job marked complete' : 'Job record updated', details: `${saved.job_number} · ${saved.title}` });
  }

  async function saveDocument(type, record) {
    const kind = type === 'invoice' ? 'invoices' : 'quotes';

    // Only send columns that actually exist on the destination table.
    // Previously every document received both lead_id and quote_id. That meant
    // quote inserts included a nonexistent quote_id column (and invoice inserts
    // included a nonexistent lead_id column), which PostgREST correctly rejected
    // with a 400 Bad Request.
    const quoteFields = [
      'id', 'created_at', 'quote_number', 'client_id', 'lead_id', 'job_id',
      'status', 'issued_on', 'expires_on', 'items', 'subtotal_cents',
      'discount_cents', 'tax_rate', 'tax_cents', 'total_cents', 'notes',
      'terms', 'sent_at',
    ];
    const invoiceFields = [
      'id', 'created_at', 'invoice_number', 'client_id', 'job_id', 'quote_id',
      'status', 'issued_on', 'due_on', 'po_number', 'items', 'subtotal_cents',
      'discount_cents', 'tax_rate', 'tax_cents', 'total_cents',
      'amount_paid_cents', 'balance_due_cents', 'notes', 'terms', 'sent_at',
      'paid_at',
    ];

    const normalized = type === 'invoice'
      ? { ...record, job_id: record.job_id || null, quote_id: record.quote_id || null }
      : { ...record, job_id: record.job_id || null, lead_id: record.lead_id || null };
    const allowedFields = type === 'invoice' ? invoiceFields : quoteFields;
    let clean = Object.fromEntries(
      allowedFields
        .filter((field) => normalized[field] !== undefined)
        .map((field) => [field, normalized[field]]),
    );

    // Force database-facing number fields to actual JSON numbers. Browser number
    // inputs return strings, and PostgREST can reject a string for numeric/bigint
    // columns depending on the generated query plan.
    clean = {
      ...clean,
      tax_rate: Number(clean.tax_rate) || 0,
      subtotal_cents: Math.max(0, Math.round(Number(clean.subtotal_cents) || 0)),
      discount_cents: Math.max(0, Math.round(Number(clean.discount_cents) || 0)),
      tax_cents: Math.max(0, Math.round(Number(clean.tax_cents) || 0)),
      total_cents: Math.max(0, Math.round(Number(clean.total_cents) || 0)),
    };

    if (type === 'invoice') {
      const paid = Math.max(0, Math.round(Number(clean.amount_paid_cents) || 0));
      clean = { ...clean, amount_paid_cents: paid, balance_due_cents: Math.max(0, Number(clean.total_cents) - paid) };
      if (clean.balance_due_cents === 0 && clean.total_cents > 0) clean.status = 'paid';
      else if (paid > 0 && clean.status !== 'void') clean.status = 'partial';
    }

    let saved;
    if (demoActive || !isSupabaseConfigured) {
      saved = await upsertCollection(kind, clean);
    } else {
      const table = TABLES[kind];
      const exists = crm[kind].some((item) => item.id === clean.id);
      const payload = { ...clean };

      // Let PostgreSQL own generated IDs/timestamps on inserts. This avoids
      // accidental schema-cache and UUID/default conflicts from table upsert.
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;

      // New records do not need empty optional relationship/timestamp keys.
      // Omitting them also keeps inserts compatible while the repair migration
      // refreshes a partially-created table.
      if (!exists) {
        for (const optional of ['lead_id', 'job_id', 'quote_id', 'sent_at', 'paid_at']) {
          if (payload[optional] == null || payload[optional] === '') delete payload[optional];
        }
      }

      const query = exists
        ? supabase.from(table).update(payload).eq('id', clean.id)
        : supabase.from(table).insert(payload);
      const { data, error } = await query.select('*').single();

      if (error) {
        console.error(`[CRM] ${type} save failed`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          table,
          mode: exists ? 'update' : 'insert',
          payload,
        });
        const detailedError = new Error([
          error.message,
          error.details,
          error.hint,
          error.code ? `Code: ${error.code}` : '',
        ].filter(Boolean).join(' — '));
        detailedError.code = error.code;
        detailedError.details = error.details;
        detailedError.hint = error.hint;
        throw detailedError;
      }

      saved = data;
      setCrm((current) => ({
        ...current,
        [kind]: current[kind].some((item) => item.id === saved.id)
          ? current[kind].map((item) => item.id === saved.id ? saved : item)
          : [saved, ...current[kind]],
      }));
    }

    setSelectedDocumentId(saved.id);
    await addActivity({ client_id: saved.client_id, lead_id: saved.lead_id || null, job_id: saved.job_id || null, quote_id: type === 'quote' ? saved.id : saved.quote_id || null, invoice_id: type === 'invoice' ? saved.id : null, activity_type: `${type}_updated`, summary: `${type === 'invoice' ? saved.invoice_number : saved.quote_number} saved`, details: `${labelize(saved.status)} · ${money(saved.total_cents)}` });
    if (type === 'quote' && saved.lead_id) await updateLead({ status: saved.status === 'accepted' ? 'won' : saved.status === 'draft' ? 'estimating' : 'quoted', quote_amount_cents: saved.total_cents }, leads.find((lead) => lead.id === saved.lead_id));
  }

  async function createJobFromQuote(quote) {
    const client = crm.clients.find((item) => item.id === quote.client_id);
    const lead = leads.find((item) => item.id === quote.lead_id);
    const job = blankJob(quote.client_id);
    const saved = await upsertCollection('jobs', cleanRecord({ ...job, quote_id: quote.id, source_lead_id: quote.lead_id || null, title: lead ? `${labelize(lead.project_type)} · ${clientName(client)}` : `${clientName(client)} project`, description: lead?.project_scope || quote.notes || '', project_address: lead?.project_address || client?.billing_address_line_1 || '', city: lead?.city || client?.billing_city || '', state: lead?.state || client?.billing_state || 'FL', zip_code: lead?.zip_code || client?.billing_zip || '', contract_amount_cents: quote.total_cents, status: 'planning' }, ['contract_amount_dollars']));
    await upsertCollection('quotes', { ...quote, job_id: saved.id, status: quote.status === 'accepted' ? 'accepted' : quote.status });
    if (lead) await updateLead({ status: 'won', client_id: quote.client_id, converted_at: lead.converted_at || new Date().toISOString() }, lead);
    await addActivity({ client_id: quote.client_id, lead_id: quote.lead_id || null, job_id: saved.id, quote_id: quote.id, activity_type: 'job_created', summary: 'Job created from quote', details: `${saved.job_number} · ${money(saved.contract_amount_cents)}` });
    setSelectedJobId(saved.id); setView('jobs'); setMessage(`${saved.job_number} created.`);
  }

  function createInvoiceFromQuote(quote) {
    setDocumentModal({ type: 'invoice', record: blankInvoice(quote.client_id, quote.job_id || '', quote.id, (quote.items || []).map((item) => ({ ...item, id: makeId('invoice-item') }))) });
  }

  async function savePayment(record) {
    const invoice = crm.invoices.find((item) => item.id === record.invoice_id);
    if (!invoice) throw new Error('Invoice not found.');
    const amount = Math.round(Number(record.amount_dollars) * 100);
    if (!amount || amount <= 0) throw new Error('Enter a valid payment amount.');
    if (amount > Number(invoice.balance_due_cents || invoice.total_cents)) throw new Error('Payment cannot exceed the remaining balance.');
    const payment = await upsertCollection('payments', cleanRecord({ ...record, amount_cents: amount }, ['amount_dollars']));
    const paid = Number(invoice.amount_paid_cents || 0) + amount;
    const balance = Math.max(0, Number(invoice.total_cents) - paid);
    const updatedInvoice = await upsertCollection('invoices', { ...invoice, amount_paid_cents: paid, balance_due_cents: balance, status: balance === 0 ? 'paid' : 'partial', paid_at: balance === 0 ? new Date().toISOString() : null });
    await addActivity({ client_id: invoice.client_id, job_id: invoice.job_id || null, quote_id: invoice.quote_id || null, invoice_id: invoice.id, activity_type: 'payment', summary: `Payment recorded for ${invoice.invoice_number}`, details: `${money(payment.amount_cents)} via ${labelize(payment.method)}${payment.reference ? ` · ${payment.reference}` : ''}` });
    setSelectedDocumentId(updatedInvoice.id);
  }

  async function sendDocumentEmail(type, document) {
    const client = crm.clients.find((item) => item.id === document.client_id);
    const job = crm.jobs.find((item) => item.id === document.job_id);
    if (!client?.email) return setMessage('Add an email address to the client before sending.');
    if (!window.confirm(`Send ${type} ${type === 'quote' ? document.quote_number : document.invoice_number} to ${client.email}?`)) return;
    setEmailing(document.id); setMessage('');
    try {
      const base = import.meta.env.VITE_CRM_API_URL || 'http://localhost:8787';
      const response = await fetch(`${base}/api/resend/send-document`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, document, client, job, settings: crm.settings }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = [result.error, result.action, result.code ? `Code: ${result.code}` : ''].filter(Boolean).join(' ');
        throw new Error(details || `Email server rejected the request (${response.status}).`);
      }
      const kind = type === 'invoice' ? 'invoices' : 'quotes';
      const updated = await upsertCollection(kind, { ...document, status: document.status === 'draft' ? 'sent' : document.status, sent_at: new Date().toISOString() });
      await addActivity({ client_id: document.client_id, lead_id: document.lead_id || null, job_id: document.job_id || null, quote_id: type === 'quote' ? document.id : document.quote_id || null, invoice_id: type === 'invoice' ? document.id : null, activity_type: 'email', summary: `${type === 'quote' ? updated.quote_number : updated.invoice_number} emailed`, details: `Sent to ${client.email}` });
      setMessage(`Email sent to ${client.email}.`);
    } catch (error) { setMessage(error.message || 'Email could not be sent.'); }
    finally { setEmailing(null); }
  }

  function printDocument(type, document) {
    const opened = openPrintWindow({ type, document, client: crm.clients.find((item) => item.id === document.client_id), job: crm.jobs.find((item) => item.id === document.job_id), settings: crm.settings });
    if (!opened) setMessage('Your browser blocked the print window. Allow pop-ups and try again.');
  }

  async function saveSettings(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (demoActive || !isSupabaseConfigured) persistDemo({ ...crm, settings: crm.settings });
      else { const { error } = await supabase.from('railing_crm_settings').upsert({ settings_key: 'default', data: crm.settings, updated_at: new Date().toISOString() }); if (error) throw error; }
      setMessage('Business and document defaults saved.');
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }

  const metrics = useMemo(() => {
    const activeJobs = crm.jobs.filter((job) => ['planning', 'scheduled', 'in_progress', 'waiting'].includes(job.status));
    const outstanding = crm.invoices.filter((invoice) => !['paid', 'void'].includes(effectiveInvoiceStatus(invoice))).reduce((sum, invoice) => sum + Number(invoice.balance_due_cents || 0), 0);
    const overdue = crm.invoices.filter((invoice) => effectiveInvoiceStatus(invoice) === 'overdue');
    const paidThisYear = crm.payments.filter((payment) => String(payment.paid_on || '').startsWith(String(new Date().getFullYear()))).reduce((sum, payment) => sum + Number(payment.amount_cents || 0), 0);
    const quotePipeline = crm.quotes.filter((quote) => ['draft', 'sent'].includes(quote.status)).reduce((sum, quote) => sum + Number(quote.total_cents || 0), 0);
    return { activeJobs, outstanding, overdue, paidThisYear, quotePipeline, newLeads: leads.filter((lead) => lead.status === 'new') };
  }, [crm, leads]);

  const filteredLeads = useMemo(() => leads.filter((lead) => [fullName(lead), lead.company_name, lead.email, lead.phone, lead.city, lead.project_scope].join(' ').toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'all' || lead.status === statusFilter)), [leads, search, statusFilter]);
  const filteredClients = useMemo(() => crm.clients.filter((client) => [client.company_name, client.primary_contact_name, client.email, client.phone, client.billing_city].join(' ').toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'all' || client.status === statusFilter)), [crm.clients, search, statusFilter]);
  const filteredJobs = useMemo(() => crm.jobs.filter((job) => [job.job_number, job.title, job.description, job.city, clientName(crm.clients.find((client) => client.id === job.client_id))].join(' ').toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'all' || job.status === statusFilter)), [crm.jobs, crm.clients, search, statusFilter]);
  const currentDocuments = view === 'quotes' ? crm.quotes : crm.invoices;
  const documentStatuses = view === 'quotes' ? QUOTE_STATUSES : INVOICE_STATUSES;
  const filteredDocuments = useMemo(() => currentDocuments.filter((document) => {
    const client = crm.clients.find((item) => item.id === document.client_id);
    const number = view === 'quotes' ? document.quote_number : document.invoice_number;
    const status = view === 'invoices' ? effectiveInvoiceStatus(document) : document.status;
    return [number, clientName(client), document.po_number, document.notes].join(' ').toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'all' || status === statusFilter);
  }), [currentDocuments, crm.clients, search, statusFilter, view]);
  const selectedDocument = currentDocuments.find((item) => item.id === selectedDocumentId) || filteredDocuments[0] || null;

  if (loading) return <div className="manager-loading">Loading manager…</div>;
  if (!active) return <Login onBack={onBack} onDemo={() => setDemoActive(true)}/>;

  const nav = [
    ['dashboard', 'building', 'Dashboard'], ['leads', 'search', 'Leads'], ['clients', 'phone', 'Clients'], ['jobs', 'ruler', 'Jobs'], ['quotes', 'clock', 'Quotes'], ['invoices', 'download', 'Invoices'], ['activity', 'check', 'Activity'], ['settings', 'shield', 'Settings'],
  ];

  return <div className="crm-shell">
    <aside className="crm-sidebar">
      <button className="crm-brand" onClick={() => setView('dashboard')}><span className="brand-mark"><i/><i/><i/></span><span><strong>{SITE.shortName}</strong><small>Business Manager</small></span></button>
      <nav>{nav.map(([key, icon, label]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}><Icon name={icon}/><span>{label}</span>{key === 'leads' && metrics.newLeads.length ? <b>{metrics.newLeads.length}</b> : null}{key === 'invoices' && metrics.overdue.length ? <b className="alert">{metrics.overdue.length}</b> : null}</button>)}</nav>
      <div className="crm-sidebar-foot"><button onClick={onBack}><Icon name="external"/> Website</button><button onClick={async () => { if (session) await supabase.auth.signOut(); setDemoActive(false); }}><Icon name="logout"/> Sign out</button></div>
    </aside>
    <div className="crm-app">
      <header className="crm-topbar"><div><strong>{demoActive ? 'Local demo workspace' : session?.user?.email}</strong><small>{demoActive ? 'Changes save in this browser' : 'Supabase connected'}</small></div><div>{message ? <span className="crm-top-message">{message}</span> : null}<button className="crm-icon-button" onClick={loadAll} disabled={busy} title="Refresh"><Icon name="clock"/></button></div></header>
      <main className="crm-main">
        {view === 'dashboard' ? <>
          <PageHeader eyebrow="Business overview" title="Good morning, Gary." copy="The numbers and next actions that need attention right now." actions={<><button className="crm-secondary-button" onClick={() => setRecordModal({ type: 'client', record: blankClient() })}><Icon name="plus"/> Client</button><button className="button button-primary" onClick={() => setDocumentModal({ type: 'invoice', record: blankInvoice() })}>New invoice <Icon name="arrow"/></button></>}/>
          <section className="crm-kpi-grid"><Kpi label="Open quote pipeline" value={money(metrics.quotePipeline)} copy={`${crm.quotes.filter((quote) => ['draft', 'sent'].includes(quote.status)).length} open quotes`}/><Kpi label="Accounts receivable" value={money(metrics.outstanding)} copy={`${crm.invoices.filter((invoice) => !['paid', 'void'].includes(effectiveInvoiceStatus(invoice))).length} unpaid invoices`} alert={metrics.overdue.length > 0}/><Kpi label="Collected this year" value={money(metrics.paidThisYear)} copy={`${crm.payments.length} payments recorded`}/><Kpi label="Active jobs" value={metrics.activeJobs.length} copy={`${crm.jobs.filter((job) => job.status === 'in_progress').length} currently in progress`}/><Kpi label="New web leads" value={metrics.newLeads.length} copy="Need first response" alert={metrics.newLeads.length > 0}/></section>
          <section className="crm-dashboard-grid">
            <div className="crm-panel span-two"><div className="crm-panel-head"><div><h2>Active work</h2><p>Scheduled, underway, and waiting projects.</p></div><button onClick={() => setView('jobs')}>View all <Icon name="arrow"/></button></div><div className="crm-compact-list">{metrics.activeJobs.slice(0, 6).map((job) => { const client = crm.clients.find((item) => item.id === job.client_id); return <button key={job.id} onClick={() => { setSelectedJobId(job.id); setView('jobs'); }}><span><strong>{job.job_number} · {job.title}</strong><small>{clientName(client)} · {jobAddress(job) || 'Location not set'}</small></span><Badge value={job.status}/><span className="crm-list-money">{money(job.contract_amount_cents)}</span></button>; })}{!metrics.activeJobs.length ? <p className="crm-muted">No active jobs.</p> : null}</div></div>
            <div className="crm-panel"><div className="crm-panel-head"><div><h2>Overdue invoices</h2><p>Balances past their due date.</p></div></div><div className="crm-compact-list warning">{metrics.overdue.slice(0, 5).map((invoice) => { const client = crm.clients.find((item) => item.id === invoice.client_id); return <button key={invoice.id} onClick={() => { setSelectedDocumentId(invoice.id); setView('invoices'); }}><span><strong>{invoice.invoice_number}</strong><small>{clientName(client)} · Due {dateLabel(invoice.due_on)}</small></span><span className="crm-list-money">{money(invoice.balance_due_cents)}</span></button>; })}{!metrics.overdue.length ? <p className="crm-muted">Nothing overdue.</p> : null}</div></div>
            <div className="crm-panel"><div className="crm-panel-head"><div><h2>Follow-ups</h2><p>Lead actions and site visits.</p></div></div><div className="crm-compact-list">{leads.filter((lead) => lead.follow_up_at || lead.scheduled_site_visit_at).sort((a, b) => new Date(a.follow_up_at || a.scheduled_site_visit_at) - new Date(b.follow_up_at || b.scheduled_site_visit_at)).slice(0, 5).map((lead) => <button key={lead.id} onClick={() => { setSelectedLeadId(lead.id); setView('leads'); }}><span><strong>{lead.company_name || fullName(lead)}</strong><small>{lead.scheduled_site_visit_at ? `Site visit ${dateTimeLabel(lead.scheduled_site_visit_at)}` : `Follow up ${dateTimeLabel(lead.follow_up_at)}`}</small></span><Badge value={lead.priority} type="priority"/></button>)}</div></div>
            <div className="crm-panel span-two"><div className="crm-panel-head"><div><h2>Recent activity</h2><p>Notes, documents, job updates, and payments.</p></div><button onClick={() => setView('activity')}>Full history <Icon name="arrow"/></button></div><ActivityList activities={crm.activities} crm={crm} limit={8}/></div>
          </section>
        </> : null}

        {view === 'leads' ? <>
          <PageHeader eyebrow="Lead capture" title="Website inquiries" copy="Qualify incoming requests, schedule follow-up, create a client, and prepare a quote." actions={<button className="crm-secondary-button" onClick={loadAll}><Icon name="clock"/> Refresh</button>}/>
          <DataToolbar search={search} setSearch={setSearch} placeholder="Search company, person, city, or scope…" status={statusFilter} setStatus={setStatusFilter} options={LEAD_STATUSES}/>
          <section className="crm-split-workspace"><div className="crm-record-list">{filteredLeads.map((lead) => <button key={lead.id} className={selectedLeadId === lead.id ? 'selected' : ''} onClick={() => setSelectedLeadId(lead.id)}><div className="crm-record-top"><span><strong>{lead.company_name || fullName(lead)}</strong><small>{lead.company_name ? fullName(lead) : labelize(lead.property_type)}</small></span><Badge value={lead.status}/></div><h3>{labelize(lead.project_type)}</h3><p>{lead.project_scope}</p><footer><span>{lead.city}, {lead.state}</span><span>{dateLabel(lead.created_at)}</span><Badge value={lead.priority} type="priority"/></footer></button>)}{!filteredLeads.length ? <EmptyState title="No matching leads" copy="Try another search or status filter."/> : null}</div>
          <aside className="crm-detail-panel">{selectedLead && leadDraft ? <><div className="crm-detail-head"><div><p className="eyebrow">Website lead</p><h2>{selectedLead.company_name || fullName(selectedLead)}</h2><span>{selectedLead.company_name ? fullName(selectedLead) : labelize(selectedLead.property_type)}</span></div><Badge value={selectedLead.priority} type="priority"/></div><div className="crm-contact-actions"><a href={`tel:${selectedLead.phone}`}><Icon name="phone"/> Call</a><a href={`mailto:${selectedLead.email}`}><Icon name="mail"/> Email</a>{selectedLead.project_address ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([selectedLead.project_address, selectedLead.city, selectedLead.state].filter(Boolean).join(', '))}`} target="_blank" rel="noreferrer"><Icon name="map"/> Map</a> : null}</div>
            <div className="crm-detail-section"><h3>Project</h3><div className="crm-detail-grid"><div><span>Project</span><strong>{labelize(selectedLead.project_type)}</strong></div><div><span>Property</span><strong>{labelize(selectedLead.property_type)}</strong></div><div><span>Budget</span><strong>{labelize(selectedLead.budget_range)}</strong></div><div><span>Timeline</span><strong>{labelize(selectedLead.timeline)}</strong></div><div><span>Linear feet</span><strong>{selectedLead.estimated_linear_feet || 'Unknown'}</strong></div><div><span>Plans ready</span><strong>{selectedLead.plans_ready ? 'Yes' : 'No'}</strong></div></div><div className="crm-scope"><span>Scope</span><p>{selectedLead.project_scope}</p></div><div className="crm-tags">{(selectedLead.material_preferences || []).map((material) => <span key={material}>{labelize(material)}</span>)}</div></div>
            <div className="crm-detail-section"><h3>Contact</h3><div className="crm-detail-grid"><div><span>Email</span><strong>{selectedLead.email}</strong></div><div><span>Phone</span><strong>{selectedLead.phone}</strong></div><div><span>Preferred</span><strong>{labelize(selectedLead.preferred_contact)}</strong></div><div><span>Received</span><strong>{dateTimeLabel(selectedLead.created_at)}</strong></div></div><p className="crm-muted">{[selectedLead.project_address, selectedLead.city, selectedLead.state, selectedLead.zip_code].filter(Boolean).join(', ')}</p></div>
            {leadFiles.length ? <div className="crm-detail-section"><h3>Attachments</h3><div className="manager-files">{leadFiles.map((file, index) => file.signed_url ? <a key={file.id || index} href={file.signed_url} target="_blank" rel="noreferrer"><Icon name="external"/><span><strong>{file.original_name}</strong><small>{file.mime_type || 'Uploaded file'}</small></span></a> : <div key={file.id || index}><Icon name="camera"/><span><strong>{file.original_name}</strong><small>{file.demo ? 'Demo attachment' : 'Stored file'}</small></span></div>)}</div></div> : null}
            <div className="crm-detail-section crm-edit-fields"><h3>Pipeline controls</h3><div className="crm-form-grid two"><label>Status<select value={leadDraft.status} onChange={(e) => setLeadDraft({ ...leadDraft, status: e.target.value })}>{LEAD_STATUSES.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</select></label><label>Priority<select value={leadDraft.priority} onChange={(e) => setLeadDraft({ ...leadDraft, priority: e.target.value })}>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{labelize(priority)}</option>)}</select></label><label>Estimated quote ($)<input type="number" min="0" step="100" value={leadDraft.quote_dollars} onChange={(e) => setLeadDraft({ ...leadDraft, quote_dollars: e.target.value })}/></label><label>Follow-up<input type="datetime-local" value={leadDraft.follow_up_at ? String(leadDraft.follow_up_at).slice(0, 16) : ''} onChange={(e) => setLeadDraft({ ...leadDraft, follow_up_at: e.target.value })}/></label><label className="span-two">Site visit<input type="datetime-local" value={leadDraft.scheduled_site_visit_at ? String(leadDraft.scheduled_site_visit_at).slice(0, 16) : ''} onChange={(e) => setLeadDraft({ ...leadDraft, scheduled_site_visit_at: e.target.value })}/></label></div><label>Internal notes<textarea value={leadDraft.internal_notes || ''} onChange={(e) => setLeadDraft({ ...leadDraft, internal_notes: e.target.value })}/></label><button className="crm-secondary-button full" onClick={saveLeadControls} disabled={busy}>Save lead updates</button></div>
            <div className="crm-detail-actions"><button className="crm-secondary-button" onClick={convertSelectedLead} disabled={busy || Boolean(selectedLead.client_id)}><Icon name="plus"/>{selectedLead.client_id ? 'Client created' : 'Convert to client'}</button><button className="button button-primary" onClick={startQuoteFromLead}>Create quote <Icon name="arrow"/></button></div>
          </> : <EmptyState title="Select a lead" copy="Choose an inquiry to review its full scope and next action."/>}</aside></section>
        </> : null}

        {view === 'clients' ? <>
          <PageHeader eyebrow="Client relationship manager" title="Clients" copy="Active accounts, contacts, billing details, job history, documents, and balances." actions={<button className="button button-primary" onClick={() => setRecordModal({ type: 'client', record: blankClient() })}>Add client <Icon name="plus"/></button>}/>
          <DataToolbar search={search} setSearch={setSearch} placeholder="Search company, contact, email, or city…" status={statusFilter} setStatus={setStatusFilter} options={['prospect', 'active', 'inactive']}/>
          <section className="crm-split-workspace clients"><div className="crm-record-list">{filteredClients.map((client) => { const jobs = crm.jobs.filter((job) => job.client_id === client.id); const balance = crm.invoices.filter((invoice) => invoice.client_id === client.id).reduce((sum, invoice) => sum + Number(invoice.balance_due_cents || 0), 0); return <button key={client.id} className={selectedClientId === client.id ? 'selected' : ''} onClick={() => setSelectedClientId(client.id)}><div className="crm-record-top"><span><strong>{clientName(client)}</strong><small>{client.primary_contact_name}</small></span><Badge value={client.status}/></div><p>{client.email}<br/>{client.phone}</p><footer><span>{jobs.length} job{jobs.length === 1 ? '' : 's'}</span><span>{balance ? `${money(balance)} due` : 'Paid up'}</span></footer></button>; })}{!filteredClients.length ? <EmptyState title="No clients found" copy="Add a client manually or convert a website lead." action="Add client" onAction={() => setRecordModal({ type: 'client', record: blankClient() })}/> : null}</div>
          <aside className="crm-detail-panel">{selectedClient ? <><div className="crm-detail-head"><div><p className="eyebrow">Client account</p><h2>{clientName(selectedClient)}</h2><span>{selectedClient.primary_contact_name}</span></div><Badge value={selectedClient.status}/></div><div className="crm-contact-actions"><a href={`tel:${selectedClient.phone}`}><Icon name="phone"/> Call</a><a href={`mailto:${selectedClient.email}`}><Icon name="mail"/> Email</a><button onClick={() => setRecordModal({ type: 'client', record: selectedClient })}><Icon name="ruler"/> Edit</button></div>
            <div className="crm-detail-section"><h3>Account snapshot</h3>{(() => { const jobs = crm.jobs.filter((job) => job.client_id === selectedClient.id); const invoices = crm.invoices.filter((invoice) => invoice.client_id === selectedClient.id); const quoted = crm.quotes.filter((quote) => quote.client_id === selectedClient.id).reduce((sum, quote) => sum + Number(quote.total_cents || 0), 0); const due = invoices.reduce((sum, invoice) => sum + Number(invoice.balance_due_cents || 0), 0); return <div className="client-snapshot"><div><span>Total quoted</span><strong>{money(quoted)}</strong></div><div><span>Open balance</span><strong>{money(due)}</strong></div><div><span>Active jobs</span><strong>{jobs.filter((job) => !['completed', 'canceled'].includes(job.status)).length}</strong></div><div><span>Completed jobs</span><strong>{jobs.filter((job) => job.status === 'completed').length}</strong></div></div>; })()}</div>
            <div className="crm-detail-section"><h3>Contact & billing</h3><div className="crm-detail-grid"><div><span>Email</span><strong>{selectedClient.email || '—'}</strong></div><div><span>Phone</span><strong>{selectedClient.phone || '—'}</strong></div><div className="wide"><span>Billing address</span><strong>{[selectedClient.billing_address_line_1, selectedClient.billing_address_line_2, selectedClient.billing_city, selectedClient.billing_state, selectedClient.billing_zip].filter(Boolean).join(', ') || '—'}</strong></div></div>{selectedClient.notes ? <div className="crm-scope"><span>Internal notes</span><p>{selectedClient.notes}</p></div> : null}</div>
            <div className="crm-detail-section"><div className="crm-section-heading"><h3>Jobs</h3><button onClick={() => setRecordModal({ type: 'job', record: blankJob(selectedClient.id) })}><Icon name="plus"/> Add</button></div><div className="crm-mini-records">{crm.jobs.filter((job) => job.client_id === selectedClient.id).map((job) => <button key={job.id} onClick={() => { setSelectedJobId(job.id); setView('jobs'); }}><span><strong>{job.job_number} · {job.title}</strong><small>{dateLabel(job.start_date)} · {money(job.contract_amount_cents)}</small></span><Badge value={job.status}/></button>)}</div></div>
            <div className="crm-detail-section"><div className="crm-section-heading"><h3>Documents</h3><div><button onClick={() => setDocumentModal({ type: 'quote', record: blankQuote(selectedClient.id) })}>Quote</button><button onClick={() => setDocumentModal({ type: 'invoice', record: blankInvoice(selectedClient.id) })}>Invoice</button></div></div><div className="crm-mini-records">{[...crm.quotes.filter((item) => item.client_id === selectedClient.id).map((item) => ({ ...item, kind: 'quote' })), ...crm.invoices.filter((item) => item.client_id === selectedClient.id).map((item) => ({ ...item, kind: 'invoice' }))].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8).map((document) => <button key={document.id} onClick={() => { setSelectedDocumentId(document.id); setView(document.kind === 'quote' ? 'quotes' : 'invoices'); }}><span><strong>{document.kind === 'quote' ? document.quote_number : document.invoice_number}</strong><small>{money(document.total_cents)} · {dateLabel(document.issued_on)}</small></span><Badge value={document.kind === 'invoice' ? effectiveInvoiceStatus(document) : document.status}/></button>)}</div></div>
            <div className="crm-detail-section"><h3>Recent activity</h3><ActivityList activities={crm.activities.filter((activity) => activity.client_id === selectedClient.id)} crm={crm} limit={6}/></div>
          </> : <EmptyState title="Select a client" copy="Choose an account to see jobs, documents, balances, and activity."/>}</aside></section>
        </> : null}

        {view === 'jobs' ? <>
          <PageHeader eyebrow="Project operations" title="Jobs" copy="Organize scheduled work, current projects, waiting items, and completed job history." actions={<button className="button button-primary" onClick={() => setRecordModal({ type: 'job', record: blankJob() })}>Add job <Icon name="plus"/></button>}/>
          <DataToolbar search={search} setSearch={setSearch} placeholder="Search job number, client, title, or location…" status={statusFilter} setStatus={setStatusFilter} options={JOB_STATUSES}/>
          <section className="crm-split-workspace jobs"><div className="crm-record-list">{filteredJobs.map((job) => { const client = crm.clients.find((item) => item.id === job.client_id); const billed = crm.invoices.filter((invoice) => invoice.job_id === job.id).reduce((sum, invoice) => sum + Number(invoice.total_cents || 0), 0); return <button key={job.id} className={selectedJobId === job.id ? 'selected' : ''} onClick={() => setSelectedJobId(job.id)}><div className="crm-record-top"><span><strong>{job.job_number}</strong><small>{clientName(client)}</small></span><Badge value={job.status}/></div><h3>{job.title}</h3><p>{job.description}</p><footer><span>{dateLabel(job.start_date)}</span><span>{money(job.contract_amount_cents)}</span><span>{money(billed)} billed</span></footer></button>; })}{!filteredJobs.length ? <EmptyState title="No jobs found" copy="Create a job manually or convert an accepted quote." action="Add job" onAction={() => setRecordModal({ type: 'job', record: blankJob() })}/> : null}</div>
          <aside className="crm-detail-panel">{selectedJob ? (() => { const client = crm.clients.find((item) => item.id === selectedJob.client_id); const jobInvoices = crm.invoices.filter((invoice) => invoice.job_id === selectedJob.id); const billed = jobInvoices.reduce((sum, invoice) => sum + Number(invoice.total_cents || 0), 0); const paid = jobInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid_cents || 0), 0); return <><div className="crm-detail-head"><div><p className="eyebrow">{selectedJob.job_number}</p><h2>{selectedJob.title}</h2><span>{clientName(client)}</span></div><Badge value={selectedJob.status}/></div><div className="crm-contact-actions"><button onClick={() => setRecordModal({ type: 'job', record: { ...selectedJob, contract_amount_dollars: Number(selectedJob.contract_amount_cents || 0) / 100 } })}><Icon name="ruler"/> Edit</button>{selectedJob.project_address ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(jobAddress(selectedJob))}`} target="_blank" rel="noreferrer"><Icon name="map"/> Map</a> : null}<button onClick={() => setDocumentModal({ type: 'invoice', record: blankInvoice(selectedJob.client_id, selectedJob.id, selectedJob.quote_id) })}><Icon name="plus"/> Invoice</button></div>
            <div className="crm-detail-section"><h3>Financials</h3><div className="client-snapshot"><div><span>Contract</span><strong>{money(selectedJob.contract_amount_cents)}</strong></div><div><span>Invoiced</span><strong>{money(billed)}</strong></div><div><span>Collected</span><strong>{money(paid)}</strong></div><div><span>Unbilled</span><strong>{money(Math.max(0, Number(selectedJob.contract_amount_cents || 0) - billed))}</strong></div></div></div>
            <div className="crm-detail-section"><h3>Project details</h3><div className="crm-detail-grid"><div><span>Start</span><strong>{dateLabel(selectedJob.start_date)}</strong></div><div><span>Target completion</span><strong>{dateLabel(selectedJob.target_completion_date)}</strong></div><div className="wide"><span>Location</span><strong>{jobAddress(selectedJob) || '—'}</strong></div></div><div className="crm-scope"><span>Description</span><p>{selectedJob.description || 'No description.'}</p></div>{selectedJob.notes ? <div className="crm-scope"><span>Internal notes</span><p>{selectedJob.notes}</p></div> : null}</div>
            <div className="crm-detail-section"><h3>Invoices</h3><div className="crm-mini-records">{jobInvoices.map((invoice) => <button key={invoice.id} onClick={() => { setSelectedDocumentId(invoice.id); setView('invoices'); }}><span><strong>{invoice.invoice_number}</strong><small>{dateLabel(invoice.issued_on)} · {money(invoice.balance_due_cents)} due</small></span><Badge value={effectiveInvoiceStatus(invoice)}/></button>)}</div></div>
            <div className="crm-detail-section"><h3>Activity</h3><ActivityList activities={crm.activities.filter((activity) => activity.job_id === selectedJob.id)} crm={crm} limit={8}/><button className="crm-secondary-button full" onClick={() => setRecordModal({ type: 'activity', record: { id: makeId('activity'), client_id: selectedJob.client_id, job_id: selectedJob.id, activity_type: 'job_update', summary: '', details: '', created_at: new Date().toISOString() } })}><Icon name="plus"/> Add job note</button></div>
          </>; })() : <EmptyState title="Select a job" copy="Choose a project to see financials, invoices, dates, and history."/>}</aside></section>
        </> : null}

        {view === 'quotes' || view === 'invoices' ? <>
          <PageHeader eyebrow={view === 'quotes' ? 'Estimating' : 'Accounts receivable'} title={view === 'quotes' ? 'Quotes' : 'Invoices'} copy={view === 'quotes' ? 'Prepare itemized proposals, email them, track decisions, and convert accepted work.' : 'Bill clients, email invoices, track due dates, and record partial or full payments.'} actions={<button className="button button-primary" onClick={() => setDocumentModal({ type: view === 'quotes' ? 'quote' : 'invoice', record: view === 'quotes' ? blankQuote(selectedClientId || '') : blankInvoice(selectedClientId || '') })}>New {view === 'quotes' ? 'quote' : 'invoice'} <Icon name="plus"/></button>}/>
          <DataToolbar search={search} setSearch={setSearch} placeholder={`Search ${view}, clients, PO numbers, or notes…`} status={statusFilter} setStatus={setStatusFilter} options={documentStatuses}/>
          <section className="crm-split-workspace documents"><div className="crm-record-list">{filteredDocuments.map((document) => { const client = crm.clients.find((item) => item.id === document.client_id); const number = view === 'quotes' ? document.quote_number : document.invoice_number; const status = view === 'invoices' ? effectiveInvoiceStatus(document) : document.status; return <button key={document.id} className={selectedDocument?.id === document.id ? 'selected' : ''} onClick={() => setSelectedDocumentId(document.id)}><div className="crm-record-top"><span><strong>{number}</strong><small>{clientName(client)}</small></span><Badge value={status}/></div><h3>{money(document.total_cents)}</h3><p>{document.notes || `${document.items?.length || 0} line item${document.items?.length === 1 ? '' : 's'}`}</p><footer><span>Issued {dateLabel(document.issued_on)}</span><span>{view === 'quotes' ? `Expires ${dateLabel(document.expires_on)}` : `${money(document.balance_due_cents)} due`}</span></footer></button>; })}{!filteredDocuments.length ? <EmptyState title={`No ${view} found`} copy={`Create the first ${view === 'quotes' ? 'quote' : 'invoice'} for a client.`}/> : null}</div>
          <aside className="crm-detail-panel document-detail">{selectedDocument ? (() => { const type = view === 'quotes' ? 'quote' : 'invoice'; const client = crm.clients.find((item) => item.id === selectedDocument.client_id); const job = crm.jobs.find((item) => item.id === selectedDocument.job_id); const payments = crm.payments.filter((payment) => payment.invoice_id === selectedDocument.id); const number = type === 'quote' ? selectedDocument.quote_number : selectedDocument.invoice_number; const status = type === 'invoice' ? effectiveInvoiceStatus(selectedDocument) : selectedDocument.status; return <><div className="crm-detail-head"><div><p className="eyebrow">{type}</p><h2>{number}</h2><span>{clientName(client)}{job ? ` · ${job.job_number}` : ''}</span></div><Badge value={status}/></div><div className="crm-document-actions"><button onClick={() => setDocumentModal({ type, record: selectedDocument })}><Icon name="ruler"/> Edit</button><button onClick={() => printDocument(type, selectedDocument)}><Icon name="download"/> Print / PDF</button><button onClick={() => sendDocumentEmail(type, selectedDocument)} disabled={emailing === selectedDocument.id}><Icon name="mail"/>{emailing === selectedDocument.id ? 'Sending…' : 'Email'}</button></div>
            <div className="crm-document-summary"><div><span>Issued</span><strong>{dateLabel(selectedDocument.issued_on)}</strong></div><div><span>{type === 'quote' ? 'Expires' : 'Due'}</span><strong>{dateLabel(type === 'quote' ? selectedDocument.expires_on : selectedDocument.due_on)}</strong></div><div><span>Total</span><strong>{money(selectedDocument.total_cents)}</strong></div>{type === 'invoice' ? <div className="balance"><span>Balance due</span><strong>{money(selectedDocument.balance_due_cents)}</strong></div> : null}</div>
            <div className="crm-detail-section"><h3>Line items</h3><div className="crm-line-summary">{(selectedDocument.items || []).map((item) => <div key={item.id}><span><strong>{item.description}</strong><small>{item.quantity} {item.unit} × {money(item.unit_price_cents)}</small></span><strong>{money(Math.round(Number(item.quantity) * Number(item.unit_price_cents)))}</strong></div>)}</div><div className="crm-total-summary"><div><span>Subtotal</span><strong>{money(selectedDocument.subtotal_cents)}</strong></div>{selectedDocument.discount_cents ? <div><span>Discount</span><strong>-{money(selectedDocument.discount_cents)}</strong></div> : null}{selectedDocument.tax_cents ? <div><span>Tax</span><strong>{money(selectedDocument.tax_cents)}</strong></div> : null}<div className="grand"><span>Total</span><strong>{money(selectedDocument.total_cents)}</strong></div></div></div>
            {selectedDocument.notes || selectedDocument.terms ? <div className="crm-detail-section"><h3>Customer notes & terms</h3>{selectedDocument.notes ? <div className="crm-scope"><span>Notes</span><p>{selectedDocument.notes}</p></div> : null}{selectedDocument.terms ? <div className="crm-scope"><span>Terms</span><p>{selectedDocument.terms}</p></div> : null}</div> : null}
            {type === 'quote' ? <div className="crm-detail-section crm-detail-actions">{!selectedDocument.job_id ? <button className="crm-secondary-button" onClick={() => createJobFromQuote(selectedDocument)}><Icon name="plus"/> Create job</button> : <button className="crm-secondary-button" onClick={() => { setSelectedJobId(selectedDocument.job_id); setView('jobs'); }}>Open linked job</button>}<button className="button button-primary" onClick={() => createInvoiceFromQuote(selectedDocument)}>Create invoice <Icon name="arrow"/></button></div> : <div className="crm-detail-section"><div className="crm-section-heading"><h3>Payments</h3>{Number(selectedDocument.balance_due_cents || 0) > 0 && selectedDocument.status !== 'void' ? <button onClick={() => setRecordModal({ type: 'payment', record: { id: makeId('payment'), invoice_id: selectedDocument.id, amount_dollars: Number(selectedDocument.balance_due_cents) / 100, paid_on: today(), method: 'check', reference: '', notes: '' } })}><Icon name="plus"/> Record</button> : null}</div><div className="crm-mini-records">{payments.map((payment) => <div key={payment.id}><span><strong>{money(payment.amount_cents)}</strong><small>{dateLabel(payment.paid_on)} · {labelize(payment.method)} {payment.reference ? `· ${payment.reference}` : ''}</small></span></div>)}{!payments.length ? <p className="crm-muted">No payments recorded.</p> : null}</div></div>}
            <button className="crm-danger-link" onClick={() => deleteCollection(view, selectedDocument.id)}>Delete {type}</button>
          </>; })() : <EmptyState title={`Select a ${view === 'quotes' ? 'quote' : 'invoice'}`} copy="Choose a document to review, print, email, or update it."/>}</aside></section>
        </> : null}

        {view === 'activity' ? <>
          <PageHeader eyebrow="Company timeline" title="Activity" copy="A searchable history of calls, emails, notes, site visits, job updates, documents, and payments." actions={<button className="button button-primary" onClick={() => setRecordModal({ type: 'activity', record: { id: makeId('activity'), client_id: '', activity_type: 'note', summary: '', details: '', created_at: new Date().toISOString() } })}>Add activity <Icon name="plus"/></button>}/>
          <DataToolbar search={search} setSearch={setSearch} placeholder="Search activity, client, or details…"/>
          <section className="crm-panel activity-page"><ActivityList activities={crm.activities.filter((activity) => { const client = crm.clients.find((item) => item.id === activity.client_id); return [activity.summary, activity.details, clientName(client), activity.activity_type].join(' ').toLowerCase().includes(search.toLowerCase()); })} crm={crm}/></section>
        </> : null}

        {view === 'settings' ? <>
          <PageHeader eyebrow="CRM configuration" title="Business settings" copy="These details appear on printed and emailed quotes and invoices." actions={demoActive ? <button className="crm-secondary-button" onClick={() => { const next = resetDemoCrm(); setCrm(next); setMessage('Demo CRM reset.'); }}><Icon name="clock"/> Reset demo data</button> : null}/>
          <form className="crm-settings-form" onSubmit={saveSettings}><section className="crm-panel"><h2>Company identity</h2><div className="crm-form-grid two"><label>Legal business name<input value={crm.settings.legal_name || ''} onChange={(e) => setCrm({ ...crm, settings: { ...crm.settings, legal_name: e.target.value } })}/></label><label>Business email<input type="email" value={crm.settings.email || ''} onChange={(e) => setCrm({ ...crm, settings: { ...crm.settings, email: e.target.value } })}/></label><label>Phone<input value={crm.settings.phone || ''} onChange={(e) => setCrm({ ...crm, settings: { ...crm.settings, phone: e.target.value } })}/></label><label>Website<input value={crm.settings.website || ''} onChange={(e) => setCrm({ ...crm, settings: { ...crm.settings, website: e.target.value } })}/></label><label>Address line 1<input value={crm.settings.address_line_1 || ''} onChange={(e) => setCrm({ ...crm, settings: { ...crm.settings, address_line_1: e.target.value } })}/></label><label>Address line 2<input value={crm.settings.address_line_2 || ''} onChange={(e) => setCrm({ ...crm, settings: { ...crm.settings, address_line_2: e.target.value } })}/></label></div></section>
          <section className="crm-panel"><h2>Document defaults</h2><div className="crm-form-grid three"><label>Default tax rate (%)<input type="number" min="0" max="100" step="0.01" value={crm.settings.default_tax_rate || 0} onChange={(e) => setCrm({ ...crm, settings: { ...crm.settings, default_tax_rate: Number(e.target.value) } })}/></label><label>Quote valid for (days)<input type="number" min="1" value={crm.settings.quote_expiration_days || 30} onChange={(e) => setCrm({ ...crm, settings: { ...crm.settings, quote_expiration_days: Number(e.target.value) } })}/></label><label>Invoice due in (days)<input type="number" min="0" value={crm.settings.invoice_due_days || 30} onChange={(e) => setCrm({ ...crm, settings: { ...crm.settings, invoice_due_days: Number(e.target.value) } })}/></label></div><div className="crm-form-grid two"><label>Default quote terms<textarea value={crm.settings.quote_terms || ''} onChange={(e) => setCrm({ ...crm, settings: { ...crm.settings, quote_terms: e.target.value } })}/></label><label>Default invoice terms<textarea value={crm.settings.invoice_terms || ''} onChange={(e) => setCrm({ ...crm, settings: { ...crm.settings, invoice_terms: e.target.value } })}/></label><label className="span-two">Payment instructions<textarea value={crm.settings.payment_instructions || ''} onChange={(e) => setCrm({ ...crm, settings: { ...crm.settings, payment_instructions: e.target.value } })}/></label></div></section>
          <section className="crm-panel resend-settings"><h2>Resend email</h2><p>The API key remains server-side. Put it in <code>.env.server</code>, not the Vite <code>.env</code> file.</p><pre>RESEND_API_KEY=re_xxxxxxxxx\nRESEND_FROM_EMAIL=Gary Commercial Rail &amp; Fence &lt;quotes@yourdomain.com&gt;\nRESEND_REPLY_TO={crm.settings.email}</pre><p>Start both the site and email service with <code>npm run dev</code>.</p></section><button className="button button-primary settings-save" disabled={busy}>Save settings <Icon name="arrow"/></button></form>
        </> : null}
      </main>
    </div>

    <RecordModal open={Boolean(recordModal)} type={recordModal?.type} record={recordModal?.record} clients={crm.clients} quotes={crm.quotes} onClose={() => setRecordModal(null)} onSave={async (record) => { if (recordModal.type === 'client') await saveClient(record); else if (recordModal.type === 'job') await saveJob(record); else if (recordModal.type === 'payment') await savePayment(record); else await addActivity(record); }}/>
    <DocumentEditor open={Boolean(documentModal)} type={documentModal?.type} record={documentModal?.record} clients={crm.clients} jobs={crm.jobs} settings={crm.settings} onClose={() => setDocumentModal(null)} onSave={(record) => saveDocument(documentModal.type, record)}/>
  </div>;
}

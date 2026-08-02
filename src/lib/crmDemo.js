const STORAGE_KEY = 'gary-railing-crm-v2';

export const DEFAULT_CRM_SETTINGS = {
  legal_name: 'Gary Commercial Rail & Fence',
  address_line_1: 'Northwest Florida',
  address_line_2: '',
  phone: '(850) 555-0148',
  email: 'estimating@garyrailfence.com',
  website: '',
  default_tax_rate: 0,
  quote_expiration_days: 30,
  invoice_due_days: 30,
  payment_instructions: 'Please remit payment by check or contact our office for ACH instructions.',
  quote_terms: 'Pricing is based on the stated scope and is subject to field verification, final measurements, permitting requirements, and approved material selections.',
  invoice_terms: 'Payment is due by the date shown. Please reference the invoice number with payment.',
};

const now = Date.now();
const day = 86400000;
const isoDate = (offsetDays = 0) => new Date(now + offsetDays * day).toISOString().slice(0, 10);
const iso = (offsetDays = 0) => new Date(now + offsetDays * day).toISOString();

const seed = {
  settings: DEFAULT_CRM_SETTINGS,
  clients: [
    {
      id: 'demo-client-1', company_name: 'Gulf Horizon Development', primary_contact_name: 'Morgan Lee', email: 'morgan@example.com', phone: '(850) 555-0186',
      billing_address_line_1: '1200 Harbor Walk', billing_address_line_2: '', billing_city: 'Destin', billing_state: 'FL', billing_zip: '32541',
      status: 'active', notes: 'Multifamily developer. Prefers email and phased project schedules.', source_lead_id: 'demo-1', created_at: iso(-45), updated_at: iso(-2),
    },
    {
      id: 'demo-client-2', company_name: 'Walsh Property Group', primary_contact_name: 'Terry Walsh', email: 'terry@example.com', phone: '(850) 555-0172',
      billing_address_line_1: '88 Commerce Parkway', billing_address_line_2: '', billing_city: 'Fort Walton Beach', billing_state: 'FL', billing_zip: '32548',
      status: 'active', notes: 'Industrial and warehouse properties. Calls preferred.', source_lead_id: 'demo-2', created_at: iso(-70), updated_at: iso(-4),
    },
    {
      id: 'demo-client-3', company_name: 'Sunline Hospitality', primary_contact_name: 'Alexis Reed', email: 'alexis@example.com', phone: '(850) 555-0164',
      billing_address_line_1: '500 Shoreline Drive', billing_address_line_2: '', billing_city: 'Miramar Beach', billing_state: 'FL', billing_zip: '32550',
      status: 'active', notes: 'Hotel group with recurring repair and retrofit work.', source_lead_id: 'demo-3', created_at: iso(-180), updated_at: iso(-35),
    },
  ],
  jobs: [
    {
      id: 'demo-job-1', job_number: `JOB-${new Date().getFullYear()}-0001`, client_id: 'demo-client-1', source_lead_id: 'demo-1', quote_id: 'demo-quote-1',
      title: 'Waterfront Balcony Railing Replacement', description: 'Phased replacement of aluminum balcony railings across two occupied buildings.',
      project_address: '1200 Harbor Walk', city: 'Destin', state: 'FL', zip_code: '32541', status: 'in_progress', start_date: isoDate(-10), target_completion_date: isoDate(24), completed_at: null,
      contract_amount_cents: 11850000, notes: 'Building A mobilized. Coordinate access weekly with property manager.', created_at: iso(-35), updated_at: iso(-1),
    },
    {
      id: 'demo-job-2', job_number: `JOB-${new Date().getFullYear()}-0002`, client_id: 'demo-client-2', source_lead_id: 'demo-2', quote_id: 'demo-quote-2',
      title: 'Warehouse Security Fence & Gates', description: 'Chain-link security perimeter with ornamental public-facing entry and two vehicle gates.',
      project_address: '88 Commerce Parkway', city: 'Fort Walton Beach', state: 'FL', zip_code: '32548', status: 'scheduled', start_date: isoDate(18), target_completion_date: isoDate(42), completed_at: null,
      contract_amount_cents: 8650000, notes: 'Awaiting final civil drawing and gate operator power location.', created_at: iso(-20), updated_at: iso(-3),
    },
    {
      id: 'demo-job-3', job_number: `JOB-${new Date().getFullYear() - 1}-0014`, client_id: 'demo-client-3', source_lead_id: 'demo-3', quote_id: 'demo-quote-3',
      title: 'Hotel Stair Rail Retrofit', description: 'Repair, reinforce, and refinish damaged stair rail and guardrail sections.',
      project_address: '500 Shoreline Drive', city: 'Miramar Beach', state: 'FL', zip_code: '32550', status: 'completed', start_date: isoDate(-80), target_completion_date: isoDate(-55), completed_at: iso(-57),
      contract_amount_cents: 3425000, notes: 'Completed and signed off by maintenance director.', created_at: iso(-100), updated_at: iso(-57),
    },
  ],
  quotes: [
    {
      id: 'demo-quote-1', quote_number: `Q-${new Date().getFullYear()}-0001`, client_id: 'demo-client-1', lead_id: 'demo-1', job_id: 'demo-job-1', status: 'accepted', issued_on: isoDate(-38), expires_on: isoDate(-8),
      items: [
        { id: 'qi-1', description: 'Fabricate and install powder-coated aluminum balcony railing', quantity: 860, unit: 'LF', unit_price_cents: 12800, taxable: true },
        { id: 'qi-2', description: 'Mobilization, layout, and phased site protection', quantity: 1, unit: 'LS', unit_price_cents: 841000, taxable: true },
      ], subtotal_cents: 11850000, discount_cents: 0, tax_rate: 0, tax_cents: 0, total_cents: 11850000,
      notes: 'Includes standard powder-coat color selection.', terms: DEFAULT_CRM_SETTINGS.quote_terms, created_at: iso(-40), updated_at: iso(-35),
    },
    {
      id: 'demo-quote-2', quote_number: `Q-${new Date().getFullYear()}-0002`, client_id: 'demo-client-2', lead_id: 'demo-2', job_id: 'demo-job-2', status: 'accepted', issued_on: isoDate(-24), expires_on: isoDate(6),
      items: [
        { id: 'qi-3', description: 'Commercial chain-link security fence', quantity: 1400, unit: 'LF', unit_price_cents: 4200, taxable: true },
        { id: 'qi-4', description: 'Vehicle gate assemblies and access coordination', quantity: 2, unit: 'EA', unit_price_cents: 1385000, taxable: true },
      ], subtotal_cents: 8650000, discount_cents: 0, tax_rate: 0, tax_cents: 0, total_cents: 8650000,
      notes: 'Gate operators and electrical feeds by owner unless added by change order.', terms: DEFAULT_CRM_SETTINGS.quote_terms, created_at: iso(-25), updated_at: iso(-20),
    },
    {
      id: 'demo-quote-3', quote_number: `Q-${new Date().getFullYear() - 1}-0014`, client_id: 'demo-client-3', lead_id: 'demo-3', job_id: 'demo-job-3', status: 'accepted', issued_on: isoDate(-110), expires_on: isoDate(-80),
      items: [{ id: 'qi-5', description: 'Stair rail repair, reinforcement, preparation, and finish', quantity: 1, unit: 'LS', unit_price_cents: 3425000, taxable: true }],
      subtotal_cents: 3425000, discount_cents: 0, tax_rate: 0, tax_cents: 0, total_cents: 3425000,
      notes: '', terms: DEFAULT_CRM_SETTINGS.quote_terms, created_at: iso(-112), updated_at: iso(-100),
    },
  ],
  invoices: [
    {
      id: 'demo-invoice-1', invoice_number: `INV-${new Date().getFullYear()}-0001`, client_id: 'demo-client-1', job_id: 'demo-job-1', quote_id: 'demo-quote-1', status: 'partial', issued_on: isoDate(-12), due_on: isoDate(18), po_number: 'GH-4408',
      items: [{ id: 'ii-1', description: 'Project deposit and initial material procurement', quantity: 1, unit: 'LS', unit_price_cents: 5925000, taxable: false }],
      subtotal_cents: 5925000, discount_cents: 0, tax_rate: 0, tax_cents: 0, total_cents: 5925000, amount_paid_cents: 3000000, balance_due_cents: 2925000,
      notes: 'First progress billing.', terms: DEFAULT_CRM_SETTINGS.invoice_terms, sent_at: iso(-12), paid_at: null, created_at: iso(-12), updated_at: iso(-4),
    },
    {
      id: 'demo-invoice-2', invoice_number: `INV-${new Date().getFullYear() - 1}-0019`, client_id: 'demo-client-3', job_id: 'demo-job-3', quote_id: 'demo-quote-3', status: 'paid', issued_on: isoDate(-65), due_on: isoDate(-35), po_number: 'SUN-1192',
      items: [{ id: 'ii-2', description: 'Completed hotel stair rail retrofit', quantity: 1, unit: 'LS', unit_price_cents: 3425000, taxable: false }],
      subtotal_cents: 3425000, discount_cents: 0, tax_rate: 0, tax_cents: 0, total_cents: 3425000, amount_paid_cents: 3425000, balance_due_cents: 0,
      notes: '', terms: DEFAULT_CRM_SETTINGS.invoice_terms, sent_at: iso(-65), paid_at: iso(-38), created_at: iso(-65), updated_at: iso(-38),
    },
  ],
  payments: [
    { id: 'demo-payment-1', invoice_id: 'demo-invoice-1', amount_cents: 3000000, paid_on: isoDate(-4), method: 'ach', reference: 'ACH-7842', notes: 'Deposit received.', created_at: iso(-4) },
    { id: 'demo-payment-2', invoice_id: 'demo-invoice-2', amount_cents: 3425000, paid_on: isoDate(-38), method: 'check', reference: 'Check 22018', notes: '', created_at: iso(-38) },
  ],
  activities: [
    { id: 'demo-activity-1', client_id: 'demo-client-1', lead_id: 'demo-1', job_id: 'demo-job-1', quote_id: 'demo-quote-1', invoice_id: 'demo-invoice-1', activity_type: 'payment', summary: 'Partial payment recorded', details: '$30,000.00 via ACH', created_at: iso(-4) },
    { id: 'demo-activity-2', client_id: 'demo-client-1', lead_id: 'demo-1', job_id: 'demo-job-1', quote_id: null, invoice_id: null, activity_type: 'job_update', summary: 'Building A mobilized', details: 'Site protection and layout underway.', created_at: iso(-1) },
    { id: 'demo-activity-3', client_id: 'demo-client-3', lead_id: 'demo-3', job_id: 'demo-job-3', quote_id: null, invoice_id: 'demo-invoice-2', activity_type: 'job_completed', summary: 'Job completed and invoice paid', details: 'Final sign-off received from maintenance director.', created_at: iso(-38) },
  ],
};

export function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function getDemoCrm() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return stored?.version === 2 ? stored.data : structuredClone(seed);
  } catch {
    return structuredClone(seed);
  }
}

export function saveDemoCrm(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, data }));
}

export function resetDemoCrm() {
  localStorage.removeItem(STORAGE_KEY);
  return structuredClone(seed);
}

export function nextDocumentNumber(prefix, records, field) {
  const year = new Date().getFullYear();
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const highest = records.reduce((max, item) => {
    const match = String(item[field] || '').match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${year}-${String(highest + 1).padStart(4, '0')}`;
}

export const DEMO_LEADS = [
  {
    id: 'demo-1', created_at: new Date(Date.now() - 1000 * 60 * 42).toISOString(), first_name: 'Morgan', last_name: 'Lee', company_name: 'Gulf Horizon Development',
    email: 'morgan@example.com', phone: '(850) 555-0186', preferred_contact: 'email', project_type: 'commercial_railing', property_type: 'multifamily',
    project_scope: 'Replace balcony railings across two occupied buildings. Work may need to be phased by elevation.', material_preferences: ['powder_coated_aluminum'],
    estimated_linear_feet: 860, project_address: '1200 Harbor Walk', city: 'Destin', state: 'FL', zip_code: '32541', timeline: '1_3_months',
    budget_range: '100k_plus', plans_ready: true, needs_site_visit: true, status: 'new', priority: 'hot', quote_amount_cents: null, internal_notes: '',
    follow_up_at: null, scheduled_site_visit_at: null, source: 'website', campaign: 'commercial_launch', updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-2', created_at: new Date(Date.now() - 1000 * 60 * 60 * 19).toISOString(), first_name: 'Terry', last_name: 'Walsh', company_name: 'Walsh Property Group',
    email: 'terry@example.com', phone: '(850) 555-0172', preferred_contact: 'call', project_type: 'commercial_fencing', property_type: 'industrial',
    project_scope: 'Security fence and two controlled vehicle gates around a warehouse expansion.', material_preferences: ['chain_link', 'ornamental_steel'],
    estimated_linear_feet: 1400, project_address: '88 Commerce Parkway', city: 'Fort Walton Beach', state: 'FL', zip_code: '32548', timeline: '3_6_months',
    budget_range: '50k_100k', plans_ready: false, needs_site_visit: true, status: 'contacted', priority: 'high', quote_amount_cents: 8650000, internal_notes: 'GC expects revised civil set next week.',
    follow_up_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(), scheduled_site_visit_at: null, source: 'referral', campaign: '', updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-3', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), first_name: 'Alexis', last_name: 'Reed', company_name: 'Sunline Hospitality',
    email: 'alexis@example.com', phone: '(850) 555-0164', preferred_contact: 'text', project_type: 'repairs_retrofits', property_type: 'hospitality',
    project_scope: 'Repair and refinish damaged stair rails and guardrail sections before peak season.', material_preferences: ['not_sure'],
    estimated_linear_feet: 275, project_address: '500 Shoreline Drive', city: 'Miramar Beach', state: 'FL', zip_code: '32550', timeline: 'asap',
    budget_range: '25k_50k', plans_ready: false, needs_site_visit: true, status: 'site_visit', priority: 'normal', quote_amount_cents: null, internal_notes: 'Site walk scheduled with maintenance director.',
    follow_up_at: null, scheduled_site_visit_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 16), source: 'website', campaign: '', updated_at: new Date().toISOString(),
  },
];

export function getDemoLeads() {
  try {
    const saved = JSON.parse(localStorage.getItem('gary-railing-demo-leads') || '[]');
    const overrides = JSON.parse(localStorage.getItem('gary-railing-demo-overrides') || '{}');
    const seeded = DEMO_LEADS.map((lead) => ({ ...lead, ...(overrides[lead.id] || {}) }));
    return [...saved, ...seeded];
  } catch {
    return DEMO_LEADS;
  }
}

export function saveDemoLead(lead) {
  const saved = JSON.parse(localStorage.getItem('gary-railing-demo-leads') || '[]');
  localStorage.setItem('gary-railing-demo-leads', JSON.stringify([lead, ...saved]));
}

export function updateDemoLead(updatedLead) {
  if (String(updatedLead.id).startsWith('demo-')) {
    const overrides = JSON.parse(localStorage.getItem('gary-railing-demo-overrides') || '{}');
    overrides[updatedLead.id] = updatedLead;
    localStorage.setItem('gary-railing-demo-overrides', JSON.stringify(overrides));
    return;
  }
  const saved = JSON.parse(localStorage.getItem('gary-railing-demo-leads') || '[]');
  const next = saved.map((lead) => lead.id === updatedLead.id ? updatedLead : lead);
  localStorage.setItem('gary-railing-demo-leads', JSON.stringify(next));
}

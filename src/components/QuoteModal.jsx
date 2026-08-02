import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { saveDemoLead } from '../lib/demoData';

const DRAFT_KEY = 'gary-commercial-quote-draft-v2';

const createInitialForm = () => ({
  project_type: '',
  property_type: '',
  project_scope: '',
  material_preferences: [],
  estimated_linear_feet: '',
  project_address: '',
  city: '',
  state: 'FL',
  zip_code: '',
  timeline: '',
  budget_range: '',
  plans_ready: false,
  needs_site_visit: true,
  first_name: '',
  last_name: '',
  company_name: '',
  email: '',
  phone: '',
  preferred_contact: 'email',
  consent: false,
});

const PROJECT_TYPES = [
  ['commercial_railing', 'Commercial railing'],
  ['commercial_fencing', 'Commercial fencing'],
  ['gates_access', 'Gates / access control'],
  ['repairs_retrofits', 'Repairs / retrofit'],
  ['mixed_scope', 'Mixed project'],
];

const PROPERTY_TYPES = [
  ['multifamily', 'Multifamily / condominium'],
  ['hospitality', 'Hospitality'],
  ['industrial', 'Industrial / warehouse'],
  ['retail_office', 'Retail / office'],
  ['municipal', 'Municipal / institutional'],
  ['general_contractor', 'General contractor bid'],
  ['other', 'Other'],
];

const TIMELINES = [
  ['asap', 'ASAP / active issue'],
  ['under_1_month', 'Under 1 month'],
  ['1_3_months', '1–3 months'],
  ['3_6_months', '3–6 months'],
  ['6_plus_months', '6+ months / budgeting'],
];

const BUDGETS = [
  ['under_10k', 'Under $10,000'],
  ['10k_25k', '$10,000–$25,000'],
  ['25k_50k', '$25,000–$50,000'],
  ['50k_100k', '$50,000–$100,000'],
  ['100k_plus', '$100,000+'],
  ['not_sure', 'Not sure / need guidance'],
];

const MATERIALS = [
  ['powder_coated_aluminum', 'Powder-coated aluminum'],
  ['ornamental_steel', 'Ornamental steel'],
  ['cable_rail', 'Cable rail'],
  ['glass_rail', 'Glass rail'],
  ['chain_link', 'Chain link'],
  ['vinyl_composite', 'Vinyl / composite'],
  ['not_sure', 'Help me choose'],
];

const CONTACT_METHODS = [
  ['email', 'Email'],
  ['call', 'Call'],
  ['text', 'Text'],
  ['any', 'Any'],
];

const FIELD_NAMES = [
  'project_type', 'property_type', 'project_scope', 'estimated_linear_feet',
  'project_address', 'city', 'state', 'zip_code', 'timeline', 'budget_range',
  'first_name', 'last_name', 'company_name', 'email', 'phone', 'preferred_contact',
];

const LABEL_MAP = new Map([
  ...PROJECT_TYPES,
  ...PROPERTY_TYPES,
  ...TIMELINES,
  ...BUDGETS,
  ...MATERIALS,
  ...CONTACT_METHODS,
]);

function cleanText(value, max = 1000) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function labelFor(value, fallback = 'Not provided') {
  return LABEL_MAP.get(value) || fallback;
}

function loadDraft() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return createInitialForm();
    return {
      ...createInitialForm(),
      ...saved,
      material_preferences: Array.isArray(saved.material_preferences) ? saved.material_preferences : [],
    };
  } catch {
    return createInitialForm();
  }
}

/**
 * Reads the browser's current controls before validation. This makes the wizard
 * resilient to browser autofill/mobile select timing and prevents a value that
 * is visible in the UI from being omitted from React state.
 */
function captureVisibleControls(formElement, currentForm) {
  if (!formElement) return currentForm;

  const next = { ...currentForm };
  const data = new FormData(formElement);

  FIELD_NAMES.forEach((name) => {
    if (data.has(name)) next[name] = String(data.get(name) || '');
  });

  const plansControl = formElement.elements.namedItem('plans_ready');
  const siteVisitControl = formElement.elements.namedItem('needs_site_visit');
  const consentControl = formElement.elements.namedItem('consent');

  if (plansControl instanceof HTMLInputElement) next.plans_ready = plansControl.checked;
  if (siteVisitControl instanceof HTMLInputElement) next.needs_site_visit = siteVisitControl.checked;
  if (consentControl instanceof HTMLInputElement) next.consent = consentControl.checked;

  return next;
}

function validateStep(step, form) {
  if (step === 1 && (!form.project_type || !form.property_type || cleanText(form.project_scope, 2000).length < 15)) {
    return 'Choose a project and property type, then add a brief scope.';
  }
  if (step === 2 && (!form.timeline || !form.budget_range || !cleanText(form.city, 80) || !cleanText(form.state, 2))) {
    return 'Add the project location, expected timeline, and budget range.';
  }
  if (step === 3) {
    const digits = String(form.phone || '').replace(/\D/g, '');
    if (!cleanText(form.first_name, 40) || !cleanText(form.last_name, 40) || !cleanText(form.email, 254) || digits.length < 10 || !form.consent) {
      return 'Complete the contact fields and consent checkbox.';
    }
  }
  return '';
}

export default function QuoteModal({ open, onClose }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(loadDraft);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [uploadNote, setUploadNote] = useState('');

  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(() => {
    return () => previews.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [previews]);

  useEffect(() => {
    if (!complete) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form, complete]);

  if (!open) return null;

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setError('');
  }

  function toggleMaterial(value) {
    setForm((current) => ({
      ...current,
      material_preferences: current.material_preferences.includes(value)
        ? current.material_preferences.filter((item) => item !== value)
        : [...current.material_preferences, value],
    }));
    setError('');
  }

  function next(event) {
    const snapshot = captureVisibleControls(event.currentTarget.form, form);
    setForm(snapshot);

    const nextError = validateStep(step, snapshot);
    if (nextError) {
      setError(nextError);
      return;
    }

    setError('');
    setStep((current) => Math.min(3, current + 1));
  }

  async function uploadFiles(leadId) {
    if (!files.length || !isSupabaseConfigured) return;
    const rows = [];

    for (const file of files.slice(0, 5)) {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const storagePath = `${leadId}/${crypto.randomUUID()}.${extension}`;
      const { error: storageError } = await supabase.storage
        .from('railing-lead-images')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

      if (storageError) throw storageError;

      rows.push({
        lead_id: leadId,
        storage_path: storagePath,
        original_name: cleanText(file.name, 180),
        mime_type: file.type,
        file_size_bytes: file.size,
      });
    }

    const { error: imageError } = await supabase.from('railing_lead_images').insert(rows);
    if (imageError) throw imageError;
  }

  async function submit(event) {
    event.preventDefault();

    const snapshot = captureVisibleControls(event.currentTarget, form);
    setForm(snapshot);

    const nextError = validateStep(3, snapshot);
    if (nextError) {
      setError(nextError);
      return;
    }

    setBusy(true);
    setError('');

    const params = new URLSearchParams(window.location.search);
    const lead = {
      first_name: cleanText(snapshot.first_name, 40),
      last_name: cleanText(snapshot.last_name, 40),
      company_name: cleanText(snapshot.company_name, 120) || null,
      email: cleanText(snapshot.email, 254),
      phone: cleanText(snapshot.phone, 24),
      preferred_contact: snapshot.preferred_contact,
      project_type: snapshot.project_type,
      property_type: snapshot.property_type,
      project_scope: cleanText(snapshot.project_scope, 2000),
      material_preferences: snapshot.material_preferences.length ? snapshot.material_preferences : ['not_sure'],
      estimated_linear_feet: snapshot.estimated_linear_feet ? Number(snapshot.estimated_linear_feet) : null,
      project_address: cleanText(snapshot.project_address, 140) || null,
      city: cleanText(snapshot.city, 80),
      state: cleanText(snapshot.state, 2).toUpperCase(),
      zip_code: cleanText(snapshot.zip_code, 10) || null,
      timeline: snapshot.timeline,
      budget_range: snapshot.budget_range,
      plans_ready: snapshot.plans_ready,
      needs_site_visit: snapshot.needs_site_visit,
      source: cleanText(params.get('source') || 'website', 80),
      campaign: cleanText(params.get('campaign') || '', 100) || null,
      status: 'new',
      priority: 'normal',
    };

    try {
      if (isSupabaseConfigured) {
        const { data: leadId, error: insertError } = await supabase.rpc('submit_railing_lead', { payload: lead });
        if (insertError) throw insertError;

        try {
          await uploadFiles(leadId);
        } catch (fileError) {
          console.error(fileError);
          setUploadNote('Your request was saved, but one or more files did not upload. Gary can request them directly.');
        }
      } else {
        saveDemoLead({
          ...lead,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          quote_amount_cents: null,
          internal_notes: '',
          follow_up_at: null,
          scheduled_site_visit_at: null,
          updated_at: new Date().toISOString(),
          uploaded_file_names: files.map((file) => file.name),
        });
        setUploadNote('Demo mode: this request was saved in this browser and will appear in the local manager dashboard.');
      }

      sessionStorage.removeItem(DRAFT_KEY);
      setComplete(true);
    } catch (submissionError) {
      console.error(submissionError);
      setError(submissionError.message || 'The request could not be submitted. Please call or email instead.');
    } finally {
      setBusy(false);
    }
  }

  function resetAndClose() {
    setStep(1);
    setForm(createInitialForm());
    setFiles([]);
    setError('');
    setComplete(false);
    setUploadNote('');
    sessionStorage.removeItem(DRAFT_KEY);
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && resetAndClose()}>
      <section className="quote-modal" role="dialog" aria-modal="true" aria-labelledby="quote-title">
        <button className="modal-close" onClick={resetAndClose} aria-label="Close quote form"><Icon name="close" /></button>

        {complete ? (
          <div className="quote-success">
            <div className="success-mark"><Icon name="check" size={34} /></div>
            <p className="eyebrow">Request received</p>
            <h2 id="quote-title">Your project is in the estimating queue.</h2>
            <p>Gary’s team will review the scope and contact you to confirm drawings, site conditions, schedule, and next steps.</p>
            {uploadNote ? <p className="form-note">{uploadNote}</p> : null}
            <button className="button button-primary" onClick={resetAndClose}>Return to website</button>
          </div>
        ) : (
          <>
            <div className="quote-modal-head">
              <p className="eyebrow">Commercial project request</p>
              <h2 id="quote-title">Tell us what you’re building.</h2>
              <p>Share the basics now. We’ll confirm the technical details before pricing.</p>
              <div className="step-progress" aria-label={`Step ${step} of 3`}>
                {[1, 2, 3].map((item) => <span key={item} className={item <= step ? 'active' : ''} />)}
              </div>
            </div>

            <form onSubmit={submit} className="quote-form" noValidate>
              {step === 1 ? (
                <div className="form-step">
                  <div className="field-grid two">
                    <label className="field">
                      Project type
                      <select name="project_type" value={form.project_type} onChange={(event) => update('project_type', event.currentTarget.value)} required>
                        <option value="">Select one</option>
                        {PROJECT_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                      </select>
                    </label>

                    <label className="field">
                      Property type
                      <select name="property_type" value={form.property_type} onChange={(event) => update('property_type', event.currentTarget.value)} required>
                        <option value="">Select one</option>
                        {PROPERTY_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                      </select>
                    </label>
                  </div>

                  {(form.project_type || form.property_type) ? (
                    <div className="selection-confirmation" aria-live="polite">
                      <Icon name="check" size={18} />
                      <span>
                        <strong>Selections saved:</strong>{' '}
                        {form.project_type ? labelFor(form.project_type) : 'Choose a project'}
                        {' · '}
                        {form.property_type ? labelFor(form.property_type) : 'Choose a property'}
                      </span>
                    </div>
                  ) : null}

                  <label className="field">
                    Project scope
                    <textarea
                      name="project_scope"
                      value={form.project_scope}
                      onChange={(event) => update('project_scope', event.currentTarget.value)}
                      maxLength="2000"
                      placeholder="Example: furnish and install balcony railings for a 4-story, 80-unit building. Drawings are at 75%."
                      required
                    />
                  </label>

                  <div className="field">
                    <span className="field-label">Material preference <small>Select any that apply</small></span>
                    <div className="choice-grid">
                      {MATERIALS.map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          className={form.material_preferences.includes(value) ? 'choice active' : 'choice'}
                          onClick={() => toggleMaterial(value)}
                          aria-pressed={form.material_preferences.includes(value)}
                        >
                          <span>{form.material_preferences.includes(value) ? '✓' : '+'}</span>{label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="form-step">
                  <div className="field-grid two">
                    <label className="field">
                      Estimated linear feet
                      <input name="estimated_linear_feet" type="number" min="0" max="100000" value={form.estimated_linear_feet} onChange={(event) => update('estimated_linear_feet', event.currentTarget.value)} placeholder="Approximate is fine" />
                    </label>

                    <label className="field">
                      Project timeline
                      <select name="timeline" value={form.timeline} onChange={(event) => update('timeline', event.currentTarget.value)} required>
                        <option value="">Select one</option>
                        {TIMELINES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="field-grid address-grid">
                    <label className="field address-wide">Project address<input name="project_address" value={form.project_address} onChange={(event) => update('project_address', event.currentTarget.value)} maxLength="140" placeholder="Street address or project name" /></label>
                    <label className="field">City<input name="city" value={form.city} onChange={(event) => update('city', event.currentTarget.value)} maxLength="80" required /></label>
                    <label className="field compact-field">State<input name="state" value={form.state} onChange={(event) => update('state', event.currentTarget.value)} maxLength="2" required /></label>
                    <label className="field">ZIP<input name="zip_code" value={form.zip_code} onChange={(event) => update('zip_code', event.currentTarget.value)} maxLength="10" /></label>
                  </div>

                  <label className="field">
                    Preliminary budget range
                    <select name="budget_range" value={form.budget_range} onChange={(event) => update('budget_range', event.currentTarget.value)} required>
                      <option value="">Select one</option>
                      {BUDGETS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>
                  </label>

                  <div className="toggle-row">
                    <label>
                      <input name="plans_ready" type="checkbox" checked={form.plans_ready} onChange={(event) => update('plans_ready', event.currentTarget.checked)} />
                      <span><strong>Plans or drawings available</strong><small>You can attach them below.</small></span>
                    </label>
                    <label>
                      <input name="needs_site_visit" type="checkbox" checked={form.needs_site_visit} onChange={(event) => update('needs_site_visit', event.currentTarget.checked)} />
                      <span><strong>Site visit may be needed</strong><small>We’ll coordinate access.</small></span>
                    </label>
                  </div>

                  <label className="upload-field">
                    <Icon name="upload" size={24} />
                    <span><strong>Attach plans, photos, or reference images</strong><small>Up to 5 files · JPG, PNG, WEBP, or PDF · 10 MB each</small></span>
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={(event) => setFiles(Array.from(event.currentTarget.files || []).filter((file) => file.size <= 10 * 1024 * 1024).slice(0, 5))} />
                  </label>

                  {previews.length ? (
                    <div className="upload-preview-row">
                      {previews.map(({ file, url }) => file.type === 'application/pdf'
                        ? <div className="pdf-preview" key={`${file.name}-${file.lastModified}`}>PDF<br /><small>{file.name}</small></div>
                        : <img key={`${file.name}-${file.lastModified}`} src={url} alt={`Preview of ${file.name}`} />)}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="form-step">
                  <div className="field-grid two">
                    <label className="field">First name<input name="first_name" value={form.first_name} onChange={(event) => update('first_name', event.currentTarget.value)} maxLength="40" required /></label>
                    <label className="field">Last name<input name="last_name" value={form.last_name} onChange={(event) => update('last_name', event.currentTarget.value)} maxLength="40" required /></label>
                  </div>

                  <label className="field">Company / organization<input name="company_name" value={form.company_name} onChange={(event) => update('company_name', event.currentTarget.value)} maxLength="120" placeholder="Optional" /></label>

                  <div className="field-grid two">
                    <label className="field">Work email<input name="email" type="email" value={form.email} onChange={(event) => update('email', event.currentTarget.value)} maxLength="254" required /></label>
                    <label className="field">Phone<input name="phone" type="tel" value={form.phone} onChange={(event) => update('phone', event.currentTarget.value)} maxLength="24" required /></label>
                  </div>

                  <label className="field">
                    Best way to follow up
                    <select name="preferred_contact" value={form.preferred_contact} onChange={(event) => update('preferred_contact', event.currentTarget.value)}>
                      {CONTACT_METHODS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>
                  </label>

                  <label className="consent-field">
                    <input name="consent" type="checkbox" checked={form.consent} onChange={(event) => update('consent', event.currentTarget.checked)} />
                    <span>I agree to be contacted about this project request. Message and data rates may apply for texts.</span>
                  </label>

                  <div className="review-card" aria-label="Project request review">
                    <div><span>Project type</span><strong>{labelFor(form.project_type)}</strong></div>
                    <div><span>Property type</span><strong>{labelFor(form.property_type)}</strong></div>
                    <div><span>Location</span><strong>{form.city ? `${form.city}, ${form.state}` : 'Not provided'}</strong></div>
                    <div><span>Timeline</span><strong>{labelFor(form.timeline)}</strong></div>
                    <div><span>Budget</span><strong>{labelFor(form.budget_range)}</strong></div>
                    <div><span>Materials</span><strong>{form.material_preferences.length ? form.material_preferences.map((value) => labelFor(value)).join(', ') : 'Help me choose'}</strong></div>
                  </div>
                </div>
              ) : null}

              {error ? <div className="form-error" role="alert">{error}</div> : null}

              <div className="form-actions">
                {step > 1
                  ? <button type="button" className="button button-ghost" onClick={() => { setError(''); setStep((current) => current - 1); }}>Back</button>
                  : <span />}
                {step < 3
                  ? <button type="button" className="button button-primary" onClick={next}>Continue <Icon name="arrow" /></button>
                  : <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit project request'} <Icon name="arrow" /></button>}
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

-- Gary Commercial Rail & Fence: lead capture + private manager schema
-- Run this entire file in Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.railing_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  first_name text not null,
  last_name text not null,
  company_name text,
  email text not null,
  phone text not null,
  preferred_contact text not null default 'email',

  project_type text not null,
  property_type text not null,
  project_scope text not null,
  material_preferences text[] not null default array['not_sure']::text[],
  estimated_linear_feet numeric,
  project_address text,
  city text not null,
  state text not null default 'FL',
  zip_code text,
  timeline text not null,
  budget_range text not null,
  plans_ready boolean not null default false,
  needs_site_visit boolean not null default true,

  source text not null default 'website',
  campaign text,

  status text not null default 'new',
  priority text not null default 'normal',
  quote_amount_cents bigint,
  internal_notes text,
  follow_up_at timestamptz,
  scheduled_site_visit_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,

  constraint railing_leads_name_lengths check (
    char_length(first_name) between 1 and 40
    and char_length(last_name) between 1 and 40
    and (company_name is null or char_length(company_name) <= 120)
  ),
  constraint railing_leads_contact_lengths check (
    char_length(email) between 3 and 254
    and char_length(phone) between 7 and 24
    and preferred_contact in ('email', 'call', 'text', 'any')
  ),
  constraint railing_leads_email_format check (
    email ~* '^[A-Z0-9._%+''-]+@[A-Z0-9.-]+\.[A-Z]{2,63}$'
  ),
  constraint railing_leads_phone_digits check (
    length(regexp_replace(phone, '[^0-9]', '', 'g')) between 10 and 15
  ),
  constraint railing_leads_project_type check (
    project_type in ('commercial_railing', 'commercial_fencing', 'gates_access', 'repairs_retrofits', 'mixed_scope')
  ),
  constraint railing_leads_property_type check (
    property_type in ('multifamily', 'hospitality', 'industrial', 'retail_office', 'municipal', 'general_contractor', 'other')
  ),
  constraint railing_leads_materials check (
    cardinality(material_preferences) between 1 and 7
    and material_preferences <@ array[
      'powder_coated_aluminum', 'ornamental_steel', 'cable_rail', 'glass_rail',
      'chain_link', 'vinyl_composite', 'not_sure'
    ]::text[]
  ),
  constraint railing_leads_location check (
    char_length(city) between 1 and 80
    and state ~ '^[A-Z]{2}$'
    and (zip_code is null or zip_code ~ '^\d{5}(-\d{4})?$')
  ),
  constraint railing_leads_timeline check (
    timeline in ('asap', 'under_1_month', '1_3_months', '3_6_months', '6_plus_months')
  ),
  constraint railing_leads_budget check (
    budget_range in ('under_10k', '10k_25k', '25k_50k', '50k_100k', '100k_plus', 'not_sure')
  ),
  constraint railing_leads_manager_values check (
    status in ('new', 'contacted', 'site_visit', 'estimating', 'quoted', 'won', 'lost', 'on_hold')
    and priority in ('normal', 'high', 'hot')
    and (quote_amount_cents is null or quote_amount_cents >= 0)
  ),
  constraint railing_leads_safe_lengths check (
    char_length(project_scope) between 15 and 2000
    and (project_address is null or char_length(project_address) <= 140)
    and char_length(source) <= 80
    and (campaign is null or char_length(campaign) <= 100)
    and (internal_notes is null or char_length(internal_notes) <= 10000)
  ),
  constraint railing_leads_no_html_brackets check (
    first_name !~ '[<>]' and last_name !~ '[<>]'
    and (company_name is null or company_name !~ '[<>]')
    and email !~ '[<>]' and phone !~ '[<>]'
    and project_scope !~ '[<>]'
    and (project_address is null or project_address !~ '[<>]')
    and city !~ '[<>]'
    and source !~ '[<>]'
    and (campaign is null or campaign !~ '[<>]')
  )
);

create index if not exists railing_leads_created_at_idx on public.railing_leads(created_at desc);
create index if not exists railing_leads_status_idx on public.railing_leads(status);
create index if not exists railing_leads_follow_up_idx on public.railing_leads(follow_up_at) where follow_up_at is not null;
create index if not exists railing_leads_company_idx on public.railing_leads(company_name);

create table if not exists public.railing_lead_images (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.railing_leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  constraint railing_lead_images_type check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  constraint railing_lead_images_size check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  constraint railing_lead_images_name_length check (char_length(original_name) between 1 and 180),
  constraint railing_lead_images_path check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$')
);

create index if not exists railing_lead_images_lead_idx on public.railing_lead_images(lead_id);

alter table public.railing_leads enable row level security;
alter table public.railing_lead_images enable row level security;

-- Public visitors submit through a narrow SECURITY DEFINER RPC. They receive the
-- new UUID for file uploads without receiving SELECT access to the leads table.
revoke all on public.railing_leads from anon;
grant select, insert, update, delete on public.railing_leads to authenticated;

drop policy if exists "Public can submit railing leads" on public.railing_leads;

create or replace function public.submit_railing_lead(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  materials text[];
begin
  materials := case
    when jsonb_typeof(payload->'material_preferences') = 'array'
      then array(select jsonb_array_elements_text(payload->'material_preferences'))
    else array['not_sure']::text[]
  end;

  insert into public.railing_leads (
    first_name, last_name, company_name, email, phone, preferred_contact,
    project_type, property_type, project_scope, material_preferences,
    estimated_linear_feet, project_address, city, state, zip_code,
    timeline, budget_range, plans_ready, needs_site_visit, source, campaign,
    status, priority
  ) values (
    trim(payload->>'first_name'),
    trim(payload->>'last_name'),
    nullif(trim(payload->>'company_name'), ''),
    lower(trim(payload->>'email')),
    trim(payload->>'phone'),
    coalesce(nullif(payload->>'preferred_contact', ''), 'email'),
    payload->>'project_type',
    payload->>'property_type',
    trim(payload->>'project_scope'),
    materials,
    nullif(payload->>'estimated_linear_feet', '')::numeric,
    nullif(trim(payload->>'project_address'), ''),
    trim(payload->>'city'),
    upper(coalesce(nullif(trim(payload->>'state'), ''), 'FL')),
    nullif(trim(payload->>'zip_code'), ''),
    payload->>'timeline',
    payload->>'budget_range',
    coalesce((payload->>'plans_ready')::boolean, false),
    coalesce((payload->>'needs_site_visit')::boolean, true),
    coalesce(nullif(trim(payload->>'source'), ''), 'website'),
    nullif(trim(payload->>'campaign'), ''),
    'new',
    'normal'
  ) returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.submit_railing_lead(jsonb) from public;
grant execute on function public.submit_railing_lead(jsonb) to anon, authenticated;

drop policy if exists "Authenticated users manage railing leads" on public.railing_leads;
create policy "Authenticated users manage railing leads"
on public.railing_leads
for all
to authenticated
using (true)
with check (true);

revoke all on public.railing_lead_images from anon;
grant insert on public.railing_lead_images to anon;
grant select, insert, update, delete on public.railing_lead_images to authenticated;

drop policy if exists "Public can attach railing lead files" on public.railing_lead_images;
create policy "Public can attach railing lead files"
on public.railing_lead_images
for insert
to anon
with check (
  split_part(storage_path, '/', 1) = lead_id::text
);

drop policy if exists "Authenticated users manage railing files" on public.railing_lead_images;
create policy "Authenticated users manage railing files"
on public.railing_lead_images
for all
to authenticated
using (true)
with check (true);

-- Private storage bucket. Public users may upload only into a folder matching a real lead UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'railing-lead-images',
  'railing-lead-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.railing_lead_exists(folder_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.railing_leads where id::text = folder_name
  );
$$;

revoke all on function public.railing_lead_exists(text) from public;
grant execute on function public.railing_lead_exists(text) to anon, authenticated;

drop policy if exists "Public uploads railing lead files" on storage.objects;
create policy "Public uploads railing lead files"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'railing-lead-images'
  and public.railing_lead_exists((storage.foldername(name))[1])
);

drop policy if exists "Authenticated users read railing lead files" on storage.objects;
create policy "Authenticated users read railing lead files"
on storage.objects
for select
to authenticated
using (bucket_id = 'railing-lead-images');

drop policy if exists "Authenticated users manage railing lead files" on storage.objects;
create policy "Authenticated users manage railing lead files"
on storage.objects
for all
to authenticated
using (bucket_id = 'railing-lead-images')
with check (bucket_id = 'railing-lead-images');

-- Keep updated_at current when manager records change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_railing_leads_updated_at on public.railing_leads;
create trigger set_railing_leads_updated_at
before update on public.railing_leads
for each row execute function public.set_updated_at();

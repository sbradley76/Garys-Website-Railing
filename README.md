# Gary Commercial Rail & Fence

A complete Vite + React commercial railing/fence website with an integrated public quote capture system and private lead manager.

## Included

- Responsive public website for desktop, tablet, and mobile
- CSS theme variables for easy color changes
- Home, Capabilities, About, Portfolio, Contact, FAQ, process, industries, and testimonials
- Multi-step commercial quote request wizard
- Plan/photo/PDF uploads
- Source and campaign tracking through URL parameters
- Private `/manager` pipeline with Supabase Auth
- Lead search, filters, priority, status, quote amount, follow-up, site visit, internal notes, and CSV export
- Supabase-free demo mode using browser local storage
- Local SVG placeholder artwork in `public/images`
- Reduced-motion accessibility support

## Run locally immediately

```bash
npm install
npm run dev
```

Open the URL Vite prints, normally:

```txt
http://localhost:5173
```

The website works without Supabase. Submit a quote request, then use the footer **Manager login** link. Because no `.env` exists yet, the manager offers a demo dashboard and the submitted lead appears there.

## Connect Supabase

1. Create a Supabase project.
2. Open **SQL Editor** in Supabase.
3. Run the complete file at `supabase/schema.sql`.
4. Go to **Authentication → Users → Add user** and create Gary's manager login.
5. Copy `.env.example` to `.env`.
6. Add your project URL and anon/publishable key:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

7. Restart Vite:

```bash
npm run dev
```

The public form now inserts into `railing_leads`. The `/manager` route requires the Supabase Auth user and can read/update leads.

## Important security notes

- Never put the Supabase service-role key in a Vite environment variable.
- The browser should only use the anon/publishable key.
- Row Level Security in `supabase/schema.sql` allows anonymous visitors to insert a clean new lead only.
- Anonymous visitors cannot read, update, or delete leads.
- Uploaded files are stored in a private bucket. Anonymous visitors can upload to a folder tied to an existing lead, but cannot list or read files.
- Authenticated manager users can manage leads and files. For multiple unrelated business clients later, replace the broad authenticated policies with organization-scoped membership policies.

## Replace business information

Edit:

```txt
src/config/site.js
```

This holds the business name, phone, email, service areas, capabilities, and portfolio item labels.

## Change the color palette

Edit the variables at the top of:

```txt
src/styles.css
```

Primary variables include:

```css
--color-primary-950
--color-primary-900
--color-primary-800
--color-accent-600
--color-accent-500
--color-accent-400
--color-surface
--color-surface-alt
--color-ink
--color-muted
--color-line
```

## Replace placeholder images

The current artwork is stored in:

```txt
public/images/
```

You can replace each SVG with a JPG, PNG, WEBP, or revised SVG. Update paths in `src/config/site.js` only when filenames change.

## Campaign tracking

Use links such as:

```txt
http://localhost:5173/?source=gary_referral&campaign=railing_launch
http://localhost:5173/?source=qr_flyer&campaign=gc_outreach
```

The values are saved with the lead.

## Production note for later

When deployed, configure the host to rewrite `/manager` to `index.html` so a browser refresh on the manager route works. Vite's local development server already handles this.

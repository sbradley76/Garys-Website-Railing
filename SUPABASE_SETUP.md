# Supabase Setup Checklist

1. Create or select the Supabase project.
2. Run `supabase/schema.sql` in SQL Editor.
3. Confirm these tables exist:
   - `railing_leads`
   - `railing_lead_images`
4. Confirm Storage contains the private bucket `railing-lead-images`.
5. Create Gary's user in Authentication.
6. Create `.env` from `.env.example`.
7. Restart `npm run dev` after changing `.env`.
8. Submit a test request from the public site.
9. Sign in at `/manager` and confirm the test lead appears.
10. Update status, quote, notes, and dates to confirm authenticated updates work.

## Optional verification SQL

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('railing_leads', 'railing_lead_images');

select policyname, tablename, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('railing_leads', 'railing_lead_images');
```

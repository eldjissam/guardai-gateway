# GuardAI Admin Control Center — Phase 4

## What this adds

- Admin-only navigation and dashboard view.
- Live overview metrics from `security_events` through a server-side aggregate RPC.
- Recent audit events with metadata only (no prompt content, detected values, or token maps).
- A safe account directory containing profile name, email, role, and creation date.
- 7-day, 30-day, and all-time filters.
- CSV export of audit metadata only.

## Apply the migration

Run `supabase/migrations/20261103210000_admin_control_center.sql` in Supabase SQL Editor. Paste the SQL contents, not the file path.

## Promote the first administrator

After the migration has completed, replace the email placeholder below with the exact email address of the account that should administer GuardAI, then run this statement in Supabase SQL Editor as the project owner:

```sql
UPDATE public.profiles AS p
SET role = 'admin'
FROM auth.users AS u
WHERE u.id = p.id
  AND lower(u.email) = lower('YOUR_ADMIN_EMAIL@example.com');

SELECT id, full_name, email, role
FROM public.profiles
WHERE lower(email) = lower('YOUR_ADMIN_EMAIL@example.com');
```

Only do this for a trusted administrator. Do not expose role editing in the browser. Normal users cannot update their own `role` column because the existing profile grant permits updates to `full_name` only.

## Apply the frontend patch

From the repository root, run:

```powershell
node tools/apply-admin-phase.mjs
npm run typecheck
npm run build
npm run dev
```

The integration script updates only `frontend/src/App.tsx` using exact anchors, then adds the new dashboard component and CSS from this package.

## Data privacy

The dashboard reads:

- `security_events`: request ID, user ID, session ID, risk score/level, entity counts/categories, status, duration, and timestamp.
- `profiles`: account ID, display name, email, role, and creation date.

It never reads `chat_messages` and never displays prompt text, original sensitive values, or token mappings. CSV export intentionally excludes account email and content.

## Important implementation notes

- The `get_guardai_admin_metrics` RPC is `SECURITY INVOKER`; caller RLS continues to apply.
- `public.is_guardai_admin()` is a narrowly scoped `SECURITY DEFINER` helper used to avoid recursive RLS policy evaluation. Its `search_path` is fixed and execute permission is restricted to authenticated users.
- The initial admin is assigned manually by the project owner in SQL.
- The UI is not the security boundary. RLS and the database function enforce access.
- A 200-row recent-events cap is applied to the table view. Summary values are calculated server-side over the selected period.

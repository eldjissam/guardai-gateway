# GuardAI Admin Operations — Phase 4.2

This package extends the existing GuardAI project with a dedicated, light-mode administration workspace, scalable admin tables, user invitations and role management, and full project-team profile management.

## What is included

- Dedicated admin shell with dark-green sidebar and white content area.
- Overview metrics with 7/30/90-day, all-time and custom date ranges.
- Security logs with server-side pagination, request-ID search, risk/status/date filters and CSV export of the current page.
- User-management metrics, server-side pagination, search, role and verification filters, date filters, account invitations, role changes and account deletion.
- Project Team CRUD: add, read, update, publish/unpublish, reorder and delete members.
- Team photograph upload to a public-read, administrator-write Supabase Storage bucket.
- Public About page team cards sourced from `published_project_team`.
- Shared sign-out confirmation for ordinary users and administrators.
- New server-side Edge Function `admin-manage-users` for privileged Auth Admin operations.

## Important security design

1. An admin does not set or see another person's password. The admin sends an invitation; the recipient establishes their own password through Supabase Auth.
2. Administrator-role assignment and account deletion occur only inside the `admin-manage-users` Edge Function. The browser never receives a Supabase secret key.
3. The last administrator cannot be demoted or deleted. An administrator cannot demote or delete their own account through this UI.
4. Project-team records are separate from login accounts. Phone, email and registration number are hidden from the public About view unless an administrator explicitly marks each field as public.
5. Public visitors can read only published team profiles through a restricted database view. Direct access to the underlying team table is administrator-only.
6. Security logs show metadata only. Prompt content, original PII and token mappings are not exposed.
7. Deleting a GuardAI account is destructive: Supabase Auth deletion cascades to that account's profile, conversations, messages and security events. Require a deliberate confirmation.

## Installation

Run commands from the repository root, `C:\guardai-gateway-starter`.

1. Create a Git checkpoint:

   ```powershell
   git status
   git add .
   git commit -m "chore: checkpoint before admin operations"
   git push
   ```

   If Git reports a clean working tree, continue.

2. Extract this package into the repository root, merging the `frontend`, `supabase`, `tools` and `docs` folders.

3. Apply the safe frontend integration:

   ```powershell
   node tools/apply-admin-operations.mjs
   ```

   The script updates `frontend/src/App.tsx` and `supabase/config.toml`. It creates a backup before modifying the app file.

4. Run the SQL migration. Open `supabase/migrations/20261103220000_admin_operations_and_project_team.sql`, copy the SQL statements (not the file path), then paste them into Supabase Dashboard → SQL Editor → New query and click Run.

5. Deploy the privileged account-management function:

   ```powershell
   npx supabase functions deploy admin-manage-users
   ```

6. Run frontend checks:

   ```powershell
   npm run typecheck
   npm run build
   npm run dev
   ```

7. Commit the completed local implementation:

   ```powershell
   git add .
   git commit -m "feat: add admin operations and project team management"
   git push
   ```

## Supabase configuration notes

- The function uses Supabase's injected `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS` dictionaries. It reads the `default` key from each dictionary. It also has a legacy server-only fallback for `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
- Do not add a secret/service-role key to `frontend/.env.local`.
- `admin-manage-users` has `verify_jwt = true` in `supabase/config.toml`.
- The invitation redirect uses the calling frontend origin. That origin must be included in both `GUARDAI_ALLOWED_ORIGINS` and Supabase Authentication → URL Configuration → Redirect URLs.
- The migration creates the `guardai-team-avatars` public bucket (5 MB maximum; JPEG, PNG and WebP only). Public read is intentional for published team portraits; uploads, updates and deletes require an administrator policy.

## Navigation and behavior

Admin navigation: Overview → Security logs → User management → Project team.

- Overview: real aggregate metrics and activity. Custom dates use a start-inclusive/end-exclusive timestamp range; activity is capped to 90 daily points (All time defaults to the latest 30 days).
- Security logs: server-side paging (10/20/50), date range, risk level, status and exact request-ID search. Full request IDs can be copied from the table; CSV exports the currently visible page only.
- User management: summary cards plus paginated account directory. New users receive an invitation email. Role changes and deletion are server-side.
- Project team: create/update/delete profiles, upload portraits, select public fields, publish/unpublish, and sort the public listing.
- About GuardAI: displays only published profiles and only the fields that have been approved for public display.

## Acceptance tests

1. An ordinary user cannot open the admin shell or read the admin user directory.
2. An admin can switch Overview / Security logs / User management / Project team without the old user sidebar appearing.
3. Date filters change the metrics and table rows. Pagination fetches only the current page.
4. Request logs never display prompt text or detected original values.
5. Inviting a new User sends an invitation email; the new account appears as Pending until email confirmation.
6. Inviting an Administrator creates the account with the admin role, while the last-admin protections still work.
7. Changing a role updates the directory after refresh.
8. Deleting a non-self account removes the Auth user and cascaded GuardAI data. The last admin and the current admin cannot be deleted through this function.
9. Creating a team member as a draft does not display them on About GuardAI.
10. Publishing a team member displays their profile. Phone, email and registration number remain hidden unless the matching public checkbox is enabled.
11. Editing a team member updates the About page. Deleting a team member removes the profile and stored photograph.
12. Sign out opens a confirmation dialog; Cancel keeps the session active; Confirm ends the session.
13. Test the admin shell at desktop, tablet and narrow mobile widths. Its content region scrolls independently from the sidebar.

## Known boundaries

- This package does not add account suspension/ban controls. Account deletion is available; adding temporary suspension should be a separate, carefully audited feature.
- Email delivery depends on the Supabase Auth email configuration and provider limits.
- `last_sign_in_at` is mirrored when Supabase updates `auth.users`; the profile directory can lag briefly after a sign-in event.
- Team member personal information should be entered only with the member's consent. Keep the public visibility checkboxes off by default.

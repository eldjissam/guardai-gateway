# GuardAI Stage 4.1 — Dedicated Admin Interface

This package separates the admin experience from the regular GuardAI user workspace.

## What changes

- Dedicated administration shell and dark-green left sidebar.
- Light/white admin content area, independent of the user's theme setting.
- Separate Overview, Security Logs and User Management navigation.
- Desktop collapsible sidebar and mobile drawer.
- Back to User Workspace action.
- Shared sign-out confirmation dialog for both admin and user interfaces.
- Existing Supabase metrics, audit data and user directory remain in the existing AdminDashboard component.
- Independent admin content scrolling; the shell and sidebar remain fixed.

## Install

Extract this package into the existing repository root (`C:\guardai-gateway-starter`), merging folders.

From PowerShell at the repository root:

```powershell
node tools/apply-admin-shell-phase.mjs
npm run typecheck
npm run build
npm run dev
```

The integration script checks all source anchors before writing. It creates backups of `App.tsx` and `AdminDashboard.tsx` before applying updates.

## Scope and CRUD status

Stage 4.1 is the separate admin shell and working navigation. The existing Overview, Security Logs and User Management pages continue to read live Supabase records; security logs remain exportable to CSV. This stage does not add fake Create/Edit/Delete actions to account or team rows.

Real Project Team CRUD (including image upload), personal user profiles, and secure administrator invitations/role changes are subsequent stages. They require their own database tables, Storage policies, and trusted server-side operations. Ordinary browser code must never use the Supabase service-role key to create accounts or grant admin roles.

## Verification checklist

- [ ] Admin user sees separate administration interface.
- [ ] Admin sidebar remains deep green.
- [ ] Admin body remains white/light even if the user workspace was in dark mode.
- [ ] Overview, Security Logs and User Management navigation works.
- [ ] Dashboard data continues to load from Supabase.
- [ ] Long admin pages scroll within the content area.
- [ ] Sidebar collapses on desktop and opens as a drawer on mobile.
- [ ] Back to User Workspace returns to the authenticated chat.
- [ ] Sign out opens a confirmation dialog in both interfaces.
- [ ] Cancel keeps the session; confirm signs out.

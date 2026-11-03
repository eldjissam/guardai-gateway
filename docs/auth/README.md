# GuardAI authentication setup

## What this phase implements

- Supabase email/password sign-up and sign-in.
- Email-confirmation-aware registration feedback.
- Persistent browser session and sign-out.
- Password reset email and password update after recovery redirect.
- A protected authenticated workspace placeholder. Secure chat is not enabled until its backend phase is built.
- A `profiles` table populated by an Auth trigger; public sign-up cannot assign an admin role.

## Frontend environment

Create `frontend/.env.local` from `frontend/.env.example` and set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Only a publishable/anon key is allowed in the browser. Never put a Supabase secret/service-role key or OpenAI key in any `VITE_` variable.

Restart Vite after changing `.env.local`.

## Supabase dashboard setup

1. Open Authentication > URL Configuration.
2. Set the Site URL to the real frontend URL once deployed. For local development use `http://localhost:5173`.
3. Add the exact local development URL(s) as Redirect URLs, for example:
   - `http://localhost:5173/**`
   - `http://127.0.0.1:5173/**`
   - `http://192.168.1.65:5173/**` (only if this is the LAN address and port actually used for testing)
   - `http://192.168.1.65:5174/**` (only if Vite selected port 5174)
4. Add the exact LAN origin and port printed by Vite if you test from a phone on the same Wi-Fi. Only allow the addresses you use.
5. Keep email confirmation enabled for normal account registration. Users must click the confirmation email before signing in when confirmation is required.
6. Confirm Authentication > Providers > Email is enabled.

Do not add broad wildcard domains in production. Add only domains you control.

## Database migration

Run `supabase/migrations/20261103170000_profiles_auth.sql` in the Supabase SQL Editor. Review the SQL before running it. It creates `public.profiles`, enables RLS, and creates a trigger that gives every new account the `user` role. The migration grants authenticated users read access only to their own profile and update access only to `full_name`.

To promote a project administrator, first register that account, identify its UUID in Authentication > Users, then have the project owner run a deliberate SQL update in the SQL Editor. Never expose a client-side role editor or accept `role` from user metadata.

## Test checklist

- Sign-up with a new test email; see the email confirmation message.
- Confirm the email; return to the allowed redirect URL and sign in.
- Refresh the page; the session remains active.
- Sign out; the guest interface returns.
- Try a wrong password; a safe error appears.
- Request a password reset; follow the email link; set a new password.
- Inspect `public.profiles`; the new row has role `user`.
- Verify one user cannot read another user's profile.

## Current scope boundary

This phase authenticates users only. It does not send prompts to OpenAI, persist chat messages, or implement admin dashboards. The authenticated workspace explicitly says that secure chat processing is the next build phase.

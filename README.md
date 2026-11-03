# GuardAI Gateway

**Think freely. Share safely.**

GuardAI is a mobile-first privacy-protection gateway for generative AI. Its purpose is to detect supported sensitive information, replace it with temporary tokens before an external AI request, and make the protection process visible to the user.

## Technology

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS v4-ready setup with a custom design system
- Motion: Framer Motion
- Icons: Lucide React
- Backend (next phase): Supabase Edge Functions
- Database/Auth (next phase): Supabase PostgreSQL and Supabase Auth
- AI provider (next phase): OpenAI API, called only from the Edge Function

## Product principles

- Phone-first layouts are designed first; tablet and desktop progressively enhance the same UI.
- Original prompts and token mappings are transient and are not written to audit tables.
- OpenAI credentials are server-side only.
- The browser receives only the data required to show a user's security report.
- Detection has known limits. GuardAI does not claim perfect anonymization.

## Repository layout

```text
guardai-gateway/
├── frontend/                 # React app
├── supabase/                 # Supabase config, migrations and Edge Functions
└── docs/                     # Architecture, UML and academic report material
```

## Requirements

- Node.js 22.12+ (or Node.js 20.19+)
- npm 10+
- Git

## Run locally

```bash
npm install
cp frontend/.env.example frontend/.env.local
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

The current frontend phase includes the guest landing experience, mobile drawer, desktop collapsible sidebar, About view, theme toggle and sign-in/create-account gate. Authentication and chat processing are intentionally not connected yet; those integrations are next.

## Environment variables

Only the Supabase URL and publishable key belong in `frontend/.env.local`. Never place a Supabase secret/service-role key or OpenAI API key in any `VITE_` variable.

## Security baseline

- Keep `.env.local` out of Git.
- Use RLS on every user-owned database table.
- Validate the authenticated user in every protected Edge Function.
- Keep OpenAI calls inside trusted server-side code.
- Store security metadata, not original sensitive values, in audit records.
- Never silently fall back to sending the unmasked prompt if protection fails.

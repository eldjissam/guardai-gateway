# GuardAI Phase 3 — Privacy Engine and Secure Chat

## What this phase adds

- Rule-based PII detection: contextual names, contextual organization names, emails, phone-like strings, Luhn-valid payment-card-like numbers, and common API-token prefixes.
- Request-scoped tokenization and exact-token restoration.
- Explainable weighted risk score (0–100).
- Authenticated Supabase Edge Function `secure-chat` with JWT verification.
- OpenAI Responses API call with `store: false`.
- Sanitized chat persistence and metadata-only security audit events.
- Mobile-first authenticated chat UI and per-message privacy inspection.

## Data-handling rules

1. The browser sends the original prompt to the GuardAI Edge Function over HTTPS.
2. The Edge Function detects and tokenizes supported sensitive spans.
3. Only the sanitized prompt and previously stored sanitized conversation messages are sent to OpenAI.
4. The token map exists only in the current Edge Function request memory.
5. The database stores sanitized user messages, sanitized assistant messages, and metadata only.
6. The current browser session can display the original text and highlighted spans. That original text is not written to Supabase.
7. If the protection pipeline fails, GuardAI does not fall back to sending the original prompt.

This is a prototype with defined detection coverage, not a guarantee that all personal, confidential, or indirectly identifying information will be detected.

## Database migration

Run the complete SQL contents of:

`supabase/migrations/20261103190000_secure_chat.sql`

in Supabase SQL Editor. Do not paste the file path into the editor. The migration creates `chat_sessions`, `chat_messages`, `security_events`, and a private per-user rate-limit counter. It enables RLS and grants browser users read-only access to their own records. Edge Function writes use the server-side secret. The rate-limit RPC allows 15 requests per user per 60-second window and fails closed if its check cannot run.

The existing `profiles` migration must already have been applied.

## Edge Function secrets

In Supabase Dashboard → Edge Functions → Secrets, configure:

- `OPENAI_API_KEY`: the OpenAI API key (server-side only).
- `OPENAI_MODEL`: a model enabled for your API project; suggested default `gpt-6-luna`.
- `GUARDAI_ALLOWED_ORIGINS`: comma-separated exact frontend origins, for example `http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.65:5174`.

Supabase provides its own URL and key environment variables to hosted Edge Functions. Do not add the Supabase secret key or OpenAI API key to any `VITE_` variable or browser environment file.

For local Edge Function serving, create `supabase/functions/secure-chat/.env` from `.env.example` and populate it locally. Never commit the populated `.env` file.

## Deploy the function

From the repository root:

1. Install the Supabase CLI as a project dev dependency: `npm install --save-dev supabase`.
2. Authenticate: `npx supabase login`.
3. Link the project using its Project ID from Supabase Settings → General: `npx supabase link --project-ref YOUR_PROJECT_REF`.
4. Deploy: `npx supabase functions deploy secure-chat`.

Keep `verify_jwt = true` in `supabase/config.toml` for this function.

## Frontend wiring

The package includes `tools/apply-privacy-phase.mjs`. Run it from the project root after extracting the patch. It replaces the authenticated placeholder with `SecureChatWorkspace`, adds the shared chat-session context to the application provider tree, and renders recent conversation links in the existing sidebar.

## Detection model and scoring

| Entity | Weight |
|---|---:|
| Person name | 15 |
| Email address | 10 |
| Phone number | 10 |
| Organization | 20 |
| Payment card (Luhn-valid) | 30 |
| API credential pattern | 40 |

The score is the sum of detected entity weights capped at 100. Levels: Low 0–29, Medium 30–59, High 60–100. These weights are project-specific demonstration values, not an external security standard.

## Test coverage

The Deno test file is `supabase/functions/secure-chat/modules/detector_test.ts`. With Deno installed, run:

`deno test supabase/functions/secure-chat/modules/detector_test.ts`

Tests cover email, contextual names, contextual organizations, repeated-value tokenization, exact restoration, and risk calculation.

## Manual acceptance tests

1. Send a harmless prompt: no PII detected, risk 0, response returned.
2. Send a prompt containing a synthetic name and email: both are highlighted, tokens appear in the sanitized prompt, and the response is restored when the model preserves tokens.
3. Repeat one email twice: both occurrences use the same token.
4. Test a synthetic Luhn-valid card-like number only; never use a real card number.
5. Use an invalid or unavailable OpenAI key in a test environment: request fails safely and never sends an unmasked fallback.
6. Open a saved session: the persisted messages are sanitized, with a notice that original values were not retained.
7. Sign in as a second test account: the first user's sessions and audit events are inaccessible.
8. Call the Edge Function without a valid JWT: it returns 401.
9. Call from an origin outside the configured allowlist: the browser request is rejected.

## Known limitations

- Person and organization detection use contextual rules. They will miss many names and organizations that do not match the expected phrases.
- Phone detection is heuristic and may misclassify long numeric identifiers.
- A masked prompt can still reveal identity through indirect context.
- If the model alters a placeholder, GuardAI leaves it masked and reports a restoration warning rather than guessing.
- Historical conversation messages remain sanitized. Original values are not recoverable after the browser session is cleared.
- The first version uses a bounded recent-history window, not unlimited conversation context.
- The first version rate-limits each account to 15 chat requests per 60-second window; tune this value only after testing and cost review.

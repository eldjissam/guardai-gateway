# GuardAI Stage 5 — Code Review Findings

## Findings addressed in this package

### MEDIUM — Concurrent administrator removal could violate the last-admin invariant

The existing Edge Functions checked the current admin count and then performed the change/deletion in a separate request. Two concurrent operations could both observe more than one admin and then remove/demote both. The new SQL migration introduces a transaction-scoped advisory lock and server-only RPCs. Admin role changes are serialized; an admin account is demoted before Auth deletion, and the final admin cannot be demoted/deleted. If Auth deletion fails after the safe demotion, a trusted administrator may need to restore that account's admin role explicitly.

### MEDIUM — Unresolved historical GuardAI placeholders could appear in an AI response

The secure-chat function detected unresolved markers but still returned their raw internal token text to the browser. The new response path restores only tokens from the current request and replaces any remaining internal markers with `[sensitive information redacted]`. The persisted assistant content remains sanitized and is not changed by this display-only fallback.

## Controls confirmed in repository review

- Edge Functions are configured with `verify_jwt = true`.
- secure-chat verifies the bearer token with Supabase Auth `getUser`.
- secure-chat applies a per-user rate-limit RPC.
- OpenAI Responses API request includes `store: false`.
- chat_messages stores the sanitized prompt and sanitized model response, not the original prompt or token map.
- User-private academic/contact fields are in a separate table with owner-only RLS.
- User avatars are stored in a private bucket with UID-folder policies.
- Admin functions verify the caller and check the database admin role before using the server secret.
- Account deletion requires an explicit `DELETE` confirmation and protects the last administrator.

## Limitations and residual risks

- Regex/pattern-based detection is not a complete DLP/NER solution. It can miss unlabelled names, unusual formats, non-Latin edge cases, images, files, encoded values and context-dependent identifiers.
- Current unit tests cover selected synthetic examples; manual and broader test corpora are still needed.
- The static audit is a source/configuration guard, not a secret scanner equivalent to GitHub Advanced Security or a full SAST/DAST platform.
- The SQL pgTAP suite checks schema/grants/policy definitions. Cross-user isolation must also be tested using two authenticated accounts against the actual Supabase project.
- The app should not be marketed as guaranteeing GDPR compliance, complete anonymization, or enterprise-grade DLP based solely on this prototype.

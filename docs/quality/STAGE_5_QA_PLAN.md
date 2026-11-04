# GuardAI Stage 5 — Security & Quality Assurance

## Purpose

Stage 5 validates the implemented GuardAI product before the academic demonstration. It is a verification phase, not a claim of formal certification or complete data-loss prevention.

## Scope

1. Authentication and account lifecycle.
2. Authorization and Row Level Security (RLS).
3. PII detection, tokenization, request-local restoration and risk scoring.
4. Sanitized conversation persistence and history isolation.
5. Administrator authorization, invitations, role changes and last-admin safeguards.
6. Project team publication and private member fields.
7. User-private profile fields and private avatar storage.
8. Mobile/tablet/desktop accessibility and layout regression.
9. TypeScript, production build, static source scan and CI quality gates.

## Automated gates

Run from the repository root:

```powershell
npm run typecheck
npm run qa:unit
npm run qa:security
npm run build
```

Or run all local code gates in one command:

```powershell
powershell -ExecutionPolicy Bypass -File tools/qa/run-stage5.ps1
```

`qa:unit` tests the real detector, tokenizer, risk engine and restoration modules using Node's built-in test runner and Node 22 TypeScript type stripping. `qa:security` performs a static configuration/source review. Neither replaces a live Supabase RLS test.

## Database tests

The pgTAP suite is `supabase/tests/guardai_security.test.sql`. With Docker running and the local Supabase stack available:

```powershell
npx supabase start
npx supabase test db
npx supabase stop
```

The pgTAP file checks RLS enablement, grants, owner-scoped private profile policies, public/team separation, private avatar bucket settings, and server-only account-role RPC privileges. It is intentionally a schema/privilege gate; the two-account isolation scenarios remain in the manual checklist.

## Manual verification

Use two controlled test accounts (one standard user and one administrator). Use synthetic sample values only. Never paste real payment-card details, personal identifiers, passwords, API keys or production customer data into a test prompt.

Record each test as PASS, FAIL or BLOCKED with date, browser/device, account role, expected result, actual result and screenshot/evidence reference.

## Release gate

Do not describe Stage 5 as passed until all of the following are true:

- `npm run typecheck` passes.
- `npm run qa:unit` passes.
- `npm run qa:security` reports zero critical failures.
- `npm run build` passes.
- pgTAP database tests pass against the migrated local database.
- Manual account-isolation, admin-denial, profile-privacy and final-admin tests pass.
- Chat PII tests confirm only sanitized prompt/history content is persisted and sent to OpenAI.
- Mobile/tablet/desktop smoke tests pass without horizontal overflow or inaccessible controls.
- No unresolved P0/P1 security or data-loss defects remain.

## Known limitations to disclose in the academic report

- GuardAI uses explainable pattern/keyword rules, not a complete enterprise DLP system or general-purpose named-entity recognition model.
- Detection can produce false positives and false negatives. Users must not treat the product as a guarantee that every sensitive value is found.
- Automated tests cover defined synthetic cases, not every language, format, encoding, document, image or adversarial prompt.
- This phase is project QA, not an independent penetration test, security certification or legal compliance assessment.

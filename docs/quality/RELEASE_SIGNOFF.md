# GuardAI Stage 5 — Release Sign-off

| Gate | Status | Evidence / notes |
|---|---|---|
| `npm run typecheck` | NOT RUN | |
| `npm run qa:unit` | NOT RUN | |
| `npm run qa:security` | NOT RUN | |
| `npm run build` | NOT RUN | |
| `npx supabase test db` | NOT RUN | Requires Docker/local Supabase stack |
| Auth / JWT / admin-denial manual tests | NOT RUN | |
| Two-account RLS isolation tests | NOT RUN | |
| Synthetic PII masking/restoration tests | NOT RUN | |
| Data persistence inspection | NOT RUN | |
| Project-team publication/privacy tests | NOT RUN | |
| User profile/private-avatar tests | NOT RUN | |
| Last-administrator concurrency test | NOT RUN | |
| Responsive and keyboard smoke tests | NOT RUN | |

Release decision: **NOT APPROVED** until the required gates are completed and evidence is recorded.

Tested by: ____________________

Date: ____________________

Commit SHA: ____________________

Outstanding P0/P1 defects: ____________________

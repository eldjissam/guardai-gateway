# GuardAI Stage 5 — Manual Security and UX Test Checklist

Use only synthetic data and dedicated test accounts. Do not use actual bank-card numbers, real personal identifiers, real API credentials or production user data.

| ID | Area | Test | Expected result | Evidence / result |
|---|---|---|---|---|
| AUTH-01 | Authentication | Open workspace while signed out | User sees guest experience; protected chat submission asks for sign-in | |
| AUTH-02 | Authentication | Sign in with a confirmed test account | Authenticated workspace opens | |
| AUTH-03 | Authentication | Submit an incorrect password | Sign-in is rejected without revealing whether the email exists | |
| AUTH-04 | Authentication | Use password recovery flow | Only the account owner can complete reset through the email link | |
| AUTH-05 | Authentication | Sign out, then use browser Back | Protected content is not usable without a valid session | |
| AUTH-06 | Authentication | Confirm sign-out dialog then cancel | Account remains signed in | |
| AUTH-07 | Authentication | Confirm sign-out dialog then sign out | Session ends and guest experience is shown | |
| RBAC-01 | Authorization | Sign in as standard user | Admin navigation is hidden | |
| RBAC-02 | Authorization | Standard user calls admin metrics RPC | Database denies access | |
| RBAC-03 | Authorization | Standard user invokes admin-manage-users function | HTTP 403; no invitation/role/delete action occurs | |
| RBAC-04 | Authorization | Missing/invalid JWT calls secure-chat | HTTP 401; OpenAI is not called | |
| RBAC-05 | Authorization | Call Edge Function from an unapproved Origin | Request is rejected; no protected action occurs | |
| RLS-01 | Data isolation | User A queries User B's chat sessions/messages | No rows from User B are returned | |
| RLS-02 | Data isolation | User A queries User B's user_private_profiles row | No rows from User B are returned | |
| RLS-03 | Data isolation | User A attempts to upload/read/delete User B's avatar path | Storage denies the operation | |
| RLS-04 | Data isolation | Standard user reads unpublished project_team_members directly | No rows returned / access denied | |
| RLS-05 | Data isolation | Anonymous visitor reads published_project_team | Only explicitly published fields appear | |
| PII-01 | Privacy engine | Submit synthetic name: `My name is Jean Dupont.` | Person span is shown in the current response inspection | |
| PII-02 | Privacy engine | Submit synthetic email: `jean@example.test` | Email is detected and tokenized before OpenAI | |
| PII-03 | Privacy engine | Submit synthetic organization: `ABC Technologies` in a supported context | Organization is detected and tokenized | |
| PII-04 | Privacy engine | Submit synthetic phone: `+250 788 123 456` | Phone is detected and tokenized | |
| PII-05 | Privacy engine | Submit a test-only Luhn-valid sample: `4111 1111 1111 1111` | Card pattern is detected; do not use a real card | |
| PII-06 | Privacy engine | Submit a fabricated API-key-shaped string | API-key pattern is detected and masked | |
| PII-07 | Privacy engine | Send a prompt without supported PII | No sensitive entities are reported; normal AI answer is returned | |
| PII-08 | Privacy engine | Send an invalid synthetic card number | It is not classified as a payment card by the Luhn check | |
| PII-09 | Privacy engine | Repeat the same synthetic email twice in one prompt | Same request-local token is reused and both occurrences restore correctly | |
| PII-10 | Privacy engine | Ask the model to repeat a historical `[[GAI_...]]` token | Unknown token is displayed as `[sensitive information redacted]`, not the internal marker | |
| PII-11 | Privacy engine | Trigger provider/API failure with a harmless synthetic prompt | Fail-closed error; raw prompt is not sent as fallback | |
| PII-12 | Privacy engine | Exceed the documented request rate in a controlled test window | HTTP 429; no further OpenAI request is processed | |
| DATA-01 | Persistence | Inspect chat_messages after PII test | Only sanitized content/token placeholders are stored | |
| DATA-02 | Persistence | Inspect security_events after PII test | Only counts, categories, risk and metadata are stored; no original values or prompt text | |
| DATA-03 | Persistence | Open a previous conversation | UI restores the historical sanitized content and readable redaction labels; no raw PII is recovered from database | |
| DATA-04 | Persistence | Delete a conversation | Only the owner’s selected conversation and dependent records are deleted | |
| ADMIN-01 | Admin | Open Admin Control Center as admin | Dedicated admin shell opens | |
| ADMIN-02 | Admin | Change metric date range | Metrics/activity change to selected period | |
| ADMIN-03 | Admin | Filter and paginate audit log | Page navigation and filters preserve correct record counts | |
| ADMIN-04 | Admin | Export audit metadata | CSV contains metadata only; no prompt or sensitive values | |
| ADMIN-05 | Admin | Invite a standard test user | Invitation email is sent; no password is set or shown by admin | |
| ADMIN-06 | Admin | Promote/demote a test account | Role updates through trusted function; UI refreshes | |
| ADMIN-07 | Admin | Attempt to demote the last admin | HTTP 409 / safe rejection; at least one admin remains | |
| ADMIN-08 | Admin | Attempt to delete the last admin | HTTP 409 / safe rejection; at least one admin remains | |
| ADMIN-09 | Admin | Two admins concurrently try to remove each other's admin role | Serialized database guard prevents zero-admin state | |
| TEAM-01 | Project team | Create an unpublished test member | Member appears only in admin management | |
| TEAM-02 | Project team | Publish member with all private visibility toggles off | Public About page excludes registration number, phone and email | |
| TEAM-03 | Project team | Enable one visibility toggle | Only that approved field appears publicly | |
| TEAM-04 | Project team | Edit, reorder, unpublish and delete test member | Each operation persists and public page updates | |
| PROFILE-01 | Profile | Save personal and academic details | Owner sees updated information | |
| PROFILE-02 | Profile | Sign in as another user and query first user's private row | No data is returned | |
| PROFILE-03 | Profile | Upload a valid JPG/PNG/WebP below 2 MB | Image is saved to private user folder and shown with signed URL | |
| PROFILE-04 | Profile | Upload an unsupported file or file above 2 MB | Upload is rejected | |
| PROFILE-05 | Profile | Change password with wrong current password | Change is rejected | |
| PROFILE-06 | Profile | Sign out other sessions | Other sessions are revoked; current session remains active | |
| PROFILE-07 | Profile | Delete test user after typing DELETE | User Auth identity and cascading GuardAI records are removed; avatar is removed | |
| UX-01 | Responsive | Test 360px, 390px, 768px, 1024px and 1440px widths | No unintended horizontal scrolling; tables and cards remain usable | |
| UX-02 | Accessibility | Navigate key controls with keyboard | Focus visible; buttons/inputs have labels; dialogs can be dismissed by Escape when safe | |
| UX-03 | Motion | Enable operating-system reduced motion | Nonessential animations are reduced/disabled | |

## Test accounts and cleanup

- Use one dedicated standard-user test account and at least two trusted administrator test accounts for the final-admin tests.
- Use disposable test accounts for invite/deletion tests.
- Never delete the only real project administrator during testing.
- Never run destructive account tests against the only account that controls the Supabase project.
- Remove test accounts and synthetic team records after recording evidence.

# GuardAI quality sprint

## Design decisions

- Historical messages contain per-request placeholders because the original values and token map are intentionally not persisted.
- A historical placeholder is a one-way redaction marker, not a reversible reference. The UI translates it to a human-readable label; the server translates old markers to descriptive labels before a later model call.
- Markdown rendering is performed with `react-markdown` and `remark-gfm`. Raw HTML is not enabled.
- Titles are derived from sanitized text only.
- Deletion is performed through `SECURITY DEFINER` RPCs that scope every delete to `auth.uid()`. Browser clients do not receive direct DELETE grants on the underlying tables.
- Deleting a conversation also deletes its messages and linked security events. Clear History removes all conversations and all security events belonging to the current user.

## Analytics implication

Security metrics represent retained security events. When a user deletes a conversation or clears history, the related events are also deleted and will no longer contribute to the dashboard. This is an intentional user-history deletion policy and should be documented in the academic report.

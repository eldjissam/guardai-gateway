# Architecture decisions

## 001 — Mobile-first product experience

The phone layout is the primary design constraint. Navigation is a drawer on phones and a collapsible persistent sidebar on larger screens. Components must support touch-sized targets and safe-area insets.

## 002 — Supabase backend

Supabase Auth and PostgreSQL are used for identity and persistence. Supabase Edge Functions handle trusted business logic and external AI calls.

## 003 — Privacy-oriented persistence

Original prompts and the original-to-token map are transient. Sanitized conversation content may be persisted for chat history. Audit events store entity categories, counts, risk scores, status and timing only.

## 004 — Fail closed

If detection, masking, or secure AI processing fails, the system must not fall back to sending the original prompt. It must return a safe error.

## 005 — Honest security claims

The prototype detects a defined set of entity patterns. It cannot guarantee that all personally identifying or confidential context is found.

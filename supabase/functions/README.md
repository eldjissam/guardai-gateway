# Supabase Edge Functions

The authenticated `secure-chat` Edge Function will be added in the backend implementation phase. It must validate the user JWT, fail closed if detection or masking fails, call OpenAI only with the sanitized prompt, and persist metadata-only audit events.

# delete-my-account Edge Function

This function accepts only an authenticated user's own deletion request. It validates the bearer JWT with Supabase Auth, removes that user's single private avatar object, and then deletes the authenticated Auth user through the server-only Admin API. The existing foreign keys with `ON DELETE CASCADE` remove the associated GuardAI profile, private profile, sessions, messages, security events, and rate-limit row.

The function must remain server-side. Never put `SUPABASE_SECRET_KEYS`, a service-role key, or any secret key in frontend environment variables.

The function reads the current Supabase Edge Function environment variables (`SUPABASE_URL`, publishable/anon key, and a service/secret key). It supports the newer JSON `SUPABASE_SECRET_KEYS` variable using its `default` key or first configured key, consistent with the secure-chat function in this repository.

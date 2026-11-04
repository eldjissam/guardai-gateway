-- GuardAI Stage 5 schema and privilege checks (pgTAP).
-- Run against a local Supabase database after applying all migrations:
--   npx supabase test db

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
begin;
select plan(32);

select has_table('public', 'profiles', 'account profiles table exists');
select has_table('public', 'user_private_profiles', 'private profile table exists');
select has_table('public', 'chat_sessions', 'conversation table exists');
select has_table('public', 'chat_messages', 'message table exists');
select has_table('public', 'security_events', 'security audit table exists');
select has_table('public', 'project_team_members', 'project team table exists');

select ok((select relrowsecurity from pg_class where oid = to_regclass('public.profiles')), 'profiles has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = to_regclass('public.user_private_profiles')), 'private profiles has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = to_regclass('public.chat_sessions')), 'chat sessions has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = to_regclass('public.chat_messages')), 'chat messages has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = to_regclass('public.security_events')), 'security events has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = to_regclass('public.project_team_members')), 'project team has RLS enabled');

select ok(not has_table_privilege('anon', 'public.user_private_profiles', 'SELECT'), 'anonymous users cannot select private profiles');
select ok(has_table_privilege('authenticated', 'public.user_private_profiles', 'SELECT'), 'authenticated role has table grant; row access remains owner-scoped by RLS');
select ok(not has_table_privilege('authenticated', 'public.user_private_profiles', 'DELETE'), 'users cannot delete private-profile rows directly');
select ok(not exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'user_private_profiles'
    and (policyname ilike '%admin%' or coalesce(qual, '') ilike '%is_guardai_admin%')
), 'private profiles have no administrator read policy');
select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'user_private_profiles'
    and policyname = 'Users read their own private profile'
    and lower(coalesce(qual, '')) like '%auth.uid%'
    and lower(coalesce(qual, '')) like '%user_id%'
), 'private-profile read policy checks the authenticated owner');
select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'user_private_profiles'
    and policyname = 'Users update their own private profile'
    and lower(coalesce(qual, '')) like '%auth.uid%'
    and lower(coalesce(with_check, '')) like '%auth.uid%'
), 'private-profile update policy checks owner in USING and WITH CHECK');

select ok(not has_function_privilege('anon', 'public.is_guardai_admin()', 'EXECUTE'), 'anonymous users cannot call the admin-role helper');
select ok(has_function_privilege('authenticated', 'public.is_guardai_admin()', 'EXECUTE'), 'authenticated users can call the boolean admin-role helper');
select ok(not has_function_privilege('authenticated', 'public.guardai_set_profile_role(uuid,text)', 'EXECUTE'), 'browser users cannot mutate account roles');
select ok(has_function_privilege('service_role', 'public.guardai_set_profile_role(uuid,text)', 'EXECUTE'), 'trusted server role can call the serialized role function');
select ok(not has_function_privilege('authenticated', 'public.guardai_prepare_account_deletion(uuid)', 'EXECUTE'), 'browser users cannot invoke the account-deletion guard');
select ok(has_function_privilege('service_role', 'public.guardai_prepare_account_deletion(uuid)', 'EXECUTE'), 'trusted server role can invoke the account-deletion guard');

select ok(not has_table_privilege('anon', 'public.security_events', 'SELECT'), 'anonymous users cannot read security events');
select ok(not has_table_privilege('anon', 'public.project_team_members', 'SELECT'), 'anonymous users cannot read unpublished team records directly');
select ok(has_table_privilege('anon', 'public.published_project_team', 'SELECT'), 'public team view is readable without exposing the private base table');
select ok(not has_table_privilege('anon', 'public.profiles', 'SELECT'), 'anonymous users cannot read account profiles');

select ok((select not public from storage.buckets where id = 'user-avatars'), 'user avatar bucket is private');
select ok((select public from storage.buckets where id = 'guardai-team-avatars'), 'team avatar bucket is public only for approved public profiles');
select ok(not has_function_privilege('authenticated', 'public.consume_guardai_rate_limit(uuid,integer,integer)', 'EXECUTE'), 'browser users cannot modify server-side rate limits');
select ok(has_function_privilege('service_role', 'public.consume_guardai_rate_limit(uuid,integer,integer)', 'EXECUTE'), 'trusted server role can consume rate limits');

select * from finish();
rollback;

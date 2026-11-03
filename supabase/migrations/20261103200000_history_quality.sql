-- GuardAI history quality and user-controlled deletion.
-- Conversation content is already sanitized before persistence. This migration adds
-- safe titles and owner-scoped deletion RPCs for sessions and their audit events.

-- When a conversation is deleted, remove its associated messages and per-conversation
-- security events as well. This keeps Clear History semantics predictable for users.
alter table public.security_events
  drop constraint if exists security_events_session_id_fkey;

alter table public.security_events
  add constraint security_events_session_id_fkey
  foreign key (session_id)
  references public.chat_sessions (id)
  on delete cascade;

-- Backfill old generic titles from the first sanitized user message.
with first_user_turn as (
  select distinct on (session_id)
    session_id,
    sanitized_content
  from public.chat_messages
  where role = 'user'
  order by session_id, created_at asc
), cleaned as (
  select
    session_id,
    trim(regexp_replace(
      regexp_replace(sanitized_content, '\[\[GAI_[A-Z0-9_]+\]\]', ' ', 'g'),
      '\s+', ' ', 'g'
    )) as content
  from first_user_turn
), titled as (
  select
    session_id,
    case
      when content ~* '(draft|write|prepare|create|explain|summarize|analyze|compare|translate|design|build|review|plan|generate)' then
        trim(regexp_replace(
          content,
          '.*?((please )?(draft|write|prepare|create|explain|summarize|analyze|compare|translate|design|build|review|plan|generate)[^.!?]{0,70}).*',
          '\1',
          'i'
        ))
      else left(content, 58)
    end as title
  from cleaned
)
update public.chat_sessions as sessions
set title = coalesce(nullif(left(titled.title, 58), ''), 'New conversation')
from titled
where sessions.id = titled.session_id
  and sessions.title in ('Secure conversation', 'New conversation');

-- Permit only owner-scoped deletes. The functions below use SECURITY INVOKER, so
-- these grants and RLS policies remain in force during deletion.
grant delete on public.chat_sessions to authenticated;
grant delete on public.chat_messages to authenticated;
grant delete on public.security_events to authenticated;

drop policy if exists "Users delete own chat sessions" on public.chat_sessions;
create policy "Users delete own chat sessions"
  on public.chat_sessions for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users delete own chat messages" on public.chat_messages;
create policy "Users delete own chat messages"
  on public.chat_messages for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users delete own security events" on public.security_events;
create policy "Users delete own security events"
  on public.security_events for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Delete one conversation only when it belongs to the currently authenticated user.
create or replace function public.delete_guardai_session(p_session_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_id uuid;
begin
  if auth.uid() is null or p_session_id is null then
    return false;
  end if;

  delete from public.chat_sessions
  where id = p_session_id
    and user_id = auth.uid()
  returning id into deleted_id;

  return deleted_id is not null;
end;
$$;

-- Clear every conversation and security event belonging to the current user.
create or replace function public.delete_my_guardai_history()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  delete from public.security_events
  where user_id = auth.uid();

  delete from public.chat_sessions
  where user_id = auth.uid();

  return true;
end;
$$;

revoke all on function public.delete_guardai_session(uuid) from public, anon, authenticated;
revoke all on function public.delete_my_guardai_history() from public, anon, authenticated;
grant execute on function public.delete_guardai_session(uuid) to authenticated;
grant execute on function public.delete_my_guardai_history() to authenticated;

comment on function public.delete_guardai_session(uuid) is
  'Invokes an owner-scoped delete under the caller role; RLS remains enforced.';
comment on function public.delete_my_guardai_history() is
  'Invokes owner-scoped deletes under the caller role; grants and RLS remain enforced.';

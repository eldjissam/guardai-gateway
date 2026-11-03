-- GuardAI secure chat persistence.
-- Store only sanitized prompts/responses and security metadata. Never store raw prompts or token maps.

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Secure conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  sanitized_content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid references public.chat_sessions (id) on delete set null,
  risk_score integer not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
  entities_detected integer not null default 0 check (entities_detected >= 0),
  entity_breakdown jsonb not null default '{}'::jsonb,
  status text not null check (status in ('SUCCESS', 'FAILED')),
  processing_time_ms integer check (processing_time_ms is null or processing_time_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_guardai_sessions_user_updated
  on public.chat_sessions (user_id, updated_at desc);
create index if not exists idx_guardai_messages_session_created
  on public.chat_messages (session_id, created_at asc);
create index if not exists idx_guardai_messages_user
  on public.chat_messages (user_id, created_at desc);
create index if not exists idx_guardai_events_user_created
  on public.security_events (user_id, created_at desc);
create index if not exists idx_guardai_events_created
  on public.security_events (created_at desc);

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.security_events enable row level security;

-- Browser users can read only their own history and audit metadata.
-- Writes are intentionally performed only by the authenticated Edge Function using its server secret.
revoke all on public.chat_sessions from anon, authenticated;
revoke all on public.chat_messages from anon, authenticated;
revoke all on public.security_events from anon, authenticated;
grant select on public.chat_sessions to authenticated;
grant select on public.chat_messages to authenticated;
grant select on public.security_events to authenticated;

drop policy if exists "Users read own chat sessions" on public.chat_sessions;
create policy "Users read own chat sessions"
  on public.chat_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own chat messages" on public.chat_messages;
create policy "Users read own chat messages"
  on public.chat_messages for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own security events" on public.security_events;
create policy "Users read own security events"
  on public.security_events for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Admins read all security events" on public.security_events;
create policy "Admins read all security events"
  on public.security_events for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

create or replace function public.set_guardai_session_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_guardai_session_updated_at() from public, anon, authenticated;
drop trigger if exists guardai_sessions_updated_at on public.chat_sessions;
create trigger guardai_sessions_updated_at
before update on public.chat_sessions
for each row execute function public.set_guardai_session_updated_at();

comment on table public.chat_sessions is 'Conversation metadata. Titles are generic and must not contain raw prompt text.';
comment on table public.chat_messages is 'Only sanitized user prompts and sanitized AI responses are persisted.';
comment on table public.security_events is 'Audit metadata only. Never store raw prompts, original PII, or token mappings.';
comment on column public.chat_messages.sanitized_content is 'Content after GuardAI masking; original sensitive values are never persisted.';


-- Per-user rate limit to reduce accidental or abusive OpenAI usage.
-- The table has no browser grants or policies; only the Edge Function's server secret can use its RPC.
create table if not exists public.guardai_rate_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);
alter table public.guardai_rate_limits enable row level security;
revoke all on public.guardai_rate_limits from anon, authenticated;

create or replace function public.consume_guardai_rate_limit(
  p_user_id uuid,
  p_limit integer default 15,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.guardai_rate_limits (user_id, window_started_at, request_count)
  values (p_user_id, now(), 1)
  on conflict (user_id) do update
  set
    window_started_at = case
      when public.guardai_rate_limits.window_started_at <= now() - (p_window_seconds * interval '1 second')
        then now()
      else public.guardai_rate_limits.window_started_at
    end,
    request_count = case
      when public.guardai_rate_limits.window_started_at <= now() - (p_window_seconds * interval '1 second')
        then 1
      else public.guardai_rate_limits.request_count + 1
    end
  returning request_count into current_count;

  return current_count <= p_limit;
end;
$$;

revoke all on function public.consume_guardai_rate_limit(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_guardai_rate_limit(uuid, integer, integer) to service_role;

-- GuardAI Admin Operations and Project Team
-- Run after 20261103210000_admin_control_center.sql.
-- No prompts, token mappings, or original sensitive values are stored here.

-- Mirror account verification and last-sign-in metadata for admin reporting.
alter table public.profiles
  add column if not exists email_confirmed_at timestamptz,
  add column if not exists last_sign_in_at timestamptz;

update public.profiles p
set
  email = u.email,
  email_confirmed_at = u.email_confirmed_at,
  last_sign_in_at = u.last_sign_in_at
from auth.users u
where u.id = p.id;

create or replace function public.handle_guardai_profile_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, full_name, email, role, email_confirmed_at, last_sign_in_at
  ) values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    new.email,
    'user',
    new.email_confirmed_at,
    new.last_sign_in_at
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    email_confirmed_at = excluded.email_confirmed_at,
    last_sign_in_at = excluded.last_sign_in_at;
  return new;
end;
$$;

revoke all on function public.handle_guardai_profile_sync() from public, anon, authenticated;
drop trigger if exists on_guardai_profile_inserted on auth.users;
create trigger on_guardai_profile_inserted
after insert on auth.users
for each row execute function public.handle_guardai_profile_sync();
drop trigger if exists on_guardai_profile_email_updated on auth.users;
create trigger on_guardai_profile_email_updated
after update of email, raw_user_meta_data, email_confirmed_at, last_sign_in_at on auth.users
for each row execute function public.handle_guardai_profile_sync();

-- User-management summary cards. Only a verified GuardAI admin can call this RPC.
create or replace function public.get_guardai_admin_user_metrics()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_total bigint := 0;
  v_admins bigint := 0;
  v_users bigint := 0;
  v_pending bigint := 0;
  v_new_30d bigint := 0;
begin
  if not public.is_guardai_admin() then
    raise exception 'GuardAI administrator access required' using errcode = '42501';
  end if;

  select
    count(*),
    count(*) filter (where role = 'admin'),
    count(*) filter (where role = 'user'),
    count(*) filter (where email_confirmed_at is null),
    count(*) filter (where created_at >= now() - interval '30 days')
  into v_total, v_admins, v_users, v_pending, v_new_30d
  from public.profiles;

  return jsonb_build_object(
    'totalUsers', v_total,
    'adminUsers', v_admins,
    'regularUsers', v_users,
    'pendingInvitations', v_pending,
    'newUsersLast30Days', v_new_30d
  );
end;
$$;
revoke all on function public.get_guardai_admin_user_metrics() from public, anon;
grant execute on function public.get_guardai_admin_user_metrics() to authenticated;

-- Project team profiles are distinct from platform accounts. Public callers receive
-- only explicitly publishable fields through a restricted view.
create table if not exists public.project_team_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  registration_number text,
  university text,
  faculty text,
  programme text,
  role_title text not null,
  phone text,
  email text,
  bio text,
  photo_path text,
  show_registration_number boolean not null default false,
  show_phone boolean not null default false,
  show_email boolean not null default false,
  is_published boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_guardai_team_published_order
  on public.project_team_members (is_published, display_order, created_at);

alter table public.project_team_members enable row level security;
revoke all on public.project_team_members from anon, authenticated;
grant select, insert, update, delete on public.project_team_members to authenticated;

drop policy if exists "Admins manage project team members" on public.project_team_members;
create policy "Admins manage project team members"
  on public.project_team_members
  for all to authenticated
  using (public.is_guardai_admin())
  with check (public.is_guardai_admin());

create or replace view public.published_project_team
with (security_barrier = true)
as
select
  id,
  full_name,
  university,
  faculty,
  programme,
  role_title,
  bio,
  photo_path,
  case when show_registration_number then registration_number else null end as registration_number,
  case when show_phone then phone else null end as phone,
  case when show_email then email else null end as email,
  display_order
from public.project_team_members
where is_published = true;

grant select on public.published_project_team to anon, authenticated;

create or replace function public.set_guardai_team_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_guardai_team_updated_at() from public, anon, authenticated;
drop trigger if exists guardai_team_updated_at on public.project_team_members;
create trigger guardai_team_updated_at
before update on public.project_team_members
for each row execute function public.set_guardai_team_updated_at();

-- Public avatar delivery; all write operations remain administrator-only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guardai-team-avatars',
  'guardai-team-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "GuardAI admins upload team avatars" on storage.objects;
create policy "GuardAI admins upload team avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'guardai-team-avatars' and public.is_guardai_admin());

drop policy if exists "GuardAI admins update team avatars" on storage.objects;
create policy "GuardAI admins update team avatars"
  on storage.objects for update to authenticated
  using (bucket_id = 'guardai-team-avatars' and public.is_guardai_admin())
  with check (bucket_id = 'guardai-team-avatars' and public.is_guardai_admin());

drop policy if exists "GuardAI admins delete team avatars" on storage.objects;
create policy "GuardAI admins delete team avatars"
  on storage.objects for delete to authenticated
  using (bucket_id = 'guardai-team-avatars' and public.is_guardai_admin());

-- Replace the former one-date metrics RPC with an inclusive lower / exclusive upper bound.
drop function if exists public.get_guardai_admin_metrics(timestamptz);
create function public.get_guardai_admin_metrics(
  p_since timestamptz default (now() - interval '30 days'),
  p_until timestamptz default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_total bigint := 0;
  v_success bigint := 0;
  v_failed bigint := 0;
  v_entities bigint := 0;
  v_high_risk bigint := 0;
  v_average numeric := 0;
  v_active_users bigint := 0;
  v_registered_users bigint := 0;
  v_categories jsonb := '{}'::jsonb;
  v_activity jsonb := '[]'::jsonb;
  v_activity_start timestamptz;
  v_activity_end timestamptz;
begin
  if not public.is_guardai_admin() then
    raise exception 'GuardAI administrator access required' using errcode = '42501';
  end if;

  select
    count(*),
    count(*) filter (where e.status = 'SUCCESS'),
    count(*) filter (where e.status = 'FAILED'),
    coalesce(sum(e.entities_detected), 0),
    count(*) filter (where e.risk_level = 'HIGH'),
    coalesce(round(avg(e.risk_score)::numeric, 1), 0),
    count(distinct e.user_id)
  into v_total, v_success, v_failed, v_entities, v_high_risk, v_average, v_active_users
  from public.security_events e
  where (p_since is null or e.created_at >= p_since)
    and (p_until is null or e.created_at < p_until);

  select count(*) into v_registered_users from public.profiles;

  select coalesce(jsonb_object_agg(c.category_key, c.category_total), '{}'::jsonb)
  into v_categories
  from (
    select item.key as category_key,
      sum(case when item.value ~ '^[0-9]+$' then item.value::bigint else 0 end)::bigint as category_total
    from public.security_events e
    cross join lateral jsonb_each_text(coalesce(e.entity_breakdown, '{}'::jsonb)) as item(key, value)
    where (p_since is null or e.created_at >= p_since)
      and (p_until is null or e.created_at < p_until)
    group by item.key
  ) c;

  -- Chart the selected window, capped at 90 daily points. All time defaults to the latest 30 days.
  v_activity_end := coalesce(p_until, now());
  v_activity_start := coalesce(p_since, v_activity_end - interval '30 days');
  if v_activity_start < v_activity_end - interval '90 days' then
    v_activity_start := v_activity_end - interval '90 days';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('day', a.day, 'requests', a.requests) order by a.day),
    '[]'::jsonb
  )
  into v_activity
  from (
    select to_char(date_trunc('day', e.created_at), 'YYYY-MM-DD') as day,
      count(*)::bigint as requests
    from public.security_events e
    where e.created_at >= v_activity_start
      and e.created_at < v_activity_end
    group by date_trunc('day', e.created_at)
    order by date_trunc('day', e.created_at)
  ) a;

  return jsonb_build_object(
    'totalRequests', v_total,
    'protectedRequests', v_success,
    'failedRequests', v_failed,
    'entitiesDetected', v_entities,
    'highRiskRequests', v_high_risk,
    'averageRisk', v_average,
    'activeUsers', v_active_users,
    'registeredUsers', v_registered_users,
    'categories', v_categories,
    'dailyActivity', v_activity
  );
end;
$$;
revoke all on function public.get_guardai_admin_metrics(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_guardai_admin_metrics(timestamptz, timestamptz) to authenticated;

comment on table public.project_team_members is
  'Public-facing academic project team profiles. Private contact and registration data are excluded from the public view unless explicitly published.';
comment on view public.published_project_team is
  'Only published project team profiles and fields explicitly approved for public display.';

-- GuardAI Admin Control Center
-- Admin access is granted only by a trusted project owner through SQL.
-- The browser receives aggregate metrics and non-content audit metadata only.

-- Keep a small account directory for admins without exposing auth.users directly.
alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

-- Keep profile email synchronized when Supabase Auth changes an account email.
create or replace function public.handle_guardai_profile_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    new.email,
    'user'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

revoke all on function public.handle_guardai_profile_sync() from public, anon, authenticated;

-- Replace the earlier profile insert trigger so a new account is synchronized once.
drop trigger if exists on_guardai_auth_user_created on auth.users;
drop trigger if exists on_guardai_profile_inserted on auth.users;
create trigger on_guardai_profile_inserted
after insert on auth.users
for each row execute function public.handle_guardai_profile_sync();

drop trigger if exists on_guardai_profile_email_updated on auth.users;
create trigger on_guardai_profile_email_updated
after update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_guardai_profile_sync();

-- SECURITY DEFINER avoids recursive RLS when an admin policy checks the current role.
create or replace function public.is_guardai_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_guardai_admin() from public, anon;
grant execute on function public.is_guardai_admin() to authenticated;

-- Existing users retain their self-read policy. Admins can read the safe account directory.
drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_guardai_admin());

-- Replace the previous admin event policy with the non-recursive role helper.
drop policy if exists "Admins read all security events" on public.security_events;
create policy "Admins read all security events"
  on public.security_events
  for select
  to authenticated
  using (public.is_guardai_admin());

-- Server-side aggregate metrics. SECURITY INVOKER preserves caller RLS policies.
create or replace function public.get_guardai_admin_metrics(
  p_since timestamptz default (now() - interval '30 days')
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
begin
  if not public.is_guardai_admin() then
    raise exception 'GuardAI administrator access required'
      using errcode = '42501';
  end if;

  select
    count(*),
    count(*) filter (where e.status = 'SUCCESS'),
    count(*) filter (where e.status = 'FAILED'),
    coalesce(sum(e.entities_detected), 0),
    count(*) filter (where e.risk_level = 'HIGH'),
    coalesce(round(avg(e.risk_score)::numeric, 1), 0),
    count(distinct e.user_id)
  into
    v_total, v_success, v_failed, v_entities, v_high_risk, v_average, v_active_users
  from public.security_events e
  where p_since is null or e.created_at >= p_since;

  select count(*) into v_registered_users from public.profiles;

  select coalesce(jsonb_object_agg(category.category_key, category.category_total), '{}'::jsonb)
  into v_categories
  from (
    select
      item.key as category_key,
      sum(case when item.value ~ '^[0-9]+$' then item.value::bigint else 0 end)::bigint as category_total
    from public.security_events e
    cross join lateral jsonb_each_text(coalesce(e.entity_breakdown, '{}'::jsonb)) as item(key, value)
    where p_since is null or e.created_at >= p_since
    group by item.key
  ) as category;

  -- Keep the chart compact even when the user selects All time.
  select coalesce(
    jsonb_agg(jsonb_build_object('day', activity.day, 'requests', activity.requests) order by activity.day),
    '[]'::jsonb
  )
  into v_activity
  from (
    select
      to_char(date_trunc('day', e.created_at), 'YYYY-MM-DD') as day,
      count(*)::bigint as requests
    from public.security_events e
    where e.created_at >= now() - interval '30 days'
      and (p_since is null or e.created_at >= p_since)
    group by date_trunc('day', e.created_at)
    order by date_trunc('day', e.created_at)
  ) as activity;

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

revoke all on function public.get_guardai_admin_metrics(timestamptz) from public, anon;
grant execute on function public.get_guardai_admin_metrics(timestamptz) to authenticated;

comment on column public.profiles.email is
  'Account email mirrored from auth.users; readable by the owner and authorized GuardAI admins only.';
comment on function public.get_guardai_admin_metrics(timestamptz) is
  'Returns aggregate security-event analytics for verified GuardAI admins; no prompts or original PII are returned.';

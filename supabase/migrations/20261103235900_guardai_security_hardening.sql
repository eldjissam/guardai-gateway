-- GuardAI Stage 5: serialize administrator-role changes and account removals.
-- This closes the race where two concurrent requests could both observe two admins
-- and then remove/demote both, leaving the project without an administrator.
-- These RPCs are server-only and must be called by the trusted Edge Functions.

create or replace function public.guardai_set_profile_role(
  p_user_id uuid,
  p_role text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_role text;
  v_admin_count bigint;
begin
 if p_user_id is null
   or p_role is null
   or p_role not in ('user', 'admin') then
    raise exception 'Invalid account role operation.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(7348291042);

  select role into v_current_role
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  if v_current_role = 'admin' and p_role = 'user' then
    select count(*) into v_admin_count
    from public.profiles
    where role = 'admin';

    if v_admin_count <= 1 then
      raise exception 'LAST_GUARDAI_ADMIN: the final administrator cannot be demoted.'
        using errcode = 'P0001';
    end if;
  end if;

  update public.profiles set role = p_role where id = p_user_id;
  return true;
end;
$$;

create or replace function public.guardai_prepare_account_deletion(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_role text;
  v_admin_count bigint;
begin
  if p_user_id is null then
    raise exception 'A target account is required.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(7348291042);

  select role into v_current_role
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return false;
  end if;

  if v_current_role = 'admin' then
    select count(*) into v_admin_count
    from public.profiles
    where role = 'admin';

    if v_admin_count <= 1 then
      raise exception 'LAST_GUARDAI_ADMIN: the final administrator cannot be deleted.'
        using errcode = 'P0001';
    end if;

    -- Reserve the administrator slot before Auth Admin deletes the account.
    -- If Auth deletion fails, the account remains a regular user rather than risking
    -- a zero-admin state. A trusted administrator may explicitly promote it again.
    update public.profiles set role = 'user' where id = p_user_id;
  end if;

  return true;
end;
$$;

revoke all on function public.guardai_set_profile_role(uuid, text) from public, anon, authenticated;
revoke all on function public.guardai_prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.guardai_set_profile_role(uuid, text) to service_role;
grant execute on function public.guardai_prepare_account_deletion(uuid) to service_role;

comment on function public.guardai_set_profile_role(uuid, text) is
  'Server-only, transaction-serialized role update; prevents demotion of the final administrator.';
comment on function public.guardai_prepare_account_deletion(uuid) is
  'Server-only, transaction-serialized deletion guard; demotes an admin before Auth deletion and protects the final admin.';

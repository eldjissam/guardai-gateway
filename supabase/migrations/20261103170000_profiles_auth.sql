-- GuardAI authentication profile table.
-- Run this in Supabase SQL Editor or apply with the Supabase CLI.
-- The application never accepts a role from public sign-up metadata.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile name" on public.profiles;
create policy "Users can update their own profile name"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_guardai_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_guardai_user() from public;

drop trigger if exists on_guardai_auth_user_created on auth.users;
create trigger on_guardai_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_guardai_user();

comment on table public.profiles is 'GuardAI account profile; role is managed by trusted administrators, not public users.';
comment on column public.profiles.role is 'Set to user on sign-up. Only a trusted project owner may promote an administrator.';

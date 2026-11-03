-- GuardAI Stage 4.3: private user profile, avatar storage and owner-only access.
-- Personal / academic fields are deliberately separated from public/admin-readable profiles.

create table if not exists public.user_private_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone text check (phone is null or length(phone) <= 40),
  registration_number text check (registration_number is null or length(registration_number) <= 80),
  university text check (university is null or length(university) <= 160),
  faculty text check (faculty is null or length(faculty) <= 160),
  programme text check (programme is null or length(programme) <= 160),
  year_of_study text check (year_of_study is null or length(year_of_study) <= 60),
  bio text check (bio is null or length(bio) <= 500),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_private_profiles enable row level security;
revoke all on public.user_private_profiles from anon, authenticated;
grant select, insert, update on public.user_private_profiles to authenticated;

drop policy if exists "Users read their own private profile" on public.user_private_profiles;
create policy "Users read their own private profile"
  on public.user_private_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users create their own private profile" on public.user_private_profiles;
create policy "Users create their own private profile"
  on public.user_private_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own private profile" on public.user_private_profiles;
create policy "Users update their own private profile"
  on public.user_private_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Existing accounts receive an empty private profile. Their details remain in their own row only.
insert into public.user_private_profiles (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

-- Provision a private profile whenever the Auth -> profiles trigger creates a profile row.
create or replace function public.create_guardai_private_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_private_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_guardai_private_profile() from public, anon, authenticated;
drop trigger if exists guardai_private_profile_created on public.profiles;
create trigger guardai_private_profile_created
  after insert on public.profiles
  for each row execute function public.create_guardai_private_profile();

create or replace function public.set_guardai_private_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_guardai_private_profile_updated_at() from public, anon, authenticated;
drop trigger if exists guardai_private_profile_updated_at on public.user_private_profiles;
create trigger guardai_private_profile_updated_at
  before update on public.user_private_profiles
  for each row execute function public.set_guardai_private_profile_updated_at();

comment on table public.user_private_profiles is
  'Private user-owned profile information. Unlike public.profiles, administrators do not receive a read policy for this table.';
comment on column public.user_private_profiles.registration_number is
  'Private academic identifier; never exposed through the public project team page.';
comment on column public.user_private_profiles.avatar_path is
  'Storage object path in the private user-avatars bucket; never a public URL.';

-- Private avatar bucket: only the owner of the first folder (auth UID) may read/write/delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-avatars',
  'user-avatars',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[];

drop policy if exists "Users read their own GuardAI avatar" on storage.objects;
create policy "Users read their own GuardAI avatar"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users upload their own GuardAI avatar" on storage.objects;
create policy "Users upload their own GuardAI avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users update their own GuardAI avatar" on storage.objects;
create policy "Users update their own GuardAI avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users delete their own GuardAI avatar" on storage.objects;
create policy "Users delete their own GuardAI avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

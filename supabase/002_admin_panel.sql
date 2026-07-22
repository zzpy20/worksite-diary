-- Run this once in the Supabase SQL Editor, after schema.sql has already been run.
-- Adds an admin flag + a profiles table (so the admin panel can show user emails),
-- and extends entries/storage RLS policies so an admin can see and modify everyone's data.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Backfill profiles for any accounts created before this migration.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Auto-create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper used by RLS policies below (security definer so it can read
-- public.profiles regardless of the calling user's own row-level access).
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin(auth.uid()));

-- Extend entries policies: admins can see/update/delete every user's entries.
drop policy if exists "Users can view their own entries" on public.entries;
create policy "Users can view own or admins view all entries"
  on public.entries for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "Users can update their own entries" on public.entries;
create policy "Users can update own or admins update all entries"
  on public.entries for update
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "Users can delete their own entries" on public.entries;
create policy "Users can delete own or admins delete all entries"
  on public.entries for delete
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- Let admins remove photo files from storage (e.g. when deleting an entry).
create policy "Admins can delete any entry photo"
  on storage.objects for delete
  using (bucket_id = 'entry-photos' and public.is_admin(auth.uid()));

-- Finally, make your own account an admin:
update public.profiles set is_admin = true where email = 'zzpy20@gmail.com';

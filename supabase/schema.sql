-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  site text not null,
  start_time text,
  finish_time text,
  travel_allowance numeric,
  tasks text,
  photo_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.entries enable row level security;

create policy "Users can view their own entries"
  on public.entries for select
  using (auth.uid() = user_id);

create policy "Users can insert their own entries"
  on public.entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own entries"
  on public.entries for update
  using (auth.uid() = user_id);

create policy "Users can delete their own entries"
  on public.entries for delete
  using (auth.uid() = user_id);

-- Storage bucket for entry photos.
-- Create manually in the dashboard (Storage > New bucket > name "entry-photos",
-- Public bucket: ON), or run this if the storage schema is accessible to you:
insert into storage.buckets (id, name, public)
values ('entry-photos', 'entry-photos', true)
on conflict (id) do nothing;

create policy "Users can upload to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'entry-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can view entry photos (public bucket)"
  on storage.objects for select
  using (bucket_id = 'entry-photos');

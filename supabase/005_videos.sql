-- Run this once in the Supabase SQL Editor, after 004_address.sql.

alter table public.entries add column if not exists video_urls text[] not null default '{}';

-- Storage bucket for entry videos, mirroring entry-photos.
insert into storage.buckets (id, name, public)
values ('entry-videos', 'entry-videos', true)
on conflict (id) do nothing;

create policy "Users can upload videos to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'entry-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can view entry videos (public bucket)"
  on storage.objects for select
  using (bucket_id = 'entry-videos');

create policy "Admins can delete any entry video"
  on storage.objects for delete
  using (bucket_id = 'entry-videos' and public.is_admin(auth.uid()));

-- Run this once in the Supabase SQL Editor, after 003_comments_and_location.sql.

alter table public.entries add column if not exists address text;

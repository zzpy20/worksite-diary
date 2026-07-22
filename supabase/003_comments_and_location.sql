-- Run this once in the Supabase SQL Editor, after 002_admin_panel.sql.

-- "Travel allowance" (numeric) becomes a free-text "Comments" field.
alter table public.entries rename column travel_allowance to comments;
alter table public.entries alter column comments type text using comments::text;

-- Optional GPS location captured per entry.
alter table public.entries add column if not exists latitude double precision;
alter table public.entries add column if not exists longitude double precision;

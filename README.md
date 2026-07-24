# Worksite Diary

[中文说明](./README.zh-CN.md)

A simple iOS app for logging daily worksite activity — a hands-on cloud portfolio project covering mobile development, a Postgres backend, and a companion web admin panel.

## Features

- Email/password sign-in (Supabase Auth), with each user only ever seeing their own entries
- Log a daily entry: job site, date, start/finish time (native pickers), comments, tasks (quick-select presets or free text), and the site's GPS location — reverse-geocoded into a plain-English address
- Attach photos from your library or take them with the camera; tap any photo to view full-size, pinch or double-tap to zoom, and swipe between them
- Edit or delete any entry after saving
- Export an entry as an A4 PDF and share it through the native iOS share sheet
- A separate web admin panel for reviewing and editing every user's entries

## Tech stack

- [React Native](https://reactnative.dev/) + [Expo](https://expo.dev/) (SDK 54) + TypeScript
- [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation
- [Supabase](https://supabase.com/) (Postgres, Auth, Storage) as the backend — accessed directly from the client, secured with row-level security
- [EAS Build](https://docs.expo.dev/build/introduction/) for compiling and signing the iOS build

## Project structure

```
src/
  app/            expo-router screens (auth, tabs, entry detail/edit)
  components/     shared UI (entry form, photo viewer, themed primitives)
  lib/            Supabase client, data access, PDF export, formatting helpers
  types/          shared TypeScript types
supabase/         SQL migrations, run in order in the Supabase SQL Editor
```

## Getting started

1. `npm install`
2. Create a [Supabase](https://supabase.com/) project.
3. In the Supabase SQL Editor, run the files in `supabase/` **in order**: `schema.sql`, `002_admin_panel.sql`, `003_comments_and_location.sql`, `004_address.sql`.
4. Copy `.env.local.example` to `.env.local` and fill in your project's URL and anon/publishable key (Project Settings → API).
5. `npx expo start` and open with Expo Go, or `npx expo run:ios` for a standalone build on a connected device.

## Admin panel

A lightweight static web app (plain HTML/CSS/JS, no build step) lets an account flagged `is_admin` in the `profiles` table sign in and manage every user's entries — search, inline edit, photo removal, and delete. It talks to the same Supabase project directly, authorized entirely through row-level security policies (see `supabase/002_admin_panel.sql`), so it needs no backend server of its own.

Live at [worksite-diary.plos.xyz](https://worksite-diary.plos.xyz), deployed on a Cloudflare Worker. Its source isn't part of this repository — only the RLS policies that authorize it live here.

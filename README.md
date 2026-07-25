# Worksite Diary

[中文说明](./README.zh-CN.md)

A simple iOS app for logging daily worksite activity — a hands-on cloud portfolio project covering mobile development, a Postgres backend, and a companion web admin panel.

## Features

- A short first-run walkthrough on first launch covering the app's main features
- Email/password sign-in (Supabase Auth), with each user only ever seeing their own entries
- Log a daily entry: job site (autocompleted from your recent sites), date, start/finish time (native pickers), comments, tasks (quick-select presets or free text), and the site's GPS location — reverse-geocoded into a plain-English address
- Attach photos from your library or take them with the camera; tap any photo to view full-size, pinch or double-tap to zoom, and swipe to instantly jump between photos
- Duplicate an entry to start a new one prefilled with the same site, tasks, and comments
- Edit or delete any entry after saving
- Browse entries as a list or a photo grid, search by site or task, or jump straight to a date with the calendar picker in the header
- An hours summary — total hours this week or this month, broken down by site
- Works offline: entries created, edited, or deleted without a connection (or on a connection too poor to actually complete an upload) are queued on-device and synced automatically once you're back online, with a pending indicator until they do
- Export an entry as an A4 PDF and share it through the native iOS share sheet
- A separate web admin panel for reviewing and editing every user's entries

## Why these features

A few of these were prioritized for how the app is actually used on a worksite, not just as generic CRUD polish:

- **Recent-site autocomplete** — the same crew often works the same sites for days or weeks at a stretch; retyping the same job site name every day is friction worth removing.
- **Duplicate entry** — "same site as yesterday" is a common case. Prefilling a new entry from the last one saves the retyping; date, times, and photos are left blank since those are specific to the new day.
- **Hours summary** — total hours per site per week is basically a timesheet report, and the data was already being captured by every entry — it just needed aggregation and a screen to show it.
- **Offline-first writes** — worksites often have poor or no signal. Without this, saving an entry with no connection just failed outright. Queuing writes locally and syncing automatically once back online addresses that directly, rather than just handling it as an edge case.

## Tech stack

- [React Native](https://reactnative.dev/) + [Expo](https://expo.dev/) (SDK 54) + TypeScript
- [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation
- [Supabase](https://supabase.com/) (Postgres, Auth, Storage) as the backend — accessed directly from the client, secured with row-level security
- Offline-first writes: an on-device queue ([`@react-native-async-storage/async-storage`](https://react-native-async-storage.github.io/async-storage/)) synced automatically on reconnect ([`@react-native-community/netinfo`](https://github.com/react-native-netinfo/react-native-netinfo))
- [EAS Build](https://docs.expo.dev/build/introduction/) for compiling and signing the iOS build

## Project structure

```
src/
  app/            expo-router screens (auth, tabs, entry detail/edit, hours summary)
  components/     shared UI (entry form, photo viewer, themed primitives)
  lib/            Supabase client, data access, offline sync queue, PDF export, formatting helpers
  types/          shared TypeScript types
supabase/         SQL migrations, run in order in the Supabase SQL Editor
```

## Getting started

1. `npm install`
2. Create a [Supabase](https://supabase.com/) project.
3. In the Supabase SQL Editor, run the files in `supabase/` **in order**: `schema.sql`, `002_admin_panel.sql`, `003_comments_and_location.sql`, `004_address.sql`.
4. Copy `.env.local.example` to `.env.local` and fill in your project's URL and anon/publishable key (Project Settings → API).
5. `npx expo start` and open with Expo Go, or `npx expo run:ios` for a standalone build on a connected device.

## Offline support

Creating, editing, and deleting entries all work without a connection. Changes are queued on-device — new entries get a client-generated ID up front, so there's nothing to reconcile after syncing — and pushed to Supabase automatically once connectivity returns. Entries with unsynced changes show a small pending indicator in the list, grid, and detail view.

This covers writes only: browsing still needs a connection on first load, since previously-fetched entries aren't cached for fully offline reading. An offline edit to an already-synced entry is queued safely, but that entry's own detail screen won't reflect the change until it syncs — only brand-new offline-created entries render entirely from local data in the meantime.

A save doesn't just trust that a photo upload succeeded — it's verified against storage afterward, since a flaky connection can let the upload call resolve without an error even when the file didn't fully land. If that verification fails, the save falls back to the same offline queue automatically rather than failing outright, so a save never gets lost to a bad connection, only to being genuinely offline in a way that still queues it for later.

## Debugging note: photos missing after a quick save

Worth documenting since it took several passes to actually nail: saving an entry (especially with multiple photos, or right after picking them) could navigate away successfully but without the photos actually attached — no error, no warning, just missing. The investigation went through a few wrong turns before landing on the real cause:

1. **First hypothesis: flaky uploads.** Supabase's storage `upload()` call can resolve without an error on a bad connection even if the file didn't fully land. Fix: added a verification step after upload (a `HEAD` request checking the file existed and its `content-length` matched), falling back to the offline queue if it failed. This didn't fix the reported bug.
2. **Checked it didn't conflict with offline support.** Traced through the offline path to confirm a genuinely offline save still bypasses upload entirely (checked up front) and queues correctly, and made verification failures on a *flaky* (not fully offline) connection fall back to the same queue too, rather than a hard error. Still didn't fix it.
3. **Second hypothesis: navigating away mid-save.** The Save/Cancel buttons were disabled while saving, but that doesn't stop iOS's swipe-back gesture or Android's hardware back button, both of which bypass on-screen buttons entirely. Added explicit gesture/back-button blocking while a save is in flight, plus a spinner so a slow multi-photo upload doesn't look stalled. Still reported as broken.
4. **Diagnosis, this time with actual signal.** Asked whether a "Saved offline" alert appeared (it hadn't) and whether this was tested on a fresh install (it wasn't). No alert meant the save was taking the *normal successful* online path — just without the newly-picked photos in it. That ruled out uploads and navigation entirely and pointed at a timing gap between the photo picker finishing and the form's own state actually including the new photos, with Save becoming tappable in between.
5. **The actual fix.** The photo-picker functions (library and camera) now track their own in-flight state for their *entire* duration — permission request, the native picker, and the state update that adds the picked photos to the form — and the Save button (plus a defensive check inside the save handler itself) stays disabled until that's fully settled. This closes the gap outright rather than depending on how fast any of those steps happen to run. Also replaced the upload verification's `HEAD`/`content-length` check with a query against Supabase Storage's own `list()` API, since the original check depended on CDN header behavior that couldn't be fully verified and may have been silently failing on every upload.

## Admin panel

A lightweight static web app (plain HTML/CSS/JS, no build step) lets an account flagged `is_admin` in the `profiles` table sign in and manage every user's entries — search, inline edit, photo removal, and delete. It talks to the same Supabase project directly, authorized entirely through row-level security policies (see `supabase/002_admin_panel.sql`), so it needs no backend server of its own.

Live at [worksite-diary.plos.xyz](https://worksite-diary.plos.xyz), deployed on a Cloudflare Worker. Its source isn't part of this repository — only the RLS policies that authorize it live here.

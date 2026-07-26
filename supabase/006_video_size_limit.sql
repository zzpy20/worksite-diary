-- Run this once in the Supabase SQL Editor, after 005_videos.sql.

-- Supabase enforces whichever is smaller of the project-wide upload limit and a
-- bucket's own file_size_limit. The free tier's project-wide limit is a hard 50MB
-- regardless of what's set here, so this just brings the bucket's own limit in line
-- with that reality (up from the platform default, which is smaller still). If you
-- upgrade plans and raise the project-wide limit later, bump this to match — the
-- client-side check in lib/entries.ts (MAX_UPLOAD_BYTES.video) should move with it.
update storage.buckets set file_size_limit = 47185920 where id = 'entry-videos'; -- 45MB

-- Run this once in the Supabase SQL Editor, after 005_videos.sql.

-- Supabase buckets default to a small size limit (commonly 50MB) unless raised
-- explicitly. A duration-capped recording usually fits under that, but an existing
-- library video (uncompressed, no duration cap on selection) often doesn't — raise
-- the entry-videos bucket to 200MB, matching the client-side check in lib/entries.ts.
update storage.buckets set file_size_limit = 209715200 where id = 'entry-videos';

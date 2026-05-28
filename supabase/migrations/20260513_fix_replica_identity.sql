-- Fix Supabase Realtime: Enable full row replication
-- This ensures UPDATE/DELETE events include all columns (including room_id)
-- so Supabase Realtime can properly filter events by room_id

-- Enable REPLICA IDENTITY FULL for watch_party_participants
-- This allows real-time updates for permissions, kicks, and leave events
ALTER TABLE watch_party_participants REPLICA IDENTITY FULL;

-- Enable REPLICA IDENTITY FULL for watch_party_playlist
-- This allows real-time updates when playlist order changes
ALTER TABLE watch_party_playlist REPLICA IDENTITY FULL;

-- Verify the changes (optional, for manual verification)
-- Run: SELECT relname, relreplident FROM pg_class WHERE relname IN ('watch_party_participants', 'watch_party_playlist');
-- Expected: relreplident = 'f' (FULL) instead of 'd' (DEFAULT)

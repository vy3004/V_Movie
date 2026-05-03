-- =====================================================
-- FINAL: Optimized Room Cleanup (No Performance Impact)
-- =====================================================
-- Chỉ dọn phòng rỗng, KHÔNG track user activity
-- =====================================================

-- Xóa function cũ (nếu có)
DROP FUNCTION IF EXISTS cleanup_ghost_participants() CASCADE;

-- Xóa cron job cũ (nếu có)
SELECT cron.unschedule('cleanup-ghost-participants') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-ghost-participants'
);

-- Tạo function mới: Chỉ dọn phòng rỗng
CREATE OR REPLACE FUNCTION cleanup_empty_rooms()
RETURNS json
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_rooms integer := 0;
  room_record record;
BEGIN
  RAISE NOTICE '[ROOM_CLEANUP] Starting cleanup of empty rooms';

  -- Tìm các phòng có participant_count = 0 hoặc không có participant nào
  FOR room_record IN
    SELECT r.id, r.room_code, r.participant_count
    FROM public.watch_party_rooms r
    WHERE r.is_active = true
      AND (
        r.participant_count = 0
        OR NOT EXISTS (
          SELECT 1 FROM public.watch_party_participants p
          WHERE p.room_id = r.id
        )
      )
  LOOP
    -- Xóa phòng (CASCADE sẽ xóa messages, playlist)
    DELETE FROM public.watch_party_rooms
    WHERE id = room_record.id;

    deleted_rooms := deleted_rooms + 1;

    RAISE NOTICE '[ROOM_CLEANUP] Deleted empty room: id=%, code=%, count=%',
      room_record.id,
      room_record.room_code,
      room_record.participant_count;
  END LOOP;

  RAISE NOTICE '[ROOM_CLEANUP] Completed: % rooms deleted', deleted_rooms;

  RETURN json_build_object(
    'success', true,
    'deleted_rooms', deleted_rooms,
    'timestamp', now()
  );
END;
$$;

-- Setup cron: Chạy mỗi 1 giờ
SELECT cron.schedule(
  'cleanup-empty-rooms',
  '0 * * * *',  -- Mỗi giờ
  $$SELECT cleanup_empty_rooms()$$
);

-- Test function
SELECT cleanup_empty_rooms();

-- Verify cron job
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'cleanup-empty-rooms';

COMMENT ON FUNCTION cleanup_empty_rooms() IS
'Cleanup empty watch party rooms (participant_count = 0).
Runs every hour via pg_cron as safety net.
Main cleanup happens via trigger when user leaves.';

-- =====================================================
-- Update cleanup_empty_rooms() for Edge janitor invocation
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_empty_rooms()
RETURNS json
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  synced_rooms integer := 0;
  deleted_rooms integer := 0;
BEGIN
  WITH participant_counts AS (
    SELECT p.room_id, COUNT(*)::integer AS participant_count
    FROM public.watch_party_participants p
    WHERE p.status = 'approved'
    GROUP BY p.room_id
  ),
  updated_rooms AS (
    UPDATE public.watch_party_rooms r
    SET
      participant_count = COALESCE(pc.participant_count, 0),
      updated_at = timezone('utc'::text, now())
    FROM (
      SELECT
        r2.id,
        COALESCE(pc2.participant_count, 0) AS participant_count
      FROM public.watch_party_rooms r2
      LEFT JOIN participant_counts pc2 ON pc2.room_id = r2.id
      WHERE r2.is_active = true
        AND COALESCE(r2.participant_count, 0) <> COALESCE(pc2.participant_count, 0)
    ) pc
    WHERE r.id = pc.id
    RETURNING r.id
  )
  SELECT COUNT(*) INTO synced_rooms FROM updated_rooms;

  WITH deletion_candidates AS (
    SELECT r.id
    FROM public.watch_party_rooms r
    WHERE r.is_active = true
      AND COALESCE(r.participant_count, 0) = 0
    FOR UPDATE SKIP LOCKED
  ),
  deleted AS (
    DELETE FROM public.watch_party_rooms r
    USING deletion_candidates c
    WHERE r.id = c.id
      AND NOT EXISTS (
        SELECT 1
        FROM public.watch_party_participants p
        WHERE p.room_id = r.id
          AND p.status = 'approved'
      )
    RETURNING r.id
  )
  SELECT COUNT(*) INTO deleted_rooms FROM deleted;

  RETURN json_build_object(
    'success', true,
    'synced_rooms', synced_rooms,
    'deleted_rooms', deleted_rooms,
    'timestamp', now()
  );
END;
$$;

SELECT cron.unschedule('cleanup-empty-rooms') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-empty-rooms'
);

COMMENT ON FUNCTION cleanup_empty_rooms() IS
'Sync participant_count from participants table and remove active rooms with zero participants. Invoked by Edge janitor function.';

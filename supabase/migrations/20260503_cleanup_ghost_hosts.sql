-- Migration: Cleanup Ghost Hosts Function
-- Allows clients to remove ghost hosts (hosts without presence)
-- Created: 2026-05-03

CREATE OR REPLACE FUNCTION cleanup_ghost_hosts(
  p_room_id UUID,
  p_ghost_host_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  -- Delete ghost hosts by IDs
  DELETE FROM watch_party_participants
  WHERE room_id = p_room_id
    AND id = ANY(p_ghost_host_ids)
    AND role = 'host';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % ghost hosts from room %', v_deleted_count, p_room_id;

  RETURN v_deleted_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_ghost_hosts(UUID, UUID[]) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION cleanup_ghost_hosts IS
'Removes ghost hosts (hosts without presence) from a room.
Used during host succession to clean up offline hosts before promoting a new one.
Returns the number of hosts deleted.';

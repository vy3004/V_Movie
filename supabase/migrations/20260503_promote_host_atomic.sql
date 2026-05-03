-- Migration: Atomic Host Promotion Function
-- Fixes race condition where multiple clients can promote themselves to host simultaneously
-- Created: 2026-05-03

CREATE OR REPLACE FUNCTION promote_to_host_atomic(
  p_room_id UUID,
  p_candidate_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_host RECORD;
  v_candidate RECORD;
  v_promoted BOOLEAN := FALSE;
BEGIN
  -- Lock the participants table for this room to prevent race conditions
  -- This ensures only one client can execute this function at a time per room
  PERFORM pg_advisory_xact_lock(hashtext(p_room_id::text));

  -- Check if candidate exists and is approved
  SELECT * INTO v_candidate
  FROM watch_party_participants
  WHERE id = p_candidate_id
    AND room_id = p_room_id
    AND status = 'approved'
  LIMIT 1;

  IF v_candidate IS NULL THEN
    RAISE EXCEPTION 'Candidate not found or not approved';
  END IF;

  -- Check if there's already an active host
  SELECT * INTO v_current_host
  FROM watch_party_participants
  WHERE room_id = p_room_id
    AND role = 'host'
    AND status = 'approved'
  LIMIT 1;

  -- Only promote if no host exists
  IF v_current_host IS NULL THEN
    -- Promote candidate to host
    UPDATE watch_party_participants
    SET
      role = 'host',
      permissions = jsonb_build_object(
        'can_control_media', true,
        'can_manage_users', true
      ),
      updated_at = NOW()
    WHERE id = p_candidate_id
      AND room_id = p_room_id
      AND status = 'approved';

    -- Check if update was successful
    IF FOUND THEN
      v_promoted := TRUE;

      -- Log the promotion for debugging
      RAISE NOTICE 'User % promoted to host in room %', p_candidate_id, p_room_id;
    END IF;
  ELSE
    -- Host already exists, log for debugging
    RAISE NOTICE 'Host already exists in room %, candidate % not promoted', p_room_id, p_candidate_id;
  END IF;

  RETURN v_promoted;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION promote_to_host_atomic(UUID, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION promote_to_host_atomic IS
'Atomically promotes a participant to host role if no host exists.
Uses advisory lock to prevent race conditions between multiple clients.
Returns TRUE if promotion succeeded, FALSE if host already exists.';

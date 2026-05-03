-- Migration: Add trigger to enforce max_participants constraint
-- This prevents race condition when multiple users join simultaneously

-- Function to check room capacity before insert/update
CREATE OR REPLACE FUNCTION check_room_capacity()
RETURNS TRIGGER AS $$
DECLARE
  room_max INT;
  current_count INT;
  room_is_private BOOLEAN;
BEGIN
  -- Get room info
  SELECT max_participants, is_private INTO room_max, room_is_private
  FROM watch_party_rooms
  WHERE id = NEW.room_id AND is_active = true;

  -- If room not found or inactive, reject
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found or inactive';
  END IF;

  -- Only check capacity for approved participants in public rooms
  IF NEW.status = 'approved' AND NOT room_is_private THEN
    -- Count current approved participants (excluding the one being inserted/updated)
    SELECT COUNT(*) INTO current_count
    FROM watch_party_participants
    WHERE room_id = NEW.room_id
      AND status = 'approved'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

    -- Check if room is full
    IF current_count >= room_max THEN
      RAISE EXCEPTION 'Room is full (max: %, current: %)', room_max, current_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS enforce_room_capacity ON watch_party_participants;

CREATE TRIGGER enforce_room_capacity
  BEFORE INSERT OR UPDATE OF status ON watch_party_participants
  FOR EACH ROW
  EXECUTE FUNCTION check_room_capacity();

-- Add comment
COMMENT ON FUNCTION check_room_capacity() IS 'Enforces max_participants constraint to prevent race conditions';
COMMENT ON TRIGGER enforce_room_capacity ON watch_party_participants IS 'Prevents room from exceeding max_participants';

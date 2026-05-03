-- Rollback migration for room capacity trigger

DROP TRIGGER IF EXISTS enforce_room_capacity ON watch_party_participants;
DROP FUNCTION IF EXISTS check_room_capacity();

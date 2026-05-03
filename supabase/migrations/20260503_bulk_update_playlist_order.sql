-- Create RPC function for bulk updating playlist order
-- This prevents N+1 query problem when reordering playlist items

CREATE OR REPLACE FUNCTION update_playlist_order(
  items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item jsonb;
BEGIN
  -- Loop through each item and update its sort_order
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    UPDATE watch_party_playlist
    SET sort_order = (item->>'sort_order')::integer
    WHERE id = (item->>'id')::uuid;
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_playlist_order(jsonb) TO authenticated;

COMMENT ON FUNCTION update_playlist_order IS 'Bulk update sort_order for playlist items to avoid N+1 queries';

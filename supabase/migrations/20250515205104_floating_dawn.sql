/*
  # Fix Ambiguous ID Column Reference in get_invitation_status Function
  
  1. Changes
    - Update get_invitation_status function to use table aliases for all column references
    - Fix ambiguous 'id' column reference that was causing errors
    
  2. Security
    - Maintain SECURITY DEFINER setting
    - Keep existing permission checks
*/

-- Drop existing function
DROP FUNCTION IF EXISTS public.get_invitation_status(uuid);

-- Recreate function with explicit column references
CREATE OR REPLACE FUNCTION public.get_invitation_status(
  invitation_uuid uuid
)
RETURNS TABLE (
  id uuid,
  status text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return empty set if invitation doesn't exist
  IF NOT EXISTS(SELECT 1 FROM invitations WHERE invitations.id = invitation_uuid) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    invitation_logs.id,
    invitation_logs.status,
    invitation_logs.details,
    invitation_logs.created_at
  FROM invitation_logs
  WHERE invitation_logs.invitation_id = invitation_uuid
  ORDER BY invitation_logs.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_invitation_status(uuid) TO authenticated;

-- Add function comment
COMMENT ON FUNCTION public.get_invitation_status IS
'Retrieves the status history for an invitation with explicit column references to avoid ambiguity';
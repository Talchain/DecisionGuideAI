/*
  # Fix teams recursion with RPC function
  
  1. Changes
    - Add get_user_teams RPC function that safely returns teams with members
    - Function uses SECURITY DEFINER to avoid RLS recursion
    - Returns teams created by user OR where user is a member
    
  2. Security
    - Function validates user authentication
    - Only returns teams user has access to
    - Uses SECURITY DEFINER carefully
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_user_teams;

-- Create RPC function to get teams with members
CREATE OR REPLACE FUNCTION get_user_teams()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  members jsonb
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  requesting_user_id uuid;
BEGIN
  -- Get authenticated user ID
  requesting_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF requesting_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Return teams where user is creator OR member
  RETURN QUERY
  SELECT DISTINCT
    t.id,
    t.name,
    t.description,
    t.created_by,
    t.created_at,
    t.updated_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', tm.id,
            'team_id', tm.team_id,
            'user_id', tm.user_id,
            'role', tm.role,
            'joined_at', tm.joined_at
          )
        )
        FROM team_members tm
        WHERE tm.team_id = t.id
      ),
      '[]'::jsonb
    ) as members
  FROM teams t
  LEFT JOIN team_members tm ON t.id = tm.team_id
  WHERE t.created_by = requesting_user_id
  OR tm.user_id = requesting_user_id;
END;
$$;
/*
  # Fix User Directory Function
  
  1. Changes
    - Drop existing function first to avoid return type error
    - Recreate function with proper type definitions
    - Add search functionality
    
  2. Security
    - Function uses SECURITY DEFINER
    - Only accessible to authenticated users
*/

-- Drop the existing function first
DROP FUNCTION IF EXISTS get_user_directory(text);

-- Create the function with proper type definitions
CREATE OR REPLACE FUNCTION get_user_directory(search_term text)
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    (u.email)::text as email,
    (up.first_name)::text as first_name,
    (up.last_name)::text as last_name
  FROM auth.users u
  LEFT JOIN user_profiles up ON u.id = up.id
  WHERE 
    CASE 
      WHEN search_term IS NULL OR search_term = '' THEN true
      ELSE 
        u.email ILIKE '%' || search_term || '%' OR
        COALESCE(up.first_name, '') ILIKE '%' || search_term || '%' OR
        COALESCE(up.last_name, '') ILIKE '%' || search_term || '%'
    END
  ORDER BY 
    CASE 
      WHEN u.email ILIKE search_term || '%' THEN 0
      WHEN COALESCE(up.first_name, '') ILIKE search_term || '%' THEN 1
      WHEN COALESCE(up.last_name, '') ILIKE search_term || '%' THEN 2
      ELSE 3
    END,
    u.email;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_directory(text) TO authenticated;

-- Add comment explaining function usage
COMMENT ON FUNCTION get_user_directory IS 
'Returns a list of users matching the search term, including their profile information.
Used for user directory search in team member management.';
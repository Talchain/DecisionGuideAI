/*
  # Fix user directory RPC function type casting

  1. Changes
    - Update get_user_directory function to ensure proper type casting
    - Cast all relevant columns to text type
    - Ensure function result type matches query structure

  2. Security
    - Maintain existing RLS policies
    - Function remains accessible to authenticated users only
*/

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
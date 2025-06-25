/*
  # Create slug validation function

  1. New Functions
    - `check_organisation_slug_exists` - Checks if an organisation slug already exists
      - Uses SECURITY DEFINER to bypass RLS policies
      - Returns boolean indicating if slug exists
      - Prevents infinite recursion in RLS policies

  2. Security
    - Grant execute permissions to authenticated and anon users
    - Function runs with elevated privileges to avoid RLS recursion
*/

CREATE OR REPLACE FUNCTION public.check_organisation_slug_exists(p_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.organisations WHERE slug = p_slug);
END;
$$;

ALTER FUNCTION public.check_organisation_slug_exists(TEXT) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.check_organisation_slug_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_organisation_slug_exists(TEXT) TO anon;
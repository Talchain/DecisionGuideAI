/*
  # Add Invitations Table and User Directory Function
  
  1. New Tables
    - `invitations`: Stores invited email addresses and their status
  
  2. New Functions
    - `get_user_directory`: Returns all profiles and invitations for directory search
  
  3. Security
    - Enable RLS on invitations table
    - Add policies for authenticated users
    - SECURITY DEFINER function for safe access
*/

-- Create invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('pending','accepted','expired')),
  invited_by uuid REFERENCES auth.users(id),
  UNIQUE(email)
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for invitations
CREATE POLICY "Enable read for authenticated users"
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON public.invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (invited_by = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_at ON public.invitations(invited_at);

-- Create function to get user directory
CREATE OR REPLACE FUNCTION public.get_user_directory(search_term text DEFAULT '')
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  avatar_url text,
  source text,
  invited_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  search_pattern text;
BEGIN
  -- Prepare search pattern for ILIKE
  IF search_term IS NULL OR search_term = '' THEN
    search_pattern := '%';
  ELSE
    search_pattern := '%' || search_term || '%';
  END IF;

  -- Return profiles and invitations matching the search
  RETURN QUERY
  -- Get profiles
  SELECT 
    p.id,
    u.email,
    p.first_name,
    p.last_name,
    NULL::text as avatar_url,
    'profile'::text as source,
    NULL::timestamptz as invited_at
  FROM user_profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE 
    u.email ILIKE search_pattern
    OR COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '') ILIKE search_pattern
  
  UNION ALL
  
  -- Get invitations
  SELECT
    i.id,
    i.email,
    NULL::text as first_name,
    NULL::text as last_name,
    NULL::text as avatar_url,
    'invitation'::text as source,
    i.invited_at
  FROM invitations i
  WHERE 
    i.email ILIKE search_pattern
    AND i.status = 'pending';
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_directory(text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_user_directory IS 
'Returns a combined list of user profiles and pending invitations for directory search.';